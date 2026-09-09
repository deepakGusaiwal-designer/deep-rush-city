import * as THREE from 'three';
import { audioManager } from './AudioManager';

export type PassengerNPCState =
  | 'hidden'
  | 'waiting'
  | 'entering'
  | 'riding'
  | 'exiting'
  | 'thanking';

export interface PassengerAppearance {
  name: string;
  avatarColor: number;
  skinColor?: number;
  pantsColor?: number;
  hairColor?: number;
}

const DEFAULT_SKIN_COLORS = [0xf7d7c4, 0xe2b083, 0xa56839, 0xc88950];
const DEFAULT_PANTS_COLORS = [0x1e3a8a, 0x2563eb, 0xd4a373, 0x1f2937, 0x475569];
const DEFAULT_HAIR_COLORS = [0x18181b, 0x3f2e1e, 0x78350f, 0xd97706, 0x52525b];

export class CabPassengerNPC {
  public rootGroup: THREE.Group;
  private bodyGroup: THREE.Group;
  private torsoGroup: THREE.Group;
  private headGroup: THREE.Group;
  private leftArmGroup: THREE.Group;
  private rightArmGroup: THREE.Group;
  private leftLegGroup: THREE.Group;
  private rightLegGroup: THREE.Group;

  // Materials
  private shirtMat: THREE.MeshStandardMaterial;
  private skinMat: THREE.MeshStandardMaterial;
  private pantsMat: THREE.MeshStandardMaterial;
  private hairMat: THREE.MeshStandardMaterial;

  // State
  public state: PassengerNPCState = 'hidden';
  private stateTimer: number = 0;
  private walkCycle: number = 0;

  // Pathing & Transition targets
  private startPos = new THREE.Vector3();
  private targetDoorPos = new THREE.Vector3();
  private exitSidewalkPos = new THREE.Vector3();
  private parentChassis: THREE.Group | null = null;
  private mainScene: THREE.Scene;

  // Callbacks
  private onEnteredCallback?: () => void;
  private onExitedCallback?: () => void;

  constructor(scene: THREE.Scene) {
    this.mainScene = scene;
    this.rootGroup = new THREE.Group();
    this.bodyGroup = new THREE.Group();
    this.rootGroup.add(this.bodyGroup);

    // Initial default materials
    this.skinMat = new THREE.MeshStandardMaterial({
      color: 0xf7d7c4,
      roughness: 0.85,
      metalness: 0.05,
    });
    this.shirtMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.85,
      metalness: 0.05,
    });
    this.pantsMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      roughness: 0.9,
      metalness: 0.05,
    });
    this.hairMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.85,
    });

    // 1. Torso
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.set(0, 0.84, 0);
    this.bodyGroup.add(this.torsoGroup);

    const torsoGeo = new THREE.BoxGeometry(0.42, 0.54, 0.24);
    const torsoMesh = new THREE.Mesh(torsoGeo, this.shirtMat);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    this.torsoGroup.add(torsoMesh);

    // Stylish collar / tie detail
    const collarGeo = new THREE.BoxGeometry(0.12, 0.24, 0.04);
    const collarMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
    const collarMesh = new THREE.Mesh(collarGeo, collarMat);
    collarMesh.position.set(0, 0.12, 0.13);
    this.torsoGroup.add(collarMesh);

    // 2. Head Group
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.35, 0);
    this.torsoGroup.add(this.headGroup);

    const headGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    const headMesh = new THREE.Mesh(headGeo, this.skinMat);
    headMesh.castShadow = true;
    this.headGroup.add(headMesh);

    // Hair
    const hairGeo = new THREE.BoxGeometry(0.31, 0.14, 0.31);
    const hairMesh = new THREE.Mesh(hairGeo, this.hairMat);
    hairMesh.position.set(0, 0.12, -0.01);
    this.headGroup.add(hairMesh);

    // Sunglasses / shades
    const glassesGeo = new THREE.BoxGeometry(0.24, 0.07, 0.05);
    const glassesMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.1, metalness: 0.8 });
    const glassesMesh = new THREE.Mesh(glassesGeo, glassesMat);
    glassesMesh.position.set(0, 0.02, 0.15);
    this.headGroup.add(glassesMesh);

    // 3. Limbs
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });

    // Left Arm
    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.position.set(-0.28, 0.18, 0);
    this.torsoGroup.add(this.leftArmGroup);

    const armGeo = new THREE.BoxGeometry(0.13, 0.44, 0.13);
    const leftArmMesh = new THREE.Mesh(armGeo, this.shirtMat);
    leftArmMesh.position.set(0, -0.18, 0);
    leftArmMesh.castShadow = true;
    this.leftArmGroup.add(leftArmMesh);

    const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), this.skinMat);
    leftHand.position.set(0, -0.42, 0);
    this.leftArmGroup.add(leftHand);

    // Right Arm (used for hailing / waving)
    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(0.28, 0.18, 0);
    this.torsoGroup.add(this.rightArmGroup);

    const rightArmMesh = new THREE.Mesh(armGeo, this.shirtMat);
    rightArmMesh.position.set(0, -0.18, 0);
    rightArmMesh.castShadow = true;
    this.rightArmGroup.add(rightArmMesh);

    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), this.skinMat);
    rightHand.position.set(0, -0.42, 0);
    this.rightArmGroup.add(rightHand);

    // Left Leg
    this.leftLegGroup = new THREE.Group();
    this.leftLegGroup.position.set(-0.12, 0.58, 0);
    this.bodyGroup.add(this.leftLegGroup);

    const legGeo = new THREE.BoxGeometry(0.16, 0.54, 0.16);
    const leftLegMesh = new THREE.Mesh(legGeo, this.pantsMat);
    leftLegMesh.position.set(0, -0.24, 0);
    leftLegMesh.castShadow = true;
    this.leftLegGroup.add(leftLegMesh);

    const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.24), shoeMat);
    leftShoe.position.set(0, -0.52, 0.04);
    this.leftLegGroup.add(leftShoe);

    // Right Leg
    this.rightLegGroup = new THREE.Group();
    this.rightLegGroup.position.set(0.12, 0.58, 0);
    this.bodyGroup.add(this.rightLegGroup);

    const rightLegMesh = new THREE.Mesh(legGeo, this.pantsMat);
    rightLegMesh.position.set(0, -0.24, 0);
    rightLegMesh.castShadow = true;
    this.rightLegGroup.add(rightLegMesh);

    const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.24), shoeMat);
    rightShoe.position.set(0, -0.52, 0.04);
    this.rightLegGroup.add(rightShoe);

    this.rootGroup.visible = false;
    this.mainScene.add(this.rootGroup);
  }

  // Configure appearance based on dispatched profile
  public setProfile(profile: PassengerAppearance) {
    const skin = profile.skinColor ?? DEFAULT_SKIN_COLORS[Math.floor(Math.random() * DEFAULT_SKIN_COLORS.length)];
    const pants = profile.pantsColor ?? DEFAULT_PANTS_COLORS[Math.floor(Math.random() * DEFAULT_PANTS_COLORS.length)];
    const hair = profile.hairColor ?? DEFAULT_HAIR_COLORS[Math.floor(Math.random() * DEFAULT_HAIR_COLORS.length)];

    this.shirtMat.color.setHex(profile.avatarColor);
    this.skinMat.color.setHex(skin);
    this.pantsMat.color.setHex(pants);
    this.hairMat.color.setHex(hair);
  }

  // 1. Spawn at curb waiting for cab
  public spawnAtCurb(pos: THREE.Vector3, roadHeading: number = 0) {
    this.resetPose();
    this.rootGroup.position.copy(pos);
    this.rootGroup.scale.set(1, 1, 1);
    // Face slightly toward the street
    this.rootGroup.rotation.set(0, roadHeading + Math.PI / 2, 0);
    this.rootGroup.visible = true;
    this.state = 'waiting';
    this.stateTimer = 0;
    this.walkCycle = 0;

    // Ensure it is attached to the main world scene
    if (this.rootGroup.parent !== this.mainScene) {
      if (this.rootGroup.parent) this.rootGroup.parent.remove(this.rootGroup);
      this.mainScene.add(this.rootGroup);
    }
  }

  // 2. Begin entering sequence: walk from curb to vehicle passenger door
  public startEnteringCab(
    carPos: THREE.Vector3,
    carHeading: number,
    onEntered: () => void
  ) {
    if (this.state === 'entering' || this.state === 'riding') return;

    this.state = 'entering';
    this.stateTimer = 0;
    this.onEnteredCallback = onEntered;
    this.startPos.copy(this.rootGroup.position);

    // Compute vehicle right-hand passenger door coordinate
    // Car forward: (sin(h), 0, cos(h)), Right: (cos(h), 0, -sin(h))
    const forwardX = Math.sin(carHeading);
    const forwardZ = Math.cos(carHeading);
    const rightX = Math.cos(carHeading);
    const rightZ = -Math.sin(carHeading);

    // Door is offset to the right side of the car, slightly behind front axle
    this.targetDoorPos.set(
      carPos.x + rightX * 1.35 + forwardX * 0.15,
      carPos.y,
      carPos.z + rightZ * 1.35 + forwardZ * 0.15
    );

    // Face toward the vehicle door
    const dx = this.targetDoorPos.x - this.rootGroup.position.x;
    const dz = this.targetDoorPos.z - this.rootGroup.position.z;
    const targetHeading = Math.atan2(dx, dz);
    this.rootGroup.rotation.set(0, targetHeading, 0);
  }

  // 3. Mount passenger as a seated passenger inside the car chassis
  public mountInsideChassis(chassisGroup: THREE.Group) {
    this.parentChassis = chassisGroup;
    this.state = 'riding';
    this.stateTimer = 0;

    if (this.rootGroup.parent) {
      this.rootGroup.parent.remove(this.rootGroup);
    }

    // Attach to car chassis group in the passenger seat
    chassisGroup.add(this.rootGroup);

    // Front right passenger seat local position
    this.rootGroup.position.set(0.36, 0.42, -0.05);
    this.rootGroup.rotation.set(0, 0, 0);
    this.rootGroup.scale.set(0.82, 0.82, 0.82);
    this.rootGroup.visible = true;

    // Seated Pose
    this.leftLegGroup.position.set(-0.12, 0.52, 0.08);
    this.rightLegGroup.position.set(0.12, 0.52, 0.08);
    this.leftLegGroup.rotation.set(1.42, 0, 0); // Thighs forward
    this.rightLegGroup.rotation.set(1.42, 0, 0);
    this.leftArmGroup.rotation.set(0.9, 0, 0.15); // Resting on lap
    this.rightArmGroup.rotation.set(0.9, 0, -0.15);
    this.torsoGroup.position.set(0, 0.72, -0.05);
    this.torsoGroup.rotation.set(-0.06, 0, 0);
  }

  // 4. Begin exiting sequence: step out from door onto sidewalk & wave thanks
  public startExitingCab(
    carPos: THREE.Vector3,
    carHeading: number,
    onExited: () => void
  ) {
    if (this.state === 'exiting' || this.state === 'thanking') return;

    this.state = 'exiting';
    this.stateTimer = 0;
    this.walkCycle = 0;
    this.onExitedCallback = onExited;

    // Unmount from car chassis and return to world scene
    if (this.rootGroup.parent) {
      this.rootGroup.parent.remove(this.rootGroup);
    }
    this.mainScene.add(this.rootGroup);
    this.rootGroup.scale.set(1, 1, 1);
    this.resetPose();

    const forwardX = Math.sin(carHeading);
    const forwardZ = Math.cos(carHeading);
    const rightX = Math.cos(carHeading);
    const rightZ = -Math.sin(carHeading);

    // Spawn right outside the car door
    const doorX = carPos.x + rightX * 1.35 + forwardX * 0.15;
    const doorZ = carPos.z + rightZ * 1.35 + forwardZ * 0.15;
    this.rootGroup.position.set(doorX, carPos.y, doorZ);

    // Target spot on sidewalk ~3.8 meters away to the right of the car
    this.exitSidewalkPos.set(
      carPos.x + rightX * 3.8 + forwardX * 0.25,
      carPos.y,
      carPos.z + rightZ * 3.8 + forwardZ * 0.25
    );

    // Face toward sidewalk destination
    const dx = this.exitSidewalkPos.x - doorX;
    const dz = this.exitSidewalkPos.z - doorZ;
    this.rootGroup.rotation.set(0, Math.atan2(dx, dz), 0);

    // Sound effects for opening and closing door
    audioManager.playDoorLatch();
    setTimeout(() => {
      audioManager.playDoorSlam();
    }, 280);
  }

  // Reset character to neutral upright pose
  private resetPose() {
    this.torsoGroup.position.set(0, 0.84, 0);
    this.torsoGroup.rotation.set(0, 0, 0);
    this.headGroup.rotation.set(0, 0, 0);
    this.leftArmGroup.position.set(-0.28, 0.18, 0);
    this.rightArmGroup.position.set(0.28, 0.18, 0);
    this.leftArmGroup.rotation.set(0, 0, 0);
    this.rightArmGroup.rotation.set(0, 0, 0);
    this.leftLegGroup.position.set(-0.12, 0.58, 0);
    this.rightLegGroup.position.set(0.12, 0.58, 0);
    this.leftLegGroup.rotation.set(0, 0, 0);
    this.rightLegGroup.rotation.set(0, 0, 0);
  }

  // Main update loop
  public update(delta: number, carPos: THREE.Vector3, carHeading: number) {
    if (this.state === 'hidden' || !this.rootGroup.visible) return;

    const dt = Math.min(delta, 0.1);
    this.stateTimer += dt;

    // --- State 1: Waiting at Curb (Hailing Cab) ---
    if (this.state === 'waiting') {
      // Subtle idle breathing
      this.torsoGroup.position.y = 0.84 + Math.sin(this.stateTimer * 2.5) * 0.015;

      // Hailing arm wave (right arm held high and waving side-to-side)
      this.rightArmGroup.rotation.z = -1.25 + Math.sin(this.stateTimer * 6.5) * 0.35;
      this.rightArmGroup.rotation.x = -0.3 + Math.cos(this.stateTimer * 4.0) * 0.12;

      // Left arm resting naturally
      this.leftArmGroup.rotation.z = 0.15;
      this.leftArmGroup.rotation.x = Math.sin(this.stateTimer * 2.0) * 0.08;

      // Head tracks oncoming car if within 30m
      const distToCar = this.rootGroup.position.distanceTo(carPos);
      if (distToCar < 30.0) {
        const toCar = carPos.clone().sub(this.rootGroup.position);
        toCar.y = 0;
        toCar.normalize();
        const lookAngle = Math.atan2(toCar.x, toCar.z) - this.rootGroup.rotation.y;
        this.headGroup.rotation.y = Math.max(-0.9, Math.min(0.9, lookAngle));
      } else {
        this.headGroup.rotation.y = Math.sin(this.stateTimer * 0.8) * 0.2;
      }
    }

    // --- State 2: Walking from Curb into Cab ---
    else if (this.state === 'entering') {
      const enterDuration = 1.65;
      const progress = Math.min(1.0, this.stateTimer / enterDuration);

      // Interpolate position from curb to car door
      this.rootGroup.position.lerpVectors(this.startPos, this.targetDoorPos, progress);

      // Walk cycle animation
      this.walkCycle += dt * 7.5;
      const legSwing = Math.sin(this.walkCycle) * 0.65;
      const armSwing = Math.cos(this.walkCycle) * 0.55;

      this.leftLegGroup.rotation.x = legSwing;
      this.rightLegGroup.rotation.x = -legSwing;
      this.leftArmGroup.rotation.x = -armSwing;
      this.rightArmGroup.rotation.x = armSwing;
      this.torsoGroup.position.y = 0.84 + Math.abs(Math.sin(this.walkCycle)) * 0.04;

      // When reaching the door (~75% progress): reach for handle & scale into car
      if (progress > 0.75) {
        this.rightArmGroup.rotation.x = -1.1; // reach toward door handle
        this.rightArmGroup.rotation.z = -0.35;
      }

      if (progress >= 1.0) {
        audioManager.playDoorLatch();
        audioManager.playDoorSlam();
        this.onEnteredCallback?.();
      }
    }

    // --- State 3: Seated Inside Cab Driving ---
    else if (this.state === 'riding') {
      // Subtle head sway with vehicle movement
      this.headGroup.rotation.x = Math.sin(this.stateTimer * 3.2) * 0.04;
      this.headGroup.rotation.y = Math.sin(this.stateTimer * 1.5) * 0.08;
      this.torsoGroup.position.y = 0.72 + Math.sin(this.stateTimer * 4.0) * 0.008;
    }

    // --- State 4: Walking from Cab onto Sidewalk ---
    else if (this.state === 'exiting') {
      const exitDuration = 1.75;
      const progress = Math.min(1.0, this.stateTimer / exitDuration);

      // Walk towards sidewalk spot
      const currentWalkPos = new THREE.Vector3().lerpVectors(this.targetDoorPos, this.exitSidewalkPos, progress);
      this.rootGroup.position.copy(currentWalkPos);

      // Walk cycle animation
      this.walkCycle += dt * 6.5;
      const legSwing = Math.sin(this.walkCycle) * 0.6;
      const armSwing = Math.cos(this.walkCycle) * 0.5;

      this.leftLegGroup.rotation.x = legSwing;
      this.rightLegGroup.rotation.x = -legSwing;
      this.leftArmGroup.rotation.x = -armSwing;
      this.rightArmGroup.rotation.x = armSwing;
      this.torsoGroup.position.y = 0.84 + Math.abs(Math.sin(this.walkCycle)) * 0.035;

      if (progress >= 1.0) {
        // Switch to Thank-You state
        this.state = 'thanking';
        this.stateTimer = 0;
        this.resetPose();

        // Turn around to face the cab
        const toCab = carPos.clone().sub(this.rootGroup.position);
        toCab.y = 0;
        toCab.normalize();
        this.rootGroup.rotation.set(0, Math.atan2(toCab.x, toCab.z), 0);

        // Sound effect: cash register chime + farewell
        audioManager.playCashRegister();
      }
    }

    // --- State 5: Celebratory Thank-You Wave ---
    else if (this.state === 'thanking') {
      const thankDuration = 2.4;
      const progress = Math.min(1.0, this.stateTimer / thankDuration);

      // Friendly wave goodbye (raising right arm, waving hand)
      this.rightArmGroup.rotation.z = -1.1 + Math.sin(this.stateTimer * 7.5) * 0.32;
      this.rightArmGroup.rotation.x = -0.4 + Math.cos(this.stateTimer * 5.0) * 0.1;
      this.leftArmGroup.rotation.z = 0.12;

      // Gentle joyful torso bounce
      this.torsoGroup.position.y = 0.84 + Math.sin(this.stateTimer * 5.0) * 0.02;

      // Smoothly fade out at the end of the farewell wave
      if (progress > 0.65) {
        const fade = (1.0 - progress) / 0.35;
        this.rootGroup.scale.setScalar(Math.max(0.01, fade));
      }

      if (progress >= 1.0) {
        this.hide();
        this.onExitedCallback?.();
      }
    }
  }

  public hide() {
    this.state = 'hidden';
    this.rootGroup.visible = false;
    this.resetPose();
    if (this.rootGroup.parent !== this.mainScene) {
      if (this.rootGroup.parent) this.rootGroup.parent.remove(this.rootGroup);
      this.mainScene.add(this.rootGroup);
    }
  }

  public dispose() {
    this.hide();
    if (this.rootGroup.parent) {
      this.rootGroup.parent.remove(this.rootGroup);
    }
  }
}
