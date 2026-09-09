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

  constructor(fov: number = 60, aspect: number = 1, near: number = 0.1, far: number = 600) {
    this.baseFov = fov;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.camera.position.set(0, 15, 25);
  }

  bindEvents(domElement: HTMLElement) {
    domElement.style.touchAction = 'none';

    const onPointerDown = (e: PointerEvent) => {
      // Left click or touch
      if (e.button === 0) {
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
    const smoothDelta = Math.min(delta, 0.1);

    // Look target on character's chest / upper torso
    const lookTarget = new THREE.Vector3(playerPos.x, playerPos.y + 1.35, playerPos.z);

    // Desired distance (closer when sprinting)
    const baseDist = Math.max(2.5, Math.min(8.0, this.distance));
    const targetDist = isSprinting ? baseDist * 0.85 : baseDist;

    const horizDist = Math.cos(this.orbitPitch) * targetDist;
    const vertHeight = Math.sin(this.orbitPitch) * targetDist;

    // Camera offset behind character rotated by orbitYaw
    const offset = new THREE.Vector3(
      -Math.sin(this.orbitYaw) * horizDist,
      vertHeight,
      -Math.cos(this.orbitYaw) * horizDist
    );

    let idealPos = lookTarget.clone().add(offset);

    // Building Anti-Clip Raycast:
    // Cast ray from lookTarget towards idealPos; if a building intersects, bring camera in front of wall
    if (colliders.length > 0) {
      const rayDir = offset.clone().normalize();
      const maxDist = offset.length();
      const ray = new THREE.Ray(lookTarget, rayDir);
      let closestHit = maxDist;

      const hitPoint = new THREE.Vector3();
      for (let i = 0; i < colliders.length; i++) {
        const b = colliders[i];
        // Quick bounding distance filter
        if (playerPos.x < b.min.x - 12 || playerPos.x > b.max.x + 12) continue;
        if (playerPos.z < b.min.z - 12 || playerPos.z > b.max.z + 12) continue;

        if (ray.intersectBox(b, hitPoint)) {
          const d = lookTarget.distanceTo(hitPoint);
          if (d < closestHit) {
            closestHit = Math.max(1.0, d - 0.28);
          }
        }
      }

      if (closestHit < maxDist) {
        idealPos = lookTarget.clone().addScaledVector(rayDir, closestHit);
      }
    }

    // Position & LookAt damping
    const posAlpha = this.isDragging ? 1.0 : (1.0 - Math.exp(-12.0 * smoothDelta));
    this.currentCameraPos.lerp(idealPos, posAlpha);
    this.currentLookTarget.lerp(lookTarget, posAlpha * 1.5);

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
    const lowAnglePos = new THREE.Vector3(
      doorPos.x + leftX * 1.6 + backX * 1.9,
      0.65,
      doorPos.z + leftZ * 1.6 + backZ * 1.9
    );
    const lowAngleLook = new THREE.Vector3(carPos.x, 1.05, carPos.z);

    // Driving chase camera target position
    const chaseDist = 5.2;
    const chasePos = new THREE.Vector3(
      carPos.x + backX * chaseDist,
      carPos.y + 2.1,
      carPos.z + backZ * chaseDist
    );
    const chaseLook = new THREE.Vector3(carPos.x, carPos.y + 1.1, carPos.z);

    // Smoothly blend from dramatic action angle (0..0.6) to driving chase angle (0.6..1.0)
    let blendT = 0;
    if (progress > 0.6) {
      const exitT = (progress - 0.6) / 0.4;
      blendT = exitT * exitT * (3 - 2 * exitT);
    }

    const targetPos = new THREE.Vector3().lerpVectors(lowAnglePos, chasePos, blendT);
    const targetLook = new THREE.Vector3().lerpVectors(lowAngleLook, chaseLook, blendT);

    const posAlpha = 1.0 - Math.exp(-14.0 * smoothDelta);
    this.currentCameraPos.lerp(targetPos, posAlpha);
    this.currentLookTarget.lerp(targetLook, posAlpha * 1.8);

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
    delta: number
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
      const localOffset = new THREE.Vector3(
        -Math.sin(this.orbitYaw) * horizDist,
        vertHeight,
        -Math.cos(this.orbitYaw) * horizDist
      );

      // Rotate with car orientation in chase mode, or world-aligned in free orbit
      if (this.currentMode === 'chase') {
        localOffset.applyQuaternion(carQuaternion);
      }
      localOffset.add(carPosition);

      const idealLookAt = new THREE.Vector3(0, 1.2, 1.5);
      if (this.currentMode === 'chase') {
        idealLookAt.applyQuaternion(carQuaternion);
      }
      idealLookAt.add(carPosition);

      // Smooth position damping (tight enough that steering never feels like the camera is dragging)
      const posAlpha = this.isDragging ? 1.0 : (1.0 - Math.exp(-13.0 * smoothDelta));
      this.currentCameraPos.lerp(localOffset, posAlpha);
      this.currentLookTarget.lerp(idealLookAt, Math.min(1, posAlpha * 1.5));

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
      const targetFov = this.baseFov + Math.min(Math.abs(speedKmh) / 100 * 12, 14);
      this.camera.fov += (targetFov - this.camera.fov) * (smoothDelta * 4.0);
      this.camera.updateProjectionMatrix();

    } else if (this.currentMode === 'cockpit') {
      const hoodOffset = new THREE.Vector3(0, 1.3, 0.9);
      hoodOffset.applyQuaternion(carQuaternion);
      hoodOffset.add(carPosition);

      const forwardTarget = new THREE.Vector3(0, 1.1, 15);
      forwardTarget.applyQuaternion(carQuaternion);
      forwardTarget.add(carPosition);

      this.camera.position.copy(hoodOffset);
      this.camera.lookAt(forwardTarget);
      this.camera.fov = 75;
      this.camera.updateProjectionMatrix();

    } else if (this.currentMode === 'topdown') {
      const targetPos = new THREE.Vector3(carPosition.x, carPosition.y + 38, carPosition.z - 6);
      this.camera.position.lerp(targetPos, 0.1);
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
