import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PlayerControls, VehicleModelId, VehicleStats, HeadlightMode } from '../types/game';
import { VEHICLE_LIST } from '../data/vehicles';
import { audioManager } from './AudioManager';
import { CityTextures } from './CityTextures';
import { createBusModel } from './models/BusModelBuilder';

export const PLAYER_SPAWN_X = -26.5;
export const DEFAULT_SPAWN_POS = new THREE.Vector3(PLAYER_SPAWN_X, 0.0, 0);

const GRAVITY = 9.81;

/** Result of a car-vs-dynamic-body collision, so the other body can react with its share of the impulse. */
export interface DynamicCollisionResult {
  normal: THREE.Vector3;       // points from the other body towards this car
  point: THREE.Vector3;        // approximate contact point (world)
  relSpeed: number;            // closing speed along the normal (m/s), > 0
  otherDeltaV: THREE.Vector3;  // velocity change to apply to the other body
  otherShift: THREE.Vector3;   // positional de-penetration to apply to the other body
  impulse: number;             // scalar impulse magnitude (N·s)
}

/**
 * Player vehicle: a planar rigid-body "bicycle model" with
 *  - mass, yaw inertia, engine/brake/drag forces
 *  - per-axle tyre slip angles, cornering stiffness and a friction circle
 *  - longitudinal weight transfer, handbrake rear-lock drifting
 *  - impulse based collisions (static city + dynamic traffic/police), body damage
 *
 * Body frame: x = forward, y = left. Positive yaw rate = turning left.
 * World: forward = (sin h, 0, cos h), left = (cos h, 0, -sin h).
 */
export class VehicleController {
  public rootGroup: THREE.Group;
  public chassisGroup: THREE.Group;
  public lightsGroup: THREE.Group;

  private currentVehicleId: VehicleModelId = 'Car_06';
  private currentStats: VehicleStats;

  // Wheel meshes
  private wheelFL: THREE.Object3D | null = null;
  private wheelFR: THREE.Object3D | null = null;
  private wheelRL: THREE.Object3D | null = null;
  private wheelRR: THREE.Object3D | null = null;
  private spoilerNode: THREE.Object3D | null = null;

  // Rigid body state
  public position = DEFAULT_SPAWN_POS.clone();
  public velocity = new THREE.Vector3(0, 0, 0);   // world-space, y is always 0
  public heading: number = 0;                      // yaw in radians (0 = facing +Z)
  public yawRate: number = 0;                      // rad/s, + = turning left
  public speedKmh: number = 0;
  public currentSteerAngle: number = 0;
  public get steerAngle(): number {
    return this.currentSteerAngle;
  }
  private wheelRollAngle: number = 0;

  // Derived dynamics exposed for HUD / effects
  public longAccel: number = 0;    // m/s² body-x (excluding centripetal coupling)
  public lateralAccel: number = 0; // m/s² body-y
  public rearSlipAngle: number = 0;
  public frontSlipAngle: number = 0;
  public isDrifting: boolean = false;
  public isWheelspin: boolean = false;
  public driftScore: number = 0;

  // Damage model
  public health: number = 100;
  public isWrecked: boolean = false;
  public lastImpactSpeed: number = 0;
  public onDamage: ((amount: number, impactSpeed: number) => void) | null = null;
  public onWrecked: (() => void) | null = null;

  // Cartoon body suspension
  private bodyPitch: number = 0;
  private bodyRoll: number = 0;
  private chassisPitchImpulse: number = 0;
  private chassisRollImpulse: number = 0;
  private chassisImpulseVel = new THREE.Vector2(0, 0);

  // Vehicle Dimensions
  public wheelBase: number = 1.25; // Distance from center to front/rear axles
  public trackWidth: number = 1.35; // Distance between left and right wheels
  public collisionRadius: number = 0.85; // Axle sphere radius

  // Visual Brake Light Meshes (Mounted on rear of vehicle)
  private tailLightMeshL: THREE.Mesh;
  private tailLightMeshR: THREE.Mesh;
  private tailLightMat: THREE.MeshStandardMaterial;

  // Visual Headlight Meshes (Mounted on front of vehicle)
  private headLightMeshL: THREE.Mesh;
  private headLightMeshR: THREE.Mesh;
  private headLightMat: THREE.MeshStandardMaterial;

  // Performance Upgrades (Stages)
  public engineStage: number = 1;
  public boostStage: number = 1;
  public handlingStage: number = 1;

  // Visual Customizations
  private customPaintColor: string | null = null;
  private underglowGroup: THREE.Group | null = null;
  private underglowMesh: THREE.Mesh | null = null;
  private underglowLight: THREE.PointLight | null = null;
  private taxiSignGroup: THREE.Group | null = null;

  // Loader
  private loader = new GLTFLoader();

  // Scratch vectors (avoid per-frame allocations in the substep loop)
  private _fwd = new THREE.Vector3();
  private _left = new THREE.Vector3();

  constructor(initialVehicleId: VehicleModelId = 'Car_06') {
    this.rootGroup = new THREE.Group();
    this.chassisGroup = new THREE.Group();
    this.lightsGroup = new THREE.Group();

    this.rootGroup.add(this.chassisGroup);
    this.rootGroup.add(this.lightsGroup);

    // Create glowing physical taillight indicators
    const tailGeo = new THREE.BoxGeometry(0.24, 0.08, 0.05);
    this.tailLightMat = new THREE.MeshStandardMaterial({
      color: 0x330000,
      emissive: 0x000000,
      emissiveIntensity: 0.0,
      roughness: 0.2,
      metalness: 0.1,
    });
    this.tailLightMeshL = new THREE.Mesh(tailGeo, this.tailLightMat);
    this.tailLightMeshR = new THREE.Mesh(tailGeo, this.tailLightMat);
    this.chassisGroup.add(this.tailLightMeshL);
    this.chassisGroup.add(this.tailLightMeshR);

    // Create glowing physical headlight indicators
    const headGeo = new THREE.BoxGeometry(0.24, 0.08, 0.05);
    this.headLightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffea88,
      emissiveIntensity: 3.5,
      roughness: 0.1,
      metalness: 0.1,
    });
    this.headLightMeshL = new THREE.Mesh(headGeo, this.headLightMat);
    this.headLightMeshR = new THREE.Mesh(headGeo, this.headLightMat);
    this.chassisGroup.add(this.headLightMeshL);
    this.chassisGroup.add(this.headLightMeshR);

    this.updateTaillightPositions();

    this.currentVehicleId = initialVehicleId;
    this.currentStats = VEHICLE_LIST.find((v) => v.id === initialVehicleId) || VEHICLE_LIST[0];

    // Soft Ambient Occlusion / Contact Shadow Decal directly under chassis and tires
    const vShadowGeo = new THREE.PlaneGeometry(2.3, 4.4);
    vShadowGeo.rotateX(-Math.PI / 2);
    const vShadowMat = new THREE.MeshBasicMaterial({
      map: CityTextures.getVehicleContactShadow(),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const vShadowMesh = new THREE.Mesh(vShadowGeo, vShadowMat);
    vShadowMesh.position.y = 0.004;
    this.rootGroup.add(vShadowMesh);

    this.position.copy(DEFAULT_SPAWN_POS);
    this.rootGroup.position.copy(this.position);
  }

  // ---------------------------------------------------------------------------
  // Physical properties
  // ---------------------------------------------------------------------------

  get mass(): number {
    return this.currentStats.mass;
  }

  /** Yaw moment of inertia approximated as a solid box (kg·m²). */
  get yawInertia(): number {
    const length = this.wheelBase * 2 * 1.75;
    const width = this.trackWidth * 1.35;
    return (this.mass * (length * length + width * width)) / 12 * 1.25;
  }

  /** Signed forward speed in m/s (body-x). Setting it keeps the lateral component. */
  get currentSpeed(): number {
    this.updateBasis();
    return this.velocity.dot(this._fwd);
  }

  set currentSpeed(v: number) {
    this.updateBasis();
    const vy = this.velocity.dot(this._left);
    this.velocity.copy(this._fwd).multiplyScalar(v).addScaledVector(this._left, vy);
  }

  private updateBasis() {
    const s = Math.sin(this.heading);
    const c = Math.cos(this.heading);
    this._fwd.set(s, 0, c);
    this._left.set(c, 0, -s);
  }

  public setPerformanceUpgrades(engine: number, boost: number, handling: number) {
    this.engineStage = engine;
    this.boostStage = boost;
    this.handlingStage = handling;
  }

  // ---------------------------------------------------------------------------
  // Damage
  // ---------------------------------------------------------------------------

  public applyDamage(amount: number, impactSpeed: number = 0) {
    if (amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.lastImpactSpeed = impactSpeed;
    if (this.onDamage) this.onDamage(amount, impactSpeed);
    if (this.health <= 0 && !this.isWrecked) {
      this.isWrecked = true;
      audioManager.playEngineDie();
      if (this.onWrecked) this.onWrecked();
    }
  }

  public repair() {
    this.health = 100;
    this.isWrecked = false;
  }

  /**
   * Crash damage curve: gentle bumps are free, a solid hit (~40-50 km/h into a wall) takes
   * roughly a quarter of the bodywork, and a single hit is capped so wrecking takes 4-5 crashes.
   */
  private damageFromImpact(impactSpeed: number): number {
    if (impactSpeed < 2.6) return 0;
    return Math.min(24, (impactSpeed - 2.0) * impactSpeed * 0.16);
  }

  // ---------------------------------------------------------------------------
  // Customs (paint / underglow / taxi sign)
  // ---------------------------------------------------------------------------

  public setCustomPaintColor(hex: string | null) {
    this.customPaintColor = hex;
    this.applyCurrentPaintColor();
  }

  public applyCurrentPaintColor() {
    if (!this.customPaintColor) return;
    const col = new THREE.Color(this.customPaintColor);
    this.chassisGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          if (!m) return;
          if (m.name === 'Car_Color' || m.name === 'Color_Glossy' || m.name === 'Color') {
            if (!(m as any)._isCustomClone) {
              const cloned = m.clone() as THREE.MeshStandardMaterial;
              (cloned as any)._isCustomClone = true;
              mesh.material = cloned;
              cloned.color.copy(col);
              cloned.needsUpdate = true;
            } else {
              (m as THREE.MeshStandardMaterial).color.copy(col);
              m.needsUpdate = true;
            }
          }
        });
      }
    });
  }

  public setUnderglowColor(hex: string | null) {
    if (!hex) {
      if (this.underglowGroup) {
        this.underglowGroup.visible = false;
      }
      return;
    }

    if (!this.underglowGroup) {
      this.underglowGroup = new THREE.Group();
      this.underglowGroup.position.set(0, 0.06, 0);

      // Neon ground projection plane
      const planeGeo = new THREE.PlaneGeometry(this.trackWidth * 1.5, this.wheelBase * 2.6);
      planeGeo.rotateX(-Math.PI / 2);
      const planeMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(hex),
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.underglowMesh = new THREE.Mesh(planeGeo, planeMat);
      this.underglowGroup.add(this.underglowMesh);

      // Dynamic point light beneath chassis
      this.underglowLight = new THREE.PointLight(new THREE.Color(hex), 2.2, 4.5);
      this.underglowLight.position.set(0, 0.1, 0);
      this.underglowGroup.add(this.underglowLight);

      this.chassisGroup.add(this.underglowGroup);
    } else {
      this.underglowGroup.visible = true;
      const col = new THREE.Color(hex);
      if (this.underglowMesh) {
        (this.underglowMesh.material as THREE.MeshBasicMaterial).color.copy(col);
      }
      if (this.underglowLight) {
        this.underglowLight.color.copy(col);
      }
    }
  }

  public setTaxiRoofSign(enabled: boolean) {
    if (!enabled) {
      if (this.taxiSignGroup) this.taxiSignGroup.visible = false;
      return;
    }

    if (!this.taxiSignGroup) {
      this.taxiSignGroup = new THREE.Group();
      // Mount on roof
      this.taxiSignGroup.position.set(0, 1.40, -0.15);

      // Aerodynamic taxi sign housing (illuminated yellow/amber box)
      const signGeo = new THREE.BoxGeometry(0.72, 0.22, 0.28);
      const signMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.8,
        roughness: 0.3,
      });
      const signMesh = new THREE.Mesh(signGeo, signMat);
      this.taxiSignGroup.add(signMesh);

      // Black mounting feet
      const baseGeo = new THREE.BoxGeometry(0.5, 0.05, 0.2);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.y = -0.12;
      this.taxiSignGroup.add(baseMesh);

      // Lettering decals (front & back TAXI sign plates)
      const plateGeo = new THREE.PlaneGeometry(0.55, 0.15);
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 36;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.font = '900 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TAXI', 64, 18);
      }
      const tex = new THREE.CanvasTexture(canvas);
      const plateMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });

      const frontPlate = new THREE.Mesh(plateGeo, plateMat);
      frontPlate.position.set(0, 0, 0.145);
      this.taxiSignGroup.add(frontPlate);

      const backPlate = new THREE.Mesh(plateGeo, plateMat);
      backPlate.rotation.y = Math.PI;
      backPlate.position.set(0, 0, -0.145);
      this.taxiSignGroup.add(backPlate);

      this.chassisGroup.add(this.taxiSignGroup);
    } else {
      this.taxiSignGroup.visible = true;
    }
  }

  public updateTaillightPositions() {
    const isBus = this.currentVehicleId === 'Bus';
    const rearZ = isBus ? -3.8 : -this.wheelBase - 0.72;
    const frontZ = isBus ? 3.8 : this.wheelBase + 0.72;
    const halfW = isBus ? 0.95 : this.trackWidth * 0.42;
    const lightY = isBus ? 0.9 : 0.52;
    this.tailLightMeshL.position.set(-halfW, lightY, rearZ);
    this.tailLightMeshR.position.set(halfW, lightY, rearZ);
    if (this.headLightMeshL && this.headLightMeshR) {
      this.headLightMeshL.position.set(-halfW, lightY, frontZ);
      this.headLightMeshR.position.set(halfW, lightY, frontZ);
    }
  }

  public setHeadlights(mode: HeadlightMode) {
    if (mode === 'off') {
      this.headLightMat.emissive.setHex(0x000000);
      this.headLightMat.emissiveIntensity = 0.0;
    } else if (mode === 'low') {
      this.headLightMat.color.setHex(0xffffff);
      this.headLightMat.emissive.setHex(0xffea88);
      this.headLightMat.emissiveIntensity = 3.5;
    } else {
      // High beam
      this.headLightMat.color.setHex(0xffffff);
      this.headLightMat.emissive.setHex(0xe0f2fe);
      this.headLightMat.emissiveIntensity = 7.0;
    }
  }

  public setBrakeLights(isBraking: boolean, isNight: boolean) {
    if (isBraking) {
      this.tailLightMat.color.setHex(0xff0022);
      this.tailLightMat.emissive.setHex(0xff0022);
      this.tailLightMat.emissiveIntensity = 4.5;
      this.tailLightMeshL.scale.set(1.25, 1.25, 1.25);
      this.tailLightMeshR.scale.set(1.25, 1.25, 1.25);
    } else {
      this.tailLightMeshL.scale.set(1.0, 1.0, 1.0);
      this.tailLightMeshR.scale.set(1.0, 1.0, 1.0);
      if (isNight) {
        this.tailLightMat.color.setHex(0x990000);
        this.tailLightMat.emissive.setHex(0x660000);
        this.tailLightMat.emissiveIntensity = 1.0;
      } else {
        this.tailLightMat.color.setHex(0x330000);
        this.tailLightMat.emissive.setHex(0x000000);
        this.tailLightMat.emissiveIntensity = 0.0;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Model loading
  // ---------------------------------------------------------------------------

  private applyDimensionsFor(vehicleId: VehicleModelId) {
    if (vehicleId === 'Bus') {
      this.wheelBase = 2.2;
      this.trackWidth = 1.6;
      this.collisionRadius = 1.6;
    } else if (vehicleId === 'Van') {
      this.wheelBase = 1.45;
      this.trackWidth = 1.45;
      this.collisionRadius = 0.95;
    } else if (vehicleId === 'Futuristic_Car_1') {
      this.wheelBase = 1.45;
      this.trackWidth = 1.40;
      this.collisionRadius = 0.92;
    } else if (vehicleId === 'Car_19') {
      this.wheelBase = 1.05;
      this.trackWidth = 1.25;
      this.collisionRadius = 0.78;
    } else {
      this.wheelBase = 1.25;
      this.trackWidth = 1.35;
      this.collisionRadius = 0.85;
    }
  }

  private bindModelNodes(model: THREE.Object3D) {
    this.wheelFL = null;
    this.wheelFR = null;
    this.wheelRL = null;
    this.wheelRR = null;
    this.spoilerNode = null;

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }

      const name = child.name;
      if (name.includes('Wheel_Front_Left')) {
        this.wheelFL = child;
        child.rotation.order = 'YXZ';
      } else if (name.includes('Wheel_Front_Right')) {
        this.wheelFR = child;
        child.rotation.order = 'YXZ';
      } else if (name.includes('Wheel_Rear_Left')) {
        this.wheelRL = child;
        child.rotation.order = 'YXZ';
      } else if (name.includes('Wheel_Rear_Right')) {
        this.wheelRR = child;
        child.rotation.order = 'YXZ';
      } else if (name.includes('Spoiler')) {
        this.spoilerNode = child;
      }
    });

    this.wheelRollAngle = 0;
    this.currentSteerAngle = 0;
  }

  private mountModel(vehicleId: VehicleModelId, model: THREE.Object3D) {
    while (this.chassisGroup.children.length > 0) {
      const child = this.chassisGroup.children[0];
      this.chassisGroup.remove(child);
    }

    this.bindModelNodes(model);
    this.applyDimensionsFor(vehicleId);
    this.updateTaillightPositions();

    this.chassisGroup.add(model);
    this.chassisGroup.add(this.tailLightMeshL);
    this.chassisGroup.add(this.tailLightMeshR);
    this.chassisGroup.add(this.headLightMeshL);
    this.chassisGroup.add(this.headLightMeshR);
    this.applyCurrentPaintColor();
    if (this.underglowGroup) this.chassisGroup.add(this.underglowGroup);
    if (this.taxiSignGroup) this.chassisGroup.add(this.taxiSignGroup);
  }

  async loadModel(vehicleId: VehicleModelId, onProgress?: (percent: number) => void): Promise<void> {
    this.currentVehicleId = vehicleId;
    const stats = VEHICLE_LIST.find((v) => v.id === vehicleId);
    if (stats) this.currentStats = stats;

    if (vehicleId === 'Bus') {
      const busModel = createBusModel();
      this.mountModel('Bus', busModel);
      if (onProgress) onProgress(100);
      return;
    }

    return new Promise((resolve, reject) => {
      this.loader.load(
        this.currentStats.modelFile,
        (gltf) => {
          this.mountModel(vehicleId, gltf.scene);
          resolve();
        },
        (xhr) => {
          if (xhr.total > 0 && onProgress) {
            onProgress(Math.round((xhr.loaded / xhr.total) * 100));
          }
        },
        (error) => {
          console.error(`Error loading vehicle model: ${vehicleId}`, error);
          reject(error);
        }
      );
    });
  }

  // Instantaneously configure vehicle from a pre-loaded template scene without network latency
  public setModelFromScene(vehicleId: VehicleModelId, sourceScene: THREE.Group) {
    this.currentVehicleId = vehicleId;
    const stats = VEHICLE_LIST.find((v) => v.id === vehicleId);
    if (stats) this.currentStats = stats;
    this.mountModel(vehicleId, sourceScene.clone(true));
  }

  public getCurrentVehicleId(): VehicleModelId {
    return this.currentVehicleId;
  }

  // ---------------------------------------------------------------------------
  // Simulation
  // ---------------------------------------------------------------------------

  update(
    controls: PlayerControls,
    delta: number,
    cityColliders: THREE.Box3[] = [],
    onImpact?: (pos: THREE.Vector3, normal: THREE.Vector3, intensity: number) => void
  ) {
    const dt = Math.min(delta, 0.05);
    const stats = this.currentStats;
    const m = this.mass;
    const Iz = this.yawInertia;

    // --- Tuning derived from stats & upgrades -------------------------------
    const engineSpeedMult = 1.0 + (this.engineStage - 1) * 0.16;
    const engineAccelMult = 1.0 + (this.engineStage - 1) * 0.14;
    const boostPowerMult = 1.0 + (this.boostStage - 1) * 0.32;
    // Nitro lifts the ceiling to ~200 km/h on a stock sports car, more with booster upgrades
    const boostSpeedLimitMult = 1.82 + (this.boostStage - 1) * 0.15;

    const maxSpeed = (stats.topSpeedKmh / 3.6) * engineSpeedMult;      // m/s
    const boostMaxSpeed = maxSpeed * boostSpeedLimitMult;
    const peakAccel = ((stats.acceleration / 100) * 8.4 + 2.9) * engineAccelMult; // m/s²
    const engineForce = m * peakAccel;                                   // N at the wheels
    const brakeForce = m * 10.5;                                         // ~1.07 G
    const mu = 0.88 + (stats.handling / 100) * 0.35 + (this.handlingStage - 1) * 0.10;
    const cRoll = m * 0.035; // rolling resistance: ~1 m/s² coast-down at 30 m/s
    const cDrag = Math.max(0.15, (engineForce * 0.3 - cRoll * maxSpeed) / (maxSpeed * maxSpeed));
    const a = this.wheelBase; // CG -> front axle
    const b = this.wheelBase; // CG -> rear axle

    // --- Driver inputs -------------------------------------------------------
    this.updateBasis();
    let vx = this.velocity.dot(this._fwd);
    let vy = this.velocity.dot(this._left);
    const absVx0 = Math.abs(vx);

    // Speed sensitive steering lock (~31° parking, tightening with speed)
    const speedSteerDamp = 1.0 / (1.0 + (absVx0 / 16.0) * 0.7);
    const maxSteer = 0.55 * speedSteerDamp * (0.85 + (stats.handling / 100) * 0.3);
    let targetSteer = 0;
    if (controls.analogX !== undefined && Math.abs(controls.analogX) > 0.05) {
      targetSteer = -controls.analogX * maxSteer;
    } else {
      if (controls.left) targetSteer += maxSteer;
      if (controls.right) targetSteer -= maxSteer;
    }
    // Quick rack: reaches lock in ~0.25 s, self-centres faster still, so taps register immediately
    const steerRate = targetSteer !== 0 ? 11.0 : 15.0;
    this.currentSteerAngle += (targetSteer - this.currentSteerAngle) * Math.min(dt * steerRate, 1.0);
    const steer = this.currentSteerAngle;

    let throttle = 0;
    let brake = 0;
    let reverse = 0;
    if (controls.forward) {
      if (vx < -0.5) brake = 1; else throttle = 1;
    } else if (controls.backward) {
      if (vx > 0.5) brake = 1; else reverse = 1;
    }
    const handbrake = Boolean(controls.handbrake);
    let boosting = Boolean(controls.boost) && throttle > 0;

    if (this.isWrecked) {
      throttle = 0;
      reverse = 0;
      boosting = false;
    }

    // --- Fixed substep integration ------------------------------------------
    const numSubSteps = Math.max(4, Math.ceil(dt / 0.006));
    const h = dt / numSubSteps;

    let wheelspin = false;
    let rearSlip = 0;
    let frontSlip = 0;
    let r = this.yawRate;

    for (let step = 0; step < numSubSteps; step++) {
      const absVx = Math.abs(vx);
      const sgnVx = vx >= 0 ? 1 : -1;

      // Axle loads with longitudinal weight transfer (CG height ~0.5 m)
      const halfLoad = (m * GRAVITY) / 2;
      const transfer = THREE.MathUtils.clamp(
        (m * this.longAccel * 0.5) / (a + b),
        -halfLoad * 0.4,
        halfLoad * 0.4
      );
      const loadF = halfLoad - transfer;
      const loadR = halfLoad + transfer;
      const maxF = mu * loadF;
      const maxR = mu * loadR;

      // Longitudinal drive (rear wheel drive)
      const speedCap = boosting ? boostMaxSpeed : maxSpeed;
      const powerCurve = absVx >= speedCap ? 0 : Math.max(0.3, 1.0 - Math.pow(absVx / speedCap, 1.6));
      let fDrive = throttle * engineForce * powerCurve;
      if (boosting) {
        // Full shove until ~85% of the nitro ceiling, then taper to zero so the cap is a hard limit
        const headroom = THREE.MathUtils.clamp((boostMaxSpeed - absVx) / (boostMaxSpeed * 0.15), 0, 1);
        fDrive += engineForce * 1.6 * boostPowerMult * headroom;
      }
      if (reverse) {
        const revMax = maxSpeed * 0.35;
        fDrive = vx < -revMax ? 0 : -engineForce * 0.45 * Math.max(0.3, 1.0 - absVx / revMax);
      }

      // Braking (opposes motion, fades smoothly through zero to avoid chatter)
      let fBrake = brake * brakeForce * (absVx > 0.3 ? sgnVx : vx / 0.3);
      if (throttle === 0 && reverse === 0 && brake === 0) {
        fBrake += m * 0.9 * THREE.MathUtils.clamp(vx, -1, 1); // engine braking
      }

      // Rolling + aerodynamic resistance (nitro "punches a hole in the air": far less drag while boosting)
      const fRes = boosting
        ? cRoll * vx * 0.8 + cDrag * vx * absVx * 0.5
        : cRoll * vx + cDrag * vx * absVx;

      // Distribute to axles (65/35 brake bias)
      let fxRear = fDrive - fBrake * 0.35;
      let fxFront = -fBrake * 0.65;

      // Handbrake locks the rear wheels: strong drag + big lateral grip loss
      let rearGripFactor = 1.0;
      if (handbrake && absVx > 0.5) {
        fxRear = fDrive * 0.35 - sgnVx * maxR * 0.55;
        rearGripFactor = 0.42;
      }

      // Friction circle: clamp longitudinal, remaining budget goes to lateral.
      // Nitro is allowed past the tyre limit (it's a boost, not a tyre) so top speed isn't traction-capped.
      const rearClamp = maxR * (boosting ? 1.4 : 1.05);
      const rearDemand = Math.abs(fxRear);
      if (rearDemand > rearClamp) {
        fxRear = Math.sign(fxRear) * rearClamp;
        if (throttle > 0 || boosting) wheelspin = true;
      }
      fxFront = THREE.MathUtils.clamp(fxFront, -maxF, maxF);
      const usedR = Math.min(Math.abs(fxRear), maxR * 1.05) * 0.75;
      const usedF = Math.abs(fxFront) * 0.75;
      const latAvailR = Math.sqrt(Math.max(0, maxR * maxR - usedR * usedR)) * rearGripFactor;
      const latAvailF = Math.sqrt(Math.max(0, maxF * maxF - usedF * usedF));

      // Tyre slip angles (front computed in the steered tyre frame so reversing behaves)
      const cosS = Math.cos(steer);
      const sinS = Math.sin(steer);
      const vLatFrontTyre = (vy + a * r) * cosS - vx * sinS;
      const vLongFrontTyre = vx * cosS + (vy + a * r) * sinS;
      frontSlip = Math.atan2(vLatFrontTyre, Math.max(Math.abs(vLongFrontTyre), 0.6));
      rearSlip = Math.atan2(vy - b * r, Math.max(absVx, 0.6));

      const cF = 9.0 * loadF;  // cornering stiffness N/rad
      const cR = 9.5 * loadR;  // slightly stiffer rear -> stable understeer balance
      const fyFrontTyre = THREE.MathUtils.clamp(-cF * frontSlip, -latAvailF, latAvailF);
      const fyRear = THREE.MathUtils.clamp(-cR * rearSlip, -latAvailR, latAvailR);
      const fyFront = fyFrontTyre * cosS;

      // Sum body-frame forces
      const fxTotal = fxRear + fxFront * cosS - fyFrontTyre * sinS - fRes;
      const fyTotal = fyFront + fyRear;

      const ax = fxTotal / m + vy * r;
      const ay = fyTotal / m - vx * r;
      // Yaw damping: base aero/tyre scrub, plus extra settle when sliding without the handbrake
      // so releasing a drift straightens the car instead of spinning it round
      const settle = !handbrake && Math.abs(rearSlip) > 0.25 ? 0.9 : 0;
      const rDot = (a * fyFront - b * fyRear) / Iz - r * (0.45 + settle);

      vx += ax * h;
      vy += ay * h;
      r += rDot * h;

      // Low speed: blend towards kinematic steering so parking feels crisp and nothing jitters
      const blend = THREE.MathUtils.clamp((absVx - 0.6) / 3.0, 0, 1);
      const rKin = (vx * Math.tan(steer)) / (a + b);
      r += (rKin - r) * (1 - blend) * Math.min(1, h * 18);
      vy *= 1 - (1 - blend) * Math.min(1, h * 14);

      // Full stop snap
      if (throttle === 0 && reverse === 0 && Math.abs(vx) < 0.08 && Math.abs(vy) < 0.08) {
        vx = 0;
        vy = 0;
        r *= 1 - Math.min(1, h * 20);
      }

      this.longAccel = fxTotal / m;
      this.lateralAccel = fyTotal / m;

      // Integrate heading, rebuild world velocity from the body frame
      this.heading += r * h;
      this.updateBasis();
      this.velocity.copy(this._fwd).multiplyScalar(vx).addScaledVector(this._left, vy);

      // Position + static collision resolution
      const nextPos = this.position.clone().addScaledVector(this.velocity, h);
      r = this.resolveStaticCollisions(nextPos, cityColliders, r, m, Iz, onImpact);
      this.position.copy(nextPos);

      // Collisions may have altered the world velocity: refresh body components
      vx = this.velocity.dot(this._fwd);
      vy = this.velocity.dot(this._left);
    }

    this.yawRate = r;
    this.rearSlipAngle = rearSlip;
    this.frontSlipAngle = frontSlip;
    this.isWheelspin = wheelspin && Math.abs(vx) < maxSpeed * 0.5;

    // Apply finalized transform
    this.position.y = 0;
    this.rootGroup.position.copy(this.position);
    this.rootGroup.rotation.y = this.heading;

    // Drift = rear axle sliding while carrying speed
    const absVx = Math.abs(vx);
    this.isDrifting = absVx > 4.0 && (Math.abs(rearSlip) > 0.16 || (handbrake && Math.abs(vy) > 1.2));
    if (this.isDrifting) {
      this.driftScore += Math.round(absVx * dt * 25);
    }

    audioManager.setDrifting(this.isDrifting || this.isWheelspin);
    audioManager.playHorn(controls.horn);

    // Telemetry speed in KM/H
    this.speedKmh = Math.round(vx * 3.6);
    audioManager.updateEngine(this.isWrecked ? 0 : this.speedKmh, (controls.forward || controls.boost) && !this.isWrecked);

    // --- Wheel animation -----------------------------------------------------
    const wheelRadius = 0.40;
    const spinBoost = this.isWheelspin ? 2.2 : 1.0;
    this.wheelRollAngle += ((vx * spinBoost) / wheelRadius) * dt;
    this.wheelRollAngle = this.wheelRollAngle % (Math.PI * 2);

    const setWheel = (w: THREE.Object3D | null, steerY: number) => {
      if (!w) return;
      w.rotation.order = 'YXZ';
      w.rotation.y = steerY;
      w.rotation.x = this.wheelRollAngle;
      w.rotation.z = 0;
    };
    setWheel(this.wheelFL, steer);
    setWheel(this.wheelFR, steer);
    setWheel(this.wheelRL, 0);
    setWheel(this.wheelRR, 0);

    // --- Body pitch/roll from real accelerations ---------------------------
    const targetPitch = THREE.MathUtils.clamp(-this.longAccel * 0.0065, -0.06, 0.06);
    const targetRoll = THREE.MathUtils.clamp(-this.lateralAccel * 0.011, -0.09, 0.09);
    this.bodyPitch += (targetPitch - this.bodyPitch) * Math.min(1, dt * 8);
    this.bodyRoll += (targetRoll - this.bodyRoll) * Math.min(1, dt * 8);

    this.updateSuspensionSpring(dt);
  }

  /**
   * Three test spheres (front / centre / rear) against static AABBs.
   * Mutates nextPos and this.velocity; returns the updated yaw rate.
   */
  private resolveStaticCollisions(
    nextPos: THREE.Vector3,
    cityColliders: THREE.Box3[],
    r: number,
    m: number,
    Iz: number,
    onImpact?: (pos: THREE.Vector3, normal: THREE.Vector3, intensity: number) => void
  ): number {
    const fwdX = this._fwd.x;
    const fwdZ = this._fwd.z;
    const leftX = this._left.x;
    const leftZ = this._left.z;
    const halfW = this.trackWidth * 0.48;
    const wbFront = this.wheelBase * 1.05;
    const wbRear = this.wheelBase * 1.05;
    const radius = Math.max(0.48, this.collisionRadius * 0.58);
    const radiusSq = radius * radius;
    const restitution = 0.18;

    // 8-point perimeter hull protecting corners and flanks from wall clipping
    const hullPoints = [
      { fwd: wbFront, lat: 0 },             // Front-Center
      { fwd: wbFront * 0.95, lat: halfW },  // Front-Left corner
      { fwd: wbFront * 0.95, lat: -halfW }, // Front-Right corner
      { fwd: 0, lat: halfW },                // Mid-Left flank
      { fwd: 0, lat: -halfW },               // Mid-Right flank
      { fwd: -wbRear, lat: 0 },             // Rear-Center
      { fwd: -wbRear * 0.95, lat: halfW },  // Rear-Left corner
      { fwd: -wbRear * 0.95, lat: -halfW }, // Rear-Right corner
    ];

    // 2-pass relaxation loop to resolve compound corner penetration
    for (let pass = 0; pass < 2; pass++) {
      for (let s = 0; s < hullPoints.length; s++) {
        const hp = hullPoints[s];
        let sx = nextPos.x + fwdX * hp.fwd + leftX * hp.lat;
        let sz = nextPos.z + fwdZ * hp.fwd + leftZ * hp.lat;

        for (let i = 0; i < cityColliders.length; i++) {
          const box = cityColliders[i];

          // Fast bounding rejection
          if (
            sx < box.min.x - radius ||
            sx > box.max.x + radius ||
            sz < box.min.z - radius ||
            sz > box.max.z + radius
          ) {
            continue;
          }

          let nx = 0;
          let nz = 0;
          let penetration = 0;

          const isInside =
            sx >= box.min.x && sx <= box.max.x &&
            sz >= box.min.z && sz <= box.max.z;

          if (isInside) {
            const dLeft = sx - box.min.x;
            const dRight = box.max.x - sx;
            const dBottom = sz - box.min.z;
            const dTop = box.max.z - sz;
            const minD = Math.min(dLeft, dRight, dBottom, dTop);
            if (minD === dLeft) { nx = -1; nz = 0; }
            else if (minD === dRight) { nx = 1; nz = 0; }
            else if (minD === dBottom) { nx = 0; nz = -1; }
            else { nx = 0; nz = 1; }
            penetration = minD + radius + 0.05;
          } else {
            const cx = Math.max(box.min.x, Math.min(sx, box.max.x));
            const cz = Math.max(box.min.z, Math.min(sz, box.max.z));
            const dx = sx - cx;
            const dz = sz - cz;
            const distSq = dx * dx + dz * dz;
            if (distSq >= radiusSq) continue;
            const dist = Math.sqrt(distSq) || 0.0001;
            nx = dx / dist;
            nz = dz / dist;
            penetration = radius - dist + 0.04;
          }

          // De-penetrate
          nextPos.x += nx * penetration;
          nextPos.z += nz * penetration;
          sx += nx * penetration;
          sz += nz * penetration;

          const vDotN = this.velocity.x * nx + this.velocity.z * nz;
          if (vDotN >= 0) continue;

          const impactSpeed = -vDotN;
          const j = (1 + restitution) * impactSpeed; // per unit mass (static body)

          // Normal impulse
          this.velocity.x += nx * j;
          this.velocity.z += nz * j;

          // Scrape friction along the wall
          const vtX = this.velocity.x - nx * (this.velocity.x * nx + this.velocity.z * nz);
          const vtZ = this.velocity.z - nz * (this.velocity.x * nx + this.velocity.z * nz);
          const scrape = 0.12 * Math.min(1, impactSpeed / 4);
          this.velocity.x -= vtX * scrape;
          this.velocity.z -= vtZ * scrape;

          // Angular impulse from off-centre contact
          const leverX = sx - nextPos.x;
          const leverZ = sz - nextPos.z;
          const hitTorque = leverX * nz - leverZ * nx;
          r += hitTorque * j * (m / Iz) * 0.25;

          // Suspension shock
          const intensity = Math.min(impactSpeed / 7.0, 1.8);
          this.bodyPitch -= intensity * 0.1;
          this.bodyRoll += hitTorque * 0.15;

          if (impactSpeed > 0.7) {
            audioManager.playCrash(intensity);
          }
          if (onImpact && impactSpeed > 0.5) {
            const impactPos = new THREE.Vector3(sx - nx * 0.3, 0.45, sz - nz * 0.3);
            const impactNormal = new THREE.Vector3(nx, 0.25, nz);
            onImpact(impactPos, impactNormal, intensity);
          }

          this.applyDamage(this.damageFromImpact(impactSpeed), impactSpeed);
        }
      }
    }

    return r;
  }

  /**
   * Collide this car against a moving box (traffic / police). Resolves penetration and
   * momentum for THIS car immediately, and returns what the other body should apply.
   */
  public collideWithDynamicBox(
    box: THREE.Box3,
    otherMass: number,
    otherVelocity: THREE.Vector3,
    restitution: number = 0.25
  ): DynamicCollisionResult | null {
    this.updateBasis();
    const m = this.mass;
    const Iz = this.yawInertia;
    const fwdX = this._fwd.x;
    const fwdZ = this._fwd.z;
    const leftX = this._left.x;
    const leftZ = this._left.z;
    const halfW = this.trackWidth * 0.48;
    const wbFront = this.wheelBase * 1.05;
    const wbRear = this.wheelBase * 1.05;
    const radius = Math.max(0.48, this.collisionRadius * 0.58);

    const hullPoints = [
      { fwd: wbFront, lat: 0 },
      { fwd: wbFront * 0.95, lat: halfW },
      { fwd: wbFront * 0.95, lat: -halfW },
      { fwd: 0, lat: halfW },
      { fwd: 0, lat: -halfW },
      { fwd: -wbRear, lat: 0 },
      { fwd: -wbRear * 0.95, lat: halfW },
      { fwd: -wbRear * 0.95, lat: -halfW },
    ];

    for (let s = 0; s < hullPoints.length; s++) {
      const hp = hullPoints[s];
      const sx = this.position.x + fwdX * hp.fwd + leftX * hp.lat;
      const sz = this.position.z + fwdZ * hp.fwd + leftZ * hp.lat;

      if (
        sx < box.min.x - radius || sx > box.max.x + radius ||
        sz < box.min.z - radius || sz > box.max.z + radius
      ) continue;

      let nx = 0;
      let nz = 0;
      let penetration = 0;
      const isInside = sx >= box.min.x && sx <= box.max.x && sz >= box.min.z && sz <= box.max.z;

      if (isInside) {
        const dLeft = sx - box.min.x;
        const dRight = box.max.x - sx;
        const dBottom = sz - box.min.z;
        const dTop = box.max.z - sz;
        const minD = Math.min(dLeft, dRight, dBottom, dTop);
        if (minD === dLeft) { nx = -1; nz = 0; }
        else if (minD === dRight) { nx = 1; nz = 0; }
        else if (minD === dBottom) { nx = 0; nz = -1; }
        else { nx = 0; nz = 1; }
        penetration = minD + radius + 0.03;
      } else {
        const cx = Math.max(box.min.x, Math.min(sx, box.max.x));
        const cz = Math.max(box.min.z, Math.min(sz, box.max.z));
        const dx = sx - cx;
        const dz = sz - cz;
        const distSq = dx * dx + dz * dz;
        if (distSq >= radius * radius) continue;
        const dist = Math.sqrt(distSq) || 0.0001;
        nx = dx / dist;
        nz = dz / dist;
        penetration = radius - dist + 0.02;
      }

      // Split de-penetration by mass ratio
      const total = m + otherMass;
      const myShare = otherMass / total;
      const otherShare = m / total;
      this.position.x += nx * penetration * myShare;
      this.position.z += nz * penetration * myShare;
      this.rootGroup.position.copy(this.position);
      const otherShift = new THREE.Vector3(-nx * penetration * otherShare, 0, -nz * penetration * otherShare);

      const relVx = this.velocity.x - otherVelocity.x;
      const relVz = this.velocity.z - otherVelocity.z;
      const relN = relVx * nx + relVz * nz;
      if (relN >= 0) {
        return {
          normal: new THREE.Vector3(nx, 0, nz),
          point: new THREE.Vector3(sx, 0.5, sz),
          relSpeed: 0,
          otherDeltaV: new THREE.Vector3(),
          otherShift,
          impulse: 0,
        };
      }

      const relSpeed = -relN;
      const jScalar = ((1 + restitution) * relSpeed) / (1 / m + 1 / otherMass);

      this.velocity.x += (nx * jScalar) / m;
      this.velocity.z += (nz * jScalar) / m;

      const leverX = sx - this.position.x;
      const leverZ = sz - this.position.z;
      const hitTorque = leverX * nz - leverZ * nx;
      this.yawRate += hitTorque * (jScalar / m) * (m / Iz) * 0.3;

      const intensity = Math.min(relSpeed / 7.0, 1.8);
      this.bodyPitch -= intensity * 0.08;
      this.bodyRoll += hitTorque * 0.12;

      if (relSpeed > 0.8) audioManager.playCrash(intensity);
      // Car-on-car hits crumple both bodies, so each takes roughly half of a wall hit
      this.applyDamage(this.damageFromImpact(relSpeed) * 0.5, relSpeed);

      return {
        normal: new THREE.Vector3(nx, 0, nz),
        point: new THREE.Vector3(sx - nx * 0.3, 0.5, sz - nz * 0.3),
        relSpeed,
        otherDeltaV: new THREE.Vector3((-nx * jScalar) / otherMass, 0, (-nz * jScalar) / otherMass),
        otherShift,
        impulse: jScalar,
      };
    }

    return null;
  }

  public applyChassisImpulse(pitch: number, roll: number) {
    this.chassisImpulseVel.x += pitch * 14.0;
    this.chassisImpulseVel.y += roll * 14.0;
    this.chassisPitchImpulse += pitch;
    this.chassisRollImpulse += roll;
  }

  public updateSuspensionSpring(dt: number) {
    const springK = 85.0;
    const damping = 11.0;

    this.chassisImpulseVel.x += (-springK * this.chassisPitchImpulse - damping * this.chassisImpulseVel.x) * dt;
    this.chassisPitchImpulse += this.chassisImpulseVel.x * dt;

    this.chassisImpulseVel.y += (-springK * this.chassisRollImpulse - damping * this.chassisImpulseVel.y) * dt;
    this.chassisRollImpulse += this.chassisImpulseVel.y * dt;

    this.chassisGroup.position.y = 0;
    this.chassisGroup.rotation.x = this.bodyPitch + this.chassisPitchImpulse;
    this.chassisGroup.rotation.z = this.bodyRoll + this.chassisRollImpulse;
  }

  public getWheelGroundPositions(): { fl: THREE.Vector3; fr: THREE.Vector3; rl: THREE.Vector3; rr: THREE.Vector3 } {
    const result = {
      fl: new THREE.Vector3(),
      fr: new THREE.Vector3(),
      rl: new THREE.Vector3(),
      rr: new THREE.Vector3(),
    };
    const halfW = this.trackWidth * 0.46;
    const frontZ = this.wheelBase * 0.72;
    const rearZ = -this.wheelBase * 0.72;

    if (this.wheelFL) {
      this.wheelFL.getWorldPosition(result.fl);
    } else {
      result.fl.copy(this.rootGroup.localToWorld(new THREE.Vector3(-halfW, 0.28, frontZ)));
    }

    if (this.wheelFR) {
      this.wheelFR.getWorldPosition(result.fr);
    } else {
      result.fr.copy(this.rootGroup.localToWorld(new THREE.Vector3(halfW, 0.28, frontZ)));
    }

    if (this.wheelRL) {
      this.wheelRL.getWorldPosition(result.rl);
    } else {
      result.rl.copy(this.rootGroup.localToWorld(new THREE.Vector3(-halfW, 0.28, rearZ)));
    }

    if (this.wheelRR) {
      this.wheelRR.getWorldPosition(result.rr);
    } else {
      result.rr.copy(this.rootGroup.localToWorld(new THREE.Vector3(halfW, 0.28, rearZ)));
    }

    result.fl.y = 0.022;
    result.fr.y = 0.022;
    result.rl.y = 0.022;
    result.rr.y = 0.022;

    return result;
  }

  /** World-space AABB of the car body (used when the player is on foot / for AI). */
  public getBoundingBox(target: THREE.Box3 = new THREE.Box3()): THREE.Box3 {
    return target.setFromCenterAndSize(
      new THREE.Vector3(this.position.x, 0.8, this.position.z),
      new THREE.Vector3(this.trackWidth * 1.15, 1.6, this.wheelBase * 2.2)
    );
  }

  resetPosition(targetPos: THREE.Vector3 = DEFAULT_SPAWN_POS.clone(), targetHeading: number = 0) {
    this.position.copy(targetPos);
    this.velocity.set(0, 0, 0);
    this.yawRate = 0;
    this.speedKmh = 0;
    this.heading = targetHeading;
    this.currentSteerAngle = 0;
    this.wheelRollAngle = 0;
    this.longAccel = 0;
    this.lateralAccel = 0;
    this.isDrifting = false;
    this.rootGroup.position.copy(this.position);
    this.rootGroup.rotation.y = this.heading;
    this.chassisGroup.rotation.set(0, 0, 0);
  }

  getStats(): VehicleStats {
    return this.currentStats;
  }
}
