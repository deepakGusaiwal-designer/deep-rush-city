import * as THREE from 'three';

// Procedural PBR and Stylized Textures Generator for Deep Rush City
export class CityTextures {
  private static asphaltDiffuse: THREE.CanvasTexture | null = null;
  private static asphaltBump: THREE.CanvasTexture | null = null;
  private static asphaltRoughness: THREE.CanvasTexture | null = null;
  private static sidewalkDiffuse: THREE.CanvasTexture | null = null;
  private static sidewalkBump: THREE.CanvasTexture | null = null;
  private static grassDiffuse: THREE.CanvasTexture | null = null;
  private static grassBump: THREE.CanvasTexture | null = null;
  private static wallBump: THREE.CanvasTexture | null = null;
  private static routeChevron: THREE.CanvasTexture | null = null;
  private static characterContactShadow: THREE.CanvasTexture | null = null;
  private static vehicleContactShadow: THREE.CanvasTexture | null = null;

  // 1. High-Detail Road Asphalt Diffuse Texture
  public static getAsphaltDiffuse(): THREE.CanvasTexture {
    if (this.asphaltDiffuse) return this.asphaltDiffuse;

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Base dark tarmac color
      ctx.fillStyle = '#1e2126';
      ctx.fillRect(0, 0, size, size);

      const imgData = ctx.getImageData(0, 0, size, size);
      const data = imgData.data;

      // Add fine mineral gravel aggregate, tar speckles, and porous road grain
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 28;
        const aggregate = Math.random() < 0.08 ? (Math.random() * 45 - 15) : 0;
        const val = Math.max(16, Math.min(65, data[i] + noise + aggregate));

        // Subtle cool-blue asphalt tone
        data[i] = val * 0.94;     // R
        data[i + 1] = val * 0.98; // G
        data[i + 2] = val * 1.05; // B
        data[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);

      // Subtle asphalt tar patches & micro-wear streaks
      ctx.fillStyle = 'rgba(15, 17, 20, 0.35)';
      for (let p = 0; p < 12; p++) {
        const px = Math.random() * size;
        const py = Math.random() * size;
        const pw = 40 + Math.random() * 80;
        const ph = 15 + Math.random() * 30;
        ctx.beginPath();
        ctx.ellipse(px, py, pw / 2, ph / 2, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }

      // Subtle fine micro-cracks
      ctx.strokeStyle = 'rgba(10, 12, 14, 0.45)';
      ctx.lineWidth = 1.2;
      for (let c = 0; c < 4; c++) {
        ctx.beginPath();
        let cx = Math.random() * size;
        let cy = Math.random() * size;
        ctx.moveTo(cx, cy);
        for (let s = 0; s < 6; s++) {
          cx += (Math.random() - 0.5) * 35;
          cy += (Math.random() - 0.5) * 35;
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(18, 18);
    texture.generateMipmaps = true;
    this.asphaltDiffuse = texture;
    return texture;
  }

  // 2. Road Surface Bump Map for Tactical Roughness
  public static getAsphaltBump(): THREE.CanvasTexture {
    if (this.asphaltBump) return this.asphaltBump;

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, size, size);

      const imgData = ctx.getImageData(0, 0, size, size);
      const data = imgData.data;

      // High-frequency gravel relief noise
      for (let i = 0; i < data.length; i += 4) {
        const pebble = (Math.random() - 0.5) * 75;
        const grain = (Math.random() - 0.5) * 35;
        const val = Math.max(0, Math.min(255, 128 + pebble + grain));
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(18, 18);
    this.asphaltBump = texture;
    return texture;
  }

  // 3. Road Surface Roughness Map
  public static getAsphaltRoughness(): THREE.CanvasTexture {
    if (this.asphaltRoughness) return this.asphaltRoughness;

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = '#b0b0b0';
      ctx.fillRect(0, 0, size, size);

      const imgData = ctx.getImageData(0, 0, size, size);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 45;
        const val = Math.max(130, Math.min(240, 185 + noise));
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(18, 18);
    this.asphaltRoughness = texture;
    return texture;
  }

  // 4. Sidewalk Paving Slabs Texture
  public static getSidewalkDiffuse(): THREE.CanvasTexture {
    if (this.sidewalkDiffuse) return this.sidewalkDiffuse;

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Base warm concrete slab
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(0, 0, size, size);

      const slabCount = 4;
      const slabSize = size / slabCount;

      for (let gx = 0; gx < slabCount; gx++) {
        for (let gy = 0; gy < slabCount; gy++) {
          const x = gx * slabSize;
          const y = gy * slabSize;

          // Individual slab subtle tonal variation
          const shade = (Math.random() - 0.5) * 14;
          const r = Math.round(203 + shade);
          const g = Math.round(213 + shade);
          const b = Math.round(225 + shade);

          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(x + 2, y + 2, slabSize - 4, slabSize - 4);

          // Slab surface concrete micro-speckle
          ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
          for (let s = 0; s < 30; s++) {
            ctx.fillRect(x + Math.random() * slabSize, y + Math.random() * slabSize, 1.5, 1.5);
          }
        }
      }

      // Dark recessed grout lines
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 3;
      for (let i = 0; i <= slabCount; i++) {
        ctx.beginPath();
        ctx.moveTo(i * slabSize, 0);
        ctx.lineTo(i * slabSize, size);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i * slabSize);
        ctx.lineTo(size, i * slabSize);
        ctx.stroke();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(24, 24);
    this.sidewalkDiffuse = texture;
    return texture;
  }

  // 5. Sidewalk Bump Map
  public static getSidewalkBump(): THREE.CanvasTexture {
    if (this.sidewalkBump) return this.sidewalkBump;

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, size, size);

      const slabCount = 4;
      const slabSize = size / slabCount;

      // Raised slab centers
      ctx.fillStyle = '#9c9c9c';
      for (let gx = 0; gx < slabCount; gx++) {
        for (let gy = 0; gy < slabCount; gy++) {
          ctx.fillRect(gx * slabSize + 3, gy * slabSize + 3, slabSize - 6, slabSize - 6);
        }
      }

      // Deep dark recessed mortar
      ctx.strokeStyle = '#282828';
      ctx.lineWidth = 5;
      for (let i = 0; i <= slabCount; i++) {
        ctx.beginPath();
        ctx.moveTo(i * slabSize, 0);
        ctx.lineTo(i * slabSize, size);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i * slabSize);
        ctx.lineTo(size, i * slabSize);
        ctx.stroke();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(24, 24);
    this.sidewalkBump = texture;
    return texture;
  }

  // 6. Lush Cartoon Grass Texture
  public static getGrassDiffuse(): THREE.CanvasTexture {
    if (this.grassDiffuse) return this.grassDiffuse;

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Base vibrant lawn green
      ctx.fillStyle = '#498528';
      ctx.fillRect(0, 0, size, size);

      // Alternating mown lawn stripes
      const stripeW = 64;
      for (let x = 0; x < size; x += stripeW * 2) {
        ctx.fillStyle = 'rgba(40, 75, 20, 0.14)';
        ctx.fillRect(x, 0, stripeW, size);
      }

      // Stylized grass blade tufts
      ctx.strokeStyle = '#62a835';
      ctx.lineWidth = 2;
      for (let i = 0; i < 400; i++) {
        const bx = Math.random() * size;
        const by = Math.random() * size;
        const len = 4 + Math.random() * 6;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + (Math.random() - 0.5) * 4, by - len);
        ctx.stroke();
      }

      // Subtle clovers / darker root shadows
      ctx.fillStyle = '#2f5b19';
      for (let i = 0; i < 80; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * size, Math.random() * size, 2 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(32, 32);
    this.grassDiffuse = texture;
    return texture;
  }

  // 6b. Grass Bump Map for Blade Tufts Relief
  public static getGrassBump(): THREE.CanvasTexture {
    if (this.grassBump) return this.grassBump;

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, size, size);

      const imgData = ctx.getImageData(0, 0, size, size);
      const data = imgData.data;

      // Base soil noise
      for (let i = 0; i < data.length; i += 4) {
        const n = (Math.random() - 0.5) * 35;
        const val = Math.max(0, Math.min(255, 128 + n));
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);

      // Elevated blade tufts
      ctx.strokeStyle = '#b0b0b0';
      ctx.lineWidth = 2;
      for (let i = 0; i < 200; i++) {
        const bx = Math.random() * size;
        const by = Math.random() * size;
        const len = 3 + Math.random() * 5;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + (Math.random() - 0.5) * 3, by - len);
        ctx.stroke();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(32, 32);
    this.grassBump = texture;
    return texture;
  }

  // 7. Wall / Architectural Relief Bump
  public static getWallBump(): THREE.CanvasTexture {
    if (this.wallBump) return this.wallBump;

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, size, size);

      // Fine stucco / concrete grain
      const imgData = ctx.getImageData(0, 0, size, size);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const n = (Math.random() - 0.5) * 25;
        const val = Math.max(0, Math.min(255, 128 + n));
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);

      // Architectural panel groove
      ctx.strokeStyle = '#484848';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, size / 2);
      ctx.lineTo(size, size / 2);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(12, 12);
    this.wallBump = texture;
    return texture;
  }

  // 8. Glowing Animated GPS Route Ribbon Texture (Luminous Chevrons)
  public static getRouteChevronTexture(): THREE.CanvasTexture {
    if (this.routeChevron) return this.routeChevron;

    const w = 512;
    const h = 128;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.clearRect(0, 0, w, h);

      // Soft road glow center track
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0.0, 'rgba(0, 240, 255, 0.0)');
      grad.addColorStop(0.3, 'rgba(0, 240, 255, 0.35)');
      grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.7)');
      grad.addColorStop(0.7, 'rgba(0, 240, 255, 0.35)');
      grad.addColorStop(1.0, 'rgba(0, 240, 255, 0.0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 16, w, h - 32);

      // Forward-pointing luminous chevron arrows: >>> >>> >>>
      const numChevrons = 6;
      const step = w / numChevrons;

      for (let i = 0; i < numChevrons; i++) {
        const cx = i * step + step / 2;
        const cy = h / 2;
        const arrowW = 28;
        const arrowH = 42;

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 18;

        ctx.beginPath();
        ctx.moveTo(cx - arrowW, cy - arrowH);
        ctx.lineTo(cx + arrowW * 0.7, cy);
        ctx.lineTo(cx - arrowW, cy + arrowH);
        ctx.stroke();

        ctx.shadowBlur = 0;
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(4, 1);
    this.routeChevron = texture;
    return texture;
  }

  // 9. Soft Character Foot Contact Shadow / Ambient Occlusion Decal
  public static getCharacterContactShadow(): THREE.CanvasTexture {
    if (this.characterContactShadow) return this.characterContactShadow;

    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.clearRect(0, 0, size, size);
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0.0, 'rgba(0, 0, 0, 0.88)');
      grad.addColorStop(0.35, 'rgba(0, 0, 0, 0.65)');
      grad.addColorStop(0.68, 'rgba(0, 0, 0, 0.22)');
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(size / 2, size / 2, size * 0.44, size * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    this.characterContactShadow = texture;
    return texture;
  }

  // 10. Soft Vehicle Undercarriage & 4-Tire Contact Shadow Decal
  public static getVehicleContactShadow(): THREE.CanvasTexture {
    if (this.vehicleContactShadow) return this.vehicleContactShadow;

    const w = 256;
    const h = 512;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.clearRect(0, 0, w, h);

      // 1. Central underbody ambient shadow
      const centerGrad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w * 0.45);
      centerGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.82)');
      centerGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.45)');
      centerGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
      ctx.fillStyle = centerGrad;
      ctx.fillRect(w * 0.12, h * 0.12, w * 0.76, h * 0.76);

      // 2. 4 Dense Tire Contact Occlusion Spots (FL, FR, RL, RR)
      const tires = [
        { x: w * 0.22, y: h * 0.22 }, // Front Left
        { x: w * 0.78, y: h * 0.22 }, // Front Right
        { x: w * 0.22, y: h * 0.78 }, // Rear Left
        { x: w * 0.78, y: h * 0.78 }, // Rear Right
      ];

      tires.forEach(t => {
        const tGrad = ctx.createRadialGradient(t.x, t.y, 2, t.x, t.y, w * 0.18);
        tGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.95)');
        tGrad.addColorStop(0.4, 'rgba(0, 0, 0, 0.7)');
        tGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
        ctx.fillStyle = tGrad;
        ctx.beginPath();
        ctx.ellipse(t.x, t.y, w * 0.16, h * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    const texture = new THREE.CanvasTexture(canvas);
    this.vehicleContactShadow = texture;
    return texture;
  }
}
