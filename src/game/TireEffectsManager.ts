import * as THREE from 'three';

interface SkidSegment {
  active: boolean;
  position: THREE.Vector3;
  heading: number;
  length: number;
  age: number;
  maxAge: number;
  initialAlpha: number;
}

interface GroundFireSegment {
  active: boolean;
  position: THREE.Vector3;
  heading: number;
  age: number;
  maxAge: number;
  initialAlpha: number;
}

interface FireParticle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  maxAge: number;
  startSize: number;
  endSize: number;
}

const FIRE_VERT = /* glsl */ `
  attribute float size;
  attribute float alpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = color;
    vAlpha = alpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (340.0 / max(0.5, -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FIRE_FRAG = /* glsl */ `
  uniform sampler2D map;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 tex = texture2D(map, gl_PointCoord);
    gl_FragColor = vec4(vColor, tex.a * vAlpha);
    if (gl_FragColor.a < 0.01) discard;
  }
`;

export class TireEffectsManager {
  private scene: THREE.Scene;

  // 1. Realistic Skid Marks on Road Surface (tire rubber marks)
  private static readonly MAX_SKID_MARKS = 1200;
  private skidMesh: THREE.InstancedMesh;
  private skidSegments: SkidSegment[] = [];
  private skidNextIndex: number = 0;
  private dummy = new THREE.Object3D();
  private tireMarkTexture: THREE.Texture;
  private skidOpacities = new Float32Array(TireEffectsManager.MAX_SKID_MARKS);
  private skidOpacityAttr: THREE.InstancedBufferAttribute;

  // Previous contact positions per wheel
  private lastPosRL = new THREE.Vector3();
  private lastPosRR = new THREE.Vector3();
  private lastPosFL = new THREE.Vector3();
  private lastPosFR = new THREE.Vector3();

  private hasLastRL = false;
  private hasLastRR = false;
  private hasLastFL = false;
  private hasLastFR = false;

  // 2. High-Performance Nitro Fire Trail System (Roaring dual exhaust flames & sparks)
  private static readonly MAX_FIRE_PARTICLES = 360;
  private fireParticles: FireParticle[] = [];
  private firePoints: THREE.Points;
  private fireGeometry: THREE.BufferGeometry;
  private fireMaterial: THREE.ShaderMaterial;
  private fireTexture: THREE.Texture;
  private fireNextIndex: number = 0;

  private firePositions = new Float32Array(TireEffectsManager.MAX_FIRE_PARTICLES * 3);
  private fireColors = new Float32Array(TireEffectsManager.MAX_FIRE_PARTICLES * 3);
  private fireSizes = new Float32Array(TireEffectsManager.MAX_FIRE_PARTICLES);
  private fireAlphas = new Float32Array(TireEffectsManager.MAX_FIRE_PARTICLES);

  // 3. Ground Fire Burn Streaks (fiery patches on tarmac under exhaust)
  private static readonly MAX_GROUND_FIRE = 80;
  private groundFireMesh: THREE.InstancedMesh;
  private groundFireSegments: GroundFireSegment[] = [];
  private groundFireNextIndex: number = 0;
  private groundFireOpacities = new Float32Array(TireEffectsManager.MAX_GROUND_FIRE);
  private groundFireOpacityAttr: THREE.InstancedBufferAttribute;
  private groundFireTexture: THREE.Texture;

  // Dynamic exhaust fire illumination
  private fireLight: THREE.PointLight;
  private fireLightPulse: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // --- Create Procedural Tire Tread Texture ---
    this.tireMarkTexture = this.createTireMarkTexture();

    // --- Create Skid Marks InstancedMesh with per-instance Opacity ---
    const skidGeo = new THREE.PlaneGeometry(0.26, 1.0);
    skidGeo.rotateX(-Math.PI / 2);

    this.skidOpacityAttr = new THREE.InstancedBufferAttribute(this.skidOpacities, 1);
    this.skidOpacityAttr.setUsage(THREE.DynamicDrawUsage);
    skidGeo.setAttribute('instanceOpacity', this.skidOpacityAttr);

    const skidMat = new THREE.MeshBasicMaterial({
      map: this.tireMarkTexture,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -1.0,
    });

    skidMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute float instanceOpacity;
          varying float vInstanceOpacity;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vInstanceOpacity = instanceOpacity;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying float vInstanceOpacity;`
        )
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
          gl_FragColor.a *= vInstanceOpacity;`
        );
    };

    this.skidMesh = new THREE.InstancedMesh(skidGeo, skidMat, TireEffectsManager.MAX_SKID_MARKS);
    this.skidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const offscreenMat = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < TireEffectsManager.MAX_SKID_MARKS; i++) {
      this.skidMesh.setMatrixAt(i, offscreenMat);
      this.skidOpacities[i] = 0.0;
      this.skidSegments.push({
        active: false,
        position: new THREE.Vector3(),
        heading: 0,
        length: 1.0,
        age: 0,
        maxAge: 14.0,
        initialAlpha: 0.85,
      });
    }
    this.skidMesh.instanceMatrix.needsUpdate = true;
    this.skidOpacityAttr.needsUpdate = true;
    this.scene.add(this.skidMesh);

    // --- Create Nitro Exhaust Fire Particle System ---
    this.fireTexture = this.createFireTexture();

    this.fireGeometry = new THREE.BufferGeometry();
    this.fireGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.firePositions, 3).setUsage(THREE.DynamicDrawUsage)
    );
    this.fireGeometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.fireColors, 3).setUsage(THREE.DynamicDrawUsage)
    );
    this.fireGeometry.setAttribute(
      'size',
      new THREE.BufferAttribute(this.fireSizes, 1).setUsage(THREE.DynamicDrawUsage)
    );
    this.fireGeometry.setAttribute(
      'alpha',
      new THREE.BufferAttribute(this.fireAlphas, 1).setUsage(THREE.DynamicDrawUsage)
    );

    this.fireMaterial = new THREE.ShaderMaterial({
      vertexShader: FIRE_VERT,
      fragmentShader: FIRE_FRAG,
      uniforms: {
        map: { value: this.fireTexture },
      },
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.firePoints = new THREE.Points(this.fireGeometry, this.fireMaterial);
    this.firePoints.frustumCulled = false;
    this.scene.add(this.firePoints);

    for (let i = 0; i < TireEffectsManager.MAX_FIRE_PARTICLES; i++) {
      this.fireParticles.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        age: 0,
        maxAge: 0.35,
        startSize: 0.25,
        endSize: 0.05,
      });
      this.firePositions[i * 3 + 1] = -999;
      this.fireSizes[i] = 0;
      this.fireAlphas[i] = 0;
    }
    this.fireGeometry.attributes.position.needsUpdate = true;
    this.fireGeometry.attributes.size.needsUpdate = true;
    this.fireGeometry.attributes.alpha.needsUpdate = true;

    // --- Create Ground Fire Burn Streaks InstancedMesh ---
    this.groundFireTexture = this.createGroundFireTexture();
    const groundFireGeo = new THREE.PlaneGeometry(0.38, 1.0);
    groundFireGeo.rotateX(-Math.PI / 2);

    this.groundFireOpacityAttr = new THREE.InstancedBufferAttribute(this.groundFireOpacities, 1);
    this.groundFireOpacityAttr.setUsage(THREE.DynamicDrawUsage);
    groundFireGeo.setAttribute('instanceOpacity', this.groundFireOpacityAttr);

    const groundFireMat = new THREE.MeshBasicMaterial({
      map: this.groundFireTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -2.0,
    });

    groundFireMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute float instanceOpacity;
          varying float vInstanceOpacity;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vInstanceOpacity = instanceOpacity;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying float vInstanceOpacity;`
        )
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
          gl_FragColor.a *= vInstanceOpacity;`
        );
    };

    this.groundFireMesh = new THREE.InstancedMesh(
      groundFireGeo,
      groundFireMat,
      TireEffectsManager.MAX_GROUND_FIRE
    );
    this.groundFireMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < TireEffectsManager.MAX_GROUND_FIRE; i++) {
      this.groundFireMesh.setMatrixAt(i, offscreenMat);
      this.groundFireOpacities[i] = 0.0;
      this.groundFireSegments.push({
        active: false,
        position: new THREE.Vector3(),
        heading: 0,
        age: 0,
        maxAge: 0.9,
        initialAlpha: 0.9,
      });
    }
    this.groundFireMesh.instanceMatrix.needsUpdate = true;
    this.groundFireOpacityAttr.needsUpdate = true;
    this.scene.add(this.groundFireMesh);

    // --- Dynamic Point Light for Nitro Fire Glow ---
    this.fireLight = new THREE.PointLight(0xff6611, 0, 9.0, 2.0);
    this.scene.add(this.fireLight);
  }

  // Create high-resolution procedural tire mark texture with realistic tread sipes, shoulder bands and rubber grain
  private createTireMarkTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Base rubber gradient across tire width (X = 0 to 128)
      // Shoulder zones experience highest contact pressure and deposit thickest rubber streaks
      const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
      grad.addColorStop(0.0, 'rgba(15, 15, 18, 0.0)');
      grad.addColorStop(0.1, 'rgba(15, 15, 18, 0.55)');
      // Outer left shoulder
      grad.addColorStop(0.2, 'rgba(10, 10, 12, 0.95)');
      // Tread channel
      grad.addColorStop(0.35, 'rgba(22, 22, 25, 0.65)');
      // Center rib
      grad.addColorStop(0.5, 'rgba(12, 12, 14, 0.9)');
      // Tread channel
      grad.addColorStop(0.65, 'rgba(22, 22, 25, 0.65)');
      // Outer right shoulder
      grad.addColorStop(0.8, 'rgba(10, 10, 12, 0.95)');
      grad.addColorStop(0.9, 'rgba(15, 15, 18, 0.55)');
      grad.addColorStop(1.0, 'rgba(15, 15, 18, 0.0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Dark longitudinal tread grooves
      ctx.fillStyle = 'rgba(6, 6, 8, 0.45)';
      ctx.fillRect(22, 0, 7, canvas.height);
      ctx.fillRect(59, 0, 10, canvas.height);
      ctx.fillRect(99, 0, 7, canvas.height);

      // 3. Repeating angled tire sipes
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      for (let y = 0; y < canvas.height; y += 14) {
        ctx.beginPath();
        ctx.moveTo(14, y);
        ctx.lineTo(46, y + 6);
        ctx.lineTo(46, y + 9);
        ctx.lineTo(14, y + 3);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(82, y + 6);
        ctx.lineTo(114, y);
        ctx.lineTo(114, y + 3);
        ctx.lineTo(82, y + 9);
        ctx.fill();
      }

      // 4. Coarse asphalt aggregate noise and rubber tear grain
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 8) {
          const noise = (Math.random() - 0.5) * 32;
          d[i] = Math.max(0, Math.min(255, d[i] + noise));
          d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + noise));
          d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + noise));
          d[i + 3] = Math.max(0, Math.min(255, d[i + 3] + (Math.random() - 0.5) * 25));
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }

  // Procedural soft glowing fire ball particle texture
  private createFireTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 64, 64);
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 31);
      grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.18, 'rgba(255, 230, 110, 0.95)');
      grad.addColorStop(0.42, 'rgba(255, 130, 25, 0.8)');
      grad.addColorStop(0.72, 'rgba(230, 45, 10, 0.35)');
      grad.addColorStop(1.0, 'rgba(180, 10, 0, 0.0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  // Procedural flaming asphalt burn streak texture
  private createGroundFireTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 64, 128);

      // Core fire ribbon gradient from center outwards
      const grad = ctx.createLinearGradient(0, 0, 64, 0);
      grad.addColorStop(0.0, 'rgba(220, 30, 0, 0.0)');
      grad.addColorStop(0.2, 'rgba(255, 70, 10, 0.45)');
      grad.addColorStop(0.5, 'rgba(255, 220, 120, 0.95)');
      grad.addColorStop(0.8, 'rgba(255, 70, 10, 0.45)');
      grad.addColorStop(1.0, 'rgba(220, 30, 0, 0.0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 128);

      // Add turbulent flame streaks
      ctx.fillStyle = 'rgba(255, 255, 200, 0.7)';
      for (let i = 0; i < 8; i++) {
        const x = 24 + Math.random() * 16;
        const y = Math.random() * 100;
        const h = 15 + Math.random() * 20;
        ctx.fillRect(x, y, 3, h);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  // Spawn a high-speed fire exhaust particle
  private spawnFireParticle(origin: THREE.Vector3, exhaustDir: THREE.Vector3, carSpeedKmh: number) {
    const idx = this.fireNextIndex;
    this.fireNextIndex = (this.fireNextIndex + 1) % TireEffectsManager.MAX_FIRE_PARTICLES;

    const p = this.fireParticles[idx];
    p.active = true;
    p.pos.copy(origin);
    // Slight jitter in emitter origin
    p.pos.x += (Math.random() - 0.5) * 0.08;
    p.pos.y += (Math.random() - 0.5) * 0.06;
    p.pos.z += (Math.random() - 0.5) * 0.08;

    p.age = 0;
    p.maxAge = 0.22 + Math.random() * 0.16; // quick 220-380ms fire trail
    p.startSize = 0.24 + Math.random() * 0.12;
    p.endSize = 0.55 + Math.random() * 0.25;

    // Velocity: shooting backward with high thrust + turbulent cone spread
    const speedBoost = Math.max(12.0, carSpeedKmh * 0.25);
    p.vel.copy(exhaustDir).multiplyScalar(speedBoost + (Math.random() - 0.5) * 4.0);
    p.vel.x += (Math.random() - 0.5) * 1.8;
    p.vel.y += 0.4 + Math.random() * 1.2;
    p.vel.z += (Math.random() - 0.5) * 1.8;
  }

  // Add an ignited ground burn segment on the road behind tires
  private addGroundFireSegment(p0: THREE.Vector3, p1: THREE.Vector3, intensity: number = 0.95) {
    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) return;

    const idx = this.groundFireNextIndex;
    this.groundFireNextIndex = (this.groundFireNextIndex + 1) % TireEffectsManager.MAX_GROUND_FIRE;

    const seg = this.groundFireSegments[idx];
    seg.active = true;
    seg.position.set((p0.x + p1.x) * 0.5, 0.006, (p0.z + p1.z) * 0.5);
    seg.heading = Math.atan2(dx, dz);
    seg.age = 0;
    seg.maxAge = 0.85;
    seg.initialAlpha = Math.min(1.0, Math.max(0.4, intensity));

    this.dummy.position.copy(seg.position);
    this.dummy.rotation.set(0, seg.heading, 0);
    this.dummy.scale.set(1.0, 1.0, len * 1.1);
    this.dummy.updateMatrix();

    this.groundFireMesh.setMatrixAt(idx, this.dummy.matrix);
    this.groundFireOpacities[idx] = seg.initialAlpha;
    this.groundFireMesh.instanceMatrix.needsUpdate = true;
    this.groundFireOpacityAttr.needsUpdate = true;
  }

  // Add a continuous tire mark quad connecting p0 and p1 on the road
  private addSkidSegment(p0: THREE.Vector3, p1: THREE.Vector3, intensity: number = 0.85) {
    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.03) return;

    const idx = this.skidNextIndex;
    this.skidNextIndex = (this.skidNextIndex + 1) % TireEffectsManager.MAX_SKID_MARKS;

    const seg = this.skidSegments[idx];
    seg.active = true;
    seg.position.set((p0.x + p1.x) * 0.5, 0.004, (p0.z + p1.z) * 0.5);
    seg.heading = Math.atan2(dx, dz);
    seg.length = len * 1.08; // 8% overlap to guarantee zero gaps
    seg.age = 0;
    seg.maxAge = 14.0;
    seg.initialAlpha = Math.min(0.92, Math.max(0.2, intensity));

    this.dummy.position.copy(seg.position);
    this.dummy.rotation.set(0, seg.heading, 0);
    this.dummy.scale.set(1.0, 1.0, seg.length);
    this.dummy.updateMatrix();

    this.skidMesh.setMatrixAt(idx, this.dummy.matrix);
    this.skidOpacities[idx] = seg.initialAlpha;
  }

  // Emit light trails and road skid marks behind vehicle
  public emitTireEffects(
    carRoot: THREE.Group,
    wheelPositions: { fl: THREE.Vector3; fr: THREE.Vector3; rl: THREE.Vector3; rr: THREE.Vector3 },
    isSlipping: boolean,
    isBraking: boolean,
    isBoosting: boolean = false,
    carSpeedKmh: number = 0,
    wheelBase: number = 1.25,
    trackWidth: number = 1.35
  ) {
    const speed = Math.abs(carSpeedKmh);

    // 1. Realistic Multi-Wheel Skid Marks on road surface
    const rearSkid = (isSlipping || isBraking) && (speed > 1.8 || isBoosting);
    const frontSkid = (isBraking && speed > 22.0) || (isSlipping && speed > 28.0);

    let rearAlpha = isSlipping ? 0.90 : Math.min(0.85, 0.45 + (speed / 70.0) * 0.4);
    if (isBoosting) rearAlpha = 0.95;
    const frontAlpha = rearAlpha * 0.72;

    let skidMeshNeedsUpdate = false;
    const minStep = isBraking ? 0.07 : 0.09;

    const processWheel = (
      currentPos: THREE.Vector3,
      lastPos: THREE.Vector3,
      hasLast: boolean,
      alpha: number
    ): boolean => {
      if (hasLast) {
        const d = currentPos.distanceTo(lastPos);
        if (d >= minStep) {
          this.addSkidSegment(lastPos, currentPos, alpha);
          lastPos.copy(currentPos);
          skidMeshNeedsUpdate = true;
          return true;
        }
        return true;
      } else {
        lastPos.copy(currentPos);
        return true;
      }
    };

    // Rear Left Wheel
    if (rearSkid) {
      this.hasLastRL = processWheel(wheelPositions.rl, this.lastPosRL, this.hasLastRL, rearAlpha);
    } else {
      this.hasLastRL = false;
    }

    // Rear Right Wheel
    if (rearSkid) {
      this.hasLastRR = processWheel(wheelPositions.rr, this.lastPosRR, this.hasLastRR, rearAlpha);
    } else {
      this.hasLastRR = false;
    }

    // Front Left Wheel
    if (frontSkid) {
      this.hasLastFL = processWheel(wheelPositions.fl, this.lastPosFL, this.hasLastFL, frontAlpha);
    } else {
      this.hasLastFL = false;
    }

    // Front Right Wheel
    if (frontSkid) {
      this.hasLastFR = processWheel(wheelPositions.fr, this.lastPosFR, this.hasLastFR, frontAlpha);
    } else {
      this.hasLastFR = false;
    }

    if (skidMeshNeedsUpdate) {
      this.skidMesh.instanceMatrix.needsUpdate = true;
      this.skidOpacityAttr.needsUpdate = true;
    }

    // 2. Nitro Boost Dual Exhaust Fire Trails & Pavement Burn Streaks
    if (isBoosting) {
      const exhaustSpacing = trackWidth * 0.28;
      const exhaustRearZ = -wheelBase * 1.06;
      const exhaustY = 0.28;

      const leftExhaust = carRoot.localToWorld(new THREE.Vector3(-exhaustSpacing, exhaustY, exhaustRearZ));
      const rightExhaust = carRoot.localToWorld(new THREE.Vector3(exhaustSpacing, exhaustY, exhaustRearZ));
      const rearCenter = carRoot.localToWorld(new THREE.Vector3(0, exhaustY + 0.08, exhaustRearZ));

      // Exhaust blast fires straight back relative to car orientation
      const exhaustDir = new THREE.Vector3(0, 0, -1).applyQuaternion(carRoot.quaternion).normalize();

      const particlesPerExhaust = speed > 40 ? 4 : 3;
      for (let p = 0; p < particlesPerExhaust; p++) {
        this.spawnFireParticle(leftExhaust, exhaustDir, speed);
        this.spawnFireParticle(rightExhaust, exhaustDir, speed);
      }

      // Lay down fiery ground burn marks under rear wheels
      if (this.hasLastRL) {
        this.addGroundFireSegment(this.lastPosRL, wheelPositions.rl, 0.95);
      }
      if (this.hasLastRR) {
        this.addGroundFireSegment(this.lastPosRR, wheelPositions.rr, 0.95);
      }

      // Dynamic flame illumination flickering
      this.fireLight.position.copy(rearCenter);
      this.fireLightPulse += 0.25;
      this.fireLight.intensity = 3.5 + Math.sin(this.fireLightPulse * 16.0) * 1.0 + (Math.random() - 0.5) * 0.8;
    } else {
      this.fireLight.intensity = 0;
    }
  }

  // Update skid marks aging, ground fire burn marks, and fire particles
  public update(dt: number, _camera?: THREE.Camera) {
    const delta = Math.min(dt, 0.08);

    // 1. Skid Marks Aging with Smooth Non-Linear Rubber Fading
    let skidMatrixChanged = false;
    let skidOpacityChanged = false;

    for (let i = 0; i < TireEffectsManager.MAX_SKID_MARKS; i++) {
      const seg = this.skidSegments[i];
      if (!seg.active) continue;

      seg.age += delta;
      if (seg.age >= seg.maxAge) {
        seg.active = false;
        this.skidOpacities[i] = 0;
        this.dummy.position.set(0, -999, 0);
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.skidMesh.setMatrixAt(i, this.dummy.matrix);
        skidMatrixChanged = true;
        skidOpacityChanged = true;
      } else {
        const lifeRatio = seg.age / seg.maxAge;
        const fade = Math.pow(1.0 - lifeRatio, 1.4);
        this.skidOpacities[i] = seg.initialAlpha * fade;
        skidOpacityChanged = true;
      }
    }

    if (skidMatrixChanged) {
      this.skidMesh.instanceMatrix.needsUpdate = true;
    }
    if (skidOpacityChanged) {
      this.skidOpacityAttr.needsUpdate = true;
    }

    // 2. Ground Fire Streaks Aging & Fading
    let groundFireMatrixChanged = false;
    let groundFireOpacityChanged = false;

    for (let i = 0; i < TireEffectsManager.MAX_GROUND_FIRE; i++) {
      const seg = this.groundFireSegments[i];
      if (!seg.active) continue;

      seg.age += delta;
      if (seg.age >= seg.maxAge) {
        seg.active = false;
        this.groundFireOpacities[i] = 0;
        this.dummy.position.set(0, -999, 0);
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.groundFireMesh.setMatrixAt(i, this.dummy.matrix);
        groundFireMatrixChanged = true;
        groundFireOpacityChanged = true;
      } else {
        const lifeRatio = seg.age / seg.maxAge;
        const fade = Math.pow(1.0 - lifeRatio, 1.6);
        this.groundFireOpacities[i] = seg.initialAlpha * fade;
        groundFireOpacityChanged = true;
      }
    }

    if (groundFireMatrixChanged) {
      this.groundFireMesh.instanceMatrix.needsUpdate = true;
    }
    if (groundFireOpacityChanged) {
      this.groundFireOpacityAttr.needsUpdate = true;
    }

    // 3. Fire Particles Motion & Blazing Color Gradient Simulation
    let hasActiveParticles = false;
    for (let i = 0; i < TireEffectsManager.MAX_FIRE_PARTICLES; i++) {
      const p = this.fireParticles[i];
      const i3 = i * 3;

      if (!p.active) {
        this.fireSizes[i] = 0;
        this.fireAlphas[i] = 0;
        continue;
      }

      hasActiveParticles = true;
      p.age += delta;
      if (p.age >= p.maxAge) {
        p.active = false;
        this.fireSizes[i] = 0;
        this.fireAlphas[i] = 0;
        this.firePositions[i3 + 1] = -999;
        continue;
      }

      // Physics: advection + turbulence + buoyant upward rise
      p.pos.addScaledVector(p.vel, delta);
      p.vel.y += 2.2 * delta; // flames rise
      p.vel.multiplyScalar(0.92); // air drag slows flames down

      this.firePositions[i3] = p.pos.x;
      this.firePositions[i3 + 1] = p.pos.y;
      this.firePositions[i3 + 2] = p.pos.z;

      const t = p.age / p.maxAge;
      // Flame expands outward as it travels
      this.fireSizes[i] = p.startSize + (p.endSize - p.startSize) * Math.sin(t * Math.PI * 0.5);
      this.fireAlphas[i] = Math.pow(1.0 - t, 1.2);

      // Blazing Fire Color Progression: White-Yellow Core -> Hot Orange -> Crimson Red -> Smoke
      if (t < 0.25) {
        const s = t / 0.25;
        this.fireColors[i3] = 1.0;
        this.fireColors[i3 + 1] = 1.0 - s * 0.25;
        this.fireColors[i3 + 2] = 0.9 - s * 0.75;
      } else if (t < 0.65) {
        const s = (t - 0.25) / 0.4;
        this.fireColors[i3] = 1.0;
        this.fireColors[i3 + 1] = 0.75 - s * 0.50;
        this.fireColors[i3 + 2] = 0.15 - s * 0.13;
      } else {
        const s = (t - 0.65) / 0.35;
        this.fireColors[i3] = 1.0 - s * 0.55;
        this.fireColors[i3 + 1] = 0.25 - s * 0.17;
        this.fireColors[i3 + 2] = 0.02 - s * 0.01;
      }
    }

    if (hasActiveParticles) {
      this.fireGeometry.attributes.position.needsUpdate = true;
      this.fireGeometry.attributes.color.needsUpdate = true;
      this.fireGeometry.attributes.size.needsUpdate = true;
      this.fireGeometry.attributes.alpha.needsUpdate = true;
    }
  }

  public dispose() {
    this.scene.remove(this.skidMesh);
    this.scene.remove(this.groundFireMesh);
    this.scene.remove(this.firePoints);
    this.scene.remove(this.fireLight);

    this.skidMesh.geometry.dispose();
    (this.skidMesh.material as THREE.Material).dispose();

    this.groundFireMesh.geometry.dispose();
    (this.groundFireMesh.material as THREE.Material).dispose();

    this.fireGeometry.dispose();
    this.fireMaterial.dispose();

    this.tireMarkTexture.dispose();
    this.fireTexture.dispose();
    this.groundFireTexture.dispose();
  }
}
