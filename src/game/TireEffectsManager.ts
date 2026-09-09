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

interface TrailPoint {
  pos: THREE.Vector3;
  age: number;
  maxAge: number;
  color: THREE.Color;
  width: number;
}

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

  // 2. Tron Light Trail Wall (Vertical energy wall streaming behind car)
  private static readonly MAX_TRAIL_POINTS = 140;
  private trailTexture: THREE.Texture;
  private flareTexture: THREE.Texture;

  private leftTrailMesh!: THREE.Mesh;
  private rightTrailMesh!: THREE.Mesh;
  private leftPoints: TrailPoint[] = [];
  private rightPoints: TrailPoint[] = [];

  // Taillight glowing lens flares
  private leftFlare!: THREE.Sprite;
  private rightFlare!: THREE.Sprite;

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

    // --- Create Tron Light Trail Walls ---
    this.trailTexture = this.createTrailTexture();
    this.flareTexture = this.createFlareTexture();

    this.leftTrailMesh = this.createRibbonMesh();
    this.rightTrailMesh = this.createRibbonMesh();
    this.scene.add(this.leftTrailMesh);
    this.scene.add(this.rightTrailMesh);

    // Taillight lens flares
    const flareMatL = new THREE.SpriteMaterial({
      map: this.flareTexture,
      color: 0x00f5ff,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const flareMatR = flareMatL.clone();

    this.leftFlare = new THREE.Sprite(flareMatL);
    this.rightFlare = new THREE.Sprite(flareMatR);
    this.leftFlare.scale.set(0.3, 0.3, 1);
    this.rightFlare.scale.set(0.3, 0.3, 1);
    this.scene.add(this.leftFlare);
    this.scene.add(this.rightFlare);
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

  // Create a soft Gaussian-blurred neon light ribbon texture
  private createTrailTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 128, 128);

      // Vertical Gaussian blur glow gradient (Y = 0 to 128)
      // Top and bottom edges dissolve to 0 alpha, creating an ethereal blurred light ribbon
      const grad = ctx.createLinearGradient(0, 0, 0, 128);
      grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
      grad.addColorStop(0.12, 'rgba(255, 255, 255, 0.06)');
      grad.addColorStop(0.26, 'rgba(255, 255, 255, 0.28)');
      grad.addColorStop(0.42, 'rgba(255, 255, 255, 0.75)');
      grad.addColorStop(0.50, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.58, 'rgba(255, 255, 255, 0.75)');
      grad.addColorStop(0.74, 'rgba(255, 255, 255, 0.28)');
      grad.addColorStop(0.88, 'rgba(255, 255, 255, 0.06)');
      grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);

      // Secondary diffuse blur layer for extra soft atmospheric bloom
      const diffuseGrad = ctx.createLinearGradient(0, 0, 0, 128);
      diffuseGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
      diffuseGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.16)');
      diffuseGrad.addColorStop(0.50, 'rgba(255, 255, 255, 0.38)');
      diffuseGrad.addColorStop(0.65, 'rgba(255, 255, 255, 0.16)');
      diffuseGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

      ctx.fillStyle = diffuseGrad;
      ctx.fillRect(0, 0, 128, 128);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }

  // Create soft radial Gaussian flare texture for taillight lens glow
  private createFlareTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 31);
      grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.18, 'rgba(255, 230, 240, 0.75)');
      grad.addColorStop(0.42, 'rgba(255, 150, 180, 0.32)');
      grad.addColorStop(0.70, 'rgba(255, 80, 120, 0.08)');
      grad.addColorStop(1.0, 'rgba(255, 0, 50, 0.0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  // Build a dynamic BufferGeometry ribbon mesh with pre-indexed triangle strips
  private createRibbonMesh(): THREE.Mesh {
    const maxPoints = TireEffectsManager.MAX_TRAIL_POINTS;
    const geo = new THREE.BufferGeometry();

    const posArray = new Float32Array(maxPoints * 2 * 3);
    const uvArray = new Float32Array(maxPoints * 2 * 2);
    const colorArray = new Float32Array(maxPoints * 2 * 3);

    geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(colorArray, 3).setUsage(THREE.DynamicDrawUsage));

    // Pre-build index buffer for (maxPoints - 1) quads
    const indices: number[] = [];
    for (let i = 0; i < maxPoints - 1; i++) {
      const p0 = i * 2;
      const p1 = i * 2 + 1;
      const p2 = (i + 1) * 2;
      const p3 = (i + 1) * 2 + 1;
      indices.push(p0, p1, p2, p2, p1, p3);
    }
    geo.setIndex(new THREE.Uint16BufferAttribute(indices, 1));
    geo.setDrawRange(0, 0);

    const mat = new THREE.MeshBasicMaterial({
      map: this.trailTexture,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    return mesh;
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
    seg.position.set((p0.x + p1.x) * 0.5, 0.022, (p0.z + p1.z) * 0.5);
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

  // Update a trail points list with a new anchor point
  private updateTrailPoints(
    points: TrailPoint[],
    worldPos: THREE.Vector3,
    color: THREE.Color,
    width: number,
    maxAge: number
  ) {
    if (points.length === 0) {
      points.push({
        pos: worldPos.clone(),
        age: 0,
        maxAge,
        color: color.clone(),
        width,
      });
      return;
    }

    // Keep the leading edge firmly pinned to the taillight
    points[0].pos.copy(worldPos);
    points[0].color.copy(color);
    points[0].width = width;
    points[0].maxAge = maxAge;

    const distToPrev = points[1] ? points[0].pos.distanceTo(points[1].pos) : 999;
    // Insert new point along path every 16 cm
    if (distToPrev >= 0.16) {
      points.unshift({
        pos: worldPos.clone(),
        age: 0,
        maxAge,
        color: color.clone(),
        width,
      });

      if (points.length > TireEffectsManager.MAX_TRAIL_POINTS) {
        points.pop();
      }
    }
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

    // Taillight emitter positions for Light Trails
    const halfWidth = trackWidth * 0.44;
    const rearZ = -wheelBase * 1.05;
    const lightY = 0.52;

    const leftLightWorld = carRoot.localToWorld(new THREE.Vector3(-halfWidth, lightY, rearZ));
    const rightLightWorld = carRoot.localToWorld(new THREE.Vector3(halfWidth, lightY, rearZ));

    // 2. Blurred Small Light Trail (Active while vehicle is moving or boosting)
    if (speed > 0.8 || isBoosting) {
      let trailColor: THREE.Color;
      let trailWidth: number;
      let trailMaxAge: number;
      let flareOpacity: number;

      if (isBoosting) {
        // Hyperdrive Electric Cyan Plasma Stream
        trailColor = new THREE.Color(0x00ffff);
        trailWidth = 0.38;
        trailMaxAge = 1.1;
        flareOpacity = 0.95;
      } else if (isSlipping) {
        // Drift / Slide: Neon Pink-Magenta Stream
        trailColor = new THREE.Color(0xff007f);
        trailWidth = 0.35;
        trailMaxAge = 0.95;
        flareOpacity = 0.9;
      } else if (isBraking) {
        // Hard Braking: Glowing Orange-Red Stream
        trailColor = new THREE.Color(0xff3300);
        trailWidth = 0.32;
        trailMaxAge = 0.85;
        flareOpacity = 0.9;
      } else {
        // Standard Cruising: Smooth Neon Cyan Stream
        const speedRatio = Math.min(speed / 90.0, 1.0);
        trailColor = new THREE.Color(0x00e5ff);
        trailWidth = 0.28 + speedRatio * 0.08;
        trailMaxAge = 0.65 + speedRatio * 0.35;
        flareOpacity = 0.55 + speedRatio * 0.35;
      }

      this.updateTrailPoints(this.leftPoints, leftLightWorld, trailColor, trailWidth, trailMaxAge);
      this.updateTrailPoints(this.rightPoints, rightLightWorld, trailColor, trailWidth, trailMaxAge);

      // Update Taillight lens flares (small and subtle)
      this.leftFlare.position.copy(leftLightWorld);
      this.rightFlare.position.copy(rightLightWorld);
      (this.leftFlare.material as THREE.SpriteMaterial).color.copy(trailColor);
      (this.rightFlare.material as THREE.SpriteMaterial).color.copy(trailColor);
      (this.leftFlare.material as THREE.SpriteMaterial).opacity = flareOpacity;
      (this.rightFlare.material as THREE.SpriteMaterial).opacity = flareOpacity;
      const flareSize = trailWidth * 0.75;
      this.leftFlare.scale.set(flareSize, flareSize, 1);
      this.rightFlare.scale.set(flareSize, flareSize, 1);
    } else {
      (this.leftFlare.material as THREE.SpriteMaterial).opacity = 0;
      (this.rightFlare.material as THREE.SpriteMaterial).opacity = 0;
    }
  }

  // Rebuild blurred, small light ribbon mesh buffers
  private renderRibbon(mesh: THREE.Mesh, points: TrailPoint[]) {
    const M = points.length;
    if (M < 2) {
      mesh.geometry.setDrawRange(0, 0);
      return;
    }

    const posAttr = mesh.geometry.attributes.position as THREE.BufferAttribute;
    const uvAttr = mesh.geometry.attributes.uv as THREE.BufferAttribute;
    const colorAttr = mesh.geometry.attributes.color as THREE.BufferAttribute;

    const posArr = posAttr.array as Float32Array;
    const uvArr = uvAttr.array as Float32Array;
    const colArr = colorAttr.array as Float32Array;

    for (let i = 0; i < M; i++) {
      const pt = points[i];
      const p = pt.pos;

      const progress = pt.age / pt.maxAge;
      // Soft exponential fadeout along trail length
      const alpha = Math.max(0, Math.pow(1.0 - progress, 1.4));

      // Small height: Low-profile glowing beam hugging car rear and ground
      const beamTopY = Math.max(0.22, Math.min(0.28, p.y * 0.5 + 0.04));
      const beamBotY = 0.035;

      // Top vertex: dissolves softly into transparency via Gaussian V-coord
      const idx0 = i * 2;
      posArr[idx0 * 3] = p.x;
      posArr[idx0 * 3 + 1] = beamTopY;
      posArr[idx0 * 3 + 2] = p.z;

      uvArr[idx0 * 2] = progress * 2.0;
      uvArr[idx0 * 2 + 1] = 0.0; // V=0 dissolves softly in Gaussian blur texture

      colArr[idx0 * 3] = pt.color.r * alpha;
      colArr[idx0 * 3 + 1] = pt.color.g * alpha;
      colArr[idx0 * 3 + 2] = pt.color.b * alpha;

      // Bottom vertex: ground contact line dissolving softly
      const idx1 = i * 2 + 1;
      posArr[idx1 * 3] = p.x;
      posArr[idx1 * 3 + 1] = beamBotY;
      posArr[idx1 * 3 + 2] = p.z;

      uvArr[idx1 * 2] = progress * 2.0;
      uvArr[idx1 * 2 + 1] = 1.0; // V=1 dissolves softly in Gaussian blur texture

      colArr[idx1 * 3] = pt.color.r * alpha;
      colArr[idx1 * 3 + 1] = pt.color.g * alpha;
      colArr[idx1 * 3 + 2] = pt.color.b * alpha;
    }

    posAttr.needsUpdate = true;
    uvAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    mesh.geometry.setDrawRange(0, (M - 1) * 6);
  }

  // Update light trails and skid marks aging
  public update(dt: number, _camera?: THREE.Camera) {
    const delta = Math.min(dt, 0.08);

    // 1. Age and trim light trail points
    for (let i = this.leftPoints.length - 1; i >= 1; i--) {
      this.leftPoints[i].age += delta;
      if (this.leftPoints[i].age >= this.leftPoints[i].maxAge) {
        this.leftPoints.splice(i);
        break;
      }
    }
    for (let i = this.rightPoints.length - 1; i >= 1; i--) {
      this.rightPoints[i].age += delta;
      if (this.rightPoints[i].age >= this.rightPoints[i].maxAge) {
        this.rightPoints.splice(i);
        break;
      }
    }

    // 2. Render dynamic Tron light wall meshes
    this.renderRibbon(this.leftTrailMesh, this.leftPoints);
    this.renderRibbon(this.rightTrailMesh, this.rightPoints);

    // 3. Skid Marks Aging with Smooth Non-Linear Rubber Fading
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
  }

  public dispose() {
    this.scene.remove(this.skidMesh);
    this.scene.remove(this.leftTrailMesh);
    this.scene.remove(this.rightTrailMesh);
    this.scene.remove(this.leftFlare);
    this.scene.remove(this.rightFlare);

    this.skidMesh.geometry.dispose();
    (this.skidMesh.material as THREE.Material).dispose();

    this.leftTrailMesh.geometry.dispose();
    (this.leftTrailMesh.material as THREE.Material).dispose();

    this.rightTrailMesh.geometry.dispose();
    (this.rightTrailMesh.material as THREE.Material).dispose();

    this.leftFlare.material.dispose();
    this.rightFlare.material.dispose();

    this.tireMarkTexture.dispose();
    this.trailTexture.dispose();
    this.flareTexture.dispose();
  }
}
