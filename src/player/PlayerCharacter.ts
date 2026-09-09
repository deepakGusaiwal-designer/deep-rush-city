import * as THREE from 'three';
import { CharacterAnimState } from './PlayerState';
import { CityTextures } from '../game/CityTextures';

export class PlayerCharacter {
  public rootGroup: THREE.Group;
  public bodyGroup: THREE.Group;
  public torsoGroup: THREE.Group;
  public headGroup: THREE.Group;
  public leftArmGroup: THREE.Group;
  public rightArmGroup: THREE.Group;
  public leftLegGroup: THREE.Group;
  public rightLegGroup: THREE.Group;
  public contactShadowMesh: THREE.Mesh;
  private handcuffsGroup: THREE.Group;

  // Jetpack rig (hidden until equipped)
  private jetpackGroup: THREE.Group;
  private jetFlames: THREE.Mesh[] = [];
  private jetFlameMat: THREE.MeshStandardMaterial;
  private jetLight: THREE.PointLight;
  private jetThrust: number = 0;

  // Animation state
  public animState: CharacterAnimState = 'IDLE';
  private cycle: number = 0;
  private animTimer: number = 0;

  // Dynamic rigid body / ragdoll rotation
  public tumbleRotation = new THREE.Vector3(0, 0, 0);
  private currentBodyRot = new THREE.Vector3(0, 0, 0);

  // Target bone rotations for smooth blending
  private targetRot = {
    torsoPitch: 0,
    torsoRoll: 0,
    bodyY: 0,
    headPitch: 0,
    leftArmX: 0,
    leftArmZ: 0,
    rightArmX: 0,
    rightArmZ: 0,
    leftLegX: 0,
    rightLegX: 0,
  };

  public setTumbleRotation(pitch: number, yaw: number, roll: number) {
    this.tumbleRotation.set(pitch, yaw, roll);
  }

  constructor() {
    this.rootGroup = new THREE.Group();
    this.bodyGroup = new THREE.Group();
    this.rootGroup.add(this.bodyGroup);

    // --- Materials matching cartoon metropolis palette ---
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xf5cba7,
      roughness: 0.85,
      metalness: 0.05,
    });
    const jacketMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // midnight slate jacket
      roughness: 0.75,
      metalness: 0.15,
    });
    const shirtMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4, // electric cyan inner shirt
      roughness: 0.8,
      metalness: 0.1,
    });
    const jeansMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a, // dark indigo denim
      roughness: 0.85,
      metalness: 0.05,
    });
    const shoeWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6,
      metalness: 0.1,
    });
    const shoeAccentMat = new THREE.MeshStandardMaterial({
      color: 0xef4444, // crimson sneaker sole
      roughness: 0.7,
      metalness: 0.1,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x18181b, // jet dark hair
      roughness: 0.85,
    });
    const shadesMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.2,
      metalness: 0.8,
    });

    // 1. Torso Group
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.set(0, 0.84, 0);
    this.bodyGroup.add(this.torsoGroup);

    // Torso Jacket body
    const torsoGeo = new THREE.BoxGeometry(0.46, 0.54, 0.28);
    const torsoMesh = new THREE.Mesh(torsoGeo, jacketMat);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    this.torsoGroup.add(torsoMesh);

    // Inner shirt chest accent
    const shirtGeo = new THREE.BoxGeometry(0.24, 0.38, 0.04);
    const shirtMesh = new THREE.Mesh(shirtGeo, shirtMat);
    shirtMesh.position.set(0, 0.06, 0.13);
    this.torsoGroup.add(shirtMesh);

    // Belt
    const beltGeo = new THREE.BoxGeometry(0.48, 0.08, 0.3);
    const beltMesh = new THREE.Mesh(beltGeo, hairMat);
    beltMesh.position.set(0, -0.24, 0);
    this.torsoGroup.add(beltMesh);

    // 2. Head Group
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.46, 0);
    this.torsoGroup.add(this.headGroup);

    const headGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    this.headGroup.add(headMesh);

    // Stylish Hair
    const hairGeo = new THREE.BoxGeometry(0.34, 0.12, 0.35);
    const hairMesh = new THREE.Mesh(hairGeo, hairMat);
    hairMesh.position.set(0, 0.14, -0.01);
    this.headGroup.add(hairMesh);

    const hairFringeGeo = new THREE.BoxGeometry(0.34, 0.08, 0.12);
    const hairFringe = new THREE.Mesh(hairFringeGeo, hairMat);
    hairFringe.position.set(0, 0.16, 0.12);
    this.headGroup.add(hairFringe);

    // Aviator / Sunglasses
    const glassesGeo = new THREE.BoxGeometry(0.33, 0.08, 0.06);
    const glassesMesh = new THREE.Mesh(glassesGeo, shadesMat);
    glassesMesh.position.set(0, 0.03, 0.16);
    this.headGroup.add(glassesMesh);

    // 3. Left Arm Group (Shoulder Pivot)
    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.position.set(-0.29, 0.22, 0);
    this.torsoGroup.add(this.leftArmGroup);

    const lArmSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.16), jacketMat);
    lArmSleeve.position.set(0, -0.14, 0);
    lArmSleeve.castShadow = true;
    this.leftArmGroup.add(lArmSleeve);

    const lForearm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.26, 0.14), skinMat);
    lForearm.position.set(0, -0.38, 0);
    lForearm.castShadow = true;
    this.leftArmGroup.add(lForearm);

    // 4. Right Arm Group (Shoulder Pivot)
    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(0.29, 0.22, 0);
    this.torsoGroup.add(this.rightArmGroup);

    const rArmSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.16), jacketMat);
    rArmSleeve.position.set(0, -0.14, 0);
    rArmSleeve.castShadow = true;
    this.rightArmGroup.add(rArmSleeve);

    const rForearm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.26, 0.14), skinMat);
    rForearm.position.set(0, -0.38, 0);
    rForearm.castShadow = true;
    this.rightArmGroup.add(rForearm);

    // 5. Left Leg Group (Hip Pivot)
    this.leftLegGroup = new THREE.Group();
    this.leftLegGroup.position.set(-0.14, -0.27, 0);
    this.torsoGroup.add(this.leftLegGroup);

    const lThigh = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.34, 0.2), jeansMat);
    lThigh.position.set(0, -0.17, 0);
    lThigh.castShadow = true;
    this.leftLegGroup.add(lThigh);

    const lShin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.28, 0.18), jeansMat);
    lShin.position.set(0, -0.42, 0);
    lShin.castShadow = true;
    this.leftLegGroup.add(lShin);

    const lShoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.28), shoeWhiteMat);
    lShoe.position.set(0, -0.52, 0.04);
    lShoe.castShadow = true;
    this.leftLegGroup.add(lShoe);

    const lSole = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.04, 0.29), shoeAccentMat);
    lSole.position.set(0, -0.57, 0.04);
    lSole.castShadow = true;
    lSole.receiveShadow = true;
    this.leftLegGroup.add(lSole);

    // 6. Right Leg Group (Hip Pivot)
    this.rightLegGroup = new THREE.Group();
    this.rightLegGroup.position.set(0.14, -0.27, 0);
    this.torsoGroup.add(this.rightLegGroup);

    const rThigh = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.34, 0.2), jeansMat);
    rThigh.position.set(0, -0.17, 0);
    rThigh.castShadow = true;
    this.rightLegGroup.add(rThigh);

    const rShin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.28, 0.18), jeansMat);
    rShin.position.set(0, -0.42, 0);
    rShin.castShadow = true;
    this.rightLegGroup.add(rShin);

    const rShoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.28), shoeWhiteMat);
    rShoe.position.set(0, -0.52, 0.04);
    rShoe.castShadow = true;
    this.rightLegGroup.add(rShoe);

    const rSole = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.04, 0.29), shoeAccentMat);
    rSole.position.set(0, -0.57, 0.04);
    rSole.castShadow = true;
    rSole.receiveShadow = true;
    this.rightLegGroup.add(rSole);

    // 6b. Handcuffs (only shown in the ARRESTED pose): two steel rings + a short chain behind the back
    this.handcuffsGroup = new THREE.Group();
    const steelMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.9, roughness: 0.25 });
    const ringGeo = new THREE.TorusGeometry(0.07, 0.018, 8, 18);
    const ringL = new THREE.Mesh(ringGeo, steelMat);
    ringL.rotation.y = Math.PI / 2;
    ringL.position.set(-0.09, 0, 0);
    const ringR = ringL.clone();
    ringR.position.set(0.09, 0, 0);
    const chain = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.02), steelMat);
    this.handcuffsGroup.add(ringL, ringR, chain);
    // Wrists meet behind the back once both arms are rotated back (see ARRESTED pose)
    this.handcuffsGroup.position.set(0, -0.2, -0.28);
    this.handcuffsGroup.visible = false;
    this.torsoGroup.add(this.handcuffsGroup);

    // 6c. Jetpack: Dual titanium turbine rocket pack, shoulder straps, glowing reactor core & vectoring nozzles
    this.jetpackGroup = new THREE.Group();
    // Torso back is at z = -0.14; position jetpack snug against the hero's jacket at z = -0.16
    this.jetpackGroup.position.set(0, 0.04, -0.16);

    const packBodyMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.25 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
    const goldAccentMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.3 });
    const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.3 });
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x06b6d4, emissiveIntensity: 2.8, roughness: 0.1 });
    const strapMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });

    // Main backplate mounting bracket
    const backplate = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.46, 0.04), packBodyMat);
    backplate.position.set(0, 0.02, -0.01);
    this.jetpackGroup.add(backplate);

    // Glowing Central Reactor Core
    const coreMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.18, 12), coreMat);
    coreMesh.rotation.z = Math.PI / 2;
    coreMesh.position.set(0, 0.04, -0.04);
    this.jetpackGroup.add(coreMesh);

    // Twin Rocket Turbine Thruster Cylinders
    const tankGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.48, 14);
    for (const side of [-1, 1]) {
      // Main rocket cylinder
      const tank = new THREE.Mesh(tankGeo, chromeMat);
      tank.position.set(side * 0.14, 0.02, -0.04);
      tank.castShadow = true;
      this.jetpackGroup.add(tank);

      // Gold pressure dome cap
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10), goldAccentMat);
      cap.position.set(side * 0.14, 0.26, -0.04);
      this.jetpackGroup.add(cap);

      // Upper intake ring
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.015, 8, 16), goldAccentMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(side * 0.14, 0.16, -0.04);
      this.jetpackGroup.add(ring);

      // Heavy flared bell nozzle
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.13, 12), nozzleMat);
      nozzle.position.set(side * 0.14, -0.28, -0.04);
      this.jetpackGroup.add(nozzle);
    }

    // Shoulder Harness Straps looping over the hero's shoulders to the chest
    for (const side of [-1, 1]) {
      // Top shoulder strap
      const strapTop = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.26), strapMat);
      strapTop.position.set(side * 0.14, 0.22, 0.11);
      this.jetpackGroup.add(strapTop);

      // Front chest drop strap
      const strapFront = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 0.04), strapMat);
      strapFront.position.set(side * 0.14, 0.08, 0.22);
      this.jetpackGroup.add(strapFront);
    }

    // Dynamic Rocket Flames
    this.jetFlameMat = new THREE.MeshStandardMaterial({
      color: 0xffaa33,
      emissive: 0xff5500,
      emissiveIntensity: 3.5,
      transparent: true,
      opacity: 0.92,
    });
    for (const side of [-1, 1]) {
      const flameGroup = new THREE.Group();
      flameGroup.position.set(side * 0.14, -0.36, -0.04);

      // Outer fiery orange/yellow plume
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.55, 12, 1, true), this.jetFlameMat);
      flame.rotation.x = Math.PI; // point downward
      flame.position.y = -0.27;
      flame.scale.set(1, 0.1, 1);
      flameGroup.add(flame);
      this.jetFlames.push(flame);

      this.jetpackGroup.add(flameGroup);
    }

    // Dynamic warm rocket thrust point light
    this.jetLight = new THREE.PointLight(0xff6611, 0, 7);
    this.jetLight.position.set(0, -0.6, -0.04);
    this.jetpackGroup.add(this.jetLight);

    this.jetpackGroup.visible = false;
    this.torsoGroup.add(this.jetpackGroup);

    // 7. Ground Contact Shadow Decal directly under shoes
    const shadowGeo = new THREE.PlaneGeometry(0.75, 0.65);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: CityTextures.getCharacterContactShadow(),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.contactShadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.contactShadowMesh.position.y = 0.005;
    this.rootGroup.add(this.contactShadowMesh);
  }

  public setVisible(visible: boolean) {
    this.rootGroup.visible = visible;
  }

  /** Show/hide the pack and scale the nozzle flames by thrust (0..1). */
  public setJetpack(equipped: boolean, thrust01: number) {
    this.jetpackGroup.visible = equipped;
    if (!equipped) {
      this.jetThrust = 0;
      return;
    }
    this.jetThrust += (thrust01 - this.jetThrust) * 0.35;
    const t = this.jetThrust;
    const flicker = 0.85 + Math.sin(this.animTimer * 47) * 0.1 + Math.sin(this.animTimer * 31) * 0.05;
    for (const f of this.jetFlames) {
      const heightScale = Math.max(0.08, t * 1.35 * flicker + 0.08);
      const widthScale = 0.7 + t * 0.5;
      f.scale.set(widthScale, heightScale, widthScale);
    }
    this.jetFlameMat.emissiveIntensity = 2.0 + t * 4.5;
    this.jetLight.intensity = (0.6 + t * 4.2) * flicker;
  }

  /** Dual nozzle world positions for smoke particles. */
  public getJetExhaustPositions(left: THREE.Vector3, right: THREE.Vector3) {
    left.set(-0.14, -0.38, -0.04);
    right.set(0.14, -0.38, -0.04);
    this.jetpackGroup.localToWorld(left);
    this.jetpackGroup.localToWorld(right);
  }

  /** World position of the nozzle exhaust point (backwards-compatible single point). */
  public getJetExhaustPosition(target: THREE.Vector3): THREE.Vector3 {
    target.set(0, -0.38, -0.04);
    return this.jetpackGroup.localToWorld(target);
  }

  public update(
    delta: number,
    state: CharacterAnimState,
    speedRatio: number,
    bankAngle: number = 0,
    landingSquash: number = 0
  ) {
    const dt = Math.min(delta, 0.1);
    this.animState = state;
    this.animTimer += dt;

    // Reset target transforms
    let torsoPitch = 0;
    let torsoRoll = 0;
    let bodyY = 0;
    let headPitch = 0;
    let leftArmX = 0;
    let leftArmZ = -0.06;
    let rightArmX = 0;
    let rightArmZ = 0.06;
    let leftLegX = 0;
    let rightLegX = 0;

    if (state === 'IDLE') {
      // Subtle breathing and gentle weight shift
      const breath = Math.sin(this.animTimer * 2.8);
      bodyY = breath * 0.015;
      torsoPitch = breath * 0.01;
      leftArmZ = -0.08 + breath * 0.02;
      rightArmZ = 0.08 - breath * 0.02;
      headPitch = -breath * 0.015;
    } else if (state === 'WALK') {
      const freq = 9.6;
      this.cycle += dt * freq;
      const s = Math.sin(this.cycle);
      const c = Math.cos(this.cycle);

      leftLegX = s * 0.65;
      rightLegX = -s * 0.65;

      leftArmX = -s * 0.55;
      rightArmX = s * 0.55;
      leftArmZ = -0.1;
      rightArmZ = 0.1;

      bodyY = Math.abs(s) * 0.035;
      torsoPitch = 0.03;
      torsoRoll = c * 0.02 + bankAngle * 0.4;
    } else if (state === 'RUN') {
      const freq = 13.5;
      this.cycle += dt * freq;
      const s = Math.sin(this.cycle);
      const c = Math.cos(this.cycle);

      leftLegX = s * 0.95;
      rightLegX = -s * 0.95;

      leftArmX = -s * 0.85;
      rightArmX = s * 0.85;
      leftArmZ = -0.16;
      rightArmZ = 0.16;

      bodyY = Math.abs(s) * 0.065;
      torsoPitch = -0.14; // forward athletic sprint lean
      torsoRoll = c * 0.04 + bankAngle; // lean into turns
    } else if (state === 'JUMP') {
      leftLegX = -0.35;
      rightLegX = 0.25;
      leftArmX = -0.65;
      rightArmX = -0.65;
      leftArmZ = -0.4;
      rightArmZ = 0.4;
      torsoPitch = 0.05;
      bodyY = 0.05;
    } else if (state === 'FALL') {
      leftLegX = 0.2;
      rightLegX = -0.2;
      leftArmX = -0.5;
      rightArmX = -0.5;
      leftArmZ = -0.3;
      rightArmZ = 0.3;
      torsoPitch = 0.1;
    } else if (state === 'ENTER_VEHICLE') {
      // Reaching for door and stepping in
      rightArmX = -0.85;
      rightArmZ = 0.2;
      leftLegX = 0.45;
      torsoPitch = -0.1;
    } else if (state === 'EXIT_VEHICLE') {
      // Stepping out
      leftArmX = -0.4;
      leftLegX = 0.4;
      torsoPitch = 0.05;
    } else if (state === 'TUMBLE_RAGDOLL') {
      // Flailing ragdoll limbs in mid-air and ground slide
      const f1 = Math.sin(this.animTimer * 14.0);
      const f2 = Math.cos(this.animTimer * 11.0);
      leftLegX = -0.65 + f1 * 0.55;
      rightLegX = 0.55 - f2 * 0.55;
      leftArmX = -1.1 + f2 * 0.6;
      rightArmX = 0.95 + f1 * 0.6;
      leftArmZ = -0.55;
      rightArmZ = 0.55;
      torsoPitch = 0.35 + f1 * 0.25;
      torsoRoll = f2 * 0.3;
      headPitch = -0.35;
      bodyY = -0.32;
    } else if (state === 'GET_UP') {
      // Hands pushing off ground, rising back up onto feet
      leftLegX = 0.45;
      rightLegX = -0.25;
      leftArmX = 0.65;
      rightArmX = 0.65;
      leftArmZ = -0.2;
      rightArmZ = 0.2;
      torsoPitch = -0.3;
      bodyY = -0.18;
    } else if (state === 'FLY') {
      // Superhero-ish flight: lean into travel, arms swept back, legs trailing
      const lean = speedRatio;
      const wobble = Math.sin(this.animTimer * 3.1) * 0.03;
      torsoPitch = -0.15 - lean * 0.75 + wobble;
      headPitch = 0.25 + lean * 0.35;
      leftArmX = 0.45 + lean * 0.5;
      rightArmX = 0.45 + lean * 0.5;
      leftArmZ = -0.55 + lean * 0.25;
      rightArmZ = 0.55 - lean * 0.25;
      leftLegX = 0.25 + lean * 0.3;
      rightLegX = 0.18 + lean * 0.3;
      torsoRoll = bankAngle * 1.2;
      bodyY = 0.05 + wobble;
    } else if (state === 'ARRESTED') {
      // Cuffed: arms swung behind the back, wrists together, head down, slight slouch
      const breath = Math.sin(this.animTimer * 2.2);
      leftArmX = 0.62;
      rightArmX = 0.62;
      leftArmZ = 0.34;   // pull wrists in towards the spine
      rightArmZ = -0.34;
      torsoPitch = 0.14 + breath * 0.01;
      headPitch = 0.42;
      leftLegX = 0.06;
      rightLegX = -0.04;
      bodyY = -0.03;
    }

    this.handcuffsGroup.visible = state === 'ARRESTED';

    // Apply landing squash
    bodyY -= landingSquash;

    // Smooth blending interpolation
    const blendSpeed = (state === 'TUMBLE_RAGDOLL' ? 24.0 : 14.0) * dt;
    this.targetRot.torsoPitch += (torsoPitch - this.targetRot.torsoPitch) * blendSpeed;
    this.targetRot.torsoRoll += (torsoRoll - this.targetRot.torsoRoll) * blendSpeed;
    this.targetRot.bodyY += (bodyY - this.targetRot.bodyY) * blendSpeed;
    this.targetRot.headPitch += (headPitch - this.targetRot.headPitch) * blendSpeed;
    this.targetRot.leftArmX += (leftArmX - this.targetRot.leftArmX) * blendSpeed;
    this.targetRot.leftArmZ += (leftArmZ - this.targetRot.leftArmZ) * blendSpeed;
    this.targetRot.rightArmX += (rightArmX - this.targetRot.rightArmX) * blendSpeed;
    this.targetRot.rightArmZ += (rightArmZ - this.targetRot.rightArmZ) * blendSpeed;
    this.targetRot.leftLegX += (leftLegX - this.targetRot.leftLegX) * blendSpeed;
    this.targetRot.rightLegX += (rightLegX - this.targetRot.rightLegX) * blendSpeed;

    // Apply squash and stretch scale to body
    const squashScaleX = 1.0 + landingSquash * 0.6;
    const squashScaleY = Math.max(0.65, 1.0 - landingSquash * 0.9);
    this.bodyGroup.scale.set(squashScaleX, squashScaleY, squashScaleX);

    // Apply 3D body tumbling rotation
    if (state === 'TUMBLE_RAGDOLL') {
      this.currentBodyRot.lerp(this.tumbleRotation, Math.min(1.0, dt * 20.0));
    } else {
      this.currentBodyRot.lerp(new THREE.Vector3(0, 0, 0), Math.min(1.0, dt * 8.0));
    }
    this.bodyGroup.rotation.set(this.currentBodyRot.x, this.currentBodyRot.y, this.currentBodyRot.z);

    // Apply to Three.js hierarchy
    this.bodyGroup.position.y = this.targetRot.bodyY;
    this.torsoGroup.rotation.x = this.targetRot.torsoPitch;
    this.torsoGroup.rotation.z = this.targetRot.torsoRoll;
    this.headGroup.rotation.x = this.targetRot.headPitch;

    this.leftArmGroup.rotation.x = this.targetRot.leftArmX;
    this.leftArmGroup.rotation.z = this.targetRot.leftArmZ;

    this.rightArmGroup.rotation.x = this.targetRot.rightArmX;
    this.rightArmGroup.rotation.z = this.targetRot.rightArmZ;

    this.leftLegGroup.rotation.x = this.targetRot.leftLegX;
    this.rightLegGroup.rotation.x = this.targetRot.rightLegX;

    // 8. Update Ground Contact Drop Shadow
    const currentY = this.rootGroup.position.y;
    if (currentY > 0.08) {
      const airHeight = currentY - 0.02;
      (this.contactShadowMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0.12, 0.85 - airHeight * 0.35);
      const sc = 1.0 + Math.min(airHeight * 0.25, 0.6);
      this.contactShadowMesh.scale.set(sc, sc, sc);
    } else {
      (this.contactShadowMesh.material as THREE.MeshBasicMaterial).opacity = 0.85;
      this.contactShadowMesh.scale.set(1.0, 1.0, 1.0);
    }
  }
}
