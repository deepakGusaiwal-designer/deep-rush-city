import * as THREE from 'three';
import { DayNightMode, HeadlightMode } from '../types/game';
import { DynamicSky } from './DynamicSky';

/**
 * Creates a high-definition procedural asphalt light puddle texture.
 * Originates from dual headlamps at the front bumper and spreads forward,
 * illuminating road lanes with realistic Gaussian falloff and feathered edges.
 */
function createGroundDecalTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, 512, 1024);

  // 1. Broad soft ambient road wash (illuminates the asphalt lanes)
  const broadGrad = ctx.createRadialGradient(256, 750, 40, 256, 620, 420);
  broadGrad.addColorStop(0.0, 'rgba(255, 252, 235, 0.40)');
  broadGrad.addColorStop(0.25, 'rgba(255, 246, 215, 0.28)');
  broadGrad.addColorStop(0.60, 'rgba(215, 235, 255, 0.12)');
  broadGrad.addColorStop(0.85, 'rgba(180, 215, 255, 0.03)');
  broadGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = broadGrad;
  ctx.beginPath();
  ctx.ellipse(256, 620, 220, 380, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. High-intensity forward-projecting dual headlight cones
  const drawConeBeam = (startX: number, targetX: number, startW: number, endW: number, endY: number) => {
    ctx.save();
    try {
      ctx.filter = 'blur(12px)';
    } catch (_) {}
    const grad = ctx.createLinearGradient(startX, 1000, targetX, endY);
    grad.addColorStop(0.0, 'rgba(255, 255, 250, 0.95)');
    grad.addColorStop(0.15, 'rgba(255, 250, 225, 0.85)');
    grad.addColorStop(0.40, 'rgba(250, 245, 210, 0.55)');
    grad.addColorStop(0.70, 'rgba(210, 230, 255, 0.22)');
    grad.addColorStop(0.90, 'rgba(190, 220, 255, 0.06)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(startX - startW * 0.5, 1000);
    ctx.lineTo(targetX - endW * 0.5, endY);
    ctx.arc(targetX, endY, endW * 0.5, Math.PI, 0, false);
    ctx.lineTo(startX + startW * 0.5, 1000);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // Left headlight beam (widens from bumper to road ahead)
  drawConeBeam(205, 185, 40, 160, 180);
  // Right headlight beam
  drawConeBeam(307, 327, 40, 160, 180);

  // 3. Dual intense hotspots near the car bumper
  const drawHotSpot = (cx: number, cy: number, r: number) => {
    const spotGrad = ctx.createRadialGradient(cx, cy, 5, cx, cy, r);
    spotGrad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    spotGrad.addColorStop(0.3, 'rgba(255, 250, 230, 0.85)');
    spotGrad.addColorStop(0.65, 'rgba(250, 240, 200, 0.40)');
    spotGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = spotGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  drawHotSpot(205, 960, 85);
  drawHotSpot(307, 960, 85);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates soft headlamp lens flare sprite texture with hot white center and golden-blue halo.
 */
function createHeadlightFlareTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.15, 'rgba(255, 250, 225, 0.85)');
  grad.addColorStop(0.40, 'rgba(230, 242, 255, 0.35)');
  grad.addColorStop(0.70, 'rgba(180, 220, 255, 0.08)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates red taillight lens flare sprite texture.
 */
function createTaillightFlareTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0.0, 'rgba(255, 200, 200, 1.0)');
  grad.addColorStop(0.20, 'rgba(255, 30, 40, 0.90)');
  grad.addColorStop(0.50, 'rgba(200, 0, 15, 0.35)');
  grad.addColorStop(0.80, 'rgba(150, 0, 0, 0.08)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Ground decal quad geometry starting at Z = 0 (bumper) and stretching forward to Z = 1.
 */
function createGroundDecalGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array([
    -0.5, 0, 0.0, // 0: near left
     0.5, 0, 0.0, // 1: near right
    -0.5, 0, 1.0, // 2: far left
     0.5, 0, 1.0, // 3: far right
  ]);
  const uvs = new Float32Array([
    0.0, 0.0, // 0: bottom left
    1.0, 0.0, // 1: bottom right
    0.0, 1.0, // 2: top left
    1.0, 1.0, // 3: top right
  ]);
  const indices = [
    0, 2, 1,
    2, 3, 1,
  ];
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Volumetric cone geometry: narrow at Z = 0 (headlight fixture) and wide at Z = 1 (road spread).
 */
function createVolumetricBeamGeometry(): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.08, 1.5, 1.0, 32, 16, true);
  // Rotate so top (narrow) is at z = 0.0, bottom (wide) is at z = 1.0
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, 0.5);
  geo.computeVertexNormals();
  return geo;
}

/**
 * ShaderMaterial for cinematic atmospheric fog cone with length and rim falloffs.
 * Completely eliminates harsh polygonal rims and circular arc artifacts.
 */
function createBeamShaderMaterial(colorHex: number, initialOpacity: number): THREE.ShaderMaterial {
  const vertexShader = `
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying float vProgress;

    void main() {
      vProgress = position.z;
      vNormal = normalMatrix * normal;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;

  const fragmentShader = `
    uniform vec3 uColor;
    uniform float uOpacity;

    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying float vProgress;

    void main() {
      // 1. Length fade: soft fade-in at lens, full glow mid-beam, dissolves to 0 before tip
      float lengthFade = smoothstep(0.0, 0.08, vProgress) * smoothstep(1.0, 0.35, vProgress);

      // 2. Rim softness: edges facing away from camera become transparent
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float rimSoftness = pow(clamp(abs(dot(normalize(vNormal), viewDir)), 0.0, 1.0), 0.65);

      float alpha = lengthFade * rimSoftness * uOpacity;
      if (alpha <= 0.001) discard;

      gl_FragColor = vec4(uColor, alpha);
    }
  `;

  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uColor: { value: new THREE.Color(colorHex) },
      uOpacity: { value: initialOpacity },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export class LightingManager {
  private scene: THREE.Scene;
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private ambientLight: THREE.AmbientLight;
  private streetLightPositions: THREE.Vector3[] = [];
  private dynamicStreetLights: THREE.PointLight[] = [];

  // Vehicle lights (attached to car)
  public headLightL: THREE.SpotLight;
  public headLightR: THREE.SpotLight;
  public tailLightL: THREE.PointLight;
  public tailLightR: THREE.PointLight;

  // Headlight targets for aiming low beam / high beam
  private headLightTargetL: THREE.Object3D;
  private headLightTargetR: THREE.Object3D;

  // Procedural assets & meshes
  private groundDecalTex: THREE.CanvasTexture | null = null;
  private headlightFlareTex: THREE.CanvasTexture | null = null;
  private taillightFlareTex: THREE.CanvasTexture | null = null;

  private groundDecalMesh: THREE.Mesh | null = null;
  private groundDecalMat: THREE.MeshBasicMaterial | null = null;
  private flareSpriteL: THREE.Sprite | null = null;
  private flareSpriteR: THREE.Sprite | null = null;
  private tailFlareL: THREE.Sprite | null = null;
  private tailFlareR: THREE.Sprite | null = null;

  // Volumetric atmospheric beam shafts
  private beamMeshL: THREE.Mesh | null = null;
  private beamMeshR: THREE.Mesh | null = null;
  private beamShaderMatL: THREE.ShaderMaterial | null = null;
  private beamShaderMatR: THREE.ShaderMaterial | null = null;

  // Vehicle dimensions tracking
  private vehicleHalfW: number = 0.58;
  private vehicleFrontZ: number = 1.95;
  private vehicleRearZ: number = -1.95;

  private currentMode: DayNightMode = 'day';
  private currentHeadlightMode: HeadlightMode = 'low';
  private sunLightOffset: THREE.Vector3 = new THREE.Vector3(45, 75, 40);

  // Streetlight distance throttling & thermal control
  private lastStreetlightUpdatePos: THREE.Vector3 = new THREE.Vector3(9999, 9999, 9999);
  private lastStreetlightUpdateTime: number = 0;
  private maxActiveStreetlights: number = 6;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Ambient light - boosted for cartoon pop and readable night streets
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    this.scene.add(this.ambientLight);

    // Hemisphere light (sky vs ground bounce)
    this.hemiLight = new THREE.HemisphereLight(0xb1e1ff, 0xb97a20, 0.55);
    this.scene.add(this.hemiLight);

    // Directional Sun Light with sharp, non-peter-panning contact shadows (1024x1024 for high thermal efficiency)
    this.sunLight = new THREE.DirectionalLight(0xfff5e6, 1.25);
    this.sunLight.position.set(45, 75, 40);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 160;

    // Tightened shadow frustum focused on the player area for crisp 4cm texel fidelity
    const d = 42;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.00015;
    this.sunLight.shadow.normalBias = 0.006;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // 6 Dynamic street light point sources that follow player to illuminate nearby avenues (thermally optimized)
    for (let i = 0; i < 6; i++) {
      const pl = new THREE.PointLight(0xffdf88, 0, 32, 1.2);
      this.scene.add(pl);
      this.dynamicStreetLights.push(pl);
    }

    // Car Headlights (Spotlights)
    this.headLightL = new THREE.SpotLight(0xfffae6, 0, 50, Math.PI / 4.2, 0.90, 1.2);
    this.headLightL.position.set(-0.58, 0.55, 1.95);
    this.headLightL.castShadow = false;

    this.headLightR = new THREE.SpotLight(0xfffae6, 0, 50, Math.PI / 4.2, 0.90, 1.2);
    this.headLightR.position.set(0.58, 0.55, 1.95);
    this.headLightR.castShadow = false;

    this.headLightTargetL = new THREE.Object3D();
    this.headLightTargetL.position.set(-0.58, -0.30, 24);
    this.headLightL.target = this.headLightTargetL;

    this.headLightTargetR = new THREE.Object3D();
    this.headLightTargetR.position.set(0.58, -0.30, 24);
    this.headLightR.target = this.headLightTargetR;

    // Car Taillights
    this.tailLightL = new THREE.PointLight(0xff1100, 0, 5.5, 1.5);
    this.tailLightL.position.set(-0.58, 0.55, -1.95);

    this.tailLightR = new THREE.PointLight(0xff1100, 0, 5.5, 1.5);
    this.tailLightR.position.set(0.58, 0.55, -1.95);

    this.applyMode('day');
  }

  setSunShadows(enabled: boolean) {
    this.sunLight.castShadow = enabled;
  }

  setDynamicStreetLightsQuality(quality: 'low' | 'medium' | 'high') {
    if (quality === 'low') this.maxActiveStreetlights = 2;
    else if (quality === 'medium') this.maxActiveStreetlights = 4;
    else this.maxActiveStreetlights = 6;
  }

  setBrakeLights(isBraking: boolean) {
    if (isBraking) {
      this.tailLightL.intensity = 6.0;
      this.tailLightR.intensity = 6.0;
      this.tailLightL.distance = 9.0;
      this.tailLightR.distance = 9.0;
      if (this.tailFlareL && this.tailFlareR) {
        this.tailFlareL.visible = true;
        this.tailFlareR.visible = true;
        this.tailFlareL.scale.set(1.3, 1.3, 1.3);
        this.tailFlareR.scale.set(1.3, 1.3, 1.3);
        this.tailFlareL.material.opacity = 1.0;
        this.tailFlareR.material.opacity = 1.0;
      }
    } else {
      const isNight = this.currentMode === 'night';
      const isSunset = this.currentMode === 'sunset';
      if (isNight) {
        this.tailLightL.intensity = 1.6;
        this.tailLightR.intensity = 1.6;
        this.tailLightL.distance = 5.5;
        this.tailLightR.distance = 5.5;
        if (this.tailFlareL && this.tailFlareR) {
          this.tailFlareL.visible = true;
          this.tailFlareR.visible = true;
          this.tailFlareL.scale.set(0.7, 0.7, 0.7);
          this.tailFlareR.scale.set(0.7, 0.7, 0.7);
          this.tailFlareL.material.opacity = 0.55;
          this.tailFlareR.material.opacity = 0.55;
        }
      } else if (isSunset) {
        this.tailLightL.intensity = 0.9;
        this.tailLightR.intensity = 0.9;
        this.tailLightL.distance = 4.0;
        this.tailLightR.distance = 4.0;
        if (this.tailFlareL && this.tailFlareR) {
          this.tailFlareL.visible = true;
          this.tailFlareR.visible = true;
          this.tailFlareL.scale.set(0.6, 0.6, 0.6);
          this.tailFlareR.scale.set(0.6, 0.6, 0.6);
          this.tailFlareL.material.opacity = 0.35;
          this.tailFlareR.material.opacity = 0.35;
        }
      } else {
        this.tailLightL.intensity = 0;
        this.tailLightR.intensity = 0;
        if (this.tailFlareL && this.tailFlareR) {
          this.tailFlareL.visible = false;
          this.tailFlareR.visible = false;
        }
      }
    }
  }

  attachVehicleLights(
    lightsGroup: THREE.Object3D,
    halfW: number = 0.58,
    frontZ: number = 1.95,
    rearZ: number = -1.95
  ) {
    this.vehicleHalfW = halfW;
    this.vehicleFrontZ = frontZ;
    this.vehicleRearZ = rearZ;

    while (lightsGroup.children.length > 0) {
      lightsGroup.remove(lightsGroup.children[0]);
    }

    if (!this.groundDecalTex) this.groundDecalTex = createGroundDecalTexture();
    if (!this.headlightFlareTex) this.headlightFlareTex = createHeadlightFlareTexture();
    if (!this.taillightFlareTex) this.taillightFlareTex = createTaillightFlareTexture();

    // 1. Asphalt Ground Projection Decal (Soft, expansive road light puddle)
    const groundGeo = createGroundDecalGeometry();
    this.groundDecalMat = new THREE.MeshBasicMaterial({
      map: this.groundDecalTex,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.groundDecalMesh = new THREE.Mesh(groundGeo, this.groundDecalMat);
    this.groundDecalMesh.position.set(0, 0.005, frontZ + 0.1);
    lightsGroup.add(this.groundDecalMesh);

    // 2. Real forward SpotLights & targets
    this.headLightL.position.set(-halfW, 0.55, frontZ);
    this.headLightR.position.set(halfW, 0.55, frontZ);
    lightsGroup.add(this.headLightTargetL);
    lightsGroup.add(this.headLightTargetR);
    lightsGroup.add(this.headLightL);
    lightsGroup.add(this.headLightR);

    // 3. Front Headlamp Lens Glow Coronas (Sprites)
    const flareMatL = new THREE.SpriteMaterial({
      map: this.headlightFlareTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const flareMatR = new THREE.SpriteMaterial({
      map: this.headlightFlareTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.flareSpriteL = new THREE.Sprite(flareMatL);
    this.flareSpriteR = new THREE.Sprite(flareMatR);
    this.flareSpriteL.position.set(-halfW, 0.55, frontZ + 0.05);
    this.flareSpriteR.position.set(halfW, 0.55, frontZ + 0.05);
    lightsGroup.add(this.flareSpriteL);
    lightsGroup.add(this.flareSpriteR);

    // 4. Rear Taillight Point Lights & Flares
    this.tailLightL.position.set(-halfW, 0.55, rearZ);
    this.tailLightR.position.set(halfW, 0.55, rearZ);
    lightsGroup.add(this.tailLightL);
    lightsGroup.add(this.tailLightR);

    const tailFlareMatL = new THREE.SpriteMaterial({
      map: this.taillightFlareTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const tailFlareMatR = new THREE.SpriteMaterial({
      map: this.taillightFlareTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.tailFlareL = new THREE.Sprite(tailFlareMatL);
    this.tailFlareR = new THREE.Sprite(tailFlareMatR);
    this.tailFlareL.position.set(-halfW, 0.52, rearZ - 0.05);
    this.tailFlareR.position.set(halfW, 0.52, rearZ - 0.05);
    lightsGroup.add(this.tailFlareL);
    lightsGroup.add(this.tailFlareR);

    // 5. Cinematic Volumetric Fog Shafts (Feathered, zero polygon borders)
    const beamGeo = createVolumetricBeamGeometry();
    this.beamShaderMatL = createBeamShaderMaterial(0xfff5d8, 0.20);
    this.beamShaderMatR = createBeamShaderMaterial(0xfff5d8, 0.20);

    this.beamMeshL = new THREE.Mesh(beamGeo, this.beamShaderMatL);
    this.beamMeshL.position.set(-halfW, 0.55, frontZ);
    lightsGroup.add(this.beamMeshL);

    this.beamMeshR = new THREE.Mesh(beamGeo, this.beamShaderMatR);
    this.beamMeshR.position.set(halfW, 0.55, frontZ);
    lightsGroup.add(this.beamMeshR);

    this.applyHeadlightParameters();
  }

  public updateVehicleLightPositions(halfW: number, frontZ: number, rearZ: number) {
    this.vehicleHalfW = halfW;
    this.vehicleFrontZ = frontZ;
    this.vehicleRearZ = rearZ;

    this.headLightL.position.set(-halfW, 0.55, frontZ);
    this.headLightR.position.set(halfW, 0.55, frontZ);

    if (this.flareSpriteL) this.flareSpriteL.position.set(-halfW, 0.55, frontZ + 0.05);
    if (this.flareSpriteR) this.flareSpriteR.position.set(halfW, 0.55, frontZ + 0.05);

    if (this.beamMeshL) this.beamMeshL.position.set(-halfW, 0.55, frontZ);
    if (this.beamMeshR) this.beamMeshR.position.set(halfW, 0.55, frontZ);

    this.tailLightL.position.set(-halfW, 0.55, rearZ);
    this.tailLightR.position.set(halfW, 0.55, rearZ);

    if (this.tailFlareL) this.tailFlareL.position.set(-halfW, 0.52, rearZ - 0.05);
    if (this.tailFlareR) this.tailFlareR.position.set(halfW, 0.52, rearZ - 0.05);

    if (this.groundDecalMesh) {
      this.groundDecalMesh.position.set(0, 0.005, frontZ + 0.1);
    }
  }

  addStreetLight(x: number, y: number, z: number) {
    this.streetLightPositions.push(new THREE.Vector3(x, y, z));
  }

  // Configure Low Beam vs High Beam vs Off
  public setHeadlightMode(mode: HeadlightMode) {
    this.currentHeadlightMode = mode;
    this.applyHeadlightParameters();
  }

  public getHeadlightMode(): HeadlightMode {
    return this.currentHeadlightMode;
  }

  private applyHeadlightParameters() {
    const isNight = this.currentMode === 'night';
    const isSunset = this.currentMode === 'sunset';
    const mode = this.currentHeadlightMode;

    if (mode === 'off') {
      this.headLightL.intensity = 0;
      this.headLightR.intensity = 0;
      if (this.groundDecalMesh) this.groundDecalMesh.visible = false;
      if (this.flareSpriteL) this.flareSpriteL.visible = false;
      if (this.flareSpriteR) this.flareSpriteR.visible = false;
      if (this.beamMeshL) this.beamMeshL.visible = false;
      if (this.beamMeshR) this.beamMeshR.visible = false;
      return;
    }

    const frontZ = this.vehicleFrontZ;
    const halfW = this.vehicleHalfW;

    if (mode === 'low') {
      // LOW BEAM: Wide angle, angled downward to asphalt surface ahead (~24m focus)
      const targetInt = isNight ? 7.0 : isSunset ? 4.5 : 2.0;
      this.headLightL.color.setHex(0xfff6dd);
      this.headLightR.color.setHex(0xfff6dd);
      this.headLightL.intensity = targetInt;
      this.headLightR.intensity = targetInt;
      this.headLightL.distance = 50;
      this.headLightR.distance = 50;
      this.headLightL.angle = Math.PI / 4.2; // ~43° wide spread
      this.headLightR.angle = Math.PI / 4.2;
      this.headLightL.penumbra = 0.90; // maximum softness
      this.headLightR.penumbra = 0.90;

      this.headLightTargetL.position.set(-halfW, -0.30, frontZ + 22.0);
      this.headLightTargetR.position.set(halfW, -0.30, frontZ + 22.0);

      // Asphalt Ground Decal: Expansive 36-meter warm road pool
      if (this.groundDecalMesh && this.groundDecalMat) {
        this.groundDecalMesh.visible = !isNight && !isSunset ? false : true;
        this.groundDecalMesh.position.set(0, 0.005, frontZ + 0.1);
        this.groundDecalMesh.scale.set(18.0, 1.0, 36.0);
        this.groundDecalMat.color.setHex(0xfffae8);
        this.groundDecalMat.opacity = isNight ? 0.90 : isSunset ? 0.60 : 0.0;
      }

      // Front Headlamp Lens Flares
      if (this.flareSpriteL && this.flareSpriteR) {
        this.flareSpriteL.visible = true;
        this.flareSpriteR.visible = true;
        this.flareSpriteL.scale.set(1.5, 1.5, 1.5);
        this.flareSpriteR.scale.set(1.5, 1.5, 1.5);
        this.flareSpriteL.material.opacity = isNight ? 0.85 : isSunset ? 0.65 : 0.30;
        this.flareSpriteR.material.opacity = isNight ? 0.85 : isSunset ? 0.65 : 0.30;
      }

      // Volumetric atmospheric mist cone
      if (this.beamMeshL && this.beamMeshR && this.beamShaderMatL && this.beamShaderMatR) {
        this.beamMeshL.visible = isNight || isSunset;
        this.beamMeshR.visible = isNight || isSunset;
        this.beamMeshL.scale.set(1.15, 1.15, 28.0);
        this.beamMeshR.scale.set(1.15, 1.15, 28.0);
        this.beamMeshL.rotation.x = -0.015;
        this.beamMeshR.rotation.x = -0.015;

        this.beamShaderMatL.uniforms.uColor.value.setHex(0xfff5d8);
        this.beamShaderMatR.uniforms.uColor.value.setHex(0xfff5d8);
        const beamOp = isNight ? 0.20 : isSunset ? 0.10 : 0.0;
        this.beamShaderMatL.uniforms.uOpacity.value = beamOp;
        this.beamShaderMatR.uniforms.uOpacity.value = beamOp;
      }
    } else if (mode === 'high') {
      // HIGH BEAM: Piercing long-range xenon blue-white laser beam (cuts ~95m through the city)
      const targetInt = isNight ? 14.5 : isSunset ? 9.0 : 4.5;
      this.headLightL.color.setHex(0xf0f7ff);
      this.headLightR.color.setHex(0xf0f7ff);
      this.headLightL.intensity = targetInt;
      this.headLightR.intensity = targetInt;
      this.headLightL.distance = 95;
      this.headLightR.distance = 95;
      this.headLightL.angle = Math.PI / 5.2; // tighter ~35° piercing beam
      this.headLightR.angle = Math.PI / 5.2;
      this.headLightL.penumbra = 0.85;
      this.headLightR.penumbra = 0.85;

      this.headLightTargetL.position.set(-halfW * 0.7, 0.15, frontZ + 65.0);
      this.headLightTargetR.position.set(halfW * 0.7, 0.15, frontZ + 65.0);

      // Asphalt Ground Decal: Brilliant 75-meter high-beam projection
      if (this.groundDecalMesh && this.groundDecalMat) {
        this.groundDecalMesh.visible = !isNight && !isSunset ? false : true;
        this.groundDecalMesh.position.set(0, 0.005, frontZ + 0.1);
        this.groundDecalMesh.scale.set(26.0, 1.0, 75.0);
        this.groundDecalMat.color.setHex(0xf0f8ff);
        this.groundDecalMat.opacity = isNight ? 1.0 : isSunset ? 0.75 : 0.0;
      }

      // Front Headlamp Lens Flares: Powerful piercing blaze
      if (this.flareSpriteL && this.flareSpriteR) {
        this.flareSpriteL.visible = true;
        this.flareSpriteR.visible = true;
        this.flareSpriteL.scale.set(2.6, 2.6, 2.6);
        this.flareSpriteR.scale.set(2.6, 2.6, 2.6);
        this.flareSpriteL.material.opacity = isNight ? 1.0 : isSunset ? 0.85 : 0.45;
        this.flareSpriteR.material.opacity = isNight ? 1.0 : isSunset ? 0.85 : 0.45;
      }

      // Volumetric high-beam atmospheric God-rays
      if (this.beamMeshL && this.beamMeshR && this.beamShaderMatL && this.beamShaderMatR) {
        this.beamMeshL.visible = isNight || isSunset;
        this.beamMeshR.visible = isNight || isSunset;
        this.beamMeshL.scale.set(1.4, 1.4, 62.0);
        this.beamMeshR.scale.set(1.4, 1.4, 62.0);
        this.beamMeshL.rotation.x = 0.005;
        this.beamMeshR.rotation.x = 0.005;

        this.beamShaderMatL.uniforms.uColor.value.setHex(0xd8efff);
        this.beamShaderMatR.uniforms.uColor.value.setHex(0xd8efff);
        const beamOp = isNight ? 0.35 : isSunset ? 0.18 : 0.0;
        this.beamShaderMatL.uniforms.uOpacity.value = beamOp;
        this.beamShaderMatR.uniforms.uOpacity.value = beamOp;
      }
    }
  }

  applyMode(mode: DayNightMode) {
    this.currentMode = mode;
    this.scene.background = null;

    if (mode === 'day') {
      this.scene.fog = new THREE.FogExp2(0xa0d8ef, 0.0055);

      this.sunLight.color.setHex(0xfffaed);
      this.sunLight.intensity = 1.35;
      this.sunLightOffset.set(45, 75, 40);

      this.hemiLight.color.setHex(0xb1e1ff);
      this.hemiLight.groundColor.setHex(0xb97a20);
      this.hemiLight.intensity = 0.60;

      this.ambientLight.intensity = 0.48;
      this.ambientLight.color.setHex(0xffffff);

      this.tailLightL.intensity = 0;
      this.tailLightR.intensity = 0;

      this.dynamicStreetLights.forEach((l) => (l.intensity = 0));
    } else if (mode === 'sunset') {
      this.scene.fog = new THREE.FogExp2(0x5a2300, 0.0065);

      this.sunLight.color.setHex(0xff7733);
      this.sunLight.intensity = 1.05;
      this.sunLightOffset.set(60, 25, -40);

      this.hemiLight.color.setHex(0xfd7e14);
      this.hemiLight.groundColor.setHex(0x54321d);
      this.hemiLight.intensity = 0.52;

      this.ambientLight.intensity = 0.40;
      this.ambientLight.color.setHex(0xffd5b0);

      this.tailLightL.intensity = 0.8;
      this.tailLightR.intensity = 0.8;

      this.dynamicStreetLights.forEach((l) => (l.intensity = 1.8));
    } else {
      // Vibrant Cyber Night Mode
      this.scene.fog = new THREE.FogExp2(0x0b1632, 0.005);

      // Bright Lunar Moonlight
      this.sunLight.color.setHex(0x93c5fd);
      this.sunLight.intensity = 0.45;
      this.sunLightOffset.set(-35, 65, 30);

      // Neon Sky Hemisphere
      this.hemiLight.color.setHex(0x38bdf8);
      this.hemiLight.groundColor.setHex(0x1e1b4b);
      this.hemiLight.intensity = 0.62;

      // Ambient night illumination
      this.ambientLight.intensity = 0.48;
      this.ambientLight.color.setHex(0x94a3b8);

      this.tailLightL.intensity = 1.4;
      this.tailLightR.intensity = 1.4;

      this.dynamicStreetLights.forEach((l) => {
        l.intensity = 3.6;
        l.color.setHex(0xffdf88);
      });
    }

    this.applyHeadlightParameters();
  }

  /**
   * Continuous sync with DynamicSky:
   * - Aligns directional sun/moon light vector to celestial position
   * - Updates contact shadows, sun/moon color & intensity
   * - Smoothly coordinates hemisphere and ambient lighting
   * - Sets horizon fog color matching atmospheric sky haze
   * - Drives streetlight illumination and car taillights based on time-of-day
   */
  public syncWithSky(sky: DynamicSky, activeFocusPos: THREE.Vector3) {
    // 1. Fog color matches sky horizon for seamless skyline blending
    if (this.scene.fog) {
      const fogExp = this.scene.fog as THREE.FogExp2;
      fogExp.color.copy(sky.currentFogColor);
      fogExp.density = 0.0055 + sky.darknessFactor * 0.0008;
    }

    // 2. Celestial body selection for directional light & contact shadows
    const isSunUp = sky.sunDirection.y > -0.04;
    const celestialDir = isSunUp ? sky.sunDirection : sky.moonDirection;

    this.sunLightOffset.copy(celestialDir).multiplyScalar(82);
    this.sunLight.position.copy(activeFocusPos).add(this.sunLightOffset);
    this.sunLight.target.position.copy(activeFocusPos);
    this.sunLight.target.updateMatrixWorld();

    if (isSunUp) {
      this.sunLight.color.copy(sky.currentSunColor);
      const sunElevFactor = THREE.MathUtils.clamp((sky.sunDirection.y + 0.04) / 0.35, 0.15, 1.0);
      this.sunLight.intensity = THREE.MathUtils.lerp(0.85, 1.35, sunElevFactor);
    } else {
      // Cool lunar illumination & moon shadows
      this.sunLight.color.copy(sky.currentMoonColor);
      const moonElevFactor = THREE.MathUtils.clamp((sky.moonDirection.y + 0.04) / 0.35, 0.15, 1.0);
      this.sunLight.intensity = THREE.MathUtils.lerp(0.28, 0.48, moonElevFactor);
    }

    // 3. Hemisphere lighting (Zenith vs Ground bounce)
    const dayHemiSky = new THREE.Color(0xb1e1ff);
    const sunsetHemiSky = new THREE.Color(0xfd7e14);
    const nightHemiSky = new THREE.Color(0x38bdf8);

    const dayHemiGround = new THREE.Color(0xb97a20);
    const sunsetHemiGround = new THREE.Color(0x54321d);
    const nightHemiGround = new THREE.Color(0x1e1b4b);

    const sunsetFactor = Math.exp(-Math.pow((sky.sunDirection.y - 0.05) / 0.16, 2.0));

    this.hemiLight.color.copy(dayHemiSky);
    this.hemiLight.color.lerp(sunsetHemiSky, sunsetFactor);
    this.hemiLight.color.lerp(nightHemiSky, sky.darknessFactor);

    this.hemiLight.groundColor.copy(dayHemiGround);
    this.hemiLight.groundColor.lerp(sunsetHemiGround, sunsetFactor);
    this.hemiLight.groundColor.lerp(nightHemiGround, sky.darknessFactor);

    this.hemiLight.intensity = THREE.MathUtils.lerp(0.58, 0.62, sky.darknessFactor) - sunsetFactor * 0.06;

    // 4. Ambient light
    const dayAmb = new THREE.Color(0xffffff);
    const sunsetAmb = new THREE.Color(0xffd5b0);
    const nightAmb = new THREE.Color(0x94a3b8);

    this.ambientLight.color.copy(dayAmb);
    this.ambientLight.color.lerp(sunsetAmb, sunsetFactor);
    this.ambientLight.color.lerp(nightAmb, sky.darknessFactor);
    this.ambientLight.intensity = THREE.MathUtils.lerp(0.48, 0.40, sunsetFactor);
    this.ambientLight.intensity = THREE.MathUtils.lerp(this.ambientLight.intensity, 0.48, sky.darknessFactor);

    // 5. Taillight ambient glow when not actively braking
    if (this.tailLightL.intensity < 5.0) {
      const baseTail = THREE.MathUtils.lerp(0, 1.4, sky.darknessFactor) + sunsetFactor * 0.8;
      this.tailLightL.intensity = Math.min(1.4, baseTail);
      this.tailLightR.intensity = Math.min(1.4, baseTail);
    }

    // 6. Dynamic Streetlight illumination around player (throttled)
    if (this.streetLightPositions.length > 0) {
      if (sky.darknessFactor < 0.12 && sunsetFactor < 0.20) {
        this.dynamicStreetLights.forEach((l) => (l.intensity = 0));
      } else {
        const targetIntensity = THREE.MathUtils.lerp(
          sunsetFactor * 1.8,
          3.6,
          sky.darknessFactor
        );
        this.updateNearbyStreetlights(activeFocusPos, targetIntensity);
      }
    }

    // 7. Dynamic headlight adaptation to ambient darkness
    this.updateHeadlightDarknessBlend(sky.darknessFactor, sunsetFactor);
  }

  private updateHeadlightDarknessBlend(darkness: number, sunsetFactor: number) {
    if (this.currentHeadlightMode === 'off') return;

    const isHigh = this.currentHeadlightMode === 'high';
    const activeDark = Math.max(darkness, sunsetFactor * 0.75);

    // Fade ground decal smoothly with darkness
    if (this.groundDecalMat && this.groundDecalMesh) {
      if (activeDark < 0.10) {
        this.groundDecalMesh.visible = false;
      } else {
        this.groundDecalMesh.visible = true;
        const targetOp = isHigh
          ? THREE.MathUtils.lerp(0.35, 1.0, activeDark)
          : THREE.MathUtils.lerp(0.25, 0.90, activeDark);
        this.groundDecalMat.opacity = targetOp;
      }
    }

    // Fade volumetric atmospheric shaft with darkness
    if (this.beamShaderMatL && this.beamShaderMatR && this.beamMeshL && this.beamMeshR) {
      if (activeDark < 0.16) {
        this.beamMeshL.visible = false;
        this.beamMeshR.visible = false;
      } else {
        this.beamMeshL.visible = true;
        this.beamMeshR.visible = true;
        const maxOp = isHigh ? 0.35 : 0.20;
        const op = THREE.MathUtils.lerp(0.04, maxOp, activeDark);
        this.beamShaderMatL.uniforms.uOpacity.value = op;
        this.beamShaderMatR.uniforms.uOpacity.value = op;
      }
    }
  }

  private updateNearbyStreetlights(focusPos: THREE.Vector3, targetIntensity: number, force: boolean = false) {
    if (this.streetLightPositions.length === 0 || this.maxActiveStreetlights <= 0) {
      this.dynamicStreetLights.forEach((l) => (l.intensity = 0));
      return;
    }

    const now = performance.now();
    const movedSq = focusPos.distanceToSquared(this.lastStreetlightUpdatePos);
    // Throttle: only re-calculate nearest streetlights when player moves > 3.5m or > 350ms elapsed
    if (!force && movedSq < 12.25 && (now - this.lastStreetlightUpdateTime) < 350) {
      for (let i = 0; i < this.maxActiveStreetlights; i++) {
        if (this.dynamicStreetLights[i].intensity > 0) {
          this.dynamicStreetLights[i].intensity = targetIntensity;
        }
      }
      return;
    }

    this.lastStreetlightUpdatePos.copy(focusPos);
    this.lastStreetlightUpdateTime = now;

    const count = Math.min(this.maxActiveStreetlights, this.dynamicStreetLights.length);
    const sorted = [...this.streetLightPositions]
      .sort((a, b) => a.distanceToSquared(focusPos) - b.distanceToSquared(focusPos))
      .slice(0, count);

    for (let i = 0; i < this.dynamicStreetLights.length; i++) {
      const pl = this.dynamicStreetLights[i];
      if (i < sorted.length) {
        const p = sorted[i];
        pl.position.set(p.x, p.y + 7.5, p.z + 2.6);
        pl.intensity = targetIntensity;
        pl.color.setHex(0xffdf88);
      } else {
        pl.intensity = 0;
      }
    }
  }

  updateCarPosition(carPos: THREE.Vector3) {
    // Keep sun shadow frustum centered around player/car for crisp contact shadows
    this.sunLight.position.copy(carPos).add(this.sunLightOffset);
    this.sunLight.target.position.copy(carPos);
    this.sunLight.target.updateMatrixWorld();

    if (this.currentMode === 'day' || this.streetLightPositions.length === 0) {
      this.dynamicStreetLights.forEach((l) => (l.intensity = 0));
      return;
    }

    // Illuminate car and nearby streets with nearest streetlights (throttled)
    const targetIntensity = this.currentMode === 'night' ? 3.6 : 1.8;
    this.updateNearbyStreetlights(carPos, targetIntensity);
  }

  flashHeadlights(durationMs: number = 450) {
    const prevL = this.headLightL.intensity;
    const prevR = this.headLightR.intensity;
    this.headLightL.intensity = 12.0;
    this.headLightR.intensity = 12.0;
    setTimeout(() => {
      this.headLightL.intensity = prevL;
      this.headLightR.intensity = prevR;
    }, durationMs);
  }
}
