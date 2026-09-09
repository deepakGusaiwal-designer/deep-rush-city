import * as THREE from 'three';
import { CITY_POIS } from '../data/vehicles';
import { CITY_SCALE } from './CityEnvironment';
import { BASE_AVENUES_X, BASE_STREETS_Z, LANE_OFFSET } from './TrafficManager';
import { audioManager } from './AudioManager';
import { useGameStore } from '../store/useGameStore';
import { CabMission } from '../types/game';
import { VehicleController } from './VehicleController';
import { CabPassengerNPC } from './CabPassengerNPC';
import { RouteGuideManager } from './RouteGuideManager';

interface PassengerProfile {
  name: string;
  quote: string;
  avatarColor: number;
}

const PASSENGER_PROFILES: PassengerProfile[] = [
  { name: 'Alex Rivera', quote: "Downtown Financial Bank, and please step on it!", avatarColor: 0x3b82f6 },
  { name: 'Chloe Chen', quote: "To the Grand Hotel! Got a VIP conference starting in 5 minutes!", avatarColor: 0xec4899 },
  { name: 'Marcus Brody', quote: "West Ocean Marina. Looking for a fast cruise along the coast!", avatarColor: 0x10b981 },
  { name: 'Elena Rostova', quote: "North Fountain Plaza! Keep it smooth and there's a big tip in it.", avatarColor: 0x8b5cf6 },
  { name: 'Jordan Vance', quote: "Sunset Pier boardwalk! Let's hear that turbo engine roar!", avatarColor: 0xf59e0b },
  { name: 'Mia Tanaka', quote: "Twisted Tower Cantilever! Double tip if we don't hit any curbs!", avatarColor: 0x06b6d4 },
];

export class MissionManager {
  private scene: THREE.Scene;
  private vehicleController: VehicleController;
  public passengerNPC: CabPassengerNPC;
  public routeGuide: RouteGuideManager;

  // 3D Visual Beacons
  private pickupBeaconGroup: THREE.Group;
  private pickupBeam: THREE.Mesh;
  private pickupRing: THREE.Mesh;

  private dropoffBeaconGroup: THREE.Group;
  private dropoffBeam: THREE.Mesh;
  private dropoffRing1: THREE.Mesh;
  private dropoffRing2: THREE.Mesh;

  // Active Mission State Tracking
  private isCabJobActive: boolean = false;
  private currentPickupPos = new THREE.Vector3();
  private currentDropoffPos = new THREE.Vector3();
  private nextFareTimer: number = 0;

  constructor(scene: THREE.Scene, vehicleController: VehicleController) {
    this.scene = scene;
    this.vehicleController = vehicleController;
    this.passengerNPC = new CabPassengerNPC(this.scene);
    this.routeGuide = new RouteGuideManager(this.scene);

    // --- 1. Holographic Passenger Pickup Beacon (Golden Amber) ---
    this.pickupBeaconGroup = new THREE.Group();
    this.pickupBeaconGroup.visible = false;

    // Vertical holographic light column
    const beamGeo = new THREE.CylinderGeometry(1.6, 1.6, 9.0, 16, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.pickupBeam = new THREE.Mesh(beamGeo, beamMat);
    this.pickupBeam.position.y = 4.5;
    this.pickupBeaconGroup.add(this.pickupBeam);

    // Rotating ground target ring
    const ringGeo = new THREE.RingGeometry(2.2, 2.9, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    this.pickupRing = new THREE.Mesh(ringGeo, ringMat);
    this.pickupRing.rotation.x = -Math.PI / 2;
    this.pickupRing.position.y = 0.08;
    this.pickupBeaconGroup.add(this.pickupRing);

    this.scene.add(this.pickupBeaconGroup);

    // --- 2. Holographic Destination Dropoff Beacon (Emerald Green) ---
    this.dropoffBeaconGroup = new THREE.Group();
    this.dropoffBeaconGroup.visible = false;

    const dropBeamGeo = new THREE.CylinderGeometry(2.0, 2.0, 10.0, 16, 1, true);
    const dropBeamMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.dropoffBeam = new THREE.Mesh(dropBeamGeo, dropBeamMat);
    this.dropoffBeam.position.y = 5.0;
    this.dropoffBeaconGroup.add(this.dropoffBeam);

    const dropRingGeo1 = new THREE.RingGeometry(2.6, 3.4, 32);
    const dropRingMat1 = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
    });
    this.dropoffRing1 = new THREE.Mesh(dropRingGeo1, dropRingMat1);
    this.dropoffRing1.rotation.x = -Math.PI / 2;
    this.dropoffRing1.position.y = 0.08;
    this.dropoffBeaconGroup.add(this.dropoffRing1);

    const dropRingGeo2 = new THREE.RingGeometry(1.2, 1.8, 32);
    const dropRingMat2 = new THREE.MeshBasicMaterial({
      color: 0x6ee7b7,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    this.dropoffRing2 = new THREE.Mesh(dropRingGeo2, dropRingMat2);
    this.dropoffRing2.rotation.x = -Math.PI / 2;
    this.dropoffRing2.position.y = 0.09;
    this.dropoffBeaconGroup.add(this.dropoffRing2);

    this.scene.add(this.dropoffBeaconGroup);
  }

  // Toggle or start cab driving shift
  public toggleCabJob(playerPos: THREE.Vector3): boolean {
    if (this.isCabJobActive) {
      this.cancelCabJob();
      return false;
    } else {
      this.startCabJob(playerPos);
      return true;
    }
  }

  public startCabJob(playerPos: THREE.Vector3) {
    this.isCabJobActive = true;
    this.nextFareTimer = 0;
    this.dispatchPassenger(playerPos);
    audioManager.playMissionStart();
  }

  public cancelCabJob() {
    this.isCabJobActive = false;
    this.pickupBeaconGroup.visible = false;
    this.dropoffBeaconGroup.visible = false;
    this.passengerNPC.hide();
    this.routeGuide.hide();
    useGameStore.getState().setNavigationRoute([]);
    useGameStore.getState().resetCabMission();
  }

  // Dispatch a new passenger hailing a cab from roadside curbs
  private dispatchPassenger(playerPos: THREE.Vector3) {
    const profile = PASSENGER_PROFILES[Math.floor(Math.random() * PASSENGER_PROFILES.length)];

    // Pick a roadside curb location not too close and not too far
    const pickupSpot = this.generateRoadsideCurbLocation(playerPos);
    this.currentPickupPos.copy(pickupSpot);
    this.pickupBeaconGroup.position.copy(pickupSpot);
    this.pickupBeaconGroup.visible = true;
    this.dropoffBeaconGroup.visible = false;

    // Spawn animated 3D passenger NPC at curb waiting & hailing
    this.passengerNPC.setProfile({
      name: profile.name,
      avatarColor: profile.avatarColor,
    });
    this.passengerNPC.spawnAtCurb(pickupSpot);

    // Calculate road navigation route to pickup on road & map
    this.routeGuide.setRoute(playerPos, pickupSpot, 'pickup');
    useGameStore.getState().setNavigationRoute(
      this.routeGuide.activeRoutePoints.map((p) => [p.x, p.z])
    );

    // Select random destination across town from POIs
    const candidatePOIs = CITY_POIS.filter((poi) => {
      const poiWorldX = poi.position[0] * CITY_SCALE;
      const poiWorldZ = poi.position[2] * CITY_SCALE;
      return Math.hypot(poiWorldX - pickupSpot.x, poiWorldZ - pickupSpot.z) > 75.0;
    });
    const destPOI = candidatePOIs.length > 0
      ? candidatePOIs[Math.floor(Math.random() * candidatePOIs.length)]
      : CITY_POIS[Math.floor(Math.random() * CITY_POIS.length)];

    const destX = destPOI.position[0] * CITY_SCALE;
    const destZ = destPOI.position[2] * CITY_SCALE;
    this.currentDropoffPos.set(destX, 0.05, destZ);

    const tripDistance = Math.hypot(destX - pickupSpot.x, destZ - pickupSpot.z);
    const timeLimit = Math.max(45, Math.round(tripDistance / 11.5) + 20);
    const baseFare = Math.round(55 + tripDistance * 0.45);

    const prevStreak = useGameStore.getState().cabMission.streak;

    const missionData: CabMission = {
      id: `fare_${Date.now()}`,
      status: 'pickup',
      passengerName: profile.name,
      passengerQuote: profile.quote,
      pickupPos: [pickupSpot.x, pickupSpot.y, pickupSpot.z],
      dropoffPos: [destX, 0.05, destZ],
      destinationName: destPOI.name,
      timeLimit,
      timeRemaining: timeLimit,
      distanceRemaining: Math.round(playerPos.distanceTo(pickupSpot)),
      baseFare,
      bonusTip: 0,
      streak: prevStreak,
    };

    useGameStore.getState().setCabMission(missionData);
  }

  // Pick an authentic roadside curb coordinate
  private generateRoadsideCurbLocation(nearPos: THREE.Vector3): THREE.Vector3 {
    // Choose an avenue or street
    const isAvenue = Math.random() > 0.5;
    let x = 0;
    let z = 0;

    if (isAvenue) {
      const avenueX = BASE_AVENUES_X[Math.floor(Math.random() * BASE_AVENUES_X.length)];
      // Stand on right or left curb
      const side = Math.random() > 0.5 ? 1 : -1;
      x = avenueX + (LANE_OFFSET + 2.4) * side;
      // Along street between -65 and 65
      z = (Math.random() * 120 - 60) * (CITY_SCALE * 0.65);
    } else {
      const streetZ = BASE_STREETS_Z[Math.floor(Math.random() * BASE_STREETS_Z.length)];
      const side = Math.random() > 0.5 ? 1 : -1;
      z = streetZ + (LANE_OFFSET + 2.4) * side;
      x = (Math.random() * 100 - 50) * (CITY_SCALE * 0.65);
    }

    return new THREE.Vector3(x, 0.05, z);
  }

  // Main tick loop called each frame
  update(
    carPos: THREE.Vector3,
    carSpeedKmh: number,
    delta: number,
    playerMode: string
  ) {
    if (!this.isCabJobActive) return;

    const dt = Math.min(delta, 0.1);
    const store = useGameStore.getState();
    const mission = store.cabMission;

    // Update 3D Passenger NPC Animations & State Machine
    this.passengerNPC.update(dt, carPos, this.vehicleController.heading);

    // Update 3D In-World Road Navigation Route (chevrons flow & route trimming)
    this.routeGuide.update(dt, carPos);

    // Animate Beacons
    if (this.pickupBeaconGroup.visible) {
      this.pickupBeam.rotation.y += dt * 1.2;
      this.pickupRing.rotation.z -= dt * 1.5;
    }

    if (this.dropoffBeaconGroup.visible) {
      this.dropoffBeam.rotation.y -= dt * 1.4;
      this.dropoffRing1.rotation.z += dt * 1.8;
      this.dropoffRing2.rotation.z -= dt * 2.2;
    }

    // 1. Pick-up Phase
    if (mission.status === 'pickup') {
      const distToPickup = carPos.distanceTo(this.currentPickupPos);
      store.setCabMission({ distanceRemaining: Math.round(distToPickup) });

      // Check if player stopped within pickup beacon (< 6.8m and < 3.5 km/h) in a vehicle
      if (distToPickup < 6.8 && carSpeedKmh < 3.5 && playerMode === 'driving') {
        this.pickupBeaconGroup.visible = false;
        store.setCabMission({ status: 'passenger_entering' });

        this.passengerNPC.startEnteringCab(
          carPos,
          this.vehicleController.heading,
          () => {
            // Mount seated passenger into vehicle passenger seat
            this.passengerNPC.mountInsideChassis(this.vehicleController.chassisGroup);

            // Position & reveal destination dropoff beacon
            this.dropoffBeaconGroup.position.copy(this.currentDropoffPos);
            this.dropoffBeaconGroup.visible = true;

            // Route to destination dropoff on 3D road and minimap
            this.routeGuide.setRoute(carPos, this.currentDropoffPos, 'dropoff');
            store.setNavigationRoute(
              this.routeGuide.activeRoutePoints.map((p) => [p.x, p.z])
            );

            store.setCabMission({
              status: 'driving',
              distanceRemaining: Math.round(carPos.distanceTo(this.currentDropoffPos)),
            });
          }
        );
      }
    }

    // 1b. Passenger Entering Cab (in transit)
    else if (mission.status === 'passenger_entering') {
      // NPC is walking to car door; update is handling walk cycle and callbacks
    }

    // 2. Driving Phase
    else if (mission.status === 'driving') {
      const distToDropoff = carPos.distanceTo(this.currentDropoffPos);
      const newTime = Math.max(0, mission.timeRemaining - dt);

      // Calculate running dynamic speed tip based on remaining time ratio
      const timeBonusRatio = newTime / mission.timeLimit;
      const speedTip = Math.round(mission.baseFare * 0.45 * Math.max(0, timeBonusRatio));

      store.setCabMission({
        distanceRemaining: Math.round(distToDropoff),
        timeRemaining: newTime,
        bonusTip: speedTip,
      });

      // Arrived at destination zone (< 6.8m and < 3.5 km/h)
      if (distToDropoff < 6.8 && carSpeedKmh < 3.5 && playerMode === 'driving') {
        this.dropoffBeaconGroup.visible = false;
        this.routeGuide.hide();
        store.setNavigationRoute([]);

        // Calculate payout
        const streak = mission.streak + 1;
        const streakMultiplier = 1.0 + Math.min(streak - 1, 4) * 0.25; // up to 2.0x
        const totalPayout = Math.round((mission.baseFare + speedTip) * streakMultiplier);

        store.setCabMission({
          status: 'passenger_exiting',
          streak,
          lastPayout: totalPayout,
        });

        // Start exiting sequence
        this.passengerNPC.startExitingCab(
          carPos,
          this.vehicleController.heading,
          () => {
            // Award cash once passenger steps onto sidewalk and waves thank you!
            store.addCash(totalPayout);
            store.setCabMission({
              status: 'completed',
              streak,
              lastPayout: totalPayout,
            });
            this.nextFareTimer = 4.0;
          }
        );
      } else if (newTime <= 0) {
        // Time expired!
        this.dropoffBeaconGroup.visible = false;
        this.passengerNPC.hide();
        this.routeGuide.hide();
        store.setNavigationRoute([]);
        store.setCabMission({
          status: 'failed',
          streak: 0,
        });
        this.nextFareTimer = 4.0;
      }
    }

    // 2b. Passenger Exiting Cab (in transit to sidewalk & thank-you wave)
    else if (mission.status === 'passenger_exiting') {
      // Handled by passengerNPC.update()
    }

    // 3. Between Fares (Cooldown / Next Dispatch)
    else if (mission.status === 'completed' || mission.status === 'failed') {
      if (this.nextFareTimer > 0) {
        this.nextFareTimer -= dt;
        if (this.nextFareTimer <= 0) {
          this.dispatchPassenger(carPos);
        }
      }
    }
  }

  public getIsActive(): boolean {
    return this.isCabJobActive;
  }

  dispose() {
    this.cancelCabJob();
    this.passengerNPC.dispose();
    this.routeGuide.dispose();
    this.scene.remove(this.pickupBeaconGroup);
    this.scene.remove(this.dropoffBeaconGroup);
  }
}
