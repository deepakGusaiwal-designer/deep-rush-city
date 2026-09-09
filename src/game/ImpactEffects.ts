import * as THREE from 'three';

interface SparkParticle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  heat: number; // 1 = white-hot spark, 0 = dull ember / debris
}

const SPARK_VERT = /* glsl */ `
  attribute float size;
  attribute float alpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = color;
    vAlpha = alpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / max(1.0, -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const SPARK_FRAG = /* glsl */ `
  uniform sampler2D map;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 tex = texture2D(map, gl_PointCoord);
    gl_FragColor = vec4(vColor * tex.a, tex.a * vAlpha);
    if (gl_FragColor.a < 0.01) discard;
  }
`;

/**
 * Collision sparks: soft round glowing points with a hot core, additive blended,
 * per-particle size and fade so they read as embers rather than square pixels.
 */
export class ImpactEffects {
  public scene: THREE.Scene;
  private particles: SparkParticle[] = [];
  private points: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  private maxParticles: number = 260;

  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private alphas: Float32Array;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

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
      uniforms: { map: { value: ImpactEffects.createSparkTexture() } },
      vertexShader: SPARK_VERT,
      fragmentShader: SPARK_FRAG,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    this.scene.add(this.points);
  }

  /** Round radial gradient with a bright core and soft halo. */
  private static createSparkTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.22, 'rgba(255,255,255,0.9)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  emit(pos: THREE.Vector3, normal: THREE.Vector3, count: number = 25) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      // Random cone velocity around collision normal
      const speed = 3.5 + Math.random() * 9.0;
      const spread = 1.1;
      const vel = new THREE.Vector3(
        normal.x * speed + (Math.random() * 2 - 1) * spread * speed,
        Math.abs(normal.y * speed) + Math.random() * 4.5 + 1.2,
        normal.z * speed + (Math.random() * 2 - 1) * spread * speed
      );

      // A few slower, larger "debris embers" among the fast sparks
      const isEmber = Math.random() < 0.25;
      if (isEmber) vel.multiplyScalar(0.45);

      this.particles.push({
        pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.4, (Math.random() - 0.5) * 0.4)),
        vel,
        life: 0,
        maxLife: isEmber ? 0.5 + Math.random() * 0.4 : 0.22 + Math.random() * 0.25,
        size: isEmber ? 0.42 + Math.random() * 0.3 : 0.22 + Math.random() * 0.22,
        heat: isEmber ? 0.35 : 1.0,
      });
    }
  }

  update(delta: number) {
    const dt = Math.min(delta, 0.05);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      // Gravity + air drag
      p.vel.y -= 18.0 * dt;
      p.vel.x *= Math.exp(-1.2 * dt);
      p.vel.z *= Math.exp(-1.2 * dt);
      p.pos.addScaledVector(p.vel, dt);

      // Bounce off ground
      if (p.pos.y < 0.05) {
        p.pos.y = 0.05;
        p.vel.y = -p.vel.y * 0.4;
        p.vel.x *= 0.6;
        p.vel.z *= 0.6;
      }
    }

    // Update GPU buffers
    const count = this.particles.length;
    for (let i = 0; i < this.maxParticles; i++) {
      const idx = i * 3;
      if (i < count) {
        const p = this.particles[i];
        this.positions[idx] = p.pos.x;
        this.positions[idx + 1] = p.pos.y;
        this.positions[idx + 2] = p.pos.z;

        // White-hot -> orange -> deep red as it cools
        const t = p.life / p.maxLife;
        const cool = Math.min(1, t * 1.25) * (1 - p.heat * 0.15);
        this.colors[idx] = 1.0;
        this.colors[idx + 1] = THREE.MathUtils.lerp(0.95, 0.18, cool);
        this.colors[idx + 2] = THREE.MathUtils.lerp(0.55 * p.heat, 0.0, cool);

        this.sizes[i] = p.size * (1.0 - t * 0.55);
        this.alphas[i] = (1.0 - t) * (0.75 + 0.25 * p.heat);
      } else {
        this.positions[idx] = 0;
        this.positions[idx + 1] = -100;
        this.positions[idx + 2] = 0;
        this.sizes[i] = 0;
        this.alphas[i] = 0;
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
    this.geometry.attributes.alpha.needsUpdate = true;
  }
}
