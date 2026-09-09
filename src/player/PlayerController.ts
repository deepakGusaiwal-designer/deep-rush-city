import * as THREE from 'three';
import { PlayerControls } from '../types/game';
import { CharacterAnimState } from './PlayerState';
import { PlayerCharacter } from './PlayerCharacter';
import { audioManager } from '../game/AudioManager';

export class PlayerController {
  public character: PlayerCharacter;
  public position = new THREE.Vector3(0, 0.02, 0);
  public velocity = new THREE.Vector3(0, 0, 0);
  public heading: number = 0; // yaw in radians
  public speed: number = 0;
  public isGrounded: boolean = true;
  public isSprinting: boolean = false;

  // Collision dimensions (capsule enveloping shoulders, head, swinging arms, and jetpack)
  public static readonly RADIUS = 0.48;
  public static readonly HEIGHT = 1.85;

  // Movement dynamics
  private static readonly WALK_SPEED = 5.2;   // ~18.7 km/h
  private static readonly SPRINT_SPEED = 9.6; // ~34.5 km/h
  private static readonly ACCEL = 28.0;
  private static readonly DECEL = 22.0;
  private static readonly JUMP_VEL = 6.8;
  private static readonly GRAVITY = -20.0;

  // Jetpack
  public static readonly MAX_FUEL = 100;
  public isJetpackOn: boolean = false;
  public fuel: number = PlayerController.MAX_FUEL;
  public thrust01: number = 0;
  public isAfterburner: boolean = false;
  public onHardLanding: ((impactSpeed: number) => void) | null = null;
  private static readonly FLY_SPEED = 18.5;
  private static readonly FLY_BOOST_SPEED = 35.0;
  private static readonly MAX_ALTITUDE = 125.0;
  private wasAirborne: boolean = false;

  // Rigid Body Tumble & Ragdoll State
  public isTumbling: boolean = false;
  private tumbleTimer: number = 0;
  private tumbleDuration: number = 1.35;
  private tumbleRot = new THREE.Vector3(0, 0, 0);
  private tumbleRotVel = new THREE.Vector3(0, 0, 0);
  public isRecovering: boolean = false;
  private recoveryTimer: number = 0;

  // Physical inertia & dynamic reactions
  private bankAngle: number = 0;
  private previousHeading: number = 0;
  private landingSquash: number = 0;
  private landingSquashVel: number = 0;
  private footstepTimer: number = 0;

  // Downward raycasting for accurate terrain/rooftop/slope surface elevation
  private downRaycaster = new THREE.Raycaster();
  private _rayOrigin = new THREE.Vector3();
  private _rayDir = new THREE.Vector3(0, -1, 0);

  constructor(character: PlayerCharacter) {
    this.character = character;
  }

  /** Altitude above street level in metres. */
  get altitude(): number {
    return Math.max(0, this.position.y - 0.02);
  }

  get isFlying(): boolean {
    return this.isJetpackOn && !this.isGrounded;
  }

  /** Equip / remove the jetpack. Returns the new state. */
  public toggleJetpack(): boolean {
    if (this.isTumbling || this.isRecovering) return this.isJetpackOn;
    this.isJetpackOn = !this.isJetpackOn;
    this.thrust01 = 0;
    this.isAfterburner = false;
    return this.isJetpackOn;
  }

  public applyVehicleHit(impactVelocity: THREE.Vector3) {
    if (this.isTumbling) return;
    this.isTumbling = true;
    this.isRecovering = false;
    this.tumbleTimer = this.tumbleDuration;

    const impactSpeed = impactVelocity.length();
    const impactDir = impactVelocity.clone();
    if (impactSpeed > 0.01) {
      impactDir.normalize();
    } else {
      impactDir.set(0, 0, 1);
    }

    const knockbackForce = Math.min(18.0, Math.max(6.5, impactSpeed * 1.3));
    this.velocity.x = impactDir.x * knockbackForce;
    this.velocity.z = impactDir.z * knockbackForce;
    this.velocity.y = 4.8; // upward pop into air
    this.isGrounded = false;

    // Angular tumbling spin velocities
    this.tumbleRot.set(0, 0, 0);
    this.tumbleRotVel.set(
      (Math.random() * 2 - 1) * 14.0,
      (Math.random() * 2 - 1) * 10.0,
      (Math.random() * 2 - 1) * 16.0
    );

    audioManager.playCrash(0.7);
    audioManager.playTumbleImpact();
  }

  public setPosition(pos: THREE.Vector3, heading: number = 0) {
    this.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.heading = heading;
    this.character.rootGroup.position.copy(this.position);
    this.character.rootGroup.rotation.y = this.heading;
  }

  /**
   * Height of the surface under (x, z): mesh raycasting gives exact terrain/rooftop/slope elevation,
   * supplemented by collider box tops.
   */
  private groundHeightAt(
    x: number,
    z: number,
    feetY: number,
    colliders: THREE.Box3[],
    walkableMeshes?: THREE.Mesh[]
  ): number {
    let ground = 0.02;

    // 1. Raycast downwards against visual meshes (exact triangles: roofs, slopes, steps, plazas, bridges)
    if (walkableMeshes && walkableMeshes.length > 0) {
      this._rayOrigin.set(x, feetY + 1.2, z);
      this.downRaycaster.set(this._rayOrigin, this._rayDir);
      this.downRaycaster.far = 40.0;
      const hits = this.downRaycaster.intersectObjects(walkableMeshes, false);
      for (let i = 0; i < hits.length; i++) {
        const hit = hits[i];
        if (hit.point.y <= feetY + 0.35 && hit.point.y > ground) {
          ground = hit.point.y;
          break;
        }
      }
    }

    // 2. Fallback / supplementary Box3 check (no artificial shrinking near edges)
    for (let i = 0; i < colliders.length; i++) {
      const b = colliders[i];
      if (x < b.min.x - 0.05 || x > b.max.x + 0.05 || z < b.min.z - 0.05 || z > b.max.z + 0.05) continue;
      if (b.max.y <= feetY + 0.35 && b.max.y > ground) ground = b.max.y;
    }
    return ground;
  }

  public update(
    controls: PlayerControls,
    delta: number,
    camera: THREE.PerspectiveCamera,
    colliders: THREE.Box3[],
    walkableMeshes?: THREE.Mesh[]
  ): CharacterAnimState {
    const dt = Math.min(delta, 0.05);

    // 0a. Handle Tumble Ragdoll State
    if (this.isTumbling) {
      this.tumbleTimer -= dt;

      // Integrate tumbling rotation
      this.tumbleRot.x += this.tumbleRotVel.x * dt;
      this.tumbleRot.y += this.tumbleRotVel.y * dt;
      this.tumbleRot.z += this.tumbleRotVel.z * dt;

      // Integrate physics velocity with gravity
      this.velocity.y += PlayerController.GRAVITY * dt;
      this.position.x += this.velocity.x * dt;
      this.position.z += this.velocity.z * dt;
      this.position.y += this.velocity.y * dt;

      // Floor contact & slide friction
      const floorY = this.groundHeightAt(this.position.x, this.position.z, this.position.y, colliders, walkableMeshes);
      if (this.position.y <= floorY) {
        this.position.y = floorY;
        if (this.velocity.y < -2.5) {
          // Bounce off asphalt
          this.velocity.y = -this.velocity.y * 0.28;
          audioManager.playTumbleImpact();
        } else {
          this.velocity.y = 0;
          this.isGrounded = true;
        }

        // Tarmac sliding friction
        this.velocity.x *= Math.exp(-6.5 * dt);
        this.velocity.z *= Math.exp(-6.5 * dt);
        this.tumbleRotVel.multiplyScalar(Math.exp(-5.0 * dt));
      } else {
        this.isGrounded = false;
      }

      this.resolveObstacleCollisions(colliders);

      this.character.rootGroup.position.copy(this.position);
      this.character.setTumbleRotation(this.tumbleRot.x, this.tumbleRot.y, this.tumbleRot.z);
      this.character.update(dt, 'TUMBLE_RAGDOLL', 1.0, 0, 0);

      // Transition to get up recovery
      if (this.tumbleTimer <= 0 && this.isGrounded) {
        this.isTumbling = false;
        this.isRecovering = true;
        this.recoveryTimer = 0.48;
        this.velocity.set(0, 0, 0);
      }

      return 'TUMBLE_RAGDOLL';
    }

    // 0b. Handle Get-Up Recovery State
    if (this.isRecovering) {
      this.recoveryTimer -= dt;
      this.velocity.set(0, 0, 0);
      this.character.rootGroup.position.copy(this.position);
      this.character.update(dt, 'GET_UP', 0.5, 0, 0);

      if (this.recoveryTimer <= 0) {
        this.isRecovering = false;
      }
      return 'GET_UP';
    }

    // 0c. Jetpack flight
    if (this.isJetpackOn) {
      return this.updateJetpack(controls, dt, camera, colliders, walkableMeshes);
    }
    this.thrust01 = 0;
    this.isAfterburner = false;
    this.fuel = Math.min(PlayerController.MAX_FUEL, this.fuel + dt * 30); // refuel while walking around

    // 1. Calculate camera-relative movement input vector
    let inputForward = 0;
    let inputRight = 0;

    const hasAnalog = controls.analogX !== undefined && controls.analogY !== undefined && (controls.analogX !== 0 || controls.analogY !== 0);
    if (hasAnalog) {
      inputRight += controls.analogX!;
      inputForward -= controls.analogY!;
    }
    if (controls.forward) inputForward += 1;
    if (controls.backward) inputForward -= 1;
    if (controls.right) inputRight += 1;
    if (controls.left) inputRight -= 1;

    const rawLen = Math.hypot(inputForward, inputRight);
    if (rawLen > 1.0) {
      inputForward /= rawLen;
      inputRight /= rawLen;
    }
    const inputLen = Math.min(1.0, rawLen);
    this.isSprinting = Boolean((controls.boost || (hasAnalog && inputLen > 0.88)) && inputLen > 0.1);

    const targetMaxSpeed = this.isSprinting
      ? PlayerController.SPRINT_SPEED
      : PlayerController.WALK_SPEED;

    // Get horizontal camera vectors
    const camForward = new THREE.Vector3();
    camera.getWorldDirection(camForward);
    camForward.y = 0;
    if (camForward.lengthSq() > 0.001) {
      camForward.normalize();
    } else {
      camForward.set(0, 0, 1);
    }
    const camRight = new THREE.Vector3(-camForward.z, 0, camForward.x);

    let moveX = 0;
    let moveZ = 0;

    if (inputLen > 0.01) {
      const normF = inputForward / inputLen;
      const normR = inputRight / inputLen;

      moveX = camForward.x * normF + camRight.x * normR;
      moveZ = camForward.z * normF + camRight.z * normR;

      // Target heading based on movement vector
      const targetHeading = Math.atan2(moveX, moveZ);

      // Smooth heading slerp
      let diff = targetHeading - this.heading;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.heading += diff * Math.min(1.0, dt * 14.0);

      // Accelerate horizontal velocity towards target
      const targetVx = moveX * targetMaxSpeed;
      const targetVz = moveZ * targetMaxSpeed;

      this.velocity.x += (targetVx - this.velocity.x) * Math.min(1.0, dt * PlayerController.ACCEL);
      this.velocity.z += (targetVz - this.velocity.z) * Math.min(1.0, dt * PlayerController.ACCEL);
    } else {
      // Decelerate smoothly to halt
      const friction = Math.exp(-PlayerController.DECEL * dt);
      this.velocity.x *= friction;
      this.velocity.z *= friction;
      if (Math.hypot(this.velocity.x, this.velocity.z) < 0.05) {
        this.velocity.x = 0;
        this.velocity.z = 0;
      }
    }

    // Centripetal Body Bank Lean into Turns
    let turnDelta = this.heading - this.previousHeading;
    while (turnDelta < -Math.PI) turnDelta += Math.PI * 2;
    while (turnDelta > Math.PI) turnDelta -= Math.PI * 2;
    const turnRate = turnDelta / Math.max(0.001, dt);
    this.previousHeading = this.heading;

    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const targetBank = THREE.MathUtils.clamp(-turnRate * 0.045 * (horizSpeed / PlayerController.SPRINT_SPEED), -0.25, 0.25);
    this.bankAngle += (targetBank - this.bankAngle) * Math.min(1.0, dt * 12.0);

    // Dynamic asphalt footsteps with cadence
    if (this.isGrounded && horizSpeed > 0.8) {
      const stepInterval = this.isSprinting ? 0.28 : 0.38;
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = stepInterval;
        audioManager.playFootstep(this.isSprinting);
      }
    } else {
      this.footstepTimer = 0.08;
    }

    // 2. Jump & Gravity
    if (this.isGrounded && controls.handbrake) {
      this.velocity.y = PlayerController.JUMP_VEL;
      this.isGrounded = false;
      audioManager.playJump();
    }

    this.velocity.y += PlayerController.GRAVITY * dt;

    // 3. Integrate position
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y += this.velocity.y * dt;

    // 4. Ground (street or rooftop) collision & Landing Squash detection
    const wasGrounded = this.isGrounded;
    const floorY = this.groundHeightAt(this.position.x, this.position.z, this.position.y, colliders, walkableMeshes);
    if (this.position.y <= floorY) {
      this.position.y = floorY;
      if (!wasGrounded && this.velocity.y < -1.5) {
        // Compute landing squash impact force
        this.landingSquashVel = Math.min(0.35, 0.05 + Math.abs(this.velocity.y) * 0.025);
        audioManager.playLand(Math.abs(this.velocity.y));
        if (this.velocity.y < -11 && this.onHardLanding) this.onHardLanding(-this.velocity.y);
      }
      this.velocity.y = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    // Spring damped harmonic oscillator for landing squash
    const springK = 220.0;
    const damping = 18.0;
    const springForce = -springK * this.landingSquash - damping * this.landingSquashVel;
    this.landingSquashVel += springForce * dt;
    this.landingSquash += this.landingSquashVel * dt;
    if (Math.abs(this.landingSquash) < 0.002 && Math.abs(this.landingSquashVel) < 0.005) {
      this.landingSquash = 0;
      this.landingSquashVel = 0;
    }

    // 5. Solid Building and Vehicle Obstacle Collision
    this.resolveObstacleCollisions(colliders);

    // 6. Update Character Transform
    this.character.rootGroup.position.copy(this.position);
    this.character.rootGroup.rotation.y = this.heading;

    // 7. Determine Animation State
    this.speed = horizSpeed;

    let animState: CharacterAnimState = 'IDLE';

    if (!this.isGrounded) {
      animState = this.velocity.y > 0.5 ? 'JUMP' : 'FALL';
    } else if (this.isSprinting && horizSpeed > 0.5) {
      animState = 'RUN';
    } else if (horizSpeed > 0.3) {
      animState = 'WALK';
    } else {
      animState = 'IDLE';
    }

    const speedRatio = Math.min(1.0, horizSpeed / PlayerController.SPRINT_SPEED);
    this.character.update(dt, animState, speedRatio, this.bankAngle, this.landingSquash);

    return animState;
  }

  /**
   * Jetpack flight model: camera-relative horizontal thrust, Space for lift, Ctrl to push down,
   * Shift afterburner. Fuel drains in the air and refills on the ground. Hovering slowly sinks,
   * so you feather the throttle to hold altitude; empty tanks mean gravity wins.
   */
  private updateJetpack(
    controls: PlayerControls,
    dt: number,
    camera: THREE.PerspectiveCamera,
    colliders: THREE.Box3[],
    walkableMeshes?: THREE.Mesh[]
  ): CharacterAnimState {
    let inputForward = 0;
    let inputRight = 0;

    const hasAnalog = controls.analogX !== undefined && controls.analogY !== undefined && (controls.analogX !== 0 || controls.analogY !== 0);
    if (hasAnalog) {
      inputRight += controls.analogX!;
      inputForward -= controls.analogY!;
    }
    if (controls.forward) inputForward += 1;
    if (controls.backward) inputForward -= 1;
    if (controls.right) inputRight += 1;
    if (controls.left) inputRight -= 1;

    const rawLen = Math.hypot(inputForward, inputRight);
    if (rawLen > 1.0) {
      inputForward /= rawLen;
      inputRight /= rawLen;
    }
    const inputLen = Math.min(1.0, rawLen);

    const hasFuel = this.fuel > 0;
    this.isAfterburner = Boolean((controls.boost || (hasAnalog && inputLen > 0.88))) && inputLen > 0.1 && hasFuel && !this.isGrounded;
    this.isSprinting = false;

    const camForward = new THREE.Vector3();
    camera.getWorldDirection(camForward);
    camForward.y = 0;
    if (camForward.lengthSq() > 0.001) camForward.normalize(); else camForward.set(0, 0, 1);
    const camRight = new THREE.Vector3(-camForward.z, 0, camForward.x);

    // --- Horizontal control ----------------------------------------------------
    const maxH = this.isGrounded
      ? PlayerController.WALK_SPEED
      : this.isAfterburner ? PlayerController.FLY_BOOST_SPEED : PlayerController.FLY_SPEED;
    const accel = this.isGrounded ? PlayerController.ACCEL : (this.isAfterburner ? 20.0 : 15.0);

    if (inputLen > 0.01) {
      const nf = inputForward / inputLen;
      const nr = inputRight / inputLen;
      const moveX = camForward.x * nf + camRight.x * nr;
      const moveZ = camForward.z * nf + camRight.z * nr;

      const targetHeading = Math.atan2(moveX, moveZ);
      let diff = targetHeading - this.heading;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.heading += diff * Math.min(1.0, dt * (this.isGrounded ? 14.0 : 8.0));

      this.velocity.x += (moveX * maxH - this.velocity.x) * Math.min(1.0, dt * accel);
      this.velocity.z += (moveZ * maxH - this.velocity.z) * Math.min(1.0, dt * accel);
    } else {
      // Air drag / ground friction
      const damp = Math.exp(-(this.isGrounded ? PlayerController.DECEL : 2.2) * dt);
      this.velocity.x *= damp;
      this.velocity.z *= damp;
    }

    // --- Vertical control ------------------------------------------------------
    const wantsUp = Boolean(controls.handbrake) && hasFuel;
    const wantsDown = Boolean(controls.descend);
    let thrust = 0;

    if (wantsUp) {
      // Instant liftoff launch boost if grounded
      if (this.isGrounded) {
        this.velocity.y = Math.max(this.velocity.y, 8.5);
        this.isGrounded = false;
      }
      // Powerful vertical climb
      const climbAccel = 18.0;
      this.velocity.y += climbAccel * dt;
      thrust = 1.0;
      this.fuel -= dt * 4.2; // ~24s continuous vertical ascent
    } else if (!this.isGrounded && hasFuel) {
      if (wantsDown) {
        // Smooth controlled descent
        this.velocity.y -= 14.0 * dt;
        thrust = 0.22;
        this.fuel -= dt * 0.8;
      } else {
        // Active hover stabilization: smoothly levels off vertical velocity
        this.velocity.y *= Math.exp(-4.5 * dt);
        thrust = 0.38;
        this.fuel -= dt * 1.0; // very low fuel burn when cruising or hovering (~100s)
      }
    } else if (!this.isGrounded) {
      // Empty fuel: gravity takes over
      this.velocity.y += PlayerController.GRAVITY * dt;
      thrust = 0;
    }

    if (this.isAfterburner) {
      thrust = Math.max(thrust, 1.0);
      this.fuel -= dt * 3.0;
    }
    this.fuel = Math.max(0, this.fuel);

    this.velocity.y = THREE.MathUtils.clamp(this.velocity.y, -22, 22);
    if (this.position.y > PlayerController.MAX_ALTITUDE && this.velocity.y > 0) this.velocity.y = 0;

    // Leaving the ground under thrust
    if (this.isGrounded && wantsUp) this.isGrounded = false;

    // --- Integrate ---------------------------------------------------------------
    const prevY = this.position.y;
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y += this.velocity.y * dt;

    // Rooftop / street landing
    const floorY = this.groundHeightAt(this.position.x, this.position.z, Math.max(prevY, this.position.y), colliders, walkableMeshes);
    if (this.position.y <= floorY && this.velocity.y <= 0) {
      this.position.y = floorY;
      if (!this.isGrounded) {
        if (this.velocity.y < -11 && this.onHardLanding) this.onHardLanding(-this.velocity.y);
        this.landingSquashVel = Math.min(0.35, 0.05 + Math.abs(this.velocity.y) * 0.025);
        if (this.velocity.y < -5) audioManager.playTumbleImpact();
      }
      this.velocity.y = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    // Refuel rapidly on the ground (~3.5s to full)
    if (this.isGrounded) {
      this.fuel = Math.min(PlayerController.MAX_FUEL, this.fuel + dt * 28);
    }

    // Landing squash spring
    const springK = 220.0;
    const damping = 18.0;
    const springForce = -springK * this.landingSquash - damping * this.landingSquashVel;
    this.landingSquashVel += springForce * dt;
    this.landingSquash += this.landingSquashVel * dt;

    // Walls
    this.resolveObstacleCollisions(colliders);

    // Bank into turns while flying
    let turnDelta = this.heading - this.previousHeading;
    while (turnDelta < -Math.PI) turnDelta += Math.PI * 2;
    while (turnDelta > Math.PI) turnDelta -= Math.PI * 2;
    const turnRate = turnDelta / Math.max(0.001, dt);
    this.previousHeading = this.heading;
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const targetBank = THREE.MathUtils.clamp(-turnRate * 0.12 * (horizSpeed / PlayerController.FLY_SPEED), -0.5, 0.5);
    this.bankAngle += (targetBank - this.bankAngle) * Math.min(1.0, dt * 6.0);

    this.thrust01 = thrust;
    this.speed = horizSpeed;
    this.wasAirborne = !this.isGrounded;

    this.character.rootGroup.position.copy(this.position);
    this.character.rootGroup.rotation.y = this.heading;

    let animState: CharacterAnimState;
    if (!this.isGrounded) {
      animState = 'FLY';
      this.character.update(dt, animState, Math.min(1, horizSpeed / PlayerController.FLY_BOOST_SPEED), this.bankAngle, this.landingSquash);
    } else {
      animState = (this.isSprinting && horizSpeed > 0.5) ? 'RUN' : horizSpeed > 0.3 ? 'WALK' : 'IDLE';
      this.character.update(dt, animState, Math.min(1, horizSpeed / PlayerController.SPRINT_SPEED), this.bankAngle, this.landingSquash);
    }
    return animState;
  }

  // Robust cylinder vs AABB building/vehicle collision push-out with multi-pass relaxation
  private resolveObstacleCollisions(colliders: THREE.Box3[]) {
    const r = PlayerController.RADIUS;
    const passes = 3;

    for (let pass = 0; pass < passes; pass++) {
      let collided = false;
      const py = this.position.y;
      const pTop = py + PlayerController.HEIGHT;

      for (let i = 0; i < colliders.length; i++) {
        const b = colliders[i];

        // Vertical span check (standing on top of a box counts as clear of it)
        if (pTop < b.min.y || py > b.max.y - 0.06) continue;

        // Find closest point on box in XZ
        const cx = Math.max(b.min.x, Math.min(b.max.x, this.position.x));
        const cz = Math.max(b.min.z, Math.min(b.max.z, this.position.z));

        const dx = this.position.x - cx;
        const dz = this.position.z - cz;
        const distSq = dx * dx + dz * dz;

        if (distSq < r * r) {
          collided = true;
          const dist = Math.sqrt(distSq);

          let nx = 0;
          let nz = 0;

          if (dist > 0.001) {
            nx = dx / dist;
            nz = dz / dist;
            // Push out along collision normal
            const penetration = r - dist;
            this.position.x += nx * penetration;
            this.position.z += nz * penetration;
          } else {
            // Inside the box: push out along shallowest axis
            const leftPen = Math.abs(this.position.x - b.min.x);
            const rightPen = Math.abs(b.max.x - this.position.x);
            const frontPen = Math.abs(b.max.z - this.position.z);
            const backPen = Math.abs(this.position.z - b.min.z);

            const minPen = Math.min(leftPen, rightPen, frontPen, backPen);
            if (minPen === leftPen) { nx = -1; nz = 0; this.position.x = b.min.x - r; }
            else if (minPen === rightPen) { nx = 1; nz = 0; this.position.x = b.max.x + r; }
            else if (minPen === backPen) { nx = 0; nz = -1; this.position.z = b.min.z - r; }
            else { nx = 0; nz = 1; this.position.z = b.max.z + r; }
          }

          // Unconditionally cancel inward velocity for all locomotion modes (walk, run, sprint, jetpack)
          const vn = this.velocity.x * nx + this.velocity.z * nz;
          if (vn < 0) {
            this.velocity.x -= nx * vn;
            this.velocity.z -= nz * vn;
          }
        }
      }

      if (!collided) break;
    }
  }
}
