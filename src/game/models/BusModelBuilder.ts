import * as THREE from 'three';

/**
 * Builds a stylized low-poly Metro Transit Bus model for Deep Rush City.
 * Standardized with Wheel_Front_Left, Wheel_Front_Right, Wheel_Rear_Left, Wheel_Rear_Right
 * nodes so VehicleController, TrafficManager, and Multiplayer can drive and steer it.
 */
export function createBusModel(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Bus';

  // --- Materials ---
  // Car_Color material allows Los Santos Customs paint shop to customize its paint!
  const bodyPaintMat = new THREE.MeshStandardMaterial({
    name: 'Car_Color',
    color: 0xeab308, // Bright Metro Transit Gold/Yellow
    roughness: 0.35,
    metalness: 0.15,
  });

  const roofMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc, // Clean White roof
    roughness: 0.4,
    metalness: 0.1,
  });

  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a8a, // Deep transit navy stripe
    roughness: 0.3,
    metalness: 0.2,
  });

  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a, // Deep tinted glass
    roughness: 0.08,
    metalness: 0.85,
  });

  const bumperMat = new THREE.MeshStandardMaterial({
    color: 0x334155, // Dark slate rubberized bumper
    roughness: 0.7,
    metalness: 0.2,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.85,
    metalness: 0.05,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.3,
    metalness: 0.7,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.8,
    metalness: 0.1,
  });

  // --- Bus Body Structure ---
  // Bus Dimensions: Length = 7.6m, Width = 2.3m, Height = 2.4m
  const busGroup = new THREE.Group();
  busGroup.name = 'Bus_Body';

  // 1. Lower chassis / lower body skirt
  const lowerBodyGeo = new THREE.BoxGeometry(2.3, 0.9, 7.6);
  const lowerBody = new THREE.Mesh(lowerBodyGeo, bodyPaintMat);
  lowerBody.position.set(0, 0.9, 0);
  lowerBody.castShadow = true;
  lowerBody.receiveShadow = true;
  busGroup.add(lowerBody);

  // 2. Navy accent beltline stripe
  const stripeGeo = new THREE.BoxGeometry(2.32, 0.18, 7.62);
  const stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.position.set(0, 1.35, 0);
  busGroup.add(stripe);

  // 3. Middle passenger cabin pillars & tinted glass volume
  const cabinGeo = new THREE.BoxGeometry(2.26, 1.0, 7.5);
  const cabin = new THREE.Mesh(cabinGeo, windowMat);
  cabin.position.set(0, 1.9, 0);
  cabin.castShadow = true;
  busGroup.add(cabin);

  // 4. White roof cap with slightly tapered brow
  const roofGeo = new THREE.BoxGeometry(2.3, 0.32, 7.6);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(0, 2.52, 0);
  roof.castShadow = true;
  roof.receiveShadow = true;
  busGroup.add(roof);

  // 5. Front windshield (angled forward slightly)
  const windshieldGeo = new THREE.BoxGeometry(2.2, 0.95, 0.15);
  const windshield = new THREE.Mesh(windshieldGeo, windowMat);
  windshield.position.set(0, 1.92, 3.75);
  windshield.rotation.x = -0.12;
  busGroup.add(windshield);

  // 6. LED Destination Marquee Display ("42 METRO TRANSIT")
  const marqueeGeo = new THREE.BoxGeometry(1.7, 0.32, 0.15);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, 256, 48);
    ctx.fillStyle = '#f59e0b'; // Amber LED text
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('42 METRO TRANSIT', 128, 24);
  }
  const marqueeTex = new THREE.CanvasTexture(canvas);
  const marqueeMat = new THREE.MeshBasicMaterial({
    map: marqueeTex,
  });
  const marqueeMesh = new THREE.Mesh(marqueeGeo, marqueeMat);
  marqueeMesh.position.set(0, 2.48, 3.74);
  busGroup.add(marqueeMesh);

  // 7. Bumpers (front and rear)
  const fdBumperGeo = new THREE.BoxGeometry(2.36, 0.35, 0.45);
  const fdBumper = new THREE.Mesh(fdBumperGeo, bumperMat);
  fdBumper.position.set(0, 0.55, 3.8);
  busGroup.add(fdBumper);

  const rdBumperGeo = new THREE.BoxGeometry(2.36, 0.35, 0.45);
  const rdBumper = new THREE.Mesh(rdBumperGeo, bumperMat);
  rdBumper.position.set(0, 0.55, -3.8);
  busGroup.add(rdBumper);

  // 8. Rooftop Air Conditioning & Ventilation Pods
  const acGeo = new THREE.BoxGeometry(1.4, 0.28, 1.6);
  const acPod1 = new THREE.Mesh(acGeo, bumperMat);
  acPod1.position.set(0, 2.76, 1.2);
  busGroup.add(acPod1);

  const acPod2 = new THREE.Mesh(acGeo, bumperMat);
  acPod2.position.set(0, 2.76, -1.5);
  busGroup.add(acPod2);

  // 9. Side mirrors
  const mirrorGeo = new THREE.BoxGeometry(0.12, 0.3, 0.18);
  const mirrorL = new THREE.Mesh(mirrorGeo, trimMat);
  mirrorL.position.set(-1.26, 2.0, 3.6);
  busGroup.add(mirrorL);

  const mirrorR = new THREE.Mesh(mirrorGeo, trimMat);
  mirrorR.position.set(1.26, 2.0, 3.6);
  busGroup.add(mirrorR);

  // 10. Front Headlamp clusters
  const lampGeo = new THREE.BoxGeometry(0.3, 0.18, 0.08);
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffeedd,
    emissiveIntensity: 0.8,
    roughness: 0.1,
  });
  const headlampL = new THREE.Mesh(lampGeo, lampMat);
  headlampL.position.set(-0.85, 0.88, 3.82);
  busGroup.add(headlampL);

  const headlampR = new THREE.Mesh(lampGeo, lampMat);
  headlampR.position.set(0.85, 0.88, 3.82);
  busGroup.add(headlampR);

  // 11. Rear Taillight clusters
  const tailGeo = new THREE.BoxGeometry(0.24, 0.4, 0.08);
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0x990000,
    emissive: 0xff1122,
    emissiveIntensity: 0.8,
    roughness: 0.2,
  });
  const taillightL = new THREE.Mesh(tailGeo, tailMat);
  taillightL.position.set(-0.95, 1.1, -3.82);
  busGroup.add(taillightL);

  const taillightR = new THREE.Mesh(tailGeo, tailMat);
  taillightR.position.set(0.95, 1.1, -3.82);
  busGroup.add(taillightR);

  root.add(busGroup);

  // --- Standardized Wheels ---
  function buildWheel(name: string, x: number, y: number, z: number): THREE.Group {
    const wheelGroup = new THREE.Group();
    wheelGroup.name = name;
    wheelGroup.position.set(x, y, z);

    // Tire (Cylinder oriented along X axis)
    const tireGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.34, 18);
    tireGeo.rotateZ(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;
    wheelGroup.add(tire);

    // Metallic Rim Hubcap
    const rimGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.35, 12);
    rimGeo.rotateZ(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    wheelGroup.add(rim);

    // Lug nut accents
    const capGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.37, 8);
    capGeo.rotateZ(Math.PI / 2);
    const cap = new THREE.Mesh(capGeo, trimMat);
    wheelGroup.add(cap);

    return wheelGroup;
  }

  const wheelX = 1.05;
  const wheelY = 0.48;
  const frontZ = 2.2;
  const rearZ = -2.2;

  const wFL = buildWheel('Wheel_Front_Left', -wheelX, wheelY, frontZ);
  const wFR = buildWheel('Wheel_Front_Right', wheelX, wheelY, frontZ);
  const wRL = buildWheel('Wheel_Rear_Left', -wheelX, wheelY, rearZ);
  const wRR = buildWheel('Wheel_Rear_Right', wheelX, wheelY, rearZ);

  root.add(wFL);
  root.add(wFR);
  root.add(wRL);
  root.add(wRR);

  return root;
}
