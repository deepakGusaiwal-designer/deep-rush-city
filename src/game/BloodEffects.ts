import * as THREE from 'three';

interface BloodParticle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  floorY: number;
}

interface BloodPool {
  active: boolean;
  position: THREE.Vector3;
  rotation: number;
  currentRadius: number;
  targetRadius: number;
  age: number;
  maxAge: number;
  initialAlpha: number;
}

const BLOOD_VERT = /* glsl */ `
  attribute float size;
  attribute float alpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = color;
    vAlpha = alpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (320.0 / max(1.0, -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const BLOOD_FRAG = /* glsl */ `
  uniform sampler2D map;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 tex = texture2D(map, gl_PointCoord);
    gl_FragColor = vec4(vColor, tex.a * vAlpha);
    if (gl_FragColor.a < 0.02) discard;
  }
`;

/**
 * High-performance cartoon blood effects system:
 * 1. 3D Droplet Particles: High-velocity spray arcs under gravity with ground contact.
 * 2. Ground Splatter Pools: Instanced expanding blood puddle decals on road, sidewalk, or rooftops.
 */
export class BloodEffects {
  public scene: THREE.Scene;

  // --- 1. Dynamic 3D Blood Droplets Particles ---
  private particles: BloodParticle[] = [];
  private points: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  private maxParticles: number = 360;

  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private alphas: Float32Array;

  // --- 2. Ground Blood Splat Decals ---
  private static readonly MAX_POOLS = 50;
  private poolMesh: THREE.InstancedMesh;
  private pools: BloodPool[] = [];
  private poolNextIndex: number = 0;
  private dummy = new THREE.Object3D();
  private bloodSplatTexture: THREE.Texture;
  private poolOpacities = new Float32Array(BloodEffects.MAX_POOLS);
  private poolOpacityAttr: THREE.InstancedBufferAttribute;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // --- Setup Droplet Particles System ---
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);
    this.sizes = new Float32Array(this.maxParticles);
    this.alphas = new Float32Array(this.maxParticles);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: { map: { value: BloodEffects.createDropletTexture() } },
      vertexShader: BLOOD_VERT,
      fragmentShader: BLOOD_FRAG,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 8;
    this.scene.add(this.points);

    // --- Setup Ground Decals System ---
    this.bloodSplatTexture = BloodEffects.createSplatterTexture();

    const poolGeo = new THREE.PlaneGeometry(1, 1);
    poolGeo.rotateX(-Math.PI / 2);

    this.poolOpacityAttr = new THREE.InstancedBufferAttribute(this.poolOpacities, 1);
    this.poolOpacityAttr.setUsage(THREE.DynamicDrawUsage);
    poolGeo.setAttribute('instanceOpacity', this.poolOpacityAttr);

    const poolMat = new THREE.MeshBasicMaterial({
      map: this.bloodSplatTexture,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -2.0,
    });

    poolMat.onBeforeCompile = (shader) => {
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

    this.poolMesh = new THREE.InstancedMesh(poolGeo, poolMat, BloodEffects.MAX_POOLS);
    this.poolMesh.frustumCulled = false;
    this.poolMesh.renderOrder = 4;

    // Initialize all pool decals as dormant below the ground
    for (let i = 0; i < BloodEffects.MAX_POOLS; i++) {
      this.dummy.position.set(0, -999, 0);
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.poolMesh.setMatrixAt(i, this.dummy.matrix);
      this.poolOpacities[i] = 0;

      this.pools.push({
        active: false,
        position: new THREE.Vector3(0, -999, 0),
        rotation: 0,
        currentRadius: 0,
        targetRadius: 1,
        age: 0,
        maxAge: 16.0,
        initialAlpha: 0.94,
      });
    }

    this.poolMesh.instanceMatrix.needsUpdate = true;
    this.poolOpacityAttr.needsUpdate = true;
    this.scene.add(this.poolMesh);
  }

  /** Round blood droplet with glossy dark crimson core */
  private static createDropletTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      grad.addColorStop(0, 'rgba(239, 68, 68, 1)'); // intense crimson center
      grad.addColorStop(0.35, 'rgba(185, 28, 28, 0.95)'); // deep red
      grad.addColorStop(0.75, 'rgba(127, 29, 29, 0.85)'); // dark burgundy
      grad.addColorStop(1, 'rgba(69, 10, 10, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(32, 32, 30, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  /** Stylized cartoon blood splatter decal texture (central puddle + satellite drops) */
  private static createSplatterTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const cx = 128;
      const cy = 128;

      // 1. Draw organic central splatter blob with noisy lobes
      ctx.fillStyle = '#8b0000'; // Deep dark blood
      ctx.beginPath();
      const numPoints = 16;
      for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        // Pseudo-random lobe radii around center
        const seed = Math.sin(i * 3.4) * 0.5 + Math.cos(i * 1.7) * 0.5;
        const r = 52 + seed * 26;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      // 2. Inner glossy liquid highlight
      const innerGrad = ctx.createRadialGradient(cx - 10, cy - 10, 4, cx, cy, 60);
      innerGrad.addColorStop(0, 'rgba(220, 38, 38, 0.9)'); // Bright wet red core
      innerGrad.addColorStop(0.65, 'rgba(153, 27, 27, 0.85)');
      innerGrad.addColorStop(1, 'rgba(127, 29, 29, 0)');
      ctx.fillStyle = innerGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, 58, 0, Math.PI * 2);
      ctx.fill();

      // 3. Outward satellite splatter drops
      const satelliteSeeds = [
        { a: 0.35, d: 82, r: 8.5 },
        { a: 0.95, d: 96, r: 6.0 },
        { a: 1.6, d: 88, r: 10.0 },
        { a: 2.3, d: 102, r: 7.0 },
        { a: 3.1, d: 84, r: 9.0 },
        { a: 3.8, d: 98, r: 6.5 },
        { a: 4.6, d: 92, r: 11.0 },
        { a: 5.4, d: 104, r: 7.5 },
        { a: 5.9, d: 78, r: 8.0 },
        // Smaller satellite droplets
        { a: 0.65, d: 110, r: 4.0 },
        { a: 1.25, d: 116, r: 3.5 },
        { a: 2.75, d: 114, r: 4.5 },
        { a: 4.15, d: 118, r: 4.0 },
        { a: 4.95, d: 112, r: 3.8 },
      ];

      for (const s of satelliteSeeds) {
        const sx = cx + Math.cos(s.a) * s.d;
        const sy = cy + Math.sin(s.a) * s.d;
        const dropGrad = ctx.createRadialGradient(sx - 1, sy - 1, 1, sx, sy, s.r);
        dropGrad.addColorStop(0, '#dc2626');
        dropGrad.addColorStop(0.7, '#991b1b');
        dropGrad.addColorStop(1, '#7f1d1d');
        ctx.fillStyle = dropGrad;
        ctx.beginPath();
        ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  /**
   * Emit 3D blood droplet spray.
   * @param pos Origin of impact (hero feet, pedestrian torso)
   * @param dir Primary direction of impact/spray (upwards for ground fall, forward for car hit)
   * @param count Number of droplet particles
   * @param speed Base velocity multiplier
   * @param floorY Surface floor height (particles stop/splat on reaching this)
   */
  public emitSplatter(
    pos: THREE.Vector3,
    dir: THREE.Vector3,
    count: number = 28,
    speed: number = 6.0,
    floorY: number = 0.02
  ) {
    const baseDir = dir.clone().normalize();
    const actualCount = Math.min(count, this.maxParticles - this.particles.length);

    for (let i = 0; i < actualCount; i++) {
      // Cone spray velocity with random variance
      const particleSpeed = speed * (0.55 + Math.random() * 0.9);
      const spread = 0.85;

      const vel = new THREE.Vector3(
        baseDir.x * particleSpeed + (Math.random() * 2 - 1) * spread * particleSpeed,
        Math.max(1.8, baseDir.y * particleSpeed) + Math.random() * 3.5 + 0.8,
        baseDir.z * particleSpeed + (Math.random() * 2 - 1) * spread * particleSpeed
      );

      // Add slight spawn origin offset around impact point
      const spawnPos = pos.clone().add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.35,
          0.15 + Math.random() * 0.35,
          (Math.random() - 0.5) * 0.35
        )
      );

      this.particles.push({
        pos: spawnPos,
        vel,
        life: 0,
        maxLife: 0.85 + Math.random() * 0.55,
        size: 0.28 + Math.random() * 0.35,
        floorY: Math.max(0.02, floorY),
      });
    }
  }

  /**
   * Spawn a flat cartoon blood splatter decal on the ground / rooftop surface.
   * @param pos Impact position
   * @param radius Final puddle radius in meters
   * @param floorY Optional surface elevation
   */
  public spawnGroundPool(pos: THREE.Vector3, radius: number = 1.6, floorY?: number) {
    const idx = this.poolNextIndex;
    this.poolNextIndex = (this.poolNextIndex + 1) % BloodEffects.MAX_POOLS;

    const surfaceY = floorY !== undefined ? floorY : pos.y;
    // Slight offset above ground to avoid Z-fighting (0.015 - 0.025m)
    const decalY = Math.max(0.018, surfaceY + 0.018);

    const pool = this.pools[idx];
    pool.active = true;
    pool.position.set(pos.x, decalY, pos.z);
    pool.rotation = Math.random() * Math.PI * 2;
    pool.currentRadius = 0.2; // Spreads out rapidly
    pool.targetRadius = Math.max(0.8, Math.min(3.2, radius));
    pool.age = 0;
    pool.maxAge = 14.0 + Math.random() * 4.0; // Stays ~16 seconds
    pool.initialAlpha = 0.94;

    this.dummy.position.copy(pool.position);
    this.dummy.rotation.set(0, pool.rotation, 0);
    this.dummy.scale.set(pool.currentRadius, 1, pool.currentRadius);
    this.dummy.updateMatrix();

    this.poolMesh.setMatrixAt(idx, this.dummy.matrix);
    this.poolOpacities[idx] = pool.initialAlpha;
    this.poolMesh.instanceMatrix.needsUpdate = true;
    this.poolOpacityAttr.needsUpdate = true;
  }

  /**
   * Frame update: integrates particle physics and updates ground puddle expansion & fade-out.
   */
  public update(delta: number) {
    const dt = Math.min(delta, 0.05);

    // --- 1. Update 3D Droplet Particles ---
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      // Gravity and air drag
      p.vel.y -= 19.0 * dt;
      p.vel.x *= Math.exp(-1.8 * dt);
      p.vel.z *= Math.exp(-1.8 * dt);
      p.pos.addScaledVector(p.vel, dt);

      // Ground floor contact (splats and stops falling)
      if (p.pos.y <= p.floorY) {
        p.pos.y = p.floorY;
        p.vel.y = 0;
        p.vel.x *= 0.2;
        p.vel.z *= 0.2;
        // Age droplet faster once grounded
        p.life += dt * 1.8;
      }
    }

    // Write particles into GPU BufferAttributes
    const pCount = this.particles.length;
    for (let i = 0; i < this.maxParticles; i++) {
      const idx = i * 3;
      if (i < pCount) {
        const p = this.particles[i];
        this.positions[idx] = p.pos.x;
        this.positions[idx + 1] = p.pos.y;
        this.positions[idx + 2] = p.pos.z;

        // Rich red -> deeper dark burgundy
        const progress = p.life / p.maxLife;
        this.colors[idx] = THREE.MathUtils.lerp(0.92, 0.55, progress); // Red
        this.colors[idx + 1] = THREE.MathUtils.lerp(0.12, 0.04, progress); // Green
        this.colors[idx + 2] = THREE.MathUtils.lerp(0.12, 0.04, progress); // Blue

        this.sizes[i] = p.size * (1.0 - progress * 0.35);
        this.alphas[i] = Math.max(0, 1.0 - progress * 0.85);
      } else {
        this.positions[idx] = 0;
        this.positions[idx + 1] = -999;
        this.positions[idx + 2] = 0;
        this.sizes[i] = 0;
        this.alphas[i] = 0;
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
    this.geometry.attributes.alpha.needsUpdate = true;

    // --- 2. Update Ground Blood Decals (Expansion & Fade) ---
    let poolsChanged = false;

    for (let i = 0; i < BloodEffects.MAX_POOLS; i++) {
      const pool = this.pools[i];
      if (!pool.active) continue;

      pool.age += dt;

      // Expand liquid pool to target radius over ~0.18s
      if (pool.currentRadius < pool.targetRadius) {
        pool.currentRadius += (pool.targetRadius - pool.currentRadius) * (dt * 14.0);
        if (Math.abs(pool.targetRadius - pool.currentRadius) < 0.02) {
          pool.currentRadius = pool.targetRadius;
        }
        poolsChanged = true;
      }

      // Calculate fade-out during the last 6 seconds of lifetime
      const fadeStart = pool.maxAge - 6.0;
      let alpha = pool.initialAlpha;
      if (pool.age > fadeStart) {
        const fadeProgress = (pool.age - fadeStart) / 6.0;
        alpha = pool.initialAlpha * Math.max(0, 1.0 - fadeProgress);
      }

      this.poolOpacities[i] = alpha;

      if (pool.age >= pool.maxAge) {
        pool.active = false;
        alpha = 0;
        this.poolOpacities[i] = 0;
        this.dummy.position.set(0, -999, 0);
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.poolMesh.setMatrixAt(i, this.dummy.matrix);
        poolsChanged = true;
      } else {
        this.dummy.position.copy(pool.position);
        this.dummy.rotation.set(0, pool.rotation, 0);
        this.dummy.scale.set(pool.currentRadius, 1, pool.currentRadius);
        this.dummy.updateMatrix();
        this.poolMesh.setMatrixAt(i, this.dummy.matrix);
      }
    }

    if (poolsChanged) {
      this.poolMesh.instanceMatrix.needsUpdate = true;
    }
    this.poolOpacityAttr.needsUpdate = true;
  }

  public dispose() {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();

    this.scene.remove(this.poolMesh);
    this.poolMesh.geometry.dispose();
    if (Array.isArray(this.poolMesh.material)) {
      this.poolMesh.material.forEach((m) => m.dispose());
    } else {
      this.poolMesh.material.dispose();
    }
    this.bloodSplatTexture.dispose();
    this.particles = [];
  }
}
