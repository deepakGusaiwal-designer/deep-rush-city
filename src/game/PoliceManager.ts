import * as THREE from 'three';
import { TrafficManager, BASE_AVENUES_X, BASE_STREETS_Z, LANE_OFFSET } from './TrafficManager';
import { PlayerMode } from '../types/game';
import { audioManager } from './AudioManager';

export interface BulletTracer {
  mesh: THREE.Mesh;
  startPos: THREE.Vector3;
  currentPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  direction: THREE.Vector3;
  speed: number;
  distanceTraveled: number;
  maxDistance: number;
  damage: number;
  isPlayerTarget: boolean;
}

export interface PoliceCar {
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  heading: number;
  speed: number;
  steer: number;
  box: THREE.Box3;
  mass: number;
  halfLength: number;
  halfWidth: number;
  state: 'chasing' | 'leaving' | 'knocked';
  knockTimer: number;
  spinRate: number;
  leaveTimer: number;
  stuckTimer: number;
  flashTimer: number;
  redLamp: THREE.Mesh;
  blueLamp: THREE.Mesh;
  pointLight: THREE.PointLight | null;
  wheels: THREE.Object3D[];
  frontWheels: THREE.Object3D[];
  wheelRoll: number;
  health: number;
  shootTimer: number;
  muzzleFlashMesh: THREE.Mesh;
  muzzleFlashTimer: number;
}

const COP_MASS = 1550;
const COP_WHEELBASE = 2.6;

/**
 * Police pursuit AI. Cops spawn out of sight when you have stars, intercept, ram and box you in.
 * In Hit-and-Run incidents or high wanted levels, officers are authorized to shoot to kill with
 * service firearms, dealing lethal damage until the hero is wasted.
 */
export class PoliceManager {
  public scene: THREE.Scene;
  public cops: PoliceCar[] = [];
  public bustedProgress: number = 0; // 0..1
  public nearestCopDistance: number = Infinity;
  public lethalForceAuthorized: boolean = false;

  public onBusted: (() => void) | null = null;
  public onHitPlayerOnFoot: ((copVelocity: THREE.Vector3) => void) | null = null;
  public onCopRammedPlayer: ((relSpeed: number) => void) | null = null;
  public onCopShotHit: ((damage: number, hitPoint: THREE.Vector3) => void) | null = null;
  public onCopFired: ((copPos: THREE.Vector3) => void) | null = null;

  private trafficManager: TrafficManager;
  private spawnCooldown: number = 0;
  private bustedTimer: number = 0;
  private footHitCooldown: number = 0;
  private warnedClosing: boolean = false;
  public onWarnClosing: (() => void) | null = null;

  // Bullet tracer geometries & materials
  private activeTracers: BulletTracer[] = [];
  private static tracerGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6);
  private static tracerMat = new THREE.MeshBasicMaterial({
    color: 0xffea00,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
  });

  private static lampRed = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, emissive: 0xff1133, emissiveIntensity: 0.0, roughness: 0.3 });
  private static lampBlue = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, emissive: 0x2563eb, emissiveIntensity: 0.0, roughness: 0.3 });

  constructor(scene: THREE.Scene, trafficManager: TrafficManager) {
    this.scene = scene;
    this.trafficManager = trafficManager;
  }

  // ---------------------------------------------------------------------------
  // Spawning
  // ---------------------------------------------------------------------------

  private buildCopMesh(): { group: THREE.Group; red: THREE.Mesh; blue: THREE.Mesh; light: THREE.PointLight | null; wheels: THREE.Object3D[]; frontWheels: THREE.Object3D[]; muzzleFlash: THREE.Mesh } {
    const template = this.trafficManager.getTemplate('Car_16') ?? this.trafficManager.getTemplate('Car_06');
    const group = new THREE.Group();
    const wheels: THREE.Object3D[] = [];
    const frontWheels: THREE.Object3D[] = [];

    if (template) {
      const body = template.clone(true);
      body.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m, idx) => {
            if (!m) return;
            if (m.name === 'Car_Color' || m.name === 'Color_Glossy' || m.name === 'Color') {
              const cloned = m.clone() as THREE.MeshStandardMaterial;
              cloned.color.setHex(0x0b1220); // black & white cruiser body
              cloned.roughness = 0.35;
              if (Array.isArray(mesh.material)) mesh.material[idx] = cloned;
              else mesh.material = cloned;
            }
          });
        }
        const name = child.name;
        if (name.includes('Wheel_')) {
          child.rotation.order = 'YXZ';
          wheels.push(child);
          if (name.includes('Front')) frontWheels.push(child);
        }
      });
      group.add(body);
    } else {
      // Fallback primitive cruiser
      const bodyMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 0.9, 4.0),
        new THREE.MeshStandardMaterial({ color: 0x0b1220 })
      );
      bodyMesh.position.y = 0.6;
      group.add(bodyMesh);
    }

    // White door panel stripe
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
    const stripeL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 1.7), stripeMat);
    stripeL.position.set(-0.98, 0.68, -0.1);
    const stripeR = stripeL.clone();
    stripeR.position.x = 0.98;
    group.add(stripeL, stripeR);

    // Roof lightbar
    const bar = new THREE.Group();
    bar.position.set(0, 1.42, -0.1);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.3), new THREE.MeshStandardMaterial({ color: 0x111827 }));
    bar.add(base);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.26), PoliceManager.lampRed.clone());
    red.position.set(-0.26, 0.1, 0);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.26), PoliceManager.lampBlue.clone());
    blue.position.set(0.26, 0.1, 0);
    bar.add(red, blue);
    group.add(bar);

    // Only the first few cruisers get a real light for perf
    let light: THREE.PointLight | null = null;
    if (this.cops.length < 3) {
      light = new THREE.PointLight(0xff2244, 0, 11);
      light.position.set(0, 1.9, -0.1);
      group.add(light);
    }

    // Muzzle flash on the patrol window for officer firearm action
    const flashGeo = new THREE.PlaneGeometry(0.65, 0.65);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffea00,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
    muzzleFlash.position.set(-0.85, 1.05, 0.4);
    muzzleFlash.visible = false;
    group.add(muzzleFlash);

    return { group, red, blue, light, wheels, frontWheels, muzzleFlash };
  }

  private pickSpawnPoint(playerPos: THREE.Vector3): { pos: THREE.Vector3; heading: number } {
    // Try a handful of lane points 60-95 m away, choose the first that qualifies
    for (let attempt = 0; attempt < 12; attempt++) {
      const onAvenue = Math.random() > 0.5;
      let x: number;
      let z: number;
      let heading: number;
      if (onAvenue) {
        const ave = BASE_AVENUES_X[Math.floor(Math.random() * BASE_AVENUES_X.length)];
        const dir = Math.random() > 0.5 ? 1 : -1;
        x = ave + LANE_OFFSET * dir;
        z = playerPos.z + (Math.random() > 0.5 ? 1 : -1) * (60 + Math.random() * 35);
        heading = z < playerPos.z ? 0 : Math.PI;
      } else {
        const st = BASE_STREETS_Z[Math.floor(Math.random() * BASE_STREETS_Z.length)];
        const dir = Math.random() > 0.5 ? 1 : -1;
        z = st - LANE_OFFSET * dir;
        x = playerPos.x + (Math.random() > 0.5 ? 1 : -1) * (60 + Math.random() * 35);
        heading = x < playerPos.x ? Math.PI / 2 : -Math.PI / 2;
      }
      const minZ = Math.min(...BASE_STREETS_Z) - 10;
      const maxZ = Math.max(...BASE_STREETS_Z) + 10;
      const minX = Math.min(...BASE_AVENUES_X) - 10;
      const maxX = Math.max(...BASE_AVENUES_X) + 10;
      if (x < minX || x > maxX || z < minZ || z > maxZ) continue;
      const d = Math.hypot(x - playerPos.x, z - playerPos.z);
      if (d < 50) continue;
      return { pos: new THREE.Vector3(x, 0, z), heading };
    }
    // Fallback: straight down the nearest avenue
    const ave = BASE_AVENUES_X.reduce((p, c) => (Math.abs(c - playerPos.x) < Math.abs(p - playerPos.x) ? c : p));
    return { pos: new THREE.Vector3(ave + LANE_OFFSET, 0, playerPos.z + 75), heading: Math.PI };
  }

  private spawnCop(playerPos: THREE.Vector3) {
    const built = this.buildCopMesh();
    const spawn = this.pickSpawnPoint(playerPos);
    built.group.position.copy(spawn.pos);
    built.group.rotation.y = spawn.heading;
    this.scene.add(built.group);

    const cop: PoliceCar = {
      mesh: built.group,
      position: spawn.pos.clone(),
      velocity: new THREE.Vector3(),
      heading: spawn.heading,
      speed: 6,
      steer: 0,
      box: new THREE.Box3(),
      mass: COP_MASS,
      halfLength: 2.0,
      halfWidth: 0.98,
      state: 'chasing',
      knockTimer: 0,
      spinRate: 0,
      leaveTimer: 0,
      stuckTimer: 0,
      flashTimer: Math.random(),
      redLamp: built.red,
      blueLamp: built.blue,
      pointLight: built.light,
      wheels: built.wheels,
      frontWheels: built.frontWheels,
      wheelRoll: 0,
      health: 100,
      shootTimer: 0.8 + Math.random() * 1.2,
      muzzleFlashMesh: built.muzzleFlash,
      muzzleFlashTimer: 0,
    };
    this.updateBox(cop);
    this.cops.push(cop);
  }

  private removeCop(index: number) {
    const cop = this.cops[index];
    this.scene.remove(cop.mesh);
    this.cops.splice(index, 1);
  }

  private clearTracers() {
    for (const tr of this.activeTracers) {
      this.scene.remove(tr.mesh);
    }
    this.activeTracers = [];
  }

  clearAll() {
    while (this.cops.length > 0) this.removeCop(this.cops.length - 1);
    this.clearTracers();
    this.bustedTimer = 0;
    this.bustedProgress = 0;
    this.warnedClosing = false;
    this.lethalForceAuthorized = false;
    audioManager.setSiren(false);
  }

  /** Cops peel off (wanted cleared): stop chasing and drive away. */
  standDown() {
    for (const cop of this.cops) {
      if (cop.state !== 'leaving') {
        cop.state = 'leaving';
        cop.leaveTimer = 0;
      }
      if (cop.muzzleFlashMesh) cop.muzzleFlashMesh.visible = false;
    }
    this.clearTracers();
    this.bustedTimer = 0;
    this.bustedProgress = 0;
    this.warnedClosing = false;
    this.lethalForceAuthorized = false;
  }

  public setLethalForce(authorized: boolean) {
    this.lethalForceAuthorized = authorized;
  }

  public isLethalForce(): boolean {
    return this.lethalForceAuthorized;
  }

  /** Officer draws sidearm and fires at the player */
  private fireAtPlayer(cop: PoliceCar, playerPos: THREE.Vector3, playerVel: THREE.Vector3, playerMode: PlayerMode) {
    cop.shootTimer = 1.0 + Math.random() * 0.8;
    if (cop.muzzleFlashMesh) {
      cop.muzzleFlashMesh.visible = true;
      cop.muzzleFlashTimer = 0.06;
    }

    // World position of patrol window
    const muzzleRel = new THREE.Vector3(-0.85, 1.05, 0.4);
    muzzleRel.applyAxisAngle(new THREE.Vector3(0, 1, 0), cop.heading);
    const muzzleWorld = cop.position.clone().add(muzzleRel);

    // Aim toward hero target position
    const targetY = playerMode === 'driving' ? 0.75 : playerPos.y + 1.0;
    const target = new THREE.Vector3(playerPos.x, targetY, playerPos.z);

    const dist = muzzleWorld.distanceTo(target);
    // Add lead based on hero velocity
    const leadFactor = Math.min(0.28, dist / 90);
    target.addScaledVector(playerVel, leadFactor);

    // Aim dispersion (small tactical spread)
    target.x += (Math.random() - 0.5) * 0.65;
    target.z += (Math.random() - 0.5) * 0.65;

    const dir = target.clone().sub(muzzleWorld).normalize();

    // Firearm report audio with distance attenuation
    audioManager.playGunshot(Math.max(0.18, 1.0 - dist / 50));

    // Spawn visible glowing bullet tracer projectile
    const tracerMesh = new THREE.Mesh(PoliceManager.tracerGeo, PoliceManager.tracerMat.clone());
    tracerMesh.position.copy(muzzleWorld);
    tracerMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    this.scene.add(tracerMesh);

    // Damage calibrated: 8 to 12 direct hits kill a 100 HP hero (~10 HP per hit)
    const damage = 9.5 + Math.random() * 2.0;

    const tracer: BulletTracer = {
      mesh: tracerMesh,
      startPos: muzzleWorld.clone(),
      currentPos: muzzleWorld.clone(),
      targetPos: target.clone(),
      direction: dir,
      speed: 135.0,
      distanceTraveled: 0,
      maxDistance: dist + 6.0,
      damage,
      isPlayerTarget: true,
    };

    this.activeTracers.push(tracer);
    if (this.onCopFired) this.onCopFired(cop.position.clone());
  }

  private updateBox(cop: PoliceCar) {
    // Axis-aligned approximation grown to cover the rotated body reasonably
    const c = Math.abs(Math.cos(cop.heading));
    const s = Math.abs(Math.sin(cop.heading));
    const halfX = cop.halfWidth * c + cop.halfLength * s;
    const halfZ = cop.halfWidth * s + cop.halfLength * c;
    cop.box.min.set(cop.position.x - halfX, 0, cop.position.z - halfZ);
    cop.box.max.set(cop.position.x + halfX, 1.6, cop.position.z + halfZ);
  }

  /** Apply a collision response coming from the player's car. */
  applyImpulse(cop: PoliceCar, deltaV: THREE.Vector3, shift: THREE.Vector3, contact: THREE.Vector3) {
    cop.position.add(shift);
    cop.velocity.add(deltaV);
    const dv = deltaV.length();
    if (dv > 2.2) {
      cop.state = 'knocked';
      cop.knockTimer = Math.max(cop.knockTimer, 0.5 + Math.min(1.4, dv * 0.15));
      const leverX = contact.x - cop.position.x;
      const leverZ = contact.z - cop.position.z;
      cop.spinRate += (leverX * deltaV.z - leverZ * deltaV.x) * 0.5;
    }
    cop.health = Math.max(0, cop.health - Math.max(0, dv - 1) * 7);
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  update(
    delta: number,
    playerPos: THREE.Vector3,
    playerVel: THREE.Vector3,
    playerMode: PlayerMode,
    wantedLevel: number,
    staticColliders: THREE.Box3[],
    isNight: boolean
  ): { hasEyes: boolean; nearestDist: number } {
    const dt = Math.min(delta, 0.05);
    this.spawnCooldown -= dt;
    this.footHitCooldown = Math.max(0, this.footHitCooldown - dt);

    // Population control
    const desired = wantedLevel > 0 ? Math.min(5, wantedLevel + (wantedLevel >= 4 ? 1 : 0)) : 0;
    const chasing = this.cops.filter((c) => c.state !== 'leaving').length;
    if (chasing < desired && this.spawnCooldown <= 0) {
      this.spawnCop(playerPos);
      this.spawnCooldown = chasing === 0 ? 0.4 : 1.6;
    }
    if (wantedLevel === 0) this.standDown();

    const playerSpeed = playerVel.length();
    let nearest = Infinity;
    let hasEyes = false;
    let anyClose = false;

    const maxChaseSpeed = Math.min(31, 15 + wantedLevel * 3.2);

    for (let i = this.cops.length - 1; i >= 0; i--) {
      const cop = this.cops[i];
      const dx = playerPos.x - cop.position.x;
      const dz = playerPos.z - cop.position.z;
      const dist = Math.hypot(dx, dz);
      if (cop.state !== 'leaving') {
        nearest = Math.min(nearest, dist);
        if (dist < 55) hasEyes = true;
      }

      if (cop.state === 'knocked') {
        cop.knockTimer -= dt;
        cop.position.addScaledVector(cop.velocity, dt);
        cop.velocity.multiplyScalar(Math.exp(-2.4 * dt));
        cop.heading += cop.spinRate * dt;
        cop.spinRate *= Math.exp(-3.0 * dt);
        cop.speed = cop.velocity.dot(new THREE.Vector3(Math.sin(cop.heading), 0, Math.cos(cop.heading)));
        this.resolveStatic(cop, staticColliders);
        if (cop.knockTimer <= 0) {
          cop.state = wantedLevel > 0 ? 'chasing' : 'leaving';
          cop.spinRate = 0;
        }
      } else if (cop.state === 'chasing') {
        // --- Intercept steering ------------------------------------------------
        const lead = Math.min(0.6, dist / 40);
        const tx = playerPos.x + playerVel.x * lead;
        const tz = playerPos.z + playerVel.z * lead;
        const desiredHeading = Math.atan2(tx - cop.position.x, tz - cop.position.z);
        let diff = desiredHeading - cop.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const targetSteer = THREE.MathUtils.clamp(diff * 1.4, -0.55, 0.55);
        cop.steer += (targetSteer - cop.steer) * Math.min(1, dt * 7);

        // --- Speed control: charge from far, match+ram mid range, box-in when the player stops.
        // A walking suspect gets pulled up on and cuffed; a sprinting one still gets run down.
        let desiredSpeed: number;
        const onFootWalking = playerMode === 'on_foot' && playerSpeed < 7.2;
        if (onFootWalking && dist < 14) {
          // Close to arm's length even while the suspect keeps walking: match their pace, plus a gap-closing term
          desiredSpeed = Math.max(0, playerSpeed + (dist - 3.0) * 1.6);
        } else if (dist > 26) desiredSpeed = maxChaseSpeed;
        else if (playerSpeed < 3.0) {
          desiredSpeed = dist > 6.5 ? Math.min(9, dist * 0.9) : 0;
        } else {
          desiredSpeed = Math.min(maxChaseSpeed, playerSpeed + 4.5 + wantedLevel);
        }
        // Slow down for sharp turns
        desiredSpeed *= 1 - Math.min(0.55, Math.abs(cop.steer) * 0.8);

        if (cop.speed < desiredSpeed) cop.speed = Math.min(desiredSpeed, cop.speed + 9.5 * dt);
        else cop.speed = Math.max(desiredSpeed, cop.speed - 15 * dt);

        // Bicycle kinematics
        const yaw = (cop.speed * Math.tan(cop.steer)) / COP_WHEELBASE;
        cop.heading += THREE.MathUtils.clamp(yaw, -2.2, 2.2) * dt;
        const fwdX = Math.sin(cop.heading);
        const fwdZ = Math.cos(cop.heading);
        cop.velocity.set(fwdX * cop.speed, 0, fwdZ * cop.speed);
        cop.position.addScaledVector(cop.velocity, dt);

        // Stuck detection (wedged on a building far from the player)
        if (cop.speed < 1.5 && dist > 12) {
          cop.stuckTimer += dt;
          if (cop.stuckTimer > 5.0) {
            this.removeCop(i);
            this.spawnCooldown = 0.2;
            continue;
          }
        } else {
          cop.stuckTimer = 0;
        }

        this.resolveStatic(cop, staticColliders);

        // Too far behind: respawn ahead
        if (dist > 170) {
          this.removeCop(i);
          this.spawnCooldown = 0.2;
          continue;
        }

        // Ran down the player on foot (not while they're hovering overhead on a jetpack)
        if (playerMode === 'on_foot' && playerPos.y < 1.2 && dist < 1.4 && cop.speed > 2.5 && this.footHitCooldown <= 0) {
          this.footHitCooldown = 1.5;
          if (this.onHitPlayerOnFoot) this.onHitPlayerOnFoot(cop.velocity.clone());
        }

        // Officer Shoot-to-Kill Action (authorized during Hit & Run or wanted >= 2)
        const canShoot = this.lethalForceAuthorized || wantedLevel >= 2;
        if (canShoot && dist >= 4.5 && dist <= 48.0) {
          cop.shootTimer -= dt;
          if (cop.shootTimer <= 0) {
            this.fireAtPlayer(cop, playerPos, playerVel, playerMode);
          }
        }
      } else {
        // Leaving: drive straight off, then vanish
        cop.leaveTimer += dt;
        cop.steer *= 0.9;
        cop.speed = Math.min(14, cop.speed + 6 * dt);
        const fwdX = Math.sin(cop.heading);
        const fwdZ = Math.cos(cop.heading);
        cop.velocity.set(fwdX * cop.speed, 0, fwdZ * cop.speed);
        cop.position.addScaledVector(cop.velocity, dt);
        this.resolveStatic(cop, staticColliders);
        if (cop.leaveTimer > 4.5 || dist > 90) {
          this.removeCop(i);
          continue;
        }
      }

      // Cop-cop separation so they don't stack
      for (let j = 0; j < this.cops.length; j++) {
        if (i === j) continue;
        const o = this.cops[j];
        const ox = cop.position.x - o.position.x;
        const oz = cop.position.z - o.position.z;
        const od = Math.hypot(ox, oz);
        if (od > 0.01 && od < 3.6) {
          const push = (3.6 - od) * 0.5;
          cop.position.x += (ox / od) * push;
          cop.position.z += (oz / od) * push;
        }
      }

      // Busted check: a cop pulls up next to a stopped car, or next to a hero who isn't sprinting away
      const onFoot = playerMode === 'on_foot';
      const bustRadius = onFoot ? 5.2 : 5.6;
      const catchable = onFoot ? playerSpeed < 7.2 && playerPos.y < 1.5 : playerSpeed < 1.6;
      if (cop.state === 'chasing' && dist < bustRadius && catchable) anyClose = true;

      // --- Visuals -----------------------------------------------------------
      cop.mesh.position.copy(cop.position);
      cop.mesh.rotation.y = cop.heading;

      cop.wheelRoll = (cop.wheelRoll + (cop.speed / 0.4) * dt) % (Math.PI * 2);
      for (const w of cop.wheels) {
        w.rotation.x = cop.wheelRoll;
        w.rotation.y = cop.frontWheels.includes(w) ? cop.steer : 0;
      }

      cop.flashTimer += dt;
      const phase = Math.floor(cop.flashTimer * 7) % 2 === 0;
      const lit = cop.state !== 'leaving' || cop.leaveTimer < 2.0;
      (cop.redLamp.material as THREE.MeshStandardMaterial).emissiveIntensity = lit && phase ? 3.5 : 0.05;
      (cop.blueLamp.material as THREE.MeshStandardMaterial).emissiveIntensity = lit && !phase ? 3.5 : 0.05;
      if (cop.pointLight) {
        cop.pointLight.color.setHex(phase ? 0xff2244 : 0x2266ff);
        cop.pointLight.intensity = lit ? (isNight ? 9 : 4) : 0;
      }

      // Muzzle flash duration timer
      if (cop.muzzleFlashTimer > 0) {
        cop.muzzleFlashTimer -= dt;
        if (cop.muzzleFlashTimer <= 0 && cop.muzzleFlashMesh) {
          cop.muzzleFlashMesh.visible = false;
        }
      }

      this.updateBox(cop);
    }

    // --- Active Bullet Tracers Simulation ---
    const targetY = playerMode === 'driving' ? 0.75 : playerPos.y + 1.0;
    const heroHitBox = new THREE.Vector3(playerPos.x, targetY, playerPos.z);
    const hitRadius = playerMode === 'driving' ? 2.2 : 0.95;

    for (let t = this.activeTracers.length - 1; t >= 0; t--) {
      const tr = this.activeTracers[t];
      const step = tr.speed * dt;
      tr.distanceTraveled += step;
      tr.currentPos.addScaledVector(tr.direction, step);
      tr.mesh.position.copy(tr.currentPos);

      // Hit detection against hero / vehicle
      const distToHero = tr.currentPos.distanceTo(heroHitBox);
      if (distToHero <= hitRadius && tr.isPlayerTarget) {
        if (this.onCopShotHit) {
          this.onCopShotHit(tr.damage, tr.currentPos.clone());
        }
        this.scene.remove(tr.mesh);
        this.activeTracers.splice(t, 1);
        continue;
      }

      // Expire bullet when past maximum travel distance
      if (tr.distanceTraveled >= tr.maxDistance) {
        this.scene.remove(tr.mesh);
        this.activeTracers.splice(t, 1);
      }
    }

    // Busted timer (on foot the cuffs go on quicker — no car door between you and the officer)
    if (anyClose && wantedLevel > 0) {
      this.bustedTimer += dt * (playerMode === 'on_foot' ? 1.6 : 1.0);
      if (this.bustedTimer > 0.5 && !this.warnedClosing) {
        this.warnedClosing = true;
        if (this.onWarnClosing) this.onWarnClosing();
      }
      if (this.bustedTimer >= 2.4) {
        this.bustedTimer = 0;
        this.bustedProgress = 0;
        if (this.onBusted) this.onBusted();
      }
    } else {
      this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2.5);
      if (this.bustedTimer <= 0) this.warnedClosing = false;
    }
    this.bustedProgress = Math.min(1, this.bustedTimer / 2.4);

    this.nearestCopDistance = nearest;
    const active = this.cops.some((c) => c.state !== 'leaving');
    audioManager.setSiren(active, active ? THREE.MathUtils.clamp(1 - nearest / 75, 0, 1) : 0);

    return { hasEyes, nearestDist: nearest };
  }

  /**
   * Arrest cinematic: cruisers hold position with lights running while the hero is cuffed.
   * Only visuals and the siren update; no movement, no spawning.
   */
  updateVisualsOnly(delta: number, isNight: boolean) {
    const dt = Math.min(delta, 0.05);
    for (const cop of this.cops) {
      cop.speed = 0;
      cop.velocity.set(0, 0, 0);
      cop.flashTimer += dt;
      const phase = Math.floor(cop.flashTimer * 7) % 2 === 0;
      (cop.redLamp.material as THREE.MeshStandardMaterial).emissiveIntensity = phase ? 3.5 : 0.05;
      (cop.blueLamp.material as THREE.MeshStandardMaterial).emissiveIntensity = !phase ? 3.5 : 0.05;
      if (cop.pointLight) {
        cop.pointLight.color.setHex(phase ? 0xff2244 : 0x2266ff);
        cop.pointLight.intensity = isNight ? 9 : 4;
      }
    }
    this.bustedTimer = 0;
    this.bustedProgress = 0;
    audioManager.setSiren(this.cops.length > 0, 0.6);
  }

  /** Two-point (front/centre) sphere push-out against buildings. */
  private resolveStatic(cop: PoliceCar, colliders: THREE.Box3[]) {
    const r = 1.05;
    const fwdX = Math.sin(cop.heading);
    const fwdZ = Math.cos(cop.heading);
    const offsets = [1.5, 0, -1.5];
    for (const off of offsets) {
      const sx = cop.position.x + fwdX * off;
      const sz = cop.position.z + fwdZ * off;
      for (let i = 0; i < colliders.length; i++) {
        const b = colliders[i];
        if (sx < b.min.x - r || sx > b.max.x + r || sz < b.min.z - r || sz > b.max.z + r) continue;
        const cx = Math.max(b.min.x, Math.min(sx, b.max.x));
        const cz = Math.max(b.min.z, Math.min(sz, b.max.z));
        let nx = sx - cx;
        let nz = sz - cz;
        let d = Math.hypot(nx, nz);
        let pen: number;
        if (d < 0.001) {
          const dl = sx - b.min.x, dr = b.max.x - sx, db = sz - b.min.z, dtp = b.max.z - sz;
          const mn = Math.min(dl, dr, db, dtp);
          nx = mn === dl ? -1 : mn === dr ? 1 : 0;
          nz = mn === db ? -1 : mn === dtp ? 1 : 0;
          pen = mn + r;
        } else if (d < r) {
          nx /= d; nz /= d;
          pen = r - d;
        } else continue;

        cop.position.x += nx * pen;
        cop.position.z += nz * pen;
        const vn = cop.velocity.x * nx + cop.velocity.z * nz;
        if (vn < 0) {
          cop.velocity.x -= nx * vn * 1.2;
          cop.velocity.z -= nz * vn * 1.2;
          cop.speed *= 0.55;
          // Nudge heading away from the wall so the AI can steer around it
          const wallSide = fwdX * nz - fwdZ * nx;
          cop.heading += (wallSide > 0 ? -1 : 1) * 0.12;
          if (vn < -3) audioManager.playCrash(Math.min(0.8, -vn / 10));
        }
      }
    }
  }

  dispose() {
    this.clearAll();
  }
}
