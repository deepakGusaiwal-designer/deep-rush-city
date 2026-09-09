import * as THREE from 'three';
import { VehicleController } from './VehicleController';
import { TrafficManager, TrafficCar } from './TrafficManager';
import { PlayerController } from '../player/PlayerController';
import { PlayerCharacter } from '../player/PlayerCharacter';
import { PlayerMode } from '../player/PlayerState';
import { audioManager } from './AudioManager';
import { LightingManager } from './LightingManager';
import { VehicleModelId } from '../types/game';
import { VEHICLE_LIST } from '../data/vehicles';

export interface NearbyVehicleInfo {
  type: 'player_car' | 'traffic_car';
  name: string;
  position: THREE.Vector3;
  heading: number;
  trafficCar?: TrafficCar;
  modelId?: VehicleModelId;
  distance: number;
}

export class VehicleInteraction {
  private playerController: PlayerController;
  private playerCharacter: PlayerCharacter;
  private vehicleController: VehicleController;
  private trafficManager: TrafficManager;
  private lightingManager?: LightingManager;

  public static readonly INTERACTION_RADIUS = 4.8;
  public nearbyVehicle: NearbyVehicleInfo | null = null;

  // Transition states
  private transitionTimer: number = 0;
  private transitionDuration: number = 1.15;
  private transitionStartPos = new THREE.Vector3();
  private transitionTargetPos = new THREE.Vector3();
  private activeTargetVehicle: NearbyVehicleInfo | null = null;

  private doorSlamPlayed: boolean = false;
  private ignitionPlayed: boolean = false;
  private characterHidden: boolean = false;

  constructor(
    playerController: PlayerController,
    playerCharacter: PlayerCharacter,
    vehicleController: VehicleController,
    trafficManager: TrafficManager,
    lightingManager?: LightingManager
  ) {
    this.playerController = playerController;
    this.playerCharacter = playerCharacter;
    this.vehicleController = vehicleController;
    this.trafficManager = trafficManager;
    this.lightingManager = lightingManager;
  }

  // Scan proximity to player car and all active traffic cars
  public checkProximity(playerPos: THREE.Vector3): NearbyVehicleInfo | null {
    let closest: NearbyVehicleInfo | null = null;
    let minDistance = VehicleInteraction.INTERACTION_RADIUS;

    // 1. Check Player's own parked car
    const distToPlayerCar = playerPos.distanceTo(this.vehicleController.position);
    if (distToPlayerCar < minDistance) {
      minDistance = distToPlayerCar;
      closest = {
        type: 'player_car',
        name: this.vehicleController.getStats().name,
        position: this.vehicleController.position,
        heading: this.vehicleController.heading,
        modelId: this.vehicleController.getCurrentVehicleId(),
        distance: distToPlayerCar,
      };
    }

    // 2. Check AI Traffic Cars
    for (let i = 0; i < this.trafficManager.trafficCars.length; i++) {
      const tCar = this.trafficManager.trafficCars[i];
      const dist = playerPos.distanceTo(tCar.position);
      if (dist < minDistance) {
        minDistance = dist;
        const vInfo = VEHICLE_LIST.find((v) => v.id === tCar.modelId);
        const carName = vInfo ? vInfo.name : tCar.modelId;
        closest = {
          type: 'traffic_car',
          name: carName,
          position: tCar.position,
          heading: tCar.heading,
          trafficCar: tCar,
          modelId: tCar.modelId,
          distance: dist,
        };
      }
    }

    this.nearbyVehicle = closest;
    return closest;
  }

  // Calculate driver's door position for any car
  public getDriverDoorPosition(carPos: THREE.Vector3, heading: number, halfWidth: number = 1.0): THREE.Vector3 {
    // Left vector relative to heading
    const leftX = -Math.cos(heading);
    const leftZ = Math.sin(heading);
    return new THREE.Vector3(
      carPos.x + leftX * (halfWidth + 0.85),
      0.05,
      carPos.z + leftZ * (halfWidth + 0.85)
    );
  }

  public getActiveTargetVehicle(): NearbyVehicleInfo | null {
    return this.activeTargetVehicle;
  }

  public getEnterProgress(): number {
    return Math.min(1.0, this.transitionTimer / Math.max(0.01, this.transitionDuration));
  }

  public getDoorPosition(): THREE.Vector3 {
    return this.transitionTargetPos;
  }

  // Begin entering sequence
  public startEnterVehicle(target: NearbyVehicleInfo): void {
    this.activeTargetVehicle = target;
    this.transitionTimer = 0;
    this.transitionDuration = 1.15;
    this.transitionStartPos.copy(this.playerController.position);

    const doorPos = this.getDriverDoorPosition(target.position, target.heading);
    this.transitionTargetPos.copy(doorPos);

    this.doorSlamPlayed = false;
    this.ignitionPlayed = false;
    this.characterHidden = false;

    // Phase 1: Mechanical door latch click
    audioManager.playDoorLatch();
  }

  // Update entering transition
  public updateEnterTransition(
    delta: number,
    onComplete: (vehicleId?: VehicleModelId) => void
  ): boolean {
    this.transitionTimer += delta;
    const t = Math.min(1.0, this.transitionTimer / this.transitionDuration);

    // Keep car chassis suspension spring updating
    this.vehicleController.updateSuspensionSpring(delta);

    // Phase 1 (0 to 0.45): Smooth walk / step towards door
    if (t < 0.45) {
      const stepT = t / 0.45;
      const smoothT = stepT * stepT * (3 - 2 * stepT);
      this.playerController.position.lerpVectors(this.transitionStartPos, this.transitionTargetPos, smoothT);
      this.playerCharacter.rootGroup.position.copy(this.playerController.position);

      if (this.activeTargetVehicle) {
        const dx = this.activeTargetVehicle.position.x - this.playerController.position.x;
        const dz = this.activeTargetVehicle.position.z - this.playerController.position.z;
        this.playerController.heading = Math.atan2(dx, dz);
        this.playerCharacter.rootGroup.rotation.y = this.playerController.heading;
      }

      this.playerCharacter.update(delta, 'ENTER_VEHICLE', 0.5);
    } else if (!this.characterHidden) {
      // Phase 2 (0.45): Character steps into vehicle seat and closes door
      this.characterHidden = true;
      this.playerCharacter.setVisible(false);

      // Chassis visibly tilts and rocks under driver weight
      this.vehicleController.applyChassisImpulse(0.045, -0.095);

      if (!this.doorSlamPlayed) {
        this.doorSlamPlayed = true;
        audioManager.playDoorSlam(); // Solid metallic *THUD*
      }
    }

    // Phase 3 (0.72): Engine starter cranks and roar blips, headlights flash
    if (t >= 0.72 && !this.ignitionPlayed) {
      this.ignitionPlayed = true;
      audioManager.playEngineIgnition();
      this.lightingManager?.flashHeadlights(450);
      this.vehicleController.applyChassisImpulse(0.03, 0.02);
    }

    if (t >= 1.0) {
      this.playerCharacter.setVisible(false);

      let hijackedId: VehicleModelId | undefined = undefined;

      // If entering a traffic car, hijack it
      if (this.activeTargetVehicle && this.activeTargetVehicle.type === 'traffic_car' && this.activeTargetVehicle.trafficCar) {
        const tCar = this.activeTargetVehicle.trafficCar;
        const carIndex = this.trafficManager.trafficCars.indexOf(tCar);
        if (carIndex !== -1) {
          // Exactly preserve the vehicle model of the hijacked traffic car
          hijackedId = tCar.modelId;

          // Remove traffic car from AI fleet
          this.trafficManager.scene.remove(tCar.mesh);
          this.trafficManager.trafficCars.splice(carIndex, 1);

          // Position player vehicle at exact traffic car spot
          this.vehicleController.position.copy(tCar.position);
          this.vehicleController.heading = tCar.heading;
          this.vehicleController.currentSpeed = Math.min(tCar.speed, 8.0);
        }
      }

      this.activeTargetVehicle = null;
      onComplete(hijackedId);
      return true;
    }

    return false;
  }

  // Begin exiting sequence with safe clearance detection
  public startExitVehicle(colliders: THREE.Box3[]): THREE.Vector3 {
    const carPos = this.vehicleController.position;
    const heading = this.vehicleController.heading;
    const halfW = this.vehicleController.trackWidth * 0.5;

    // Left door candidate
    const leftDoor = this.getDriverDoorPosition(carPos, heading, halfW);

    // Check if left door position penetrates any building
    let isLeftBlocked = false;
    for (const b of colliders) {
      if (
        leftDoor.x >= b.min.x - 0.3 &&
        leftDoor.x <= b.max.x + 0.3 &&
        leftDoor.z >= b.min.z - 0.3 &&
        leftDoor.z <= b.max.z + 0.3
      ) {
        isLeftBlocked = true;
        break;
      }
    }

    let finalExitPos = leftDoor;

    if (isLeftBlocked) {
      // Right door candidate (passenger side)
      const rightX = Math.cos(heading);
      const rightZ = -Math.sin(heading);
      const rightDoor = new THREE.Vector3(
        carPos.x + rightX * (halfW + 0.85),
        0.05,
        carPos.z + rightZ * (halfW + 0.85)
      );

      let isRightBlocked = false;
      for (const b of colliders) {
        if (
          rightDoor.x >= b.min.x - 0.3 &&
          rightDoor.x <= b.max.x + 0.3 &&
          rightDoor.z >= b.min.z - 0.3 &&
          rightDoor.z <= b.max.z + 0.3
        ) {
          isRightBlocked = true;
          break;
        }
      }

      finalExitPos = isRightBlocked ? new THREE.Vector3(carPos.x, 0.05, carPos.z - 2.5) : rightDoor;
    }

    this.playerController.setPosition(finalExitPos, heading);
    this.playerCharacter.setVisible(true);
    this.playerCharacter.update(0.016, 'EXIT_VEHICLE', 0.2);

    // Car suspension springs upward as driver weight leaves
    this.vehicleController.applyChassisImpulse(-0.04, 0.08);

    audioManager.playDoorLatch();
    setTimeout(() => {
      audioManager.playDoorSlam();
    }, 240);

    return finalExitPos;
  }
}
