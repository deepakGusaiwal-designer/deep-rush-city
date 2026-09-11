import * as THREE from 'three';
import { CameraMode } from '../types/game';

export class FollowCamera {
  public camera: THREE.PerspectiveCamera;
  private currentMode: CameraMode = 'chase';

  // Damping vectors
  private currentCameraPos = new THREE.Vector3(0, 10, -20);
  private currentLookTarget = new THREE.Vector3();
  private baseFov: number = 60;

  // Trauma camera shake
  private trauma: number = 0;

  // Interactive Mouse Drag & Orbit Controls
  public isDragging: boolean = false;
  public orbitYaw: number = 0;       // horizontal azimuth offset in radians
  public orbitPitch: number = 0.28;  // vertical elevation angle in radians
  public distance: number = 7.5;     // camera distance from car
  private lastDragTime: number = 0;
  private pointerStartX: number = 0;
  private pointerStartY: number = 0;

  // Orbit angle for auto-orbit mode
  private autoOrbitAngle: number = 0;

  // Multi-touch tracking & pinch zoom
  private activePointers = new Map<number, { x: number; y: number }>();
  private primaryPointerId: number | null = null;
  private pinchInitialDist: number | null = null;
  private pinchInitialCamDist: number = 7.5;

  // Scratch vectors for zero-allocation camera updates
  private _lookTarget = new THREE.Vector3();
  private _idealPos = new THREE.Vector3();
  private _camOffset = new THREE.Vector3();
  private _rayDir = new THREE.Vector3();
  private _ray = new THREE.Ray();
  private _hitPoint = new THREE.Vector3();
  private _chaseOffset = new THREE.Vector3();
  private _chaseLookAt = new THREE.Vector3();
  private currentOcclusionDist: number = 6.0;

  constructor(fov: number = 60, aspect: number = 1, near: number = 0.1, far: number = 600) {
    this.baseFov = fov;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.camera.position.set(0, 15, 25);
  }

  bindEvents(domElement: HTMLElement) {
    domElement.style.touchAction = 'none';

    const onPointerDown = (e: PointerEvent) => {
      // Left click or touch
      if (e.button === 0 || e.pointerType === 'touch') {
        this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (this.primaryPointerId === null) {
          this.primaryPointerId = e.pointerId;
          this.isDragging = true;
          this.pointerStartX = e.clientX;
          this.pointerStartY = e.clientY;
          this.lastDragTime = performance.now();
        }

        // Two fingers detected -> initialize pinch zoom
        if (this.activePointers.size === 2) {
          const [p1, p2] = Array.from(this.activePointers.values());
          this.pinchInitialDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          this.pinchInitialCamDist = this.distance;
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (this.activePointers.has(e.pointerId)) {
        this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      // Handle pinch-to-zoom when two fingers are touching
      if (this.activePointers.size >= 2 && this.pinchInitialDist) {
        const [p1, p2] = Array.from(this.activePointers.values());
        const currentDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (currentDist > 5) {
          const scale = this.pinchInitialDist / currentDist;
          this.distance = Math.max(3.5, Math.min(24.0, this.pinchInitialCamDist * scale));
          this.lastDragTime = performance.now();
        }
        return;
      }

      // Single finger / left mouse drag: orbit camera around hero or vehicle
      if (this.isDragging && e.pointerId === this.primaryPointerId) {
        const dx = e.clientX - this.pointerStartX;
        const dy = e.clientY - this.pointerStartY;
        this.pointerStartX = e.clientX;
        this.pointerStartY = e.clientY;
        this.lastDragTime = performance.now();

        // Rotate around target
        this.orbitYaw -= dx * 0.007;
        this.orbitPitch += dy * 0.005;

        // Clamp vertical elevation (-5 deg to +70 deg)
        this.orbitPitch = Math.max(-0.08, Math.min(1.2, this.orbitPitch));
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      this.activePointers.delete(e.pointerId);

      if (e.pointerId === this.primaryPointerId) {
        const remaining = Array.from(this.activePointers.keys());
        if (remaining.length > 0) {
          this.primaryPointerId = remaining[0];
          const next = this.activePointers.get(this.primaryPointerId)!;
          this.pointerStartX = next.x;
          this.pointerStartY = next.y;
        } else {
          this.primaryPointerId = null;
          this.isDragging = false;
        }
      }

      if (this.activePointers.size < 2) {
        this.pinchInitialDist = null;
      }
    };

    const onWheel = (e: WheelEvent) => {
      this.distance = Math.max(3.5, Math.min(24.0, this.distance + e.deltaY * 0.01));
      this.lastDragTime = performance.now();
    };

    domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    domElement.addEventListener('wheel', onWheel, { passive: true });
    domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  addTrauma(amount: number) {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  setMode(mode: CameraMode) {
    this.currentMode = mode;
  }

  getMode(): CameraMode {
    return this.currentMode;
  }

  // Update camera following protagonist character on foot (GTA style)
  updateCharacter(
    playerPos: THREE.Vector3,
    playerHeading: number,
    isSprinting: boolean,
    delta: number,
    colliders: THREE.Box3[] = []
  ) {
    const smoothDelta = Math.min(delta, 0.05);

    // Look target on character's chest / upper torso
    this._lookTarget.set(playerPos.x, playerPos.y + 1.35, playerPos.z);

    // Desired distance (closer when sprinting)
    const baseDist = Math.max(2.5, Math.min(8.0, this.distance));
    const targetDist = isSprinting ? baseDist * 0.85 : baseDist;

    const horizDist = Math.cos(this.orbitPitch) * targetDist;
    const vertHeight = Math.sin(this.orbitPitch) * targetDist;

    // Camera offset behind character rotated by orbitYaw
    this._camOffset.set(
      -Math.sin(this.orbitYaw) * horizDist,
      vertHeight,
      -Math.cos(this.orbitYaw) * horizDist
    );

    const maxDist = this._camOffset.length();
    this._idealPos.copy(this._lookTarget).add(this._camOffset);

    // Building Anti-Clip Raycast:
    if (colliders.length > 0) {
      this._rayDir.copy(this._camOffset).normalize();
      this._ray.set(this._lookTarget, this._rayDir);
      let closestHit = maxDist;

      for (let i = 0; i < colliders.length; i++) {
        const b = colliders[i];
        // Quick bounding distance filter
        if (playerPos.x < b.min.x - 12 || playerPos.x > b.max.x + 12) continue;
        if (playerPos.z < b.min.z - 12 || playerPos.z > b.max.z + 12) continue;
        // If the player is standing on or near the roof of a tall building, don't clip camera against this building
        if (playerPos.y > b.max.y - 4.5 && (b.max.y - b.min.y) > 10.0) continue;

        if (this._ray.intersectBox(b, this._hitPoint)) {
          const d = this._lookTarget.distanceTo(this._hitPoint);
          if (d < closestHit) {
            closestHit = Math.max(1.0, d - 0.28);
          }
        }
      }

      // Smooth occlusion transition to eliminate sudden camera jerks near corners
      this.currentOcclusionDist += (closestHit - this.currentOcclusionDist) * Math.min(1.0, smoothDelta * 14.0);

      if (this.currentOcclusionDist < maxDist - 0.05) {
        this._idealPos.copy(this._lookTarget).addScaledVector(this._rayDir, this.currentOcclusionDist);
      } else {
        this.currentOcclusionDist = maxDist;
      }
    }

    // Position & LookAt damping
    const posAlpha = this.isDragging ? 1.0 : (1.0 - Math.exp(-12.0 * smoothDelta));
    this.currentCameraPos.lerp(this._idealPos, posAlpha);
    this.currentLookTarget.lerp(this._lookTarget, posAlpha * 1.5);

    this.camera.up.set(0, 1, 0);
    this.camera.position.copy(this.currentCameraPos);
    this.camera.lookAt(this.currentLookTarget);

    // FOV effect on sprint (60 -> 64)
    const targetFov = isSprinting ? 64 : 60;
    this.camera.fov += (targetFov - this.camera.fov) * (smoothDelta * 6.0);
    this.camera.updateProjectionMatrix();
  }

  // Instantly place the third-person foot camera behind the character (on load or reset)
  snapFootFollow(playerPos: THREE.Vector3) {
    const lookTarget = new THREE.Vector3(playerPos.x, playerPos.y + 1.35, playerPos.z);
    const horizDist = Math.cos(this.orbitPitch) * this.distance;
    const vertHeight = Math.sin(this.orbitPitch) * this.distance;
    const offset = new THREE.Vector3(
      -Math.sin(this.orbitYaw) * horizDist,
      vertHeight,
      -Math.cos(this.orbitYaw) * horizDist
    );
    this.currentCameraPos.copy(lookTarget).add(offset);
    this.currentLookTarget.copy(lookTarget);
    this.camera.up.set(0, 1, 0);
    this.camera.position.copy(this.currentCameraPos);
    this.camera.lookAt(this.currentLookTarget);
  }

  // Instantly place the chase camera behind the vehicle (on load, reset, or teleport)
  snapCarFollow(carPos: THREE.Vector3) {
    const lookTarget = new THREE.Vector3(carPos.x, carPos.y + 0.9, carPos.z);
    const horizDist = Math.cos(this.orbitPitch) * Math.max(this.distance, 7.0);
    const vertHeight = Math.sin(this.orbitPitch) * Math.max(this.distance, 7.0) + 1.2;
    const offset = new THREE.Vector3(
      -Math.sin(this.orbitYaw) * horizDist,
      vertHeight,
      -Math.cos(this.orbitYaw) * horizDist
    );
    this.currentCameraPos.copy(lookTarget).add(offset);
    this.currentLookTarget.copy(lookTarget);
    this.camera.up.set(0, 1, 0);
    this.camera.position.copy(this.currentCameraPos);
    this.camera.lookAt(this.currentLookTarget);
  }

  // Dramatic cinematic low-angle action framing when entering a vehicle
  updateCinematicEnter(
    carPos: THREE.Vector3,
    carHeading: number,
    doorPos: THREE.Vector3,
    progress: number, // 0.0 to 1.0
    delta: number
  ) {
    const smoothDelta = Math.min(delta, 0.1);

    // Left and rear unit vectors relative to car heading
    const leftX = -Math.cos(carHeading);
    const leftZ = Math.sin(carHeading);
    const backX = -Math.sin(carHeading);
    const backZ = -Math.cos(carHeading);

    // Dynamic low-angle 3/4 action camera framing looking up at the driver door
    const chaseDist = 5.2;

    // Smoothly blend from dramatic action angle (0..0.6) to driving chase angle (0.6..1.0)
    let blendT = 0;
    if (progress > 0.6) {
      const exitT = (progress - 0.6) / 0.4;
      blendT = exitT * exitT * (3 - 2 * exitT);
    }

    const lowAngleX = doorPos.x + leftX * 1.6 + backX * 1.9;
    const lowAngleY = 0.65;
    const lowAngleZ = doorPos.z + leftZ * 1.6 + backZ * 1.9;

    const chaseX = carPos.x + backX * chaseDist;
    const chaseY = carPos.y + 2.1;
    const chaseZ = carPos.z + backZ * chaseDist;

    this._idealPos.set(
      lowAngleX + (chaseX - lowAngleX) * blendT,
      lowAngleY + (chaseY - lowAngleY) * blendT,
      lowAngleZ + (chaseZ - lowAngleZ) * blendT
    );

    const lowLookY = 1.05;
    const chaseLookY = carPos.y + 1.1;
    this._lookTarget.set(
      carPos.x,
      lowLookY + (chaseLookY - lowLookY) * blendT,
      carPos.z
    );

    const posAlpha = 1.0 - Math.exp(-14.0 * smoothDelta);
    this.currentCameraPos.lerp(this._idealPos, posAlpha);
    this.currentLookTarget.lerp(this._lookTarget, posAlpha * 1.8);

    // Dynamic cinematic Dutch tilt: subtle roll during entrance, settles upright
    const rollAngle = (1.0 - blendT) * -0.06;
    this.camera.up.set(Math.sin(rollAngle), Math.cos(rollAngle), 0);

    this.camera.position.copy(this.currentCameraPos);
    this.camera.lookAt(this.currentLookTarget);

    const targetFov = 52 + blendT * 8; // 52 cinematic FOV -> 60 normal FOV
    this.camera.fov += (targetFov - this.camera.fov) * (smoothDelta * 8.0);
    this.camera.updateProjectionMatrix();
  }

  update(
    carPosition: THREE.Vector3,
    carQuaternion: THREE.Quaternion,
    speedKmh: number,
    delta: number,
    yawRate: number = 0,
    isDrifting: boolean = false,
    isBoosting: boolean = false
  ) {
    this.camera.up.set(0, 1, 0);
    const smoothDelta = Math.min(delta, 0.1);

    if (this.currentMode === 'chase' || this.currentMode === 'orbit') {
      // If user is not dragging and driving fast in chase mode, gently return orbitYaw to 0 after 2.5s
      const now = performance.now();
      if (this.currentMode === 'chase' && !this.isDragging && (now - this.lastDragTime > 2500) && Math.abs(speedKmh) > 5) {
        this.orbitYaw *= Math.pow(0.5, smoothDelta * 2.0);
        if (Math.abs(this.orbitYaw) < 0.01) this.orbitYaw = 0;
      }

      // Compute ideal camera position in spherical offset relative to car heading
      const horizDist = Math.cos(this.orbitPitch) * this.distance;
      const vertHeight = 1.6 + Math.sin(this.orbitPitch) * this.distance;

      // Relative offset behind car rotated by orbitYaw
      this._chaseOffset.set(
        -Math.sin(this.orbitYaw) * horizDist,
        vertHeight,
        -Math.cos(this.orbitYaw) * horizDist
      );

      // Rotate with car orientation in chase mode, or world-aligned in free orbit
      if (this.currentMode === 'chase') {
        this._chaseOffset.applyQuaternion(carQuaternion);
      }
      this._chaseOffset.add(carPosition);

      this._chaseLookAt.set(0, 1.2, 1.5);
      if (this.currentMode === 'chase') {
        this._chaseLookAt.applyQuaternion(carQuaternion);
      }
      this._chaseLookAt.add(carPosition);

      // Smooth position damping (tight enough that steering never feels like the camera is dragging)
      const posAlpha = this.isDragging ? 1.0 : (1.0 - Math.exp(-13.0 * smoothDelta));
      this.currentCameraPos.lerp(this._chaseOffset, posAlpha);
      this.currentLookTarget.lerp(this._chaseLookAt, Math.min(1, posAlpha * 1.5));

      this.camera.position.copy(this.currentCameraPos);
      this.camera.lookAt(this.currentLookTarget);

      // Apply trauma screen shake on impact
      if (this.trauma > 0.001) {
        const shake = this.trauma * this.trauma;
        const shakeX = (Math.random() * 2 - 1) * 0.9 * shake;
        const shakeY = (Math.random() * 2 - 1) * 0.6 * shake;
        const shakeZ = (Math.random() * 2 - 1) * 0.4 * shake;
        this.camera.position.x += shakeX;
        this.camera.position.y += shakeY;
        this.camera.position.z += shakeZ;
        this.trauma = Math.max(0, this.trauma - smoothDelta * 2.8);
      }

      // Dynamic FOV speed effect (from 60 up to 74)
      const targetFov = this.baseFov + Math.min((Math.abs(speedKmh) / 100) * 12, 14);
      this.camera.fov += (targetFov - this.camera.fov) * (smoothDelta * 4.0);
      this.camera.updateProjectionMatrix();

    } else if (this.currentMode === 'cockpit') {
      this._chaseOffset.set(0, 1.3, 0.9);
      this._chaseOffset.applyQuaternion(carQuaternion);
      this._chaseOffset.add(carPosition);

      this._chaseLookAt.set(0, 1.1, 15);
      this._chaseLookAt.applyQuaternion(carQuaternion);
      this._chaseLookAt.add(carPosition);

      this.camera.position.copy(this._chaseOffset);
      this.camera.lookAt(this._chaseLookAt);
      this.camera.fov = 75;
      this.camera.updateProjectionMatrix();

    } else if (this.currentMode === 'topdown') {
      this._chaseOffset.set(carPosition.x, carPosition.y + 38, carPosition.z - 6);
      this.camera.position.lerp(this._chaseOffset, 0.1);
      this.camera.lookAt(carPosition.x, carPosition.y, carPosition.z);
      this.camera.fov = 55;
      this.camera.updateProjectionMatrix();
    }
  }

  setAspect(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
