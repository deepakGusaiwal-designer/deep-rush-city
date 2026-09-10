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
  public onTumbleBounce: ((impactSpeed: number) => void) | null = null;
  private static readonly FLY_SPEED = 18.5;
  private static readonly FLY_BOOST_SPEED = 35.0;
  private static readonly FLY_LATERAL_SPEED = 6.2; // Calibrated maximum lateral strafe speed in flight
  private static readonly FLY_LATERAL_BOOST_SPEED = 11.5;
  private static readonly MAX_ALTITUDE = 125.0;
  private wasAirborne: boolean = false;
  private lateralHoldTimer: number = 0; // Tracks duration lateral key is held for smooth progressive ease-in

  // Parachute
  public isParachuteOpen: boolean = false;
  private parachuteDeployTimer: number = 0;
  private parachuteInflation: number = 0;
  private isParachuteFlaring: boolean = false;
  private parachuteSteerBias: number = 0;
  private static readonly PARACHUTE_GLIDE_SPEED = 9.8;   // ~35 km/h forward glide
  private static readonly PARACHUTE_DIVE_SPEED = 14.5;   // diving glide (W)
  private static readonly PARACHUTE_SINK_RATE = -3.8;    // gentle cruising sink rate (m/s)
  private static readonly PARACHUTE_FLARE_SINK = -1.6;   // soft landing flare sink rate (m/s)
  private static readonly PARACHUTE_DIVE_SINK = -6.8;    // diving sink rate (m/s)
  private static readonly PARACHUTE_TURN_RATE = 2.0;     // rad/s steering yaw rate

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
  public currentFloorY: number = 0.02;

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
    // If parachute is open, cut it when equipping jetpack
    if (this.isParachuteOpen) {
      this.cutParachute();
    }
    this.isJetpackOn = !this.isJetpackOn;
    this.thrust01 = 0;
    this.isAfterburner = false;
    return this.isJetpackOn;
  }

  /** Deploy the parachute canopy in mid-air. Returns true if successfully deployed. */
  public deployParachute(): boolean {
    if (this.isGrounded || this.isTumbling || this.isRecovering) return false;
    if (this.altitude < 1.6) return false;

    // If jetpack was active, turn it off so parachute takes over
    if (this.isJetpackOn) {
      this.isJetpackOn = false;
      this.thrust01 = 0;
      this.character.setJetpack(false, 0);
    }

    this.isParachuteOpen = true;
    this.parachuteDeployTimer = 0.35;
    this.parachuteInflation = 0.25;
    this.parachuteSteerBias = 0;
    this.isParachuteFlaring = false;

    // Immediately arrest violent downward falling velocity safely
    this.velocity.y = Math.max(this.velocity.y * 0.25, -4.2);

    this.character.setParachute(true, 0.25, 0);
    audioManager.playParachuteDeploy();
    return true;
  }

  /** Cut the parachute lines (cut-away) to return to freefall. */
  public cutParachute(): void {
    if (!this.isParachuteOpen) return;
    this.isParachuteOpen = false;
    this.parachuteInflation = 0;
    this.character.setParachute(false, 0);
    audioManager.playParachuteCut();
  }

  /** Toggle parachute on/off with P key. */
  public toggleParachute(): boolean {
    if (this.isParachuteOpen) {
      this.cutParachute();
      return false;
    }
    return this.deployParachute();
  }

  public applyVehicleHit(impactVelocity: THREE.Vector3) {
    if (this.isTumbling) return;
    if (this.isParachuteOpen) {
      this.cutParachute();
    }
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

  public applyVehicleBailout(bailoutVelocity: THREE.Vector3, speedKmh: number) {
    if (this.isParachuteOpen) {
      this.cutParachute();
    }
    this.isJetpackOn = false;
    this.thrust01 = 0;
    this.character.setJetpack(false, 0);

    this.isTumbling = true;
    this.isRecovering = false;
    // Tumble duration scales with speed: 0.85s at 12 km/h up to 2.4s at 120+ km/h
    this.tumbleTimer = Math.min(2.4, 0.8 + (speedKmh / 120) * 1.4);
    this.velocity.copy(bailoutVelocity);
    this.isGrounded = false;

    // Fast initial tumble roll
    const spinSign = Math.random() > 0.5 ? 1 : -1;
    this.tumbleRot.set(0, 0, 0);
    this.tumbleRotVel.set(
      14.0 + Math.min(speedKmh * 0.15, 14.0),
      spinSign * (7.0 + Math.min(speedKmh * 0.1, 10.0)),
      -spinSign * (9.0 + Math.min(speedKmh * 0.12, 12.0))
    );

    this.character.setTumbleRotation(this.tumbleRot.x, this.tumbleRot.y, this.tumbleRot.z);
    this.character.update(0.016, 'TUMBLE_RAGDOLL', 1.0, 0, 0);
  }

  public setPosition(pos: THREE.Vector3, heading: number = 0) {
    if (this.isParachuteOpen) {
      this.cutParachute();
    }
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
      // When walking/grounded on road or sidewalk, raycast from just above feet (0.35m) so overhead
      // props, streetlight arms, cables, and billboards cannot intercept the ray.
      // When airborne (jumping/jetpack/parachute), raycast from 1.2m above feet to detect rooftops below.
      const rayOffsetY = this.isGrounded ? 0.35 : 1.2;
      this._rayOrigin.set(x, feetY + rayOffsetY, z);
      this.downRaycaster.set(this._rayOrigin, this._rayDir);
      this.downRaycaster.far = 180.0;
      const hits = this.downRaycaster.intersectObjects(walkableMeshes, false);
      for (let i = 0; i < hits.length; i++) {
        const hit = hits[i];
        // Ensure surface is upward-facing so we don't land on vertical walls or underside ceilings
        if (hit.face && hit.face.normal.y < 0.25) continue;
        // Curbs and sidewalk tiles are ~0.22m high; walking character can step up max 0.35m.
        // Higher step-ups (> 0.35m) require jumping or falling from above.
        const maxStepUp = this.isGrounded ? 0.35 : 1.5;
        if (hit.point.y <= feetY + maxStepUp && hit.point.y > ground) {
          ground = hit.point.y;
          break;
        }
      }
    }

    // 2. Fallback / supplementary Box3 check & rooftop geometry guarantees
    for (let i = 0; i < colliders.length; i++) {
      const b = colliders[i];
      if (x < b.min.x - 0.05 || x > b.max.x + 0.05 || z < b.min.z - 0.05 || z > b.max.z + 0.05) continue;

      const isBuilding = (b.max.y - b.min.y) > 10.0;
      if (isBuilding) {
        // High-confidence rooftop fallback if triangle raycast had a seam or missed
        let roofY = b.max.y;
        if (b.min.x > 50 && b.max.x < 115) {
          if (b.min.z > 60) {
            // TwistedTower
            roofY = 105.30;
          } else if (b.min.z > -60 && b.max.z < 30) {
            // Grid005
            roofY = 125.46;
          } else if (b.min.z < -60) {
            // Terrace008
            roofY = z > -76 ? 24.48 : (z > -96 ? 34.6 : 47.96);
          }
        } else if (b.min.x < -10) {
          // Slope buildings
          const t = THREE.MathUtils.clamp((x - (-15.1)) / (-112.0 - (-15.1)), 0, 1);
          roofY = 50.0 + t * 93.5;
        }

        const maxStepUp = this.isGrounded ? 0.35 : 1.5;
        if (roofY <= feetY + maxStepUp && roofY > ground) {
          ground = roofY;
        }
      } else {
        // Only allow standing on vehicle roofs when descending from air (e.g. jumping on a car),
        // never treat street props (traffic poles, trash cans, streetlights) as walkable floors!
        const isVehicle = (b.max.y - b.min.y) >= 0.8 && (b.max.y - b.min.y) <= 2.5 && (b.max.x - b.min.x) >= 1.4 && (b.max.z - b.min.z) >= 1.4;
        if (isVehicle && !this.isGrounded && b.max.y <= feetY + 0.35 && b.max.y > ground) {
          ground = b.max.y;
        }
      }
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
          const impactSpeed = Math.abs(this.velocity.y);
          this.velocity.y = -this.velocity.y * 0.28;
          audioManager.playTumbleImpact();
          if (this.onTumbleBounce) this.onTumbleBounce(impactSpeed);
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
        this.tumbleRot.set(0, 0, 0);
        this.tumbleRotVel.set(0, 0, 0);
        this.character.setTumbleRotation(0, 0, 0);
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

    // 0d. Parachute gliding flight
    if (this.isParachuteOpen) {
      return this.updateParachute(controls, dt, camera, colliders, walkableMeshes);
    }
    if (this.character.isParachuteDeployed) {
      this.character.setParachute(false, 0);
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
    } else if (!this.isGrounded && controls.handbrake && this.fuel > 10 && this.altitude > 2.0) {
      // Emergency mid-air thruster deployment (recovers from accidental J press or skyscraper jump)
      this.isJetpackOn = true;
      this.velocity.y = Math.max(this.velocity.y, 4.5);
    }

    this.velocity.y += PlayerController.GRAVITY * dt;

    // 3. Integrate position
    const prevY = this.position.y;
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y += this.velocity.y * dt;

    // 4. Ground (street or rooftop) collision & Landing Squash detection
    const wasGrounded = this.isGrounded;
    const checkFeetY = Math.max(prevY, this.position.y);
    const floorY = this.groundHeightAt(this.position.x, this.position.z, checkFeetY, colliders, walkableMeshes);
    this.currentFloorY = floorY;
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
    this.character.update(dt, animState, speedRatio, this.bankAngle, this.landingSquash, this.velocity.y);

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
    if (this.isGrounded) {
      this.lateralHoldTimer = 0;
      if (inputLen > 0.01) {
        const nf = inputForward / inputLen;
        const nr = inputRight / inputLen;
        const moveX = camForward.x * nf + camRight.x * nr;
        const moveZ = camForward.z * nf + camRight.z * nr;

        const targetHeading = Math.atan2(moveX, moveZ);
        let diff = targetHeading - this.heading;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.heading += diff * Math.min(1.0, dt * 14.0);

        this.velocity.x += (moveX * PlayerController.WALK_SPEED - this.velocity.x) * Math.min(1.0, dt * PlayerController.ACCEL);
        this.velocity.z += (moveZ * PlayerController.WALK_SPEED - this.velocity.z) * Math.min(1.0, dt * PlayerController.ACCEL);
      } else {
        const damp = Math.exp(-PlayerController.DECEL * dt);
        this.velocity.x *= damp;
        this.velocity.z *= damp;
      }
    } else {
      // In flight: separate forward flight thrust from precision lateral strafe
      if (Math.abs(inputRight) > 0.05) {
        this.lateralHoldTimer = Math.min(0.55, this.lateralHoldTimer + dt);
      } else {
        this.lateralHoldTimer = Math.max(0, this.lateralHoldTimer - dt * 3.5);
      }

      // Progressive ease-in: single quick tap yields ~1.5 - 2.5 m/s gentle positioning adjustment.
      // Sustained hold smoothly accelerates up to 6.2 m/s (or 11.5 m/s with afterburner).
      const latRamp = 0.32 + 0.68 * Math.min(1.0, this.lateralHoldTimer / 0.38);

      const maxFwd = this.isAfterburner ? PlayerController.FLY_BOOST_SPEED : PlayerController.FLY_SPEED;
      const maxLat = (this.isAfterburner ? PlayerController.FLY_LATERAL_BOOST_SPEED : PlayerController.FLY_LATERAL_SPEED) * latRamp;

      const fwdThrust = inputForward * maxFwd;
      const latThrust = inputRight * maxLat;

      // Target heading & aeronautical banking:
      // When moving forward + lateral: carves a smooth banked aeronautical curve
      // When purely strafing left/right: keeps facing forward (camera orientation) with lateral lean
      if (Math.abs(inputForward) > 0.15) {
        const turnBias = inputRight * 0.45;
        const targetHeading = Math.atan2(
          camForward.x * Math.sign(inputForward) + camRight.x * turnBias,
          camForward.z * Math.sign(inputForward) + camRight.z * turnBias
        );
        let diff = targetHeading - this.heading;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.heading += diff * Math.min(1.0, dt * 7.5);
      } else if (Math.abs(inputRight) > 0.05) {
        // Pure lateral strafe: smoothly align heading to camera forward view
        const camYaw = Math.atan2(camForward.x, camForward.z);
        let diff = camYaw - this.heading;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.heading += diff * Math.min(1.0, dt * 5.0);
      }

      // Decompose current velocity into forward and lateral components for specialized air drag & acceleration
      const currFwdSpeed = this.velocity.x * camForward.x + this.velocity.z * camForward.z;
      const currLatSpeed = this.velocity.x * camRight.x + this.velocity.z * camRight.z;

      // Forward flight acceleration / drag
      let newFwdSpeed = currFwdSpeed;
      if (Math.abs(inputForward) > 0.05) {
        const fwdAccel = this.isAfterburner ? 18.0 : 12.0;
        newFwdSpeed += (fwdThrust - currFwdSpeed) * Math.min(1.0, dt * fwdAccel);
      } else {
        newFwdSpeed *= Math.exp(-2.2 * dt); // gentle cruising air drag
      }

      // Lateral strafe acceleration / drag: gentle acceleration rate prevents sudden jerk on single taps
      let newLatSpeed = currLatSpeed;
      if (Math.abs(inputRight) > 0.05) {
        const latAccel = 7.0; // gentle, non-jarring acceleration
        newLatSpeed += (latThrust - currLatSpeed) * Math.min(1.0, dt * latAccel);
      } else {
        newLatSpeed *= Math.exp(-6.5 * dt); // crisp aerodynamic damping stops lateral slide promptly
      }

      this.velocity.x = camForward.x * newFwdSpeed + camRight.x * newLatSpeed;
      this.velocity.z = camForward.z * newFwdSpeed + camRight.z * newLatSpeed;
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
    const checkFeetY = Math.max(prevY, this.position.y);
    const floorY = this.groundHeightAt(this.position.x, this.position.z, checkFeetY, colliders, walkableMeshes);
    this.currentFloorY = floorY;
    if (this.position.y <= floorY && this.velocity.y <= 0) {
      this.position.y = floorY;
      if (!this.isGrounded) {
        if (this.velocity.y < -11 && this.onHardLanding) this.onHardLanding(-this.velocity.y);
        this.landingSquashVel = Math.min(0.35, 0.05 + Math.abs(this.velocity.y) * 0.025);
        if (this.velocity.y < -5) audioManager.playTumbleImpact();
        else audioManager.playLand(Math.abs(this.velocity.y));
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
      this.character.update(dt, animState, Math.min(1, horizSpeed / PlayerController.FLY_BOOST_SPEED), this.bankAngle, this.landingSquash, this.velocity.y);
    } else {
      animState = (this.isSprinting && horizSpeed > 0.5) ? 'RUN' : horizSpeed > 0.3 ? 'WALK' : 'IDLE';
      this.character.update(dt, animState, Math.min(1, horizSpeed / PlayerController.SPRINT_SPEED), this.bankAngle, this.landingSquash, this.velocity.y);
    }
    return animState;
  }

  /**
   * Parachute aerodynamic gliding flight model:
   * Controlled sink rate (-3.8 m/s cruising, -1.6 m/s flare), forward glide (9.8 m/s up to 14.5 m/s dive),
   * responsive yaw steering with toggle pulls and banked canopy/torso tilt, safe stand-up touchdown.
   */
  private updateParachute(
    controls: PlayerControls,
    dt: number,
    camera: THREE.PerspectiveCamera,
    colliders: THREE.Box3[],
    walkableMeshes?: THREE.Mesh[]
  ): CharacterAnimState {
    // Parachute inflation deployment transition (smooth expansion)
    this.parachuteInflation = Math.min(1.0, this.parachuteInflation + dt * 2.8);

    // Steering input (A/D or analogX)
    // Left key turns Left (+X in world space), Right key turns Right (-X in world space)
    let steerInput = 0;
    if (controls.left) steerInput += 1;
    if (controls.right) steerInput -= 1;
    if (controls.analogX !== undefined && Math.abs(controls.analogX) > 0.05) {
      steerInput -= controls.analogX;
    }

    // Smooth toggle pull
    this.parachuteSteerBias += (steerInput - this.parachuteSteerBias) * Math.min(1.0, dt * 7.5);

    // Yaw rotation: turns the canopy and hero towards steered direction (Left turns Left, Right turns Right)
    this.heading += this.parachuteSteerBias * PlayerController.PARACHUTE_TURN_RATE * dt;

    // Pitch & flare controls
    const wantsDive = Boolean(controls.forward) || (controls.analogY !== undefined && controls.analogY < -0.3);
    const wantsFlare = Boolean(controls.backward) || Boolean(controls.handbrake) || (controls.analogY !== undefined && controls.analogY > 0.3);

    let targetFwdSpeed = PlayerController.PARACHUTE_GLIDE_SPEED;
    let targetSink = PlayerController.PARACHUTE_SINK_RATE;
    this.isParachuteFlaring = false;

    if (wantsDive) {
      targetFwdSpeed = PlayerController.PARACHUTE_DIVE_SPEED;
      targetSink = PlayerController.PARACHUTE_DIVE_SINK;
    } else if (wantsFlare) {
      targetFwdSpeed = PlayerController.PARACHUTE_GLIDE_SPEED * 0.45;
      targetSink = PlayerController.PARACHUTE_FLARE_SINK;
      this.isParachuteFlaring = true;
    }

    // Integrate forward flight velocity along current heading
    const fwdX = Math.sin(this.heading);
    const fwdZ = Math.cos(this.heading);

    const accel = this.parachuteInflation >= 0.8 ? 5.5 : 9.0;
    this.velocity.x += (fwdX * targetFwdSpeed - this.velocity.x) * Math.min(1.0, dt * accel);
    this.velocity.z += (fwdZ * targetFwdSpeed - this.velocity.z) * Math.min(1.0, dt * accel);
    this.velocity.y += (targetSink - this.velocity.y) * Math.min(1.0, dt * 6.5);

    // Move position
    const prevY = this.position.y;
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y += this.velocity.y * dt;

    // Bank angle into turn (towards the rope being pulled on screen)
    const targetBank = -this.parachuteSteerBias * 0.38;
    this.bankAngle += (targetBank - this.bankAngle) * Math.min(1.0, dt * 8.0);

    // Ground / rooftop contact detection
    const checkFeetY = Math.max(prevY, this.position.y);
    const floorY = this.groundHeightAt(this.position.x, this.position.z, checkFeetY, colliders, walkableMeshes);
    this.currentFloorY = floorY;

    if (this.position.y <= floorY) {
      // Safe, satisfying stand-up touchdown!
      this.position.y = floorY;
      this.velocity.set(0, 0, 0);
      this.isGrounded = true;
      this.isParachuteOpen = false;
      this.parachuteInflation = 0;
      this.character.setParachute(false, 0);
      audioManager.playLand(1.2);
      this.landingSquashVel = 0.12; // gentle knee squash on landing

      // Resolve wall collisions at landing point
      this.resolveObstacleCollisions(colliders);

      // Update transform
      this.character.rootGroup.position.copy(this.position);
      this.character.rootGroup.rotation.y = this.heading;

      // Immediately switch to ground stance animation
      this.character.update(dt, 'IDLE', 0, 0, this.landingSquash, 0);
      return 'IDLE';
    } else {
      this.isGrounded = false;
    }

    // Resolve wall collisions
    this.resolveObstacleCollisions(colliders);

    // Update transform
    this.character.rootGroup.position.copy(this.position);
    this.character.rootGroup.rotation.y = this.heading;

    // Visual canopy update
    if (this.isParachuteOpen) {
      this.character.setParachute(true, this.parachuteInflation, this.parachuteSteerBias, this.isParachuteFlaring);
    }

    const speedRatio = this.isParachuteFlaring ? 0.15 : (targetFwdSpeed / PlayerController.PARACHUTE_DIVE_SPEED);
    this.character.update(dt, 'PARACHUTE', speedRatio, this.bankAngle, this.landingSquash, this.velocity.y);

    return 'PARACHUTE';
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
        const isBuilding = (b.max.y - b.min.y) > 10.0;

        // If player is standing on or walking on this building's solid rooftop/terrace/slope:
        if (isBuilding) {
          if (this.currentFloorY > 10.0 && py >= this.currentFloorY - 0.25) {
            continue;
          }
        }

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
