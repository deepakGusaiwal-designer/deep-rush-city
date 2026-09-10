import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TrafficLightColor, VehicleModelId } from '../types/game';
import { audioManager } from './AudioManager';
import { CITY_SCALE } from './CityEnvironment';
import { CityTextures } from './CityTextures';
import { VEHICLE_LIST } from '../data/vehicles';
import { createBusModel } from './models/BusModelBuilder';

export const CHUNK_WIDTH = 120.0 * CITY_SCALE;
export const CHUNK_DEPTH = 150.0 * CITY_SCALE;

// Base road centerlines verified from Cartoon_City_Free.glb scaled by CITY_SCALE
export const BASE_AVENUES_X = [-52.5 * CITY_SCALE, 7.5 * CITY_SCALE, 52.5 * CITY_SCALE];
export const BASE_STREETS_Z = [-67.5 * CITY_SCALE, 22.5 * CITY_SCALE, 67.5 * CITY_SCALE];
export const LANE_OFFSET = 2.6 * CITY_SCALE;

export interface TrafficCar {
  modelId: VehicleModelId;
  mesh: THREE.Group;
  wheelsFL: THREE.Object3D | null;
  wheelsFR: THREE.Object3D | null;
  wheelsRL: THREE.Object3D | null;
  wheelsRR: THREE.Object3D | null;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  heading: number; // yaw in radians
  speed: number;
  targetSpeed: number;
  steerAngle: number;
  axis: 'X' | 'Z';
  dir: 1 | -1;
  roadCoord: number; // base road center coordinate
  laneCoord: number; // exact center of lane coordinate
  box: THREE.Box3;
  halfLength: number;
  halfWidth: number;
  isHit: boolean;
  hitTimer: number;
  wheelRoll: number;
  isStoppedAtLight: boolean;
  honkCooldown: number;
  isStoppedForPlayer: boolean;

  // Rigid body-ish properties for momentum exchange with the player
  mass: number;
  health: number;
  spinRate: number;      // rad/s yaw spin while knocked
  isSuspect: boolean;    // vigilante mission target: flees, ignores lights

  // Turn navigation across intersections to loop indefinitely around the city
  turnState: 'none' | 'turning';
  turnProgress: number;
  turnDuration: number;
  turnStartPos: THREE.Vector3;
  turnStartHeading: number;
  turnTargetPos: THREE.Vector3;
  turnTargetHeading: number;
  targetAxis: 'X' | 'Z';
  targetDir: 1 | -1;
  targetRoadCoord: number;
  targetLaneCoord: number;
  turnCooldown: number;
}

export class TrafficManager {
  public scene: THREE.Scene;
  public trafficCars: TrafficCar[] = [];
  public trafficBoxes: THREE.Box3[] = [];

  public carTemplates: { id: VehicleModelId; scene: THREE.Group }[] = [];
  private isLoaded: boolean = false;
  public maxCars: number = 12;

  // Global traffic light signal state
  public trafficLightColor: TrafficLightColor = 'green';
  public lightTimer: number = 7.0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  getTemplate(id: VehicleModelId): THREE.Group | undefined {
    if (id === 'Bus') {
      const found = this.carTemplates.find(t => t.id === 'Bus');
      if (found) return found.scene;
      const bus = createBusModel();
      this.carTemplates.push({ id: 'Bus', scene: bus });
      return bus;
    }
    return this.carTemplates.find(t => t.id === id)?.scene;
  }

  async init(onProgress?: (percent: number) => void): Promise<void> {
    const loader = new GLTFLoader();
    const models: { id: VehicleModelId; path: string }[] = [
      { id: 'Car_06', path: '/models/vehicles/Car_06.glb' },
      { id: 'Car_13', path: '/models/vehicles/Car_13.glb' },
      { id: 'Car_16', path: '/models/vehicles/Car_16.glb' },
      { id: 'Car_19', path: '/models/vehicles/Car_19.glb' },
      { id: 'Futuristic_Car_1', path: '/models/vehicles/Futuristic_Car_1.glb' },
      { id: 'Van', path: '/models/vehicles/Van.glb' },
    ];

    // Register Metro Transit Bus template
    const busScene = createBusModel();
    this.carTemplates.push({ id: 'Bus', scene: busScene });

    let loadedCount = 0;
    const loadPromises = models.map((m) => {
      return new Promise<void>((resolve) => {
        loader.load(
          m.path,
          (gltf) => {
            const scene = gltf.scene;
            scene.name = m.id;
            scene.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });
            this.carTemplates.push({ id: m.id, scene });
            loadedCount++;
            if (onProgress) onProgress(Math.round((loadedCount / models.length) * 100));
            resolve();
          },
          undefined,
          () => resolve()
        );
      });
    });

    await Promise.all(loadPromises);
    this.isLoaded = true;

    // Spawn initial traffic fleet
    for (let i = 0; i < this.maxCars; i++) {
      this.spawnTrafficCar(new THREE.Vector3(0, 0, 0), true);
    }
  }

  private spawnTrafficCar(playerPos: THREE.Vector3, initialSpawn: boolean = false) {
    if (this.carTemplates.length === 0) return;

    const templateObj = this.carTemplates[Math.floor(Math.random() * this.carTemplates.length)];
    const clone = templateObj.scene.clone(true);
    clone.name = templateObj.id;

    let wFL: THREE.Object3D | null = null;
    let wFR: THREE.Object3D | null = null;
    let wRL: THREE.Object3D | null = null;
    let wRR: THREE.Object3D | null = null;

    clone.traverse((child) => {
      const name = child.name;
      if (name.includes('Wheel_Front_Left')) {
        wFL = child;
        child.rotation.order = 'YXZ';
      } else if (name.includes('Wheel_Front_Right')) {
        wFR = child;
        child.rotation.order = 'YXZ';
      } else if (name.includes('Wheel_Rear_Left')) {
        wRL = child;
        child.rotation.order = 'YXZ';
      } else if (name.includes('Wheel_Rear_Right')) {
        wRR = child;
        child.rotation.order = 'YXZ';
      }
    });

    const axis: 'X' | 'Z' = Math.random() > 0.45 ? 'Z' : 'X';
    const dir: 1 | -1 = Math.random() > 0.5 ? 1 : -1;

    let posX = 0;
    let posZ = 0;
    let heading = 0;
    let roadCoord = 0;
    let laneCoord = 0;

    const pChunkX = Math.round(playerPos.x / CHUNK_WIDTH);
    const pChunkZ = Math.round(playerPos.z / CHUNK_DEPTH);
    const cx = pChunkX + (Math.floor(Math.random() * 3) - 1);
    const cz = pChunkZ + (Math.floor(Math.random() * 3) - 1);

    if (axis === 'Z') {
      const baseAvenue = BASE_AVENUES_X[Math.floor(Math.random() * BASE_AVENUES_X.length)];
      roadCoord = cx * CHUNK_WIDTH + baseAvenue;
      laneCoord = roadCoord + (dir === 1 ? LANE_OFFSET : -LANE_OFFSET);
      posX = laneCoord;

      const minZ = cz * CHUNK_DEPTH + Math.min(...BASE_STREETS_Z);
      const maxZ = cz * CHUNK_DEPTH + Math.max(...BASE_STREETS_Z);
      let posZClamped = minZ + 8.0 + Math.random() * (maxZ - minZ - 16.0);
      if (Math.abs(posX - playerPos.x) < 4.0 && Math.abs(posZClamped - playerPos.z) < 24.0) {
        posZClamped = posZClamped > playerPos.z ? posZClamped + 24.0 : posZClamped - 24.0;
      }
      posZ = posZClamped;
      heading = dir === 1 ? 0 : Math.PI;
    } else {
      const baseStreet = BASE_STREETS_Z[Math.floor(Math.random() * BASE_STREETS_Z.length)];
      roadCoord = cz * CHUNK_DEPTH + baseStreet;
      laneCoord = roadCoord + (dir === 1 ? -LANE_OFFSET : LANE_OFFSET);
      posZ = laneCoord;

      const minX = cx * CHUNK_WIDTH + Math.min(...BASE_AVENUES_X);
      const maxX = cx * CHUNK_WIDTH + Math.max(...BASE_AVENUES_X);
      let posXClamped = minX + 8.0 + Math.random() * (maxX - minX - 16.0);
      if (Math.abs(posZ - playerPos.z) < 4.0 && Math.abs(posXClamped - playerPos.x) < 24.0) {
        posXClamped = posXClamped > playerPos.x ? posXClamped + 24.0 : posXClamped - 24.0;
      }
      posX = posXClamped;
      heading = dir === 1 ? Math.PI / 2 : -Math.PI / 2;
    }

    const isBus = templateObj.id === 'Bus';
    const isVan = templateObj.id === 'Van';
    const halfLength = isBus ? 3.8 : isVan ? 2.3 : 1.9;
    const halfWidth = isBus ? 1.25 : isVan ? 1.1 : 0.95;

    // Contact shadow decal directly under vehicle wheels
    const contactShadowGeo = new THREE.PlaneGeometry(
      isBus ? 2.8 : isVan ? 2.6 : 2.3,
      isBus ? 7.8 : isVan ? 4.8 : 4.4
    );
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: CityTextures.getVehicleContactShadow(),
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const contactShadowMesh = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    contactShadowMesh.rotation.x = -Math.PI / 2;
    contactShadowMesh.position.set(0, 0.004, 0);
    contactShadowMesh.renderOrder = 2;
    clone.add(contactShadowMesh);

    // Glowing front headlights and rear taillights on AI traffic cars
    const headGeo = new THREE.BoxGeometry(0.22, 0.08, 0.04);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff5cc,
      emissiveIntensity: 3.5,
      roughness: 0.1,
    });
    const headL = new THREE.Mesh(headGeo, headMat);
    headL.position.set(-halfWidth * 0.72, 0.52, halfLength);
    const headR = new THREE.Mesh(headGeo, headMat);
    headR.position.set(halfWidth * 0.72, 0.52, halfLength);
    clone.add(headL);
    clone.add(headR);

    const tailGeo = new THREE.BoxGeometry(0.22, 0.08, 0.04);
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xff0022,
      emissive: 0xff0022,
      emissiveIntensity: 3.8,
      roughness: 0.2,
    });
    const tailL = new THREE.Mesh(tailGeo, tailMat);
    tailL.position.set(-halfWidth * 0.72, 0.52, -halfLength);
    const tailR = new THREE.Mesh(tailGeo, tailMat);
    tailR.position.set(halfWidth * 0.72, 0.52, -halfLength);
    clone.add(tailL);
    clone.add(tailR);

    const pos = new THREE.Vector3(posX, 0.0, posZ);
    clone.position.copy(pos);
    clone.rotation.y = heading;
    this.scene.add(clone);

    const trafficCar: TrafficCar = {
      modelId: templateObj.id,
      mesh: clone,
      wheelsFL: wFL,
      wheelsFR: wFR,
      wheelsRL: wRL,
      wheelsRR: wRR,
      position: pos,
      velocity: new THREE.Vector3(0, 0, 0),
      heading: heading,
      speed: 7.5 + Math.random() * 3.5, // ~28 - 40 km/h
      targetSpeed: 8.0 + Math.random() * 3.5,
      steerAngle: 0,
      axis: axis,
      dir: dir,
      roadCoord: roadCoord,
      laneCoord: laneCoord,
      box: new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(pos.x, 0.8, pos.z),
        new THREE.Vector3(halfWidth * 2.0, 1.6, halfLength * 2.0)
      ),
      halfLength: halfLength,
      halfWidth: halfWidth,
      isHit: false,
      hitTimer: 0,
      wheelRoll: 0,
      isStoppedAtLight: false,
      honkCooldown: 0.5 + Math.random() * 2.0,
      isStoppedForPlayer: false,

      mass: VEHICLE_LIST.find((v) => v.id === templateObj.id)?.mass ?? 1300,
      health: 100,
      spinRate: 0,
      isSuspect: false,

      turnState: 'none',
      turnProgress: 0,
      turnDuration: 1.0,
      turnStartPos: new THREE.Vector3(),
      turnStartHeading: 0,
      turnTargetPos: new THREE.Vector3(),
      turnTargetHeading: 0,
      targetAxis: axis,
      targetDir: dir,
      targetRoadCoord: roadCoord,
      targetLaneCoord: laneCoord,
      turnCooldown: 1.5 + Math.random() * 2.0,
    };

    this.trafficCars.push(trafficCar);
  }

  // Smoothly reposition car onto a road lane near the player
  private repositionCarOnRoad(car: TrafficCar, nearPos?: THREE.Vector3) {
    const axis: 'X' | 'Z' = Math.random() > 0.5 ? 'Z' : 'X';
    const dir: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
    car.axis = axis;
    car.dir = dir;
    car.isHit = false;
    car.hitTimer = 0;
    car.spinRate = 0;
    car.velocity.set(0, 0, 0);
    car.turnState = 'none';
    car.turnCooldown = 2.5;
    car.speed = 7.5 + Math.random() * 3.5;

    const refX = nearPos ? nearPos.x : 0;
    const refZ = nearPos ? nearPos.z : 0;
    const pChunkX = Math.round(refX / CHUNK_WIDTH);
    const pChunkZ = Math.round(refZ / CHUNK_DEPTH);
    const cx = pChunkX + (Math.floor(Math.random() * 3) - 1);
    const cz = pChunkZ + (Math.floor(Math.random() * 3) - 1);

    if (axis === 'Z') {
      const baseAvenue = BASE_AVENUES_X[Math.floor(Math.random() * BASE_AVENUES_X.length)];
      car.roadCoord = cx * CHUNK_WIDTH + baseAvenue;
      car.laneCoord = car.roadCoord + (dir === 1 ? LANE_OFFSET : -LANE_OFFSET);
      const minZ = cz * CHUNK_DEPTH + Math.min(...BASE_STREETS_Z);
      const maxZ = cz * CHUNK_DEPTH + Math.max(...BASE_STREETS_Z);
      car.position.set(car.laneCoord, 0.0, minZ + 12.0 + Math.random() * (maxZ - minZ - 24.0));
      car.heading = dir === 1 ? 0 : Math.PI;
    } else {
      const baseStreet = BASE_STREETS_Z[Math.floor(Math.random() * BASE_STREETS_Z.length)];
      car.roadCoord = cz * CHUNK_DEPTH + baseStreet;
      car.laneCoord = car.roadCoord + (dir === 1 ? -LANE_OFFSET : LANE_OFFSET);
      const minX = cx * CHUNK_WIDTH + Math.min(...BASE_AVENUES_X);
      const maxX = cx * CHUNK_WIDTH + Math.max(...BASE_AVENUES_X);
      car.position.set(minX + 12.0 + Math.random() * (maxX - minX - 24.0), 0.0, car.laneCoord);
      car.heading = dir === 1 ? Math.PI / 2 : -Math.PI / 2;
    }
  }

  // Calculate realistic turn options at intersection and start smooth Bezier cornering
  private triggerIntersectionDecision(car: TrafficCar, avenueX: number, streetZ: number) {
    const options: ('straight' | 'right' | 'left')[] = ['straight', 'straight', 'right', 'left'];
    const action = options[Math.floor(Math.random() * options.length)];

    if (action === 'straight') {
      car.turnCooldown = 3.5;
      return;
    }

    let targetAxis: 'X' | 'Z';
    let targetDir: 1 | -1;
    let targetRoadCoord: number;
    let targetLaneCoord: number;
    let targetHeading: number;
    const targetPos = new THREE.Vector3();

    const turnOffset = LANE_OFFSET + 4.2;

    if (car.axis === 'Z') {
      targetAxis = 'X';
      targetRoadCoord = streetZ;

      if (action === 'right') {
        if (car.dir === 1) {
          targetDir = 1;
          targetHeading = Math.PI / 2;
          targetLaneCoord = streetZ - LANE_OFFSET;
          targetPos.set(avenueX + turnOffset, 0.0, targetLaneCoord);
        } else {
          targetDir = -1;
          targetHeading = -Math.PI / 2;
          targetLaneCoord = streetZ + LANE_OFFSET;
          targetPos.set(avenueX - turnOffset, 0.0, targetLaneCoord);
        }
      } else {
        if (car.dir === 1) {
          targetDir = -1;
          targetHeading = -Math.PI / 2;
          targetLaneCoord = streetZ + LANE_OFFSET;
          targetPos.set(avenueX - turnOffset, 0.0, targetLaneCoord);
        } else {
          targetDir = 1;
          targetHeading = Math.PI / 2;
          targetLaneCoord = streetZ - LANE_OFFSET;
          targetPos.set(avenueX + turnOffset, 0.0, targetLaneCoord);
        }
      }
    } else {
      targetAxis = 'Z';
      targetRoadCoord = avenueX;

      if (action === 'right') {
        if (car.dir === 1) {
          targetDir = -1;
          targetHeading = Math.PI;
          targetLaneCoord = avenueX - LANE_OFFSET;
          targetPos.set(targetLaneCoord, 0.0, streetZ - turnOffset);
        } else {
          targetDir = 1;
          targetHeading = 0;
          targetLaneCoord = avenueX + LANE_OFFSET;
          targetPos.set(targetLaneCoord, 0.0, streetZ + turnOffset);
        }
      } else {
        if (car.dir === 1) {
          targetDir = 1;
          targetHeading = 0;
          targetLaneCoord = avenueX + LANE_OFFSET;
          targetPos.set(targetLaneCoord, 0.0, streetZ + turnOffset);
        } else {
          targetDir = -1;
          targetHeading = Math.PI;
          targetLaneCoord = avenueX - LANE_OFFSET;
          targetPos.set(targetLaneCoord, 0.0, streetZ - turnOffset);
        }
      }
    }

    car.turnState = 'turning';
    car.turnProgress = 0;
    car.turnStartPos.copy(car.position);
    car.turnStartHeading = car.heading;
    car.turnTargetPos.copy(targetPos);
    car.turnTargetHeading = targetHeading;
    car.targetAxis = targetAxis;
    car.targetDir = targetDir;
    car.targetRoadCoord = targetRoadCoord;
    car.targetLaneCoord = targetLaneCoord;

    const turnDist = car.turnStartPos.distanceTo(car.turnTargetPos);
    car.speed = Math.min(car.speed, 5.0);
    car.turnDuration = Math.max(1.1, turnDist / Math.max(car.speed, 3.8));
  }

  update(
    playerPos: THREE.Vector3,
    delta: number,
    isPlayerOnFoot: boolean = false,
    playerCarPos: THREE.Vector3 | null = null,
    staticColliders: THREE.Box3[] = []
  ) {
    if (!this.isLoaded) return;
    const dt = Math.min(delta, 0.05);

    // 1. Cycle traffic lights (Green 7s -> Yellow 2.5s -> Red 7s)
    this.lightTimer -= dt;
    if (this.lightTimer <= 0) {
      if (this.trafficLightColor === 'green') {
        this.trafficLightColor = 'yellow';
        this.lightTimer = 2.5;
      } else if (this.trafficLightColor === 'yellow') {
        this.trafficLightColor = 'red';
        this.lightTimer = 7.0;
      } else {
        this.trafficLightColor = 'green';
        this.lightTimer = 7.0;
      }
    }

    this.trafficBoxes = [];

    // 2. Update each traffic vehicle (Never disappears, loops continuously)
    for (let i = this.trafficCars.length - 1; i >= 0; i--) {
      const car = this.trafficCars[i];

      if (car.isHit) {
        // Physical knockback from player impact: slide with tyre friction, spin out, bounce off buildings
        car.hitTimer -= dt;
        car.position.addScaledVector(car.velocity, dt);
        car.velocity.multiplyScalar(Math.exp(-2.2 * dt));
        car.heading += car.spinRate * dt;
        car.spinRate *= Math.exp(-2.8 * dt);

        // Keep knocked cars out of buildings
        for (let c = 0; c < staticColliders.length; c++) {
          const b = staticColliders[c];
          const rad = car.halfWidth;
          if (
            car.position.x < b.min.x - rad || car.position.x > b.max.x + rad ||
            car.position.z < b.min.z - rad || car.position.z > b.max.z + rad
          ) continue;
          const cx = Math.max(b.min.x, Math.min(car.position.x, b.max.x));
          const cz = Math.max(b.min.z, Math.min(car.position.z, b.max.z));
          let dx = car.position.x - cx;
          let dz = car.position.z - cz;
          let dist = Math.hypot(dx, dz);
          if (dist < 0.001) {
            // Centre is inside: push out along the shallowest face
            const dl = car.position.x - b.min.x, dr = b.max.x - car.position.x;
            const db = car.position.z - b.min.z, dtp = b.max.z - car.position.z;
            const mn = Math.min(dl, dr, db, dtp);
            dx = mn === dl ? -1 : mn === dr ? 1 : 0;
            dz = mn === db ? -1 : mn === dtp ? 1 : 0;
            dist = 1;
            car.position.x += dx * (mn + rad);
            car.position.z += dz * (mn + rad);
          } else if (dist < rad) {
            dx /= dist; dz /= dist;
            car.position.x += dx * (rad - dist);
            car.position.z += dz * (rad - dist);
          } else continue;
          const vn = car.velocity.x * dx + car.velocity.z * dz;
          if (vn < 0) {
            car.velocity.x -= dx * vn * 1.3;
            car.velocity.z -= dz * vn * 1.3;
            if (vn < -2) audioManager.playCrash(Math.min(1, -vn / 8));
          }
        }

        if (car.hitTimer <= 0 && car.velocity.lengthSq() < 4.0) {
          car.isHit = false;
          car.spinRate = 0;
          car.turnState = 'none';
          car.speed = Math.max(0, car.velocity.dot(new THREE.Vector3(Math.sin(car.heading), 0, Math.cos(car.heading))));
          // Snap heading back to the lane direction so the AI can recover
          car.heading = car.axis === 'Z' ? (car.dir === 1 ? 0 : Math.PI) : (car.dir === 1 ? Math.PI / 2 : -Math.PI / 2);
        }
      } else if (car.turnState === 'turning') {
        // Smooth Cubic Bezier Cornering Curve
        car.turnProgress += dt / car.turnDuration;
        const t = Math.min(1.0, car.turnProgress);

        const p0 = car.turnStartPos;
        const p3 = car.turnTargetPos;
        const dist = p0.distanceTo(p3);

        const startDir = new THREE.Vector3(Math.sin(car.turnStartHeading), 0, Math.cos(car.turnStartHeading));
        const endDir = new THREE.Vector3(Math.sin(car.turnTargetHeading), 0, Math.cos(car.turnTargetHeading));

        const p1 = p0.clone().addScaledVector(startDir, dist * 0.42);
        const p2 = p3.clone().addScaledVector(endDir, -dist * 0.42);

        const u = 1 - t;
        const posX = u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x;
        const posZ = u * u * u * p0.z + 3 * u * u * t * p1.z + 3 * u * t * t * p2.z + t * t * t * p3.z;
        car.position.set(posX, 0.0, posZ);

        const dx = 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x);
        const dz = 3 * u * u * (p1.z - p0.z) + 6 * u * t * (p2.z - p1.z) + 3 * t * t * (p3.z - p2.z);
        if (Math.hypot(dx, dz) > 0.01) {
          car.heading = Math.atan2(dx, dz);
        }
        car.velocity.set(dx / Math.max(0.1, car.turnDuration), 0, dz / Math.max(0.1, car.turnDuration));

        let angleDiff = car.turnTargetHeading - car.turnStartHeading;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        car.steerAngle = angleDiff * Math.sin(t * Math.PI) * 0.75;

        if (t >= 1.0) {
          car.turnState = 'none';
          car.position.copy(car.turnTargetPos);
          car.heading = car.turnTargetHeading;
          car.axis = car.targetAxis;
          car.dir = car.targetDir;
          car.roadCoord = car.targetRoadCoord;
          car.laneCoord = car.targetLaneCoord;
          car.steerAngle = 0;
          car.turnCooldown = 3.5;
        }
      } else {
        // Normal Driving along lane
        let shouldStop = false;

        // Check Traffic Light status
        const isRedForMe = car.axis === 'Z'
          ? (this.trafficLightColor === 'red' || this.trafficLightColor === 'yellow')
          : (this.trafficLightColor === 'green' || this.trafficLightColor === 'yellow');

        if (isRedForMe) {
          if (car.axis === 'Z') {
            const chunkZ = Math.round(car.position.z / CHUNK_DEPTH);
            for (const cz of [chunkZ, chunkZ + car.dir]) {
              for (const baseZ of BASE_STREETS_Z) {
                const streetZ = cz * CHUNK_DEPTH + baseZ;
                const distAhead = (streetZ - car.position.z) * car.dir;
                if (distAhead > 3.0 && distAhead < 15.0) {
                  shouldStop = true;
                  break;
                }
              }
              if (shouldStop) break;
            }
          } else {
            const chunkX = Math.round(car.position.x / CHUNK_WIDTH);
            for (const cx of [chunkX, chunkX + car.dir]) {
              for (const baseAv of BASE_AVENUES_X) {
                const avenueX = cx * CHUNK_WIDTH + baseAv;
                const distAhead = (avenueX - car.position.x) * car.dir;
                if (distAhead > 3.0 && distAhead < 15.0) {
                  shouldStop = true;
                  break;
                }
              }
              if (shouldStop) break;
            }
          }
        }

        // Check for traffic car stopped ahead in same lane
        for (let j = 0; j < this.trafficCars.length; j++) {
          if (i === j) continue;
          const other = this.trafficCars[j];
          if (other.axis === car.axis && other.dir === car.dir) {
            const laneDiff = Math.abs(other.laneCoord - car.laneCoord);
            if (laneDiff < 1.0) {
              const distAhead = car.axis === 'Z'
                ? (other.position.z - car.position.z) * car.dir
                : (other.position.x - car.position.x) * car.dir;
              if (distAhead > 0.5 && distAhead < 8.5) {
                shouldStop = true;
                break;
              }
            }
          }
        }

        // Check for player protagonist standing in lane ahead
        let blockedByPlayer = false;
        if (isPlayerOnFoot) {
          const lateralTolerance = 2.4;
          if (car.axis === 'Z') {
            const lateralDiff = Math.abs(playerPos.x - car.position.x);
            if (lateralDiff < lateralTolerance) {
              const distAhead = (playerPos.z - car.position.z) * car.dir;
              if (distAhead > 0.3 && distAhead < 18.0) {
                shouldStop = true;
                blockedByPlayer = true;
                if (distAhead < 5.5) {
                  car.speed = Math.max(0, car.speed - 32.0 * dt);
                }
                if (distAhead < 11.0) {
                  car.honkCooldown -= dt;
                  if (car.honkCooldown <= 0) {
                    audioManager.playCarHornPulse();
                    car.honkCooldown = 2.0 + Math.random() * 1.5;
                  }
                }
              }
            }
          } else {
            const lateralDiff = Math.abs(playerPos.z - car.position.z);
            if (lateralDiff < lateralTolerance) {
              const distAhead = (playerPos.x - car.position.x) * car.dir;
              if (distAhead > 0.3 && distAhead < 18.0) {
                shouldStop = true;
                blockedByPlayer = true;
                if (distAhead < 5.5) {
                  car.speed = Math.max(0, car.speed - 32.0 * dt);
                }
                if (distAhead < 11.0) {
                  car.honkCooldown -= dt;
                  if (car.honkCooldown <= 0) {
                    audioManager.playCarHornPulse();
                    car.honkCooldown = 2.0 + Math.random() * 1.5;
                  }
                }
              }
            }
          }
        }
        // Brake for the player's car sitting in the lane ahead (and honk at it)
        if (playerCarPos && !car.isSuspect) {
          const lateralDiff = car.axis === 'Z'
            ? Math.abs(playerCarPos.x - car.position.x)
            : Math.abs(playerCarPos.z - car.position.z);
          if (lateralDiff < 2.2) {
            const distAhead = car.axis === 'Z'
              ? (playerCarPos.z - car.position.z) * car.dir
              : (playerCarPos.x - car.position.x) * car.dir;
            if (distAhead > 0.3 && distAhead < 14.0) {
              shouldStop = true;
              blockedByPlayer = true;
              if (distAhead < 7.0) car.speed = Math.max(0, car.speed - 30.0 * dt);
              if (distAhead < 9.0) {
                car.honkCooldown -= dt;
                if (car.honkCooldown <= 0) {
                  audioManager.playCarHornPulse();
                  car.honkCooldown = 2.5 + Math.random() * 2.0;
                }
              }
            }
          }
        }
        car.isStoppedForPlayer = blockedByPlayer;

        // Fleeing suspects never stop for anything
        if (car.isSuspect) shouldStop = false;

        // Smooth acceleration / braking
        if (shouldStop) {
          car.speed = Math.max(0, car.speed - (blockedByPlayer ? 28.0 : 22.0) * dt);
          car.isStoppedAtLight = true;
        } else {
          car.isStoppedAtLight = false;
          if (car.speed < car.targetSpeed) {
            car.speed = Math.min(car.speed + 12.0 * dt, car.targetSpeed);
          }
        }

        // Steer tightly in designated lane & update velocity
        if (car.axis === 'Z') {
          const lateralError = car.laneCoord - car.position.x;
          car.position.x += lateralError * Math.min(dt * 6.0, 1.0);
          car.position.z += car.dir * car.speed * dt;
          car.heading = car.dir === 1 ? 0 : Math.PI;
          car.velocity.set(lateralError * 4.0, 0, car.dir * car.speed);
        } else {
          const lateralError = car.laneCoord - car.position.z;
          car.position.z += lateralError * Math.min(dt * 6.0, 1.0);
          car.position.x += car.dir * car.speed * dt;
          car.heading = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
          car.velocity.set(car.dir * car.speed, 0, lateralError * 4.0);
        }

        // Check Intersection Approach for continuous looping around the city
        car.turnCooldown = Math.max(0, car.turnCooldown - dt);
        if (car.turnCooldown <= 0 && !car.isStoppedAtLight) {
          if (car.axis === 'Z') {
            const chunkZ = Math.round(car.position.z / CHUNK_DEPTH);
            let decided = false;
            for (const cz of [chunkZ, chunkZ + car.dir]) {
              for (const baseZ of BASE_STREETS_Z) {
                const streetZ = cz * CHUNK_DEPTH + baseZ;
                const distAhead = (streetZ - car.position.z) * car.dir;
                if (distAhead > 0 && distAhead <= 5.0) {
                  this.triggerIntersectionDecision(car, car.roadCoord, streetZ);
                  decided = true;
                  break;
                }
              }
              if (decided) break;
            }
          } else {
            const chunkX = Math.round(car.position.x / CHUNK_WIDTH);
            let decided = false;
            for (const cx of [chunkX, chunkX + car.dir]) {
              for (const baseAv of BASE_AVENUES_X) {
                const avenueX = cx * CHUNK_WIDTH + baseAv;
                const distAhead = (avenueX - car.position.x) * car.dir;
                if (distAhead > 0 && distAhead <= 5.0) {
                  this.triggerIntersectionDecision(car, avenueX, car.roadCoord);
                  decided = true;
                  break;
                }
              }
              if (decided) break;
            }
          }
        }
      }

      // Keep car grounded at asphalt level
      if (!car.isHit) car.position.y = 0.0;
      else car.position.y = Math.max(0.0, car.position.y);

      // Sync 3D Mesh
      car.mesh.position.copy(car.position);
      car.mesh.rotation.y = car.heading;

      // Animate wheels
      const wheelRadius = 0.40;
      car.wheelRoll += (car.speed / wheelRadius) * dt;
      car.wheelRoll = car.wheelRoll % (Math.PI * 2);

      if (car.wheelsFL) {
        car.wheelsFL.rotation.order = 'YXZ';
        car.wheelsFL.rotation.y = car.steerAngle;
        car.wheelsFL.rotation.x = car.wheelRoll;
      }
      if (car.wheelsFR) {
        car.wheelsFR.rotation.order = 'YXZ';
        car.wheelsFR.rotation.y = car.steerAngle;
        car.wheelsFR.rotation.x = car.wheelRoll;
      }
      if (car.wheelsRL) {
        car.wheelsRL.rotation.order = 'YXZ';
        car.wheelsRL.rotation.y = 0;
        car.wheelsRL.rotation.x = car.wheelRoll;
      }
      if (car.wheelsRR) {
        car.wheelsRR.rotation.order = 'YXZ';
        car.wheelsRR.rotation.y = 0;
        car.wheelsRR.rotation.x = car.wheelRoll;
      }

      // Update collision box (axis-aligned, extents follow the heading so X-axis traffic isn't sideways)
      const hc = Math.abs(Math.cos(car.heading));
      const hs = Math.abs(Math.sin(car.heading));
      const halfX = car.halfWidth * hc + car.halfLength * hs;
      const halfZ = car.halfWidth * hs + car.halfLength * hc;
      car.box.min.set(car.position.x - halfX, 0, car.position.z - halfZ);
      car.box.max.set(car.position.x + halfX, 1.6, car.position.z + halfZ);
      this.trafficBoxes.push(car.box);

      // In an infinite city: recycle cars that drive beyond the active bubble (> 240m from player)
      // or that were knocked away by collisions
      const distFromPlayer = car.position.distanceTo(playerPos);
      if (distFromPlayer > 240.0 || (car.isHit && car.hitTimer <= 0 && distFromPlayer > 100.0)) {
        this.repositionCarOnRoad(car, playerPos);
      }
    }

    // Maintain target population
    while (this.trafficCars.length < this.maxCars) {
      this.spawnTrafficCar(playerPos, false);
    }
  }

  applyHit(boxIndex: number, impactVelocity: THREE.Vector3) {
    if (boxIndex >= 0 && boxIndex < this.trafficCars.length) {
      const car = this.trafficCars[boxIndex];
      car.isHit = true;
      car.hitTimer = 1.4;
      car.velocity.copy(impactVelocity).multiplyScalar(0.75);
      car.heading += (Math.random() * 2 - 1) * 0.45;
      audioManager.playCrash(0.9);
    }
  }

  /**
   * Momentum-based shove from a collision resolved by the player's car.
   * deltaV is the velocity change for this car; shift de-penetrates; contact is the world hit point.
   */
  applyImpulse(car: TrafficCar, deltaV: THREE.Vector3, shift: THREE.Vector3, contact: THREE.Vector3) {
    if (!car.isHit) {
      // Enter the knocked state carrying the AI's current lane velocity
      car.isHit = true;
      car.spinRate = 0;
    }
    car.position.add(shift);
    car.velocity.add(deltaV);
    car.hitTimer = Math.max(car.hitTimer, 0.9 + Math.min(1.6, deltaV.length() * 0.18));

    // Off-centre hits spin the car
    const leverX = contact.x - car.position.x;
    const leverZ = contact.z - car.position.z;
    const torque = leverX * deltaV.z - leverZ * deltaV.x;
    car.spinRate += torque * 0.55;

    const dmg = Math.max(0, deltaV.length() - 1.0) * 9.0;
    car.health = Math.max(0, car.health - dmg);
  }

  /** Mark a car as the vigilante suspect (or clear it). */
  setSuspect(car: TrafficCar | null) {
    for (const c of this.trafficCars) c.isSuspect = false;
    if (car) {
      car.isSuspect = true;
      car.targetSpeed = 15.5;
      car.health = 100;
    }
  }

  /** Nearest traffic car to a position within maxDist, or null. */
  findNearestCar(pos: THREE.Vector3, minDist: number = 0, maxDist: number = Infinity): TrafficCar | null {
    let best: TrafficCar | null = null;
    let bestD = maxDist;
    for (const c of this.trafficCars) {
      const d = c.position.distanceTo(pos);
      if (d >= minDist && d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  setMaxCars(count: number) {
    this.maxCars = count;
    while (this.trafficCars.length > count) {
      const removed = this.trafficCars.pop();
      if (removed) this.scene.remove(removed.mesh);
    }
  }
}
