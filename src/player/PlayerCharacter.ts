import * as THREE from 'three';
import { CharacterAnimState } from './PlayerState';
import { CityTextures } from '../game/CityTextures';

/**
 * Realistic 3D Humanoid Protagonist for Deep Rush City.
 * Features:
 * - Sculpted human cranium, jaw, neck, ears, and facial anatomy.
 * - Expressive 3D eyes with sclera, iris, pupil, corneal catchlight, and involuntary blinking.
 * - Volumetric textured hairstyle with street taper fade.
 * - Streetwear bomber jacket with 3D rolled collar, open lapels, zipper track, and inner tee.
 * - Articulated arms with functional elbow flexion, tactical smartwatch, and 5-finger sculpted hands.
 * - Articulated legs with functional knee flexion, denim seams, and high-top designer sneakers.
 * - Natural skeletal kinematics: dynamic elbow pumping, high knee drives, pelvis counter-rotation,
 *   and involuntary breathing/blinking idle cycles.
 */
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

  // Articulated secondary joints
  private leftForearmGroup: THREE.Group;
  private rightForearmGroup: THREE.Group;
  private leftShinGroup: THREE.Group;
  private rightShinGroup: THREE.Group;

  // Facial features & blinking
  private leftEyelidTop: THREE.Mesh;
  private leftEyelidBottom: THREE.Mesh;
  private rightEyelidTop: THREE.Mesh;
  private rightEyelidBottom: THREE.Mesh;
  private blinkTimer: number = 2.5;
  private blinkDuration: number = 0.14;
  private currentBlink: number = 0;

  // Jetpack rig
  private jetpackGroup: THREE.Group;
  private jetFlames: THREE.Mesh[] = [];
  private jetFlameMat: THREE.MeshStandardMaterial;
  private jetLight: THREE.PointLight;
  private jetThrust: number = 0;

  // Parachute system & canopy
  private parachuteGroup: THREE.Group;
  private parachuteCanopyGroup: THREE.Group;
  public parachutePackMesh: THREE.Mesh;
  public isParachuteDeployed: boolean = false;
  private parachuteInflation: number = 0;
  private parachuteSteerBias: number = 0;
  private parachuteIsFlares: boolean = false;
  private parachuteLineGeo!: THREE.BufferGeometry;
  private parachuteLines!: THREE.LineSegments;
  public leftHandGroup!: THREE.Group;
  public rightHandGroup!: THREE.Group;
  public leftToggleMesh!: THREE.Mesh;
  public rightToggleMesh!: THREE.Mesh;

  // Animation state
  public animState: CharacterAnimState = 'IDLE';
  private cycle: number = 0;
  private animTimer: number = 0;

  // Dynamic rigid body / ragdoll rotation
  public tumbleRotation = new THREE.Vector3(0, 0, 0);
  private currentBodyRot = new THREE.Vector3(0, 0, 0);

  // Target bone transforms for smooth interpolation
  private targetRot = {
    torsoPitch: 0,
    torsoRoll: 0,
    torsoYaw: 0,
    bodyY: 0,
    headPitch: 0,
    headYaw: 0,
    leftArmX: 0,
    leftArmY: 0,
    leftArmZ: 0,
    leftElbowX: -0.18,
    leftWristX: 0,
    leftWristY: 0,
    rightArmX: 0,
    rightArmY: 0,
    rightArmZ: 0,
    rightElbowX: -0.18,
    rightWristX: 0,
    rightWristY: 0,
    leftLegX: 0,
    leftLegZ: 0,
    leftKneeX: 0,
    rightLegX: 0,
    rightLegZ: 0,
    rightKneeX: 0,
  };

  public setTumbleRotation(pitch: number, yaw: number, roll: number) {
    this.tumbleRotation.set(pitch, yaw, roll);
  }

  constructor() {
    this.rootGroup = new THREE.Group();
    this.bodyGroup = new THREE.Group();
    this.rootGroup.add(this.bodyGroup);

    // =========================================================================
    // 1. PBR MATERIALS PALETTE (High-Definition, Crisp & Clear Hero Aesthetic)
    // =========================================================================
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xf5caa6, // bright, warm, clear healthy skin tone
      roughness: 0.52,
      metalness: 0.02,
    });
    const lipsMat = new THREE.MeshStandardMaterial({
      color: 0xce7971, // natural defined lip pigmentation
      roughness: 0.5,
      metalness: 0.02,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x18181b, // deep obsidian sleek hair
      roughness: 0.65,
      metalness: 0.08,
    });
    const hairFadeMat = new THREE.MeshStandardMaterial({
      color: 0x27272a, // neat fade trim
      roughness: 0.8,
    });
    const eyeWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, // optic white sclera
      roughness: 0.1,
      metalness: 0.02,
    });
    const eyeIrisMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // striking electric sapphire blue iris
      roughness: 0.2,
      metalness: 0.1,
    });
    const eyePupilMat = new THREE.MeshBasicMaterial({
      color: 0x09090b,
    });
    const eyeCatchlightMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });

    // Streetwear Hero Jacket & Clothes (High contrast, instantly readable)
    const jacketMat = new THREE.MeshStandardMaterial({
      color: 0xef4444, // vibrant scarlet crimson hero jacket
      roughness: 0.5,
      metalness: 0.12,
    });
    const jacketTrimMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, // crisp white racing stripes & accents
      roughness: 0.4,
      metalness: 0.08,
    });
    const jacketRibMat = new THREE.MeshStandardMaterial({
      color: 0x18181b, // ribbed knit collar/cuffs/hem in charcoal obsidian
      roughness: 0.85,
    });
    const shirtMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // dark sleek athletic crewneck
      roughness: 0.75,
      metalness: 0.05,
    });
    const shirtEmblemMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff, // glowing electric cyan hero insignia
      emissive: 0x00d8f6,
      emissiveIntensity: 1.6,
      roughness: 0.15,
    });
    const jeansMat = new THREE.MeshStandardMaterial({
      color: 0x1e40af, // rich deep athletic indigo denim
      roughness: 0.78,
      metalness: 0.06,
    });
    const beltMat = new THREE.MeshStandardMaterial({
      color: 0x27272a, // dark leather belt
      roughness: 0.65,
    });
    const metalBuckleMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9, // polished silver chrome
      metalness: 0.95,
      roughness: 0.18,
    });

    // High-Top Sneakers
    const shoeLeatherMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, // clean optic white leather
      roughness: 0.38,
      metalness: 0.05,
    });
    const shoeAccentMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626, // crimson heel accent
      roughness: 0.42,
      metalness: 0.05,
    });
    const shoeSoleMat = new THREE.MeshStandardMaterial({
      color: 0x18181b, // dark charcoal outsole
      roughness: 0.85,
    });
    const shoeAirMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff, // glowing cyan air cushion
      roughness: 0.2,
      metalness: 0.3,
    });

    // Accessories: Tactical Smartwatch
    const watchBodyMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.9,
      roughness: 0.2,
    });
    const watchScreenMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 1.8,
      roughness: 0.1,
    });

    // =========================================================================
    // 2. TORSO & VIBRANT HERO BOMBER JACKET
    // =========================================================================
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.set(0, 0.86, 0);
    this.bodyGroup.add(this.torsoGroup);

    // Anatomical V-Taper Torso (Athletic Chest)
    const upperChestGeo = new THREE.BoxGeometry(0.44, 0.32, 0.26);
    const upperChest = new THREE.Mesh(upperChestGeo, jacketMat);
    upperChest.position.set(0, 0.12, 0);
    upperChest.castShadow = true;
    upperChest.receiveShadow = true;
    this.torsoGroup.add(upperChest);

    const lowerWaistGeo = new THREE.BoxGeometry(0.39, 0.24, 0.23);
    const lowerWaist = new THREE.Mesh(lowerWaistGeo, jacketMat);
    lowerWaist.position.set(0, -0.14, 0);
    lowerWaist.castShadow = true;
    lowerWaist.receiveShadow = true;
    this.torsoGroup.add(lowerWaist);

    // Optic White Racing Stripes on Front & Back of Chest
    const chestStripeGeo = new THREE.BoxGeometry(0.026, 0.30, 0.008);
    for (const side of [-1, 1]) {
      // Front racing stripe
      const frontStripe = new THREE.Mesh(chestStripeGeo, jacketTrimMat);
      frontStripe.position.set(side * 0.165, 0.12, 0.132);
      this.torsoGroup.add(frontStripe);

      // Back racing stripe
      const backStripe = new THREE.Mesh(chestStripeGeo, jacketTrimMat);
      backStripe.position.set(side * 0.165, 0.12, -0.132);
      this.torsoGroup.add(backStripe);
    }

    // Ribbed Bomber Hem at bottom of jacket
    const hemGeo = new THREE.BoxGeometry(0.40, 0.05, 0.24);
    const hemMesh = new THREE.Mesh(hemGeo, jacketRibMat);
    hemMesh.position.set(0, -0.25, 0);
    this.torsoGroup.add(hemMesh);

    // 3D Rolled Bomber Collar hugging the neck
    const collarGeo = new THREE.CylinderGeometry(0.125, 0.155, 0.065, 14);
    const collarMesh = new THREE.Mesh(collarGeo, jacketRibMat);
    collarMesh.position.set(0, 0.27, -0.01);
    this.torsoGroup.add(collarMesh);

    // Inner Athletic Crewneck T-Shirt showing beneath jacket
    const shirtGeo = new THREE.BoxGeometry(0.18, 0.32, 0.04);
    const shirtMesh = new THREE.Mesh(shirtGeo, shirtMat);
    shirtMesh.position.set(0, 0.10, 0.122);
    this.torsoGroup.add(shirtMesh);

    // Glowing Electric Cyan Hero Insignia on Chest
    const emblemGeo = new THREE.BoxGeometry(0.062, 0.062, 0.008);
    const emblemMesh = new THREE.Mesh(emblemGeo, shirtEmblemMat);
    emblemMesh.rotation.z = Math.PI / 4;
    emblemMesh.position.set(0, 0.14, 0.144);
    this.torsoGroup.add(emblemMesh);

    // Open Jacket Lapels with Clean White Piping
    const lapelGeo = new THREE.BoxGeometry(0.065, 0.34, 0.035);
    const pipingGeo = new THREE.BoxGeometry(0.012, 0.33, 0.012);
    for (const side of [-1, 1]) {
      const lapel = new THREE.Mesh(lapelGeo, jacketMat);
      lapel.position.set(side * 0.12, 0.10, 0.135);
      lapel.rotation.z = -side * 0.08;
      this.torsoGroup.add(lapel);

      const piping = new THREE.Mesh(pipingGeo, jacketTrimMat);
      piping.position.set(side * 0.085, 0.10, 0.154);
      piping.rotation.z = -side * 0.08;
      this.torsoGroup.add(piping);
    }

    // Polished Silver Zipper Pull Tab
    const pullTabGeo = new THREE.BoxGeometry(0.018, 0.040, 0.018);
    const pullTab = new THREE.Mesh(pullTabGeo, metalBuckleMat);
    pullTab.position.set(0.045, 0.08, 0.150);
    this.torsoGroup.add(pullTab);

    // Streetwear Leather Belt & Polished Silver Buckle
    const beltGeo = new THREE.BoxGeometry(0.41, 0.045, 0.25);
    const beltMesh = new THREE.Mesh(beltGeo, beltMat);
    beltMesh.position.set(0, -0.28, 0);
    this.torsoGroup.add(beltMesh);

    const buckleGeo = new THREE.BoxGeometry(0.085, 0.055, 0.02);
    const buckleMesh = new THREE.Mesh(buckleGeo, metalBuckleMat);
    buckleMesh.position.set(0, -0.28, 0.13);
    this.torsoGroup.add(buckleMesh);

    // =========================================================================
    // 3. CRYSTAL-CLEAR SCULPTED HEAD, EXPRESSIVE FACE & MODERN HAIR
    // =========================================================================
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.44, 0);
    this.torsoGroup.add(this.headGroup);

    // Cylindrical Muscular Neck
    const neckGeo = new THREE.CylinderGeometry(0.08, 0.092, 0.14, 14);
    const neckMesh = new THREE.Mesh(neckGeo, skinMat);
    neckMesh.position.set(0, -0.10, 0.01);
    neckMesh.castShadow = true;
    this.headGroup.add(neckMesh);

    // Sculpted Cranium (smooth organic head base)
    const craniumGeo = new THREE.SphereGeometry(0.145, 18, 14);
    craniumGeo.scale(1.0, 1.15, 1.08);
    const craniumMesh = new THREE.Mesh(craniumGeo, skinMat);
    craniumMesh.position.set(0, 0.08, -0.01);
    craniumMesh.castShadow = true;
    this.headGroup.add(craniumMesh);

    // Sculpted Jawline & Chin
    const jawGeo = new THREE.BoxGeometry(0.185, 0.11, 0.16);
    const jawMesh = new THREE.Mesh(jawGeo, skinMat);
    jawMesh.position.set(0, 0.01, 0.05);
    this.headGroup.add(jawMesh);

    const chinGeo = new THREE.SphereGeometry(0.048, 10, 8);
    chinGeo.scale(1.0, 0.8, 0.9);
    const chinMesh = new THREE.Mesh(chinGeo, skinMat);
    chinMesh.position.set(0, -0.05, 0.11);
    this.headGroup.add(chinMesh);

    // Cheekbones
    for (const side of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 6), skinMat);
      cheek.position.set(side * 0.095, 0.06, 0.08);
      cheek.scale.set(1.1, 0.7, 0.9);
      this.headGroup.add(cheek);
    }

    // Sculpted 3D Ears
    const earGeo = new THREE.TorusGeometry(0.032, 0.011, 8, 12, Math.PI * 1.2);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(earGeo, skinMat);
      ear.position.set(side * 0.146, 0.07, -0.01);
      ear.rotation.y = side * (Math.PI / 2);
      ear.rotation.z = side * 0.15;
      this.headGroup.add(ear);
    }

    // --- Striking, Crystal-Clear Eyes & Eyebrows (No obscuring sunglasses) ---
    const eyeSpacing = 0.054;
    const eyeY = 0.088;
    const eyeZ = 0.130;

    // Confident, Stylized Eyebrows
    const browGeo = new THREE.BoxGeometry(0.055, 0.014, 0.018);
    for (const side of [-1, 1]) {
      const brow = new THREE.Mesh(browGeo, hairMat);
      brow.position.set(side * eyeSpacing, eyeY + 0.038, eyeZ + 0.006);
      brow.rotation.z = -side * 0.10;
      brow.rotation.y = side * 0.08;
      this.headGroup.add(brow);
    }

    // Eyes: Large Optic White Sclera + Electric Blue Iris + Pupil + Catchlight
    const scleraGeo = new THREE.SphereGeometry(0.026, 14, 12);
    scleraGeo.scale(1.15, 0.9, 0.85);

    const irisGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.005, 14);
    irisGeo.rotateX(Math.PI / 2);

    const pupilGeo = new THREE.CylinderGeometry(0.0065, 0.0065, 0.006, 12);
    pupilGeo.rotateX(Math.PI / 2);

    const catchlightGeo = new THREE.SphereGeometry(0.0038, 8, 8);

    for (const side of [-1, 1]) {
      const eyeRig = new THREE.Group();
      eyeRig.position.set(side * eyeSpacing, eyeY, eyeZ);

      // Sclera
      const sclera = new THREE.Mesh(scleraGeo, eyeWhiteMat);
      eyeRig.add(sclera);

      // Iris
      const iris = new THREE.Mesh(irisGeo, eyeIrisMat);
      iris.position.set(0, 0, 0.021);
      eyeRig.add(iris);

      // Pupil
      const pupil = new THREE.Mesh(pupilGeo, eyePupilMat);
      pupil.position.set(0, 0, 0.023);
      eyeRig.add(pupil);

      // Corneal specular catchlight dot
      const catchlight = new THREE.Mesh(catchlightGeo, eyeCatchlightMat);
      catchlight.position.set(0.004, 0.004, 0.025);
      eyeRig.add(catchlight);

      this.headGroup.add(eyeRig);
    }

    // Eyelids (Only visible during involuntary blink, eliminating shadow artifacts)
    const eyelidGeo = new THREE.BoxGeometry(0.064, 0.018, 0.025);
    this.leftEyelidTop = new THREE.Mesh(eyelidGeo, skinMat);
    this.leftEyelidTop.position.set(-eyeSpacing, eyeY + 0.024, eyeZ + 0.012);
    this.leftEyelidTop.visible = false;
    this.headGroup.add(this.leftEyelidTop);

    this.leftEyelidBottom = new THREE.Mesh(eyelidGeo, skinMat);
    this.leftEyelidBottom.position.set(-eyeSpacing, eyeY - 0.024, eyeZ + 0.012);
    this.leftEyelidBottom.visible = false;
    this.headGroup.add(this.leftEyelidBottom);

    this.rightEyelidTop = new THREE.Mesh(eyelidGeo, skinMat);
    this.rightEyelidTop.position.set(eyeSpacing, eyeY + 0.024, eyeZ + 0.012);
    this.rightEyelidTop.visible = false;
    this.headGroup.add(this.rightEyelidTop);

    this.rightEyelidBottom = new THREE.Mesh(eyelidGeo, skinMat);
    this.rightEyelidBottom.position.set(eyeSpacing, eyeY - 0.024, eyeZ + 0.012);
    this.rightEyelidBottom.visible = false;
    this.headGroup.add(this.rightEyelidBottom);

    // 3D Sculpted Nose
    const noseBridge = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.065, 0.038), skinMat);
    noseBridge.position.set(0, 0.045, 0.138);
    noseBridge.rotation.x = -0.18;
    this.headGroup.add(noseBridge);

    const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), skinMat);
    noseTip.position.set(0, 0.018, 0.158);
    this.headGroup.add(noseTip);

    // 3D Sculpted Lips
    const lipUpper = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.014, 0.02), lipsMat);
    lipUpper.position.set(0, -0.018, 0.145);
    this.headGroup.add(lipUpper);

    const lipLower = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.016, 0.022), lipsMat);
    lipLower.position.set(0, -0.034, 0.143);
    this.headGroup.add(lipLower);

    // --- Volumetric Sleek Modern Hairstyle (Street Quiff & Taper Fade) ---
    // Neat side and back fade
    const fadeGeo = new THREE.CylinderGeometry(0.148, 0.154, 0.17, 18);
    const fadeMesh = new THREE.Mesh(fadeGeo, hairFadeMat);
    fadeMesh.position.set(0, 0.12, -0.015);
    this.headGroup.add(fadeMesh);

    // Volumetric Top Quiff
    const hairTopGeo = new THREE.SphereGeometry(0.152, 18, 14);
    hairTopGeo.scale(1.04, 0.78, 1.16);
    const hairTop = new THREE.Mesh(hairTopGeo, hairMat);
    hairTop.position.set(0, 0.225, 0.015);
    hairTop.castShadow = true;
    this.headGroup.add(hairTop);

    // Sleek front swept fringe
    const fringeGeo = new THREE.BoxGeometry(0.16, 0.055, 0.09);
    const fringe = new THREE.Mesh(fringeGeo, hairMat);
    fringe.position.set(0.01, 0.23, 0.13);
    fringe.rotation.x = -0.32;
    fringe.rotation.z = 0.06;
    this.headGroup.add(fringe);

    // =========================================================================
    // 4. ARTICULATED ARMS (SHOULDERS, BICEPS, RACING STRIPES, ELBOWS, WATCH & HANDS)
    // =========================================================================
    // Left Arm (Shoulder Pivot)
    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.position.set(-0.27, 0.22, 0);
    this.torsoGroup.add(this.leftArmGroup);

    // Right Arm (Shoulder Pivot)
    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(0.27, 0.22, 0);
    this.torsoGroup.add(this.rightArmGroup);

    // Forearm groups (Elbow Pivots!)
    this.leftForearmGroup = new THREE.Group();
    this.leftForearmGroup.position.set(0, -0.24, 0);
    this.leftArmGroup.add(this.leftForearmGroup);

    this.rightForearmGroup = new THREE.Group();
    this.rightForearmGroup.position.set(0, -0.24, 0);
    this.rightArmGroup.add(this.rightForearmGroup);

    const armSleeveGeo = new THREE.CylinderGeometry(0.075, 0.068, 0.22, 12);
    const shoulderCapGeo = new THREE.SphereGeometry(0.082, 12, 10);
    const forearmGeo = new THREE.CylinderGeometry(0.062, 0.052, 0.20, 12);
    const wristCuffGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.035, 12);

    [
      { arm: this.leftArmGroup, forearm: this.leftForearmGroup, isLeft: true },
      { arm: this.rightArmGroup, forearm: this.rightForearmGroup, isLeft: false },
    ].forEach(({ arm, forearm, isLeft }) => {
      // Shoulder deltoid ball
      const shoulderCap = new THREE.Mesh(shoulderCapGeo, jacketMat);
      shoulderCap.castShadow = true;
      arm.add(shoulderCap);

      // Upper arm / bicep sleeve in vibrant crimson
      const bicep = new THREE.Mesh(armSleeveGeo, jacketMat);
      bicep.position.set(0, -0.11, 0);
      bicep.castShadow = true;
      arm.add(bicep);

      // Crisp Optic White Racing Stripe along outer bicep
      const bicepStripeGeo = new THREE.BoxGeometry(0.014, 0.21, 0.075);
      const bicepStripe = new THREE.Mesh(bicepStripeGeo, jacketTrimMat);
      bicepStripe.position.set(isLeft ? -0.072 : 0.072, -0.11, 0);
      arm.add(bicepStripe);

      // Forearm sleeve in vibrant crimson
      const fArmMesh = new THREE.Mesh(forearmGeo, jacketMat);
      fArmMesh.position.set(0, -0.09, 0);
      fArmMesh.castShadow = true;
      forearm.add(fArmMesh);

      // Crisp Optic White Racing Stripe along outer forearm
      const forearmStripeGeo = new THREE.BoxGeometry(0.014, 0.18, 0.062);
      const fStripe = new THREE.Mesh(forearmStripeGeo, jacketTrimMat);
      fStripe.position.set(isLeft ? -0.058 : 0.058, -0.09, 0);
      forearm.add(fStripe);

      // Ribbed wrist cuff in charcoal obsidian
      const cuff = new THREE.Mesh(wristCuffGeo, jacketRibMat);
      cuff.position.set(0, -0.18, 0);
      forearm.add(cuff);

      // Tactical Smartwatch on left wrist
      if (isLeft) {
        const watchGroup = new THREE.Group();
        watchGroup.position.set(0, -0.16, 0);

        const watchCase = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.042, 0.024), watchBodyMat);
        watchCase.position.set(0, 0, 0.055);
        watchGroup.add(watchCase);

        const watchScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.032, 0.028), watchScreenMat);
        watchScreen.position.set(0, 0, 0.068);
        watchGroup.add(watchScreen);

        const watchStrap = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.032, 12), watchBodyMat);
        watchGroup.add(watchStrap);

        forearm.add(watchGroup);
      }

      // --- Sculpted 5-Finger Hand ---
      const handGroup = new THREE.Group();
      handGroup.position.set(0, -0.23, 0);

      // Palm
      const palmGeo = new THREE.BoxGeometry(0.078, 0.075, 0.042);
      const palm = new THREE.Mesh(palmGeo, skinMat);
      palm.castShadow = true;
      handGroup.add(palm);

      // Opposable Thumb
      const thumbGeo = new THREE.CylinderGeometry(0.014, 0.012, 0.045, 8);
      const thumb = new THREE.Mesh(thumbGeo, skinMat);
      thumb.position.set(isLeft ? 0.038 : -0.038, 0.012, 0.022);
      thumb.rotation.z = isLeft ? -0.45 : 0.45;
      thumb.rotation.x = 0.35;
      handGroup.add(thumb);

      // 4 Individual articulated fingers (Index, Middle, Ring, Pinky)
      const fingerLengths = [0.052, 0.058, 0.054, 0.044];
      for (let i = 0; i < 4; i++) {
        const fGeo = new THREE.CylinderGeometry(0.011, 0.009, fingerLengths[i], 8);
        const finger = new THREE.Mesh(fGeo, skinMat);
        const fx = -0.028 + i * 0.019;
        finger.position.set(fx, -0.042 - fingerLengths[i] * 0.45, 0.008);
        finger.rotation.x = 0.28; // natural relaxed athletic curl
        handGroup.add(finger);
      }

      // Skydiving Steering Toggle Grip Handle (visible during parachute flight)
      const toggleMat = new THREE.MeshStandardMaterial({
        color: isLeft ? 0xef4444 : 0x06b6d4, // Scarlet Red left toggle, Cyan right toggle
        roughness: 0.35,
        metalness: 0.1,
      });
      const toggleGrip = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.007, 8, 16), toggleMat);
      toggleGrip.rotation.x = Math.PI / 2;
      toggleGrip.position.set(0, -0.04, 0.02);
      toggleGrip.visible = false;
      handGroup.add(toggleGrip);

      if (isLeft) {
        this.leftHandGroup = handGroup;
        this.leftToggleMesh = toggleGrip;
      } else {
        this.rightHandGroup = handGroup;
        this.rightToggleMesh = toggleGrip;
      }

      forearm.add(handGroup);
    });

    // =========================================================================
    // 5. ARTICULATED LEGS, INDIGO DENIM & HIGH-TOP KICKS
    // =========================================================================
    // Left Leg (Hip Pivot)
    this.leftLegGroup = new THREE.Group();
    this.leftLegGroup.position.set(-0.135, -0.28, 0);
    this.torsoGroup.add(this.leftLegGroup);

    // Right Leg (Hip Pivot)
    this.rightLegGroup = new THREE.Group();
    this.rightLegGroup.position.set(0.135, -0.28, 0);
    this.torsoGroup.add(this.rightLegGroup);

    // Shin / Knee groups (Knee Pivots!)
    this.leftShinGroup = new THREE.Group();
    this.leftShinGroup.position.set(0, -0.29, 0);
    this.leftLegGroup.add(this.leftShinGroup);

    this.rightShinGroup = new THREE.Group();
    this.rightShinGroup.position.set(0, -0.29, 0);
    this.rightLegGroup.add(this.rightShinGroup);

    const thighGeo = new THREE.CylinderGeometry(0.098, 0.082, 0.28, 14);
    const kneeCapGeo = new THREE.SphereGeometry(0.078, 10, 8);
    const calfGeo = new THREE.CylinderGeometry(0.082, 0.068, 0.24, 14);

    [
      { leg: this.leftLegGroup, shin: this.leftShinGroup },
      { leg: this.rightLegGroup, shin: this.rightShinGroup },
    ].forEach(({ leg, shin }) => {
      // Upper thigh (athletic denim quadriceps)
      const thigh = new THREE.Mesh(thighGeo, jeansMat);
      thigh.position.set(0, -0.14, 0);
      thigh.castShadow = true;
      thigh.receiveShadow = true;
      leg.add(thigh);

      // Knee joint cap
      const kneeCap = new THREE.Mesh(kneeCapGeo, jeansMat);
      kneeCap.position.set(0, 0, 0.012);
      shin.add(kneeCap);

      // Lower leg / calf
      const calf = new THREE.Mesh(calfGeo, jeansMat);
      calf.position.set(0, -0.11, 0);
      calf.castShadow = true;
      calf.receiveShadow = true;
      shin.add(calf);

      // --- High-Top Retro Street Sneakers ---
      const shoeGroup = new THREE.Group();
      shoeGroup.position.set(0, -0.24, 0.035);

      // High padded ankle collar
      const ankleCollarGeo = new THREE.BoxGeometry(0.145, 0.085, 0.16);
      const ankleCollar = new THREE.Mesh(ankleCollarGeo, shoeAccentMat);
      ankleCollar.position.set(0, 0.03, -0.01);
      shoeGroup.add(ankleCollar);

      // Aerodynamic main white leather upper
      const upperGeo = new THREE.BoxGeometry(0.148, 0.095, 0.26);
      const upper = new THREE.Mesh(upperGeo, shoeLeatherMat);
      upper.position.set(0, -0.02, 0.02);
      upper.castShadow = true;
      shoeGroup.add(upper);

      // Curved sculpted white toe cap
      const toeGeo = new THREE.SphereGeometry(0.072, 10, 8);
      toeGeo.scale(1.0, 0.55, 1.25);
      const toeCap = new THREE.Mesh(toeGeo, shoeLeatherMat);
      toeCap.position.set(0, -0.038, 0.10);
      shoeGroup.add(toeCap);

      // Sneaker tongue & laces
      const tongueGeo = new THREE.BoxGeometry(0.092, 0.085, 0.16);
      const tongue = new THREE.Mesh(tongueGeo, shoeAccentMat);
      tongue.position.set(0, 0.03, 0.04);
      tongue.rotation.x = -0.22;
      shoeGroup.add(tongue);

      for (let l = 0; l < 3; l++) {
        const lace = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.012, 0.016), shoeLeatherMat);
        lace.position.set(0, 0.01 + l * 0.025, 0.06 + l * 0.022);
        shoeGroup.add(lace);
      }

      // Air cushion window on heel midsole
      const airBubbleGeo = new THREE.BoxGeometry(0.152, 0.022, 0.065);
      const airBubble = new THREE.Mesh(airBubbleGeo, shoeAirMat);
      airBubble.position.set(0, -0.06, -0.04);
      shoeGroup.add(airBubble);

      // Chunky Street Outsole & Tread
      const soleGeo = new THREE.BoxGeometry(0.156, 0.038, 0.28);
      const sole = new THREE.Mesh(soleGeo, shoeSoleMat);
      sole.position.set(0, -0.075, 0.02);
      sole.castShadow = true;
      sole.receiveShadow = true;
      shoeGroup.add(sole);

      shin.add(shoeGroup);
    });

    // =========================================================================
    // 6. HANDCUFFS RIG (FOR ARRESTED CINEMATIC)
    // =========================================================================
    this.handcuffsGroup = new THREE.Group();
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      metalness: 0.95,
      roughness: 0.18,
    });
    const ringGeo = new THREE.TorusGeometry(0.065, 0.014, 8, 18);
    const ringL = new THREE.Mesh(ringGeo, steelMat);
    ringL.rotation.y = Math.PI / 2;
    ringL.position.set(-0.08, 0, 0);
    const ringR = ringL.clone();
    ringR.position.set(0.08, 0, 0);
    const chain = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.018, 0.018), steelMat);
    this.handcuffsGroup.add(ringL, ringR, chain);
    this.handcuffsGroup.position.set(0, -0.16, -0.26);
    this.handcuffsGroup.visible = false;
    this.torsoGroup.add(this.handcuffsGroup);

    // =========================================================================
    // 7. JETPACK RIG (TWIN TITANIUM TURBINE THRUSTERS)
    // =========================================================================
    this.jetpackGroup = new THREE.Group();
    this.jetpackGroup.position.set(0, 0.04, -0.16);

    const packBodyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.88,
      roughness: 0.22,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.92,
      roughness: 0.15,
    });
    const goldAccentMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.85,
      roughness: 0.25,
    });
    const nozzleMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.92,
      roughness: 0.28,
    });
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x06b6d4,
      emissiveIntensity: 3.2,
      roughness: 0.1,
    });
    const strapMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.85,
    });

    // Mounting backplate snug against the bomber jacket
    const backplate = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.04), packBodyMat);
    backplate.position.set(0, 0.02, -0.01);
    this.jetpackGroup.add(backplate);

    // Glowing Central Arc Reactor
    const coreMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.18, 14), coreMat);
    coreMesh.rotation.z = Math.PI / 2;
    coreMesh.position.set(0, 0.04, -0.04);
    this.jetpackGroup.add(coreMesh);

    // Twin Titanium Turbine Thrusters
    const tankGeo = new THREE.CylinderGeometry(0.082, 0.082, 0.46, 14);
    for (const side of [-1, 1]) {
      const tank = new THREE.Mesh(tankGeo, chromeMat);
      tank.position.set(side * 0.14, 0.02, -0.04);
      tank.castShadow = true;
      this.jetpackGroup.add(tank);

      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.082, 12, 10), goldAccentMat);
      cap.position.set(side * 0.14, 0.25, -0.04);
      this.jetpackGroup.add(cap);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.014, 8, 16), goldAccentMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(side * 0.14, 0.15, -0.04);
      this.jetpackGroup.add(ring);

      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.088, 0.13, 14), nozzleMat);
      nozzle.position.set(side * 0.14, -0.27, -0.04);
      this.jetpackGroup.add(nozzle);
    }

    // Shoulder Harness Straps
    for (const side of [-1, 1]) {
      const strapTop = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.038, 0.26), strapMat);
      strapTop.position.set(side * 0.14, 0.22, 0.11);
      this.jetpackGroup.add(strapTop);
    }

    // Dual Rocket Exhaust Flames
    this.jetFlameMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x06b6d4,
      emissiveIntensity: 2.2,
      transparent: true,
      opacity: 0.85,
      roughness: 0.1,
    });
    const flameGeo = new THREE.ConeGeometry(0.065, 0.38, 10);
    flameGeo.rotateX(Math.PI);

    for (const side of [-1, 1]) {
      const flame = new THREE.Mesh(flameGeo, this.jetFlameMat);
      flame.position.set(side * 0.14, -0.52, -0.04);
      this.jetFlames.push(flame);
      this.jetpackGroup.add(flame);
    }

    this.jetLight = new THREE.PointLight(0x06b6d4, 0.8, 4.5);
    this.jetLight.position.set(0, -0.38, -0.06);
    this.jetpackGroup.add(this.jetLight);

    this.jetpackGroup.visible = false;
    this.torsoGroup.add(this.jetpackGroup);

    // =========================================================================
    // 8. PARACHUTE SYSTEM (SPORTS RAM-AIR AIRFOIL CANOPY & RIG)
    // =========================================================================
    this.parachuteGroup = new THREE.Group();
    this.parachuteGroup.position.set(0, 0.42, 0);
    this.torsoGroup.add(this.parachuteGroup);

    // Parachute Backpack Container Rig (stowed on back)
    const packMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.65,
      metalness: 0.25,
    });
    const packAccentMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.35,
    });
    this.parachutePackMesh = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.40, 0.12), packMat);
    this.parachutePackMesh.position.set(0, 0.04, -0.16);
    this.parachutePackMesh.castShadow = true;

    // Ripcord pin & flap accent
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.02), packAccentMat);
    flap.position.set(0, 0.08, -0.065);
    this.parachutePackMesh.add(flap);
    this.parachutePackMesh.visible = false;
    this.torsoGroup.add(this.parachutePackMesh);

    // Parachute Canopy Group (floats high above the hero)
    this.parachuteCanopyGroup = new THREE.Group();
    this.parachuteCanopyGroup.position.set(0, 2.5, -0.22);
    this.parachuteGroup.add(this.parachuteCanopyGroup);

    // Ram-Air Canopy Materials
    const canopyRedMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.35,
      metalness: 0.08,
      side: THREE.DoubleSide,
    });
    const canopyWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.30,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const canopyCyanMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.65,
      roughness: 0.25,
      side: THREE.DoubleSide,
    });
    const cellInletMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.9,
    });

    // 7 Ram-Air Airfoil Cells across 2.85m span
    const numCells = 7;
    const span = 2.85;
    const chord = 1.35;
    const cellWidth = span / numCells;
    const cellThick = 0.22;

    for (let c = 0; c < numCells; c++) {
      const u = (c - (numCells - 1) / 2) / ((numCells - 1) / 2); // -1.0 to 1.0
      const cx = (c - (numCells - 1) / 2) * cellWidth;
      // Parabolic arch dihedral: center is highest, tips curve down
      const archY = -0.22 * (u * u);
      const cellMat = (c === 0 || c === numCells - 1)
        ? canopyCyanMat
        : (c === 2 || c === 3 || c === 4)
        ? canopyWhiteMat
        : canopyRedMat;

      const cellGroup = new THREE.Group();
      cellGroup.position.set(cx, archY, 0);

      // Upper camber curved wing surface
      const upperGeo = new THREE.BoxGeometry(cellWidth * 0.94, cellThick, chord);
      const upperMesh = new THREE.Mesh(upperGeo, cellMat);
      upperMesh.castShadow = true;
      cellGroup.add(upperMesh);

      // Front ram-air intake cell mouth
      const mouthGeo = new THREE.BoxGeometry(cellWidth * 0.82, cellThick * 0.65, 0.03);
      const mouthMesh = new THREE.Mesh(mouthGeo, cellInletMat);
      mouthMesh.position.set(0, -0.02, chord * 0.485);
      cellGroup.add(mouthMesh);

      // Stabilizer endplate fins on wingtips
      if (c === 0 || c === numCells - 1) {
        const finGeo = new THREE.BoxGeometry(0.035, 0.44, chord * 0.85);
        const finMesh = new THREE.Mesh(finGeo, canopyCyanMat);
        finMesh.position.set(c === 0 ? -cellWidth * 0.5 : cellWidth * 0.5, -0.14, 0);
        cellGroup.add(finMesh);
      }

      this.parachuteCanopyGroup.add(cellGroup);
    }

    // Dual Nylon Harness Webbing Risers (from shoulders up towards line connector links)
    const riserMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.75,
      metalness: 0.15,
    });
    const linkMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.85,
      roughness: 0.25,
    });

    [-0.18, 0.18].forEach((rx) => {
      const riserMesh = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.20, 0.016), riserMat);
      riserMesh.position.set(rx, 0.02, 0.03);
      riserMesh.rotation.x = -0.12;
      this.parachuteGroup.add(riserMesh);

      const linkMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.036, 8), linkMat);
      linkMesh.rotation.z = Math.PI / 2;
      linkMesh.position.set(rx, 0.12, 0.04);
      this.parachuteGroup.add(linkMesh);
    });

    // Braided Spectra Suspension Lines & Steering Brake Lines (20 dynamic lines = 40 vertices)
    const totalLines = 20;
    const linePositions = new Float32Array(totalLines * 2 * 3);
    this.parachuteLineGeo = new THREE.BufferGeometry();
    this.parachuteLineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.90,
    });
    this.parachuteLines = new THREE.LineSegments(this.parachuteLineGeo, lineMat);
    this.parachuteGroup.add(this.parachuteLines);

    this.parachuteGroup.visible = false;
    this.parachuteCanopyGroup.scale.set(0.08, 0.08, 0.08);

    // =========================================================================
    // 9. GROUND CONTACT SHADOW DECAL
    // =========================================================================
    const shadowGeo = new THREE.PlaneGeometry(0.72, 0.65);
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

  public getJetExhaustPositions(left: THREE.Vector3, right: THREE.Vector3) {
    left.set(-0.14, -0.38, -0.04);
    right.set(0.14, -0.38, -0.04);
    this.jetpackGroup.localToWorld(left);
    this.jetpackGroup.localToWorld(right);
  }

  public getJetExhaustPosition(target: THREE.Vector3): THREE.Vector3 {
    target.set(0, -0.38, -0.04);
    return this.jetpackGroup.localToWorld(target);
  }

  public setParachute(deployed: boolean, inflation01: number, steerBias: number = 0, isFlares: boolean = false) {
    this.isParachuteDeployed = deployed;
    this.parachuteSteerBias = steerBias;
    this.parachuteIsFlares = isFlares;
    this.parachuteGroup.visible = deployed;
    this.parachutePackMesh.visible = deployed;
    if (this.leftToggleMesh) this.leftToggleMesh.visible = deployed;
    if (this.rightToggleMesh) this.rightToggleMesh.visible = deployed;

    if (!deployed) {
      this.parachuteInflation = 0;
      this.parachuteGroup.visible = false;
      this.parachuteCanopyGroup.visible = false;
      this.parachuteLines.visible = false;
      this.parachutePackMesh.visible = false;
      if (this.leftToggleMesh) this.leftToggleMesh.visible = false;
      if (this.rightToggleMesh) this.rightToggleMesh.visible = false;
      this.parachuteCanopyGroup.scale.set(0.08, 0.08, 0.08);

      // Zero out line positions buffer so no phantom ropes remain visible in WebGL
      if (this.parachuteLineGeo) {
        const posAttr = this.parachuteLineGeo.getAttribute('position') as THREE.BufferAttribute;
        if (posAttr && posAttr.array) {
          (posAttr.array as Float32Array).fill(0);
          posAttr.needsUpdate = true;
        }
      }
      return;
    }

    this.parachuteCanopyGroup.visible = true;
    this.parachuteLines.visible = true;
    this.parachuteInflation += (inflation01 - this.parachuteInflation) * 0.25;
    const sc = Math.max(0.12, this.parachuteInflation);
    this.parachuteCanopyGroup.scale.set(sc, sc, sc);

    // Dynamic aerodynamic fabric fluttering in wind
    const flutter1 = Math.sin(this.animTimer * 16.0) * 0.025;
    const flutter2 = Math.cos(this.animTimer * 11.5) * 0.020;
    this.parachuteCanopyGroup.rotation.z = -steerBias * 0.38 + flutter2;
    this.parachuteCanopyGroup.rotation.x = (isFlares ? -0.15 : 0.08) + flutter1;

    this.updateParachuteRopes();
  }

  /**
   * Synchronize all 20 suspension lines and steering brake lines in real-time.
   * Suspension lines connect the 7 canopy cells to Left & Right shoulder risers with 100% symmetry.
   * Trailing edge brake lines connect outer wingtips directly to the left and right steering toggles held in hands.
   */
  private updateParachuteRopes() {
    if (!this.isParachuteDeployed || !this.parachuteLineGeo) return;

    this.parachuteCanopyGroup.updateMatrix();

    // Riser attachment coordinates in parachuteGroup space (at top of shoulder webbing straps)
    const leftRiserPos = new THREE.Vector3(-0.18, 0.12, 0.04);
    const rightRiserPos = new THREE.Vector3(0.18, 0.12, 0.04);

    // Hand coordinates in parachuteGroup space
    const handWorld = new THREE.Vector3();
    const leftHandPos = new THREE.Vector3(-0.35, 0.16, 0.27);
    const rightHandPos = new THREE.Vector3(0.35, 0.16, 0.27);

    if (this.leftHandGroup && this.rightHandGroup) {
      this.leftHandGroup.getWorldPosition(handWorld);
      leftHandPos.copy(handWorld);
      this.parachuteGroup.worldToLocal(leftHandPos);

      this.rightHandGroup.getWorldPosition(handWorld);
      rightHandPos.copy(handWorld);
      this.parachuteGroup.worldToLocal(rightHandPos);
    }

    const posAttr = this.parachuteLineGeo.getAttribute('position') as THREE.BufferAttribute;
    let vIdx = 0;

    const numCells = 7;
    const span = 2.85;
    const chord = 1.35;
    const cellWidth = span / numCells;
    const cellThick = 0.22;

    const topPos = new THREE.Vector3();

    const addSegment = (cellLocal: THREE.Vector3, anchorPos: THREE.Vector3) => {
      topPos.copy(cellLocal).applyMatrix4(this.parachuteCanopyGroup.matrix);
      posAttr.setXYZ(vIdx++, topPos.x, topPos.y, topPos.z);
      posAttr.setXYZ(vIdx++, anchorPos.x, anchorPos.y, anchorPos.z);
    };

    // 1. Suspension Lines (16 lines: 8 to left riser, 8 to right riser — 100% symmetrical)
    for (let c = 0; c < numCells; c++) {
      const u = (c - (numCells - 1) / 2) / ((numCells - 1) / 2);
      const cx = (c - (numCells - 1) / 2) * cellWidth;
      const archY = -0.22 * (u * u) - cellThick * 0.5;

      if (c === 3) {
        // Center cell: dual balanced lines to both left and right risers
        addSegment(new THREE.Vector3(cx - 0.08, archY, chord * 0.35), leftRiserPos);
        addSegment(new THREE.Vector3(cx + 0.08, archY, chord * 0.35), rightRiserPos);
        addSegment(new THREE.Vector3(cx - 0.08, archY, 0), leftRiserPos);
        addSegment(new THREE.Vector3(cx + 0.08, archY, 0), rightRiserPos);
      } else {
        const riser = cx < 0 ? leftRiserPos : rightRiserPos;
        addSegment(new THREE.Vector3(cx, archY, chord * 0.35), riser);
        addSegment(new THREE.Vector3(cx, archY, 0), riser);
      }
    }

    // 2. Trailing Edge Brake Steering Lines (4 lines: 2 to left hand, 2 to right hand)
    const archY0 = -0.22 * 1.0 - cellThick * 0.5;
    addSegment(new THREE.Vector3(-3 * cellWidth, archY0, -chord * 0.46), leftHandPos);

    const archY1 = -0.22 * 0.444 - cellThick * 0.5;
    addSegment(new THREE.Vector3(-2 * cellWidth, archY1, -chord * 0.44), leftHandPos);

    addSegment(new THREE.Vector3(3 * cellWidth, archY0, -chord * 0.46), rightHandPos);
    addSegment(new THREE.Vector3(2 * cellWidth, archY1, -chord * 0.44), rightHandPos);

    posAttr.needsUpdate = true;
  }

  // =========================================================================
  // 9. ADVANCED SKELETAL KINEMATICS & BLENDED ANIMATION
  // =========================================================================
  public update(
    delta: number,
    state: CharacterAnimState,
    speedRatio: number,
    bankAngle: number = 0,
    landingSquash: number = 0,
    vertSpeed: number = 0
  ) {
    const dt = Math.min(delta, 0.1);
    this.animState = state;
    this.animTimer += dt;

    // --- Involuntary Natural Eye Blinking (Zero shadow artifacts when eyes open) ---
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.currentBlink = 1.0;
      this.blinkTimer = 2.8 + Math.random() * 2.2;
    }
    const isBlinking = this.currentBlink > 0;
    this.leftEyelidTop.visible = isBlinking;
    this.leftEyelidBottom.visible = isBlinking;
    this.rightEyelidTop.visible = isBlinking;
    this.rightEyelidBottom.visible = isBlinking;
    if (isBlinking) {
      this.currentBlink = Math.max(0, this.currentBlink - dt / this.blinkDuration);
      const blinkScale = 1.0 - Math.sin(this.currentBlink * Math.PI) * 0.88;
      this.leftEyelidTop.position.y = 0.088 + 0.024 * blinkScale;
      this.leftEyelidBottom.position.y = 0.088 - 0.024 * blinkScale;
      this.rightEyelidTop.position.y = 0.088 + 0.024 * blinkScale;
      this.rightEyelidBottom.position.y = 0.088 - 0.024 * blinkScale;
    }

    // Default target bone orientations
    let torsoPitch = 0;
    let torsoRoll = 0;
    let torsoYaw = 0;
    let bodyY = 0;
    let headPitch = 0;
    let headYaw = 0;

    let leftArmX = 0;
    let leftArmY = 0;
    let leftArmZ = -0.06;
    let leftElbowX = -0.18;
    let leftWristX = 0;
    let leftWristY = 0;

    let rightArmX = 0;
    let rightArmY = 0;
    let rightArmZ = 0.06;
    let rightElbowX = -0.18;
    let rightWristX = 0;
    let rightWristY = 0;

    let leftLegX = 0;
    let leftLegZ = 0;
    let leftKneeX = 0.04;

    let rightLegX = 0;
    let rightLegZ = 0;
    let rightKneeX = 0.04;

    // --- State-Specific Kinematics ---
    if (state === 'IDLE') {
      // Natural dual-phase breathing & micro-sway
      const breath = Math.sin(this.animTimer * 2.4);
      const microSway = Math.sin(this.animTimer * 1.1) * 0.015;

      bodyY = breath * 0.012;
      torsoPitch = breath * 0.008;
      torsoYaw = microSway;
      headPitch = -breath * 0.012;
      headYaw = -microSway * 1.4;

      // Relaxed arms with slight natural forward elbow hang & soft wrist poise
      leftArmY = 0.06;
      rightArmY = -0.06;
      leftArmZ = -0.08 + breath * 0.015;
      rightArmZ = 0.08 - breath * 0.015;
      leftElbowX = -0.18 - breath * 0.03;
      rightElbowX = -0.18 - breath * 0.03;
      leftWristX = -0.06;
      rightWristX = -0.06;

      // Relaxed weight shift
      leftLegX = 0.03;
      rightLegX = -0.02;
      leftKneeX = 0.06;
      rightKneeX = 0.03;
    } else if (state === 'WALK') {
      // Natural human walk with articulated knee flexion & front-flowing arm swing
      const freq = 9.2;
      this.cycle += dt * freq;
      const s = Math.sin(this.cycle);
      const c = Math.cos(this.cycle);
      const walkSwing = Math.max(0.4, Math.min(1.0, speedRatio * 1.6));

      // Forward/backward thigh swing
      leftLegX = s * 0.58;
      rightLegX = -s * 0.58;

      // Knee flexion: leg lifts and bends as it swings forward, extends straight before plant
      leftKneeX = Math.max(0.04, -s * 0.72);
      rightKneeX = Math.max(0.04, s * 0.72);

      // Arm swing with forward-biased front flow
      leftArmX = (-s * 0.44 - 0.05) * walkSwing;
      rightArmX = (s * 0.44 - 0.05) * walkSwing;

      // Inward front flow: hand arcs gracefully across the front of the body on forward reach
      leftArmY = (Math.max(0, s) * 0.20 - Math.max(0, -s) * 0.06) * walkSwing;
      rightArmY = (-Math.max(0, -s) * 0.20 + Math.max(0, s) * 0.06) * walkSwing;

      leftArmZ = -0.09 + Math.max(0, s) * 0.04 * walkSwing;
      rightArmZ = 0.09 - Math.max(0, -s) * 0.04 * walkSwing;

      // Forward elbow flexion: bends forward on reach (-0.64 rad), relaxes on backswing (-0.26 rad)
      leftElbowX = -(0.32 + Math.max(0, s) * 0.32 + c * 0.06) * walkSwing;
      rightElbowX = -(0.32 + Math.max(0, -s) * 0.32 - c * 0.06) * walkSwing;

      // Fluid wrist follow-through tracking into the flow of motion
      leftWristX = -(Math.max(0, s) * 0.16 + c * 0.06) * walkSwing;
      rightWristX = -(Math.max(0, -s) * 0.16 - c * 0.06) * walkSwing;
      leftWristY = 0.10 * Math.max(0, s) * walkSwing;
      rightWristY = -0.10 * Math.max(0, -s) * walkSwing;

      // Pelvis counter-twist and step bob
      torsoYaw = -s * 0.07;
      headYaw = s * 0.04;
      bodyY = Math.abs(s) * 0.032;
      torsoPitch = 0.025;
      torsoRoll = c * 0.030 + bankAngle * 0.4;
    } else if (state === 'RUN') {
      // Athletic sprint: powerful high knee drive, compact pumping elbows, aggressive front flow
      const freq = 13.8;
      this.cycle += dt * freq;
      const s = Math.sin(this.cycle);
      const c = Math.cos(this.cycle);
      const runDrive = Math.max(0.75, speedRatio);

      // Powerful leg stride
      leftLegX = s * 0.92;
      rightLegX = -s * 0.92;

      // High knee drive (knee flexes up to ~65° during forward push)
      leftKneeX = Math.max(0.08, -s * 1.15 + 0.15);
      rightKneeX = Math.max(0.08, s * 1.15 + 0.15);

      // Power arm pump with forward-biased front drive (hands stay in front of the body)
      leftArmX = (-s * 0.72 - 0.16) * runDrive;
      rightArmX = (s * 0.72 - 0.16) * runDrive;

      // Inward chest angle: hands track naturally across the chest midline (front flow)
      leftArmY = (0.22 + Math.max(0, s) * 0.24) * runDrive;
      rightArmY = (-0.22 - Math.max(0, -s) * 0.24) * runDrive;

      leftArmZ = -0.12 + Math.max(0, s) * 0.06 * runDrive;
      rightArmZ = 0.12 - Math.max(0, -s) * 0.06 * runDrive;

      // Bent elbows (~75°–90° forward flexion): pumps forward and up to chest level
      leftElbowX = -(1.26 + Math.max(0, s) * 0.32 + c * 0.08) * runDrive;
      rightElbowX = -(1.26 + Math.max(0, -s) * 0.32 - c * 0.08) * runDrive;

      // Aerodynamic runner's wrist posture pointing forward into movement
      leftWristX = -(0.14 + Math.max(0, s) * 0.18 + c * 0.06) * runDrive;
      rightWristX = -(0.14 + Math.max(0, -s) * 0.18 - c * 0.06) * runDrive;
      leftWristY = 0.14 * runDrive;
      rightWristY = -0.14 * runDrive;

      // Athletic sprint lean & ground impact bounce
      torsoPitch = -0.18; // aggressive forward lean
      torsoRoll = c * 0.05 + bankAngle * 1.1; // bank into turns
      torsoYaw = -s * 0.10;
      headPitch = 0.09; // head looks up towards horizon
      bodyY = Math.abs(s) * 0.068;
    } else if (state === 'JUMP') {
      // Dynamic athletic jump launch poise: arms swinging forward/upward, lead knee driving up
      leftLegX = 0.35;
      rightLegX = -0.14;
      leftKneeX = 0.58;
      rightKneeX = 0.22;

      leftArmX = -0.65;
      rightArmX = -0.55;
      leftArmY = 0.18;
      rightArmY = -0.18;
      leftElbowX = -0.60;
      rightElbowX = -0.50;
      leftWristX = -0.25;
      rightWristX = -0.25;
      leftArmZ = -0.18;
      rightArmZ = 0.18;

      torsoPitch = -0.10;
      headPitch = -0.06;
      bodyY = 0.08;
    } else if (state === 'FALL') {
      // Real-human dynamic falling physics (inspired by GTA V / Euphoria procedural animation):
      // 1. Alternating dynamic arm windmilling & flailing to struggle for balance against rushing air
      // 2. Instinctual leg bicycling / pedaling ("air-stepping") searching for ground footing
      // 3. Torso counter-sway and head tilted urgently downward tracking the impact zone
      const fallSpeed = Math.max(0, -vertSpeed);
      const intensity = Math.min(1.0, 0.40 + fallSpeed / 18.0);
      const flailFreq = 5.6 + Math.min(fallSpeed * 0.35, 5.8);
      const flailPhase = this.animTimer * flailFreq;

      // Asymmetric counter-phase flailing waves
      const armWaveL = Math.sin(flailPhase);
      const armWaveR = Math.sin(flailPhase + Math.PI * 0.85);
      const crossWave = Math.cos(flailPhase * 0.8);

      // Arms flail in wide, visible, organic arcs (no stiff tension)
      leftArmX = 0.22 + armWaveL * 0.52 * intensity;
      rightArmX = 0.22 + armWaveR * 0.52 * intensity;
      leftArmZ = -0.42 - Math.abs(armWaveL) * 0.38 * intensity;
      rightArmZ = 0.42 + Math.abs(armWaveR) * 0.38 * intensity;
      leftElbowX = -(0.28 + Math.max(0, armWaveL) * 0.45);
      rightElbowX = -(0.28 + Math.max(0, armWaveR) * 0.45);

      // Instinctual human leg bicycling / air-stepping:
      // Legs pedal asynchronously, pumping knees and flexing hips to right the body
      const pedalPhase = this.animTimer * (flailFreq * 0.85);
      const legWaveL = Math.sin(pedalPhase);
      const legWaveR = Math.sin(pedalPhase + Math.PI);

      leftLegX = 0.12 + legWaveL * 0.42 * intensity;
      rightLegX = 0.12 + legWaveR * 0.42 * intensity;
      leftLegZ = -0.10 - crossWave * 0.05;
      rightLegZ = 0.10 + crossWave * 0.05;
      leftKneeX = 0.28 + Math.max(0, -legWaveL) * 0.58;
      rightKneeX = 0.28 + Math.max(0, -legWaveR) * 0.58;

      // Realistic torso reaction: leans forward into wind with subtle counter-sway
      torsoPitch = -0.16 + Math.sin(flailPhase * 0.5) * 0.06;
      torsoRoll = crossWave * 0.08 + bankAngle * 0.8;
      torsoYaw = Math.sin(flailPhase * 0.6) * 0.10;
      headPitch = 0.30; // Eyes locked on ground
      headYaw = -torsoYaw * 0.7;
      bodyY = 0.03 + Math.sin(flailPhase) * 0.03;
    } else if (state === 'ENTER_VEHICLE') {
      // Stepping in and reaching for driver door
      rightArmX = -0.88;
      rightArmZ = 0.24;
      rightElbowX = -0.55;

      leftLegX = 0.48;
      leftKneeX = 0.65;
      torsoPitch = -0.12;
    } else if (state === 'EXIT_VEHICLE') {
      // Stepping out onto street
      leftArmX = -0.42;
      leftElbowX = -0.35;
      leftLegX = 0.42;
      leftKneeX = 0.45;
      torsoPitch = 0.06;
    } else if (state === 'TUMBLE_RAGDOLL') {
      // Articulated ragdoll tumble with flailing elbows and knees
      const f1 = Math.sin(this.animTimer * 14.0);
      const f2 = Math.cos(this.animTimer * 11.0);

      leftLegX = -0.65 + f1 * 0.55;
      rightLegX = 0.55 - f2 * 0.55;
      leftKneeX = 0.45 + Math.abs(f1) * 0.7;
      rightKneeX = 0.45 + Math.abs(f2) * 0.7;

      leftArmX = -1.1 + f2 * 0.6;
      rightArmX = 0.95 + f1 * 0.6;
      leftElbowX = 0.45 + Math.abs(f2) * 0.8;
      rightElbowX = 0.45 + Math.abs(f1) * 0.8;
      leftArmZ = -0.55;
      rightArmZ = 0.55;

      torsoPitch = 0.35 + f1 * 0.25;
      torsoRoll = f2 * 0.3;
      headPitch = -0.35;
      bodyY = -0.32;
    } else if (state === 'GET_UP') {
      // Pushing up from pavement
      leftLegX = 0.45;
      rightLegX = -0.25;
      leftKneeX = 0.85;
      rightKneeX = 0.45;

      leftArmX = 0.65;
      rightArmX = 0.65;
      leftElbowX = 0.75;
      rightElbowX = 0.75;
      leftArmZ = -0.2;
      rightArmZ = 0.2;

      torsoPitch = -0.32;
      bodyY = -0.18;
    } else if (state === 'FLY') {
      // Supersonic flight: streamlined poise, knees bent trailing, arms stabilizing
      const lean = speedRatio;
      const wobble = Math.sin(this.animTimer * 3.1) * 0.03;

      torsoPitch = -0.18 - lean * 0.78 + wobble;
      headPitch = 0.28 + lean * 0.38;

      leftArmX = 0.48 + lean * 0.52;
      rightArmX = 0.48 + lean * 0.52;
      leftElbowX = 0.25 + lean * 0.2;
      rightElbowX = 0.25 + lean * 0.2;
      leftArmZ = -0.52 + lean * 0.22;
      rightArmZ = 0.52 - lean * 0.22;

      leftLegX = 0.28 + lean * 0.32;
      rightLegX = 0.22 + lean * 0.32;
      leftKneeX = 0.42;
      rightKneeX = 0.42;

      torsoRoll = bankAngle * 1.25;
      bodyY = 0.05 + wobble;
    } else if (state === 'PARACHUTE') {
      // Parachute flight: hands raised high in front grasping steering toggles, legs suspended in harness
      const steer = this.parachuteSteerBias;
      const isFlares = this.parachuteIsFlares;

      if (isFlares) {
        // Both hands pull down hard on toggles towards chest (flare landing brake!)
        leftArmX = -1.75;
        rightArmX = -1.75;
        leftElbowX = 0.70;
        rightElbowX = 0.70;
        leftArmZ = -0.20;
        rightArmZ = 0.20;
      } else {
        // When steer > 0 (Left / A key): pull the left rope on screen (hero's right arm on screen-left)
        const pullLeftRope = Math.max(0, steer);
        // When steer < 0 (Right / D key): pull the right rope on screen (hero's left arm on screen-right)
        const pullRightRope = Math.max(0, -steer);

        // High position (raised in front): armX = -2.60, elbowX = 0.20
        // Low pulled position (towards chest): armX = -1.75, elbowX = 0.70
        const windGrip = Math.sin(this.animTimer * 7.5) * 0.025;
        // Screen-left arm (hero's right arm):
        rightArmX = -2.60 + pullLeftRope * 0.85 - windGrip;
        rightElbowX = 0.20 + pullLeftRope * 0.50;
        rightArmZ = 0.28 - pullLeftRope * 0.08;

        // Screen-right arm (hero's left arm):
        leftArmX = -2.60 + pullRightRope * 0.85 + windGrip;
        leftElbowX = 0.20 + pullRightRope * 0.50;
        leftArmZ = -0.28 + pullRightRope * 0.08;
      }

      // Suspended harness posture: legs hanging naturally with slight knee bend and wind flutter
      const legFlutter = Math.sin(this.animTimer * 5.5) * 0.03;
      leftLegX = 0.14 + legFlutter;
      rightLegX = 0.10 - legFlutter;
      leftLegZ = -0.09;
      rightLegZ = 0.09;
      leftKneeX = 0.38 + legFlutter;
      rightKneeX = 0.34 - legFlutter;

      // Torso slight forward pitch and banking into turns
      torsoPitch = isFlares ? 0.08 : -0.08;
      torsoRoll = bankAngle * 0.85;
      headPitch = 0.12; // Looking along glide slope towards landing zone
      bodyY = 0.02 + Math.sin(this.animTimer * 6.0) * 0.015;
    } else if (state === 'ARRESTED') {
      // Handcuffed: arms behind back, elbows bent, wrists joined, head hung
      const breath = Math.sin(this.animTimer * 2.2);
      leftArmX = 0.58;
      rightArmX = 0.58;
      leftArmZ = 0.32;
      rightArmZ = -0.32;
      leftElbowX = 0.52;
      rightElbowX = 0.52;

      torsoPitch = 0.15 + breath * 0.01;
      headPitch = 0.44;
      leftLegX = 0.06;
      rightLegX = -0.04;
      bodyY = -0.03;
    }

    this.handcuffsGroup.visible = state === 'ARRESTED';

    // Apply landing shock squash to knees and body
    bodyY -= landingSquash * 0.85;
    leftKneeX += landingSquash * 1.4;
    rightKneeX += landingSquash * 1.4;

    // Smooth blending interpolation
    const blendSpeed = (state === 'TUMBLE_RAGDOLL' ? 24.0 : 14.0) * dt;
    this.targetRot.torsoPitch += (torsoPitch - this.targetRot.torsoPitch) * blendSpeed;
    this.targetRot.torsoRoll += (torsoRoll - this.targetRot.torsoRoll) * blendSpeed;
    this.targetRot.torsoYaw += (torsoYaw - this.targetRot.torsoYaw) * blendSpeed;
    this.targetRot.bodyY += (bodyY - this.targetRot.bodyY) * blendSpeed;
    this.targetRot.headPitch += (headPitch - this.targetRot.headPitch) * blendSpeed;
    this.targetRot.headYaw += (headYaw - this.targetRot.headYaw) * blendSpeed;

    this.targetRot.leftArmX += (leftArmX - this.targetRot.leftArmX) * blendSpeed;
    this.targetRot.leftArmY += (leftArmY - this.targetRot.leftArmY) * blendSpeed;
    this.targetRot.leftArmZ += (leftArmZ - this.targetRot.leftArmZ) * blendSpeed;
    this.targetRot.leftElbowX += (leftElbowX - this.targetRot.leftElbowX) * blendSpeed;
    this.targetRot.leftWristX += (leftWristX - this.targetRot.leftWristX) * blendSpeed;
    this.targetRot.leftWristY += (leftWristY - this.targetRot.leftWristY) * blendSpeed;

    this.targetRot.rightArmX += (rightArmX - this.targetRot.rightArmX) * blendSpeed;
    this.targetRot.rightArmY += (rightArmY - this.targetRot.rightArmY) * blendSpeed;
    this.targetRot.rightArmZ += (rightArmZ - this.targetRot.rightArmZ) * blendSpeed;
    this.targetRot.rightElbowX += (rightElbowX - this.targetRot.rightElbowX) * blendSpeed;
    this.targetRot.rightWristX += (rightWristX - this.targetRot.rightWristX) * blendSpeed;
    this.targetRot.rightWristY += (rightWristY - this.targetRot.rightWristY) * blendSpeed;

    this.targetRot.leftLegX += (leftLegX - this.targetRot.leftLegX) * blendSpeed;
    this.targetRot.leftLegZ += (leftLegZ - this.targetRot.leftLegZ) * blendSpeed;
    this.targetRot.leftKneeX += (leftKneeX - this.targetRot.leftKneeX) * blendSpeed;

    this.targetRot.rightLegX += (rightLegX - this.targetRot.rightLegX) * blendSpeed;
    this.targetRot.rightLegZ += (rightLegZ - this.targetRot.rightLegZ) * blendSpeed;
    this.targetRot.rightKneeX += (rightKneeX - this.targetRot.rightKneeX) * blendSpeed;

    // Apply squash and stretch scale to body
    const squashScaleX = 1.0 + landingSquash * 0.45;
    const squashScaleY = Math.max(0.70, 1.0 - landingSquash * 0.75);
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
    this.torsoGroup.rotation.y = this.targetRot.torsoYaw;
    this.torsoGroup.rotation.z = this.targetRot.torsoRoll;

    this.headGroup.rotation.x = this.targetRot.headPitch;
    this.headGroup.rotation.y = this.targetRot.headYaw;

    // Arm shoulder rotation
    this.leftArmGroup.rotation.x = this.targetRot.leftArmX;
    this.leftArmGroup.rotation.y = this.targetRot.leftArmY;
    this.leftArmGroup.rotation.z = this.targetRot.leftArmZ;

    this.rightArmGroup.rotation.x = this.targetRot.rightArmX;
    this.rightArmGroup.rotation.y = this.targetRot.rightArmY;
    this.rightArmGroup.rotation.z = this.targetRot.rightArmZ;

    // Forearm elbow flexion (articulated joint!)
    this.leftForearmGroup.rotation.x = this.targetRot.leftElbowX;
    this.rightForearmGroup.rotation.x = this.targetRot.rightElbowX;

    // Hand wrist articulation (Front Flow wrist poise)
    if (this.leftHandGroup) {
      this.leftHandGroup.rotation.x = this.targetRot.leftWristX;
      this.leftHandGroup.rotation.y = this.targetRot.leftWristY;
    }
    if (this.rightHandGroup) {
      this.rightHandGroup.rotation.x = this.targetRot.rightWristX;
      this.rightHandGroup.rotation.y = this.targetRot.rightWristY;
    }

    // Leg hip rotation
    this.leftLegGroup.rotation.x = this.targetRot.leftLegX;
    this.leftLegGroup.rotation.z = this.targetRot.leftLegZ;

    this.rightLegGroup.rotation.x = this.targetRot.rightLegX;
    this.rightLegGroup.rotation.z = this.targetRot.rightLegZ;

    // Shin knee flexion (articulated joint!)
    this.leftShinGroup.rotation.x = this.targetRot.leftKneeX;
    this.rightShinGroup.rotation.x = this.targetRot.rightKneeX;

    // Update Ground Contact Shadow Decal
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

    // Keep parachute suspension & brake lines dynamically anchored to hands & risers
    if (this.isParachuteDeployed) {
      this.bodyGroup.updateMatrixWorld(true);
      this.updateParachuteRopes();
    }
  }
}
