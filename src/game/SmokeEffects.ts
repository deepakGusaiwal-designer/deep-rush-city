import * as THREE from 'three';

interface SmokePuff {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  grow: number;
  shade: number; // 0 = white steam, 1 = black oil smoke
}

const SMOKE_VERT = /* glsl */ `
  attribute float size;
  attribute float alpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = color;
    vAlpha = alpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (260.0 / max(1.0, -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const SMOKE_FRAG = /* glsl */ `
  uniform sampler2D map;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 tex = texture2D(map, gl_PointCoord);
    gl_FragColor = vec4(vColor, tex.a * vAlpha);
    if (gl_FragColor.a < 0.01) discard;
  }
`;

/**
 * Soft billboard smoke for damaged engines and burning wrecks.
 * One Points cloud with per-particle size/alpha; colour shifts white -> grey -> black with damage.
 */
export class SmokeEffects {
  public scene: THREE.Scene;
  private puffs: SmokePuff[] = [];
  private points: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  private maxPuffs: number = 220;

  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private alphas: Float32Array;

  private emitAccumulator: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.positions = new Float32Array(this.maxPuffs * 3);
    this.colors = new Float32Array(this.maxPuffs * 3);
    this.sizes = new Float32Array(this.maxPuffs);
    this.alphas = new Float32Array(this.maxPuffs);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: { map: { value: SmokeEffects.createPuffTexture() } },
      vertexShader: SMOKE_VERT,
      fragmentShader: SMOKE_FRAG,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.scene.add(this.points);
  }

  private static createPuffTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,255,255,0.95)');
      grad.addColorStop(0.45, 'rgba(255,255,255,0.45)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  /**
   * Continuous emitter for a damaged engine.
   * damage01: 0 (pristine) .. 1 (wrecked). Emits nothing below ~0.45.
   */
  emitEngineSmoke(hoodPos: THREE.Vector3, carVelocity: THREE.Vector3, damage01: number, dt: number) {
    if (damage01 < 0.45) return;
    const intensity = (damage01 - 0.45) / 0.55; // 0..1
    const rate = 4 + intensity * 26; // puffs per second
    this.emitAccumulator += rate * dt;

    while (this.emitAccumulator >= 1) {
      this.emitAccumulator -= 1;
      if (this.puffs.length >= this.maxPuffs) break;
      this.puffs.push({
        pos: hoodPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5)),
        vel: new THREE.Vector3(
          carVelocity.x * 0.25 + (Math.random() - 0.5) * 0.6,
          1.2 + Math.random() * 1.2 + intensity,
          carVelocity.z * 0.25 + (Math.random() - 0.5) * 0.6
        ),
        life: 0,
        maxLife: 1.1 + Math.random() * 0.9 + intensity * 0.6,
        size: 0.5 + Math.random() * 0.4,
        grow: 1.4 + intensity * 1.6,
        shade: Math.min(1, 0.15 + intensity * 1.1),
      });
    }
  }

  private exhaustAccumulator: number = 0;

  /** Jetpack exhaust: quick bright vapour puffs blown downward, rate scales with thrust. */
  emitExhaust(nozzlePos: THREE.Vector3, thrust01: number, dt: number) {
    if (thrust01 <= 0.05) return;
    this.exhaustAccumulator += (8 + thrust01 * 40) * dt;
    while (this.exhaustAccumulator >= 1) {
      this.exhaustAccumulator -= 1;
      if (this.puffs.length >= this.maxPuffs) break;
      this.puffs.push({
        pos: nozzlePos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.25, 0, (Math.random() - 0.5) * 0.25)),
        vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, -4 - thrust01 * 6 + Math.random(), (Math.random() - 0.5) * 1.5),
        life: 0,
        maxLife: 0.35 + Math.random() * 0.35,
        size: 0.25 + Math.random() * 0.2,
        grow: 1.6,
        shade: 0.05,
      });
    }
  }

  /** One-shot burst (impacts, wreck moment). */
  burst(pos: THREE.Vector3, count: number = 18, shade: number = 0.6) {
    for (let i = 0; i < count; i++) {
      if (this.puffs.length >= this.maxPuffs) break;
      this.puffs.push({
        pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, Math.random() * 0.6, (Math.random() - 0.5) * 1.2)),
        vel: new THREE.Vector3((Math.random() - 0.5) * 3.5, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 3.5),
        life: 0,
        maxLife: 0.9 + Math.random() * 0.8,
        size: 0.7 + Math.random() * 0.6,
        grow: 2.2,
        shade,
      });
    }
  }

  update(delta: number) {
    const dt = Math.min(delta, 0.05);

    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.puffs.splice(i, 1);
        continue;
      }
      // Buoyancy + air drag
      p.vel.y += 0.9 * dt;
      p.vel.x *= Math.exp(-1.4 * dt);
      p.vel.z *= Math.exp(-1.4 * dt);
      p.pos.addScaledVector(p.vel, dt);
    }

    const count = this.puffs.length;
    for (let i = 0; i < this.maxPuffs; i++) {
      const idx = i * 3;
      if (i < count) {
        const p = this.puffs[i];
        const t = p.life / p.maxLife;
        this.positions[idx] = p.pos.x;
        this.positions[idx + 1] = p.pos.y;
        this.positions[idx + 2] = p.pos.z;

        const c = 0.9 - p.shade * 0.78;
        this.colors[idx] = c;
        this.colors[idx + 1] = c;
        this.colors[idx + 2] = c * 1.04;

        this.sizes[i] = p.size + p.grow * t;
        // Quick fade-in, long fade-out
        this.alphas[i] = 0.55 * Math.min(1, t * 6) * (1 - t) * (1 - t * 0.3);
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

  dispose() {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }
}
