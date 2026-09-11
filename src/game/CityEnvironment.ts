import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CITY_POIS } from '../data/vehicles';
import { POI, DayNightMode, TrafficLightColor } from '../types/game';
import { LightingManager } from './LightingManager';
import { audioManager } from './AudioManager';
import { CityTextures } from './CityTextures';

export const CITY_SCALE = 2.5;
export const CHUNK_WIDTH = 120.0 * CITY_SCALE;
export const CHUNK_DEPTH = 150.0 * CITY_SCALE;

export interface TrafficSignalLamp {
  type: 'traffic' | 'pedestrian';
  color: 'red' | 'yellow' | 'green';
  mat: THREE.MeshStandardMaterial;
  glowMat: THREE.MeshBasicMaterial;
  glowMesh: THREE.Mesh;
}

export interface TrafficSignalPole {
  name: string;
  node: THREE.Object3D;
  servesZ: boolean;
  worldPos: THREE.Vector3;
  overheadPos?: THREE.Vector3;
  lamps: TrafficSignalLamp[];
}

export interface CityChunk {
  gridX: number;
  gridZ: number;
  group: THREE.Group;
  colliders: THREE.Box3[];
  walkableMeshes: THREE.Mesh[];
}

export class CityEnvironment {
  public scene: THREE.Scene;
  public cityRootGroup: THREE.Group;
  private lightingManager: LightingManager;

  // 3x3 Dynamic Infinite Chunk Pool
  public chunks: CityChunk[] = [];
  public centerChunkX: number = 0;
  public centerChunkZ: number = 0;
  private templateChunk: THREE.Group | null = null;
  private chunkLocalColliders: THREE.Box3[] = [];

  // Static colliders extracted from Cartoon_City_Free.glb + boundary perimeter
  public baseColliders: THREE.Box3[] = [];
  public activeColliders: THREE.Box3[] = [];

  // Walkable meshes for raycast elevation & standing (buildings, roofs, roads, props)
  public walkableMeshes: THREE.Mesh[] = [];

  public static isWalkableMesh(nodeName: string): boolean {
    const n = (nodeName || '').toLowerCase();

    // 1. Strict exclusions: non-walkable props, poles, overhead arms, lights, foliage, signs, wires, vehicles
    if (
      n.includes('line') ||
      n.includes('cable') ||
      n.includes('wire') ||
      n.includes('traffic') ||
      n.includes('spotlight') ||
      n.includes('light') ||
      n.includes('lamp') ||
      n.includes('bush') ||
      n.includes('palm') ||
      n.includes('tree') ||
      n.includes('plant') ||
      n.includes('flower') ||
      n.includes('foliage') ||
      n.includes('trash') ||
      n.includes('bin') ||
      n.includes('billboard') ||
      n.includes('sign') ||
      n.includes('hydrant') ||
      n.includes('bench') ||
      n.includes('car') ||
      n.includes('van') ||
      n.includes('futuristic') ||
      n.includes('wheel') ||
      n.includes('spoiler') ||
      n.includes('graffiti')
    ) {
      return false;
    }

    // 2. Allowed true walking surfaces: roads, sidewalk tiles, terrain, plazas, building structures/rooftops
    return (
      n.startsWith('road') ||
      n.startsWith('set_b_tiles') ||
      n.includes('building') ||
      n.includes('eco_building') ||
      n.includes('twistedtower') ||
      n.includes('ground') ||
      n.includes('terrain') ||
      n.includes('sidewalk') ||
      n.includes('asphalt') ||
      n.includes('pavement') ||
      n.includes('plaza')
    );
  }

  // Ocean & Coastal Seawall Environment
  private oceanMesh!: THREE.Mesh;
  private oceanTexture: THREE.CanvasTexture | null = null;
  private oceanMaterial!: THREE.MeshStandardMaterial;
  private seawallGroup: THREE.Group | null = null;
  private shorelineFoamMaterial!: THREE.MeshBasicMaterial;

  // Day/Night Materials & Visual Effects
  private windowMaterials: THREE.MeshStandardMaterial[] = [];
  private bulbMaterials: THREE.MeshStandardMaterial[] = [];
  private billboardMaterials: THREE.MeshStandardMaterial[] = [];
  private scrollingTextMaterials: THREE.MeshStandardMaterial[] = [];
  private groundLightMaterial: THREE.MeshBasicMaterial;
  private currentMode: DayNightMode = 'day';

  // POI beacons (dynamic per district)
  private poiBeacons: { poi: POI; group: THREE.Group; mesh: THREE.Mesh; ring: THREE.Mesh }[] = [];
  public currentActivePOI: POI | null = null;

  // Traffic lights
  private trafficSignals: TrafficSignalPole[] = [];
  private trafficPointLights: THREE.PointLight[] = [];
  private currentSignalColor: TrafficLightColor | null = null;
  private subtleHaloTexture: THREE.Texture | null = null;
  private static readonly trafficLensGeo = new THREE.SphereGeometry(0.11, 16, 12);
  private static readonly pedLensGeo = new THREE.SphereGeometry(0.08, 14, 10);
  private static readonly trafficGlowGeo = new THREE.PlaneGeometry(0.55, 0.55);
  private static readonly pedGlowGeo = new THREE.PlaneGeometry(0.38, 0.38);

  public static readonly SIGNAL_COLORS = {
    red: {
      activeColor: 0xff202b,
      activeEmissive: 0xff202b,
      activeIntensity: 4.2,
      activeRoughness: 0.15,
      glowColor: 0xff2835,
      dullColor: 0x240608,
      dullRoughness: 0.85,
    },
    yellow: {
      activeColor: 0xffa808,
      activeEmissive: 0xffa808,
      activeIntensity: 4.2,
      activeRoughness: 0.15,
      glowColor: 0xffb814,
      dullColor: 0x241a04,
      dullRoughness: 0.85,
    },
    green: {
      activeColor: 0x04f470,
      activeEmissive: 0x04f470,
      activeIntensity: 4.2,
      activeRoughness: 0.15,
      glowColor: 0x14ff90,
      dullColor: 0x031c0c,
      dullRoughness: 0.85,
    },
  } as const;

  constructor(scene: THREE.Scene, lightingManager: LightingManager) {
    this.scene = scene;
    this.lightingManager = lightingManager;
    this.cityRootGroup = new THREE.Group();
    this.scene.add(this.cityRootGroup);

    // Subtle dynamic scene pointlights for closest traffic light poles
    for (let i = 0; i < 2; i++) {
      const pl = new THREE.PointLight(0x04f470, 0, 8.0, 2.0);
      pl.visible = false;
      this.scene.add(pl);
      this.trafficPointLights.push(pl);
    }

    // Create radial gradient ground light pool material for streetlights
    this.groundLightMaterial = new THREE.MeshBasicMaterial({
      map: this.createLightPoolTexture(),
      transparent: true,
      opacity: 0.0,
      visible: false,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -1.0,
    });

    this.createOcean();
    // Infinite city: no perimeter seawall barriers
    this.createPOIBeacons();
  }

  // Create soft radial warm ground pool texture for streetlights
  private createLightPoolTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 63);
      grad.addColorStop(0.0, 'rgba(255, 240, 160, 0.95)');
      grad.addColorStop(0.25, 'rgba(255, 215, 110, 0.80)');
      grad.addColorStop(0.55, 'rgba(255, 180, 60, 0.45)');
      grad.addColorStop(0.82, 'rgba(255, 150, 30, 0.16)');
      grad.addColorStop(1.0, 'rgba(255, 130, 10, 0.0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  // Create a tropical animated ocean surrounding the island city
  private createOcean() {
    // Generate harmonic water caustic ripple texture
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0a4f78';
      ctx.fillRect(0, 0, 256, 256);

      // Multi-frequency wave ripple patterns
      for (let y = 0; y < 256; y += 4) {
        for (let x = 0; x < 256; x += 4) {
          const w1 = Math.sin(x * 0.09 + y * 0.07);
          const w2 = Math.sin(x * 0.06 - y * 0.08 + 1.5);
          const w3 = Math.sin((x + y) * 0.05);
          const val = (w1 + w2 + w3) / 3;
          if (val > 0.18) {
            const alpha = Math.min(1.0, (val - 0.18) * 1.6);
            ctx.fillStyle = `rgba(130, 235, 255, ${alpha * 0.42})`;
            ctx.fillRect(x, y, 4, 4);
          }
        }
      }
    }

    this.oceanTexture = new THREE.CanvasTexture(canvas);
    this.oceanTexture.wrapS = THREE.RepeatWrapping;
    this.oceanTexture.wrapT = THREE.RepeatWrapping;
    this.oceanTexture.repeat.set(65, 65);

    // 3.5km x 3.5km ocean water plane extending to the horizon
    const oceanGeo = new THREE.PlaneGeometry(3500, 3500, 1, 1);
    oceanGeo.rotateX(-Math.PI / 2);

    this.oceanMaterial = new THREE.MeshStandardMaterial({
      color: 0x0077be,
      map: this.oceanTexture,
      roughness: 0.12,
      metalness: 0.22,
      transparent: true,
      opacity: 0.94,
    });

    this.oceanMesh = new THREE.Mesh(oceanGeo, this.oceanMaterial);
    this.oceanMesh.position.y = -0.45; // Sits just below the city streets (-0.45m)
    this.oceanMesh.receiveShadow = true;
    this.scene.add(this.oceanMesh);
  }

  // Create concrete coastal seawall embankments and animated shoreline foam around the island perimeter
  private createCoastalSeawalls() {
    this.seawallGroup = new THREE.Group();

    const halfW = 58.5 * CITY_SCALE;
    const halfD = 73.5 * CITY_SCALE;
    const wallThick = 1.6;
    const wallHeight = 0.72; // From y = 0.18 down to y = -0.54

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x5a6578,
      roughness: 0.78,
      metalness: 0.12,
      bumpMap: CityTextures.getWallBump(),
      bumpScale: 0.05,
    });

    const curbMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.6,
      metalness: 0.1,
      bumpMap: CityTextures.getSidewalkBump(),
      bumpScale: 0.04,
    });

    // 4 Coastal Seawalls (West, East, South, North)
    const wallsData = [
      { x: -halfW - wallThick / 2, z: 0, w: wallThick, d: halfD * 2 + wallThick * 2 }, // West
      { x: halfW + wallThick / 2, z: 0, w: wallThick, d: halfD * 2 + wallThick * 2 },  // East
      { x: 0, z: -halfD - wallThick / 2, w: halfW * 2, d: wallThick },                  // South
      { x: 0, z: halfD + wallThick / 2, w: halfW * 2, d: wallThick },                   // North
    ];

    wallsData.forEach(({ x, z, w, d }) => {
      // Concrete retaining seawall
      const wallGeo = new THREE.BoxGeometry(w, wallHeight, d);
      const wallMesh = new THREE.Mesh(wallGeo, wallMat);
      wallMesh.position.set(x, -0.18, z);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      this.seawallGroup!.add(wallMesh);
      this.walkableMeshes.push(wallMesh);

      // Coastal promenade safety curb / barrier ledge
      const curbGeo = new THREE.BoxGeometry(w * 0.85, 0.22, d);
      const curbMesh = new THREE.Mesh(curbGeo, curbMat);
      curbMesh.position.set(x, 0.22, z);
      curbMesh.castShadow = true;
      this.seawallGroup!.add(curbMesh);
      this.walkableMeshes.push(curbMesh);
    });

    // Shoreline foam ribbon encircling the city base
    const foamW = halfW * 2 + 7.0;
    const foamD = halfD * 2 + 7.0;
    const foamInnerW = halfW * 2 + 0.5;
    const foamInnerD = halfD * 2 + 0.5;

    // Create a 2D shoreline foam shape (outer ring minus inner ring)
    const shape = new THREE.Shape();
    shape.moveTo(-foamW / 2, -foamD / 2);
    shape.lineTo(foamW / 2, -foamD / 2);
    shape.lineTo(foamW / 2, foamD / 2);
    shape.lineTo(-foamW / 2, foamD / 2);
    shape.closePath();

    const hole = new THREE.Path();
    hole.moveTo(-foamInnerW / 2, -foamInnerD / 2);
    hole.lineTo(foamInnerW / 2, -foamInnerD / 2);
    hole.lineTo(foamInnerW / 2, foamInnerD / 2);
    hole.lineTo(-foamInnerW / 2, foamInnerD / 2);
    hole.closePath();
    shape.holes.push(hole);

    const foamGeo = new THREE.ShapeGeometry(shape);
    foamGeo.rotateX(-Math.PI / 2);

    this.shorelineFoamMaterial = new THREE.MeshBasicMaterial({
      color: 0xecfeff,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const foamMesh = new THREE.Mesh(foamGeo, this.shorelineFoamMaterial);
    foamMesh.position.y = -0.41; // Just above the ocean water surface
    this.seawallGroup.add(foamMesh);

    this.scene.add(this.seawallGroup);
  }

  private createPOIBeacons() {
    CITY_POIS.forEach((poi) => {
      const beaconGroup = new THREE.Group();
      beaconGroup.position.set(
        poi.position[0] * CITY_SCALE,
        poi.position[1],
        poi.position[2] * CITY_SCALE
      );

      // Glowing holographic beam
      const beamGeo = new THREE.CylinderGeometry(1.6, 1.6, 7, 16, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(poi.color),
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.y = 3.5;
      beaconGroup.add(beam);

      // Rotating ground ring
      const ringGeo = new THREE.RingGeometry(2.0, 2.6, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(poi.color),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.08;
      beaconGroup.add(ring);

      this.scene.add(beaconGroup);
      this.poiBeacons.push({ poi, group: beaconGroup, mesh: beam, ring });
    });
  }

  async loadCity(onProgress?: (percent: number) => void): Promise<void> {
    const loader = new GLTFLoader();

    return new Promise((resolve, reject) => {
      loader.load(
        '/models/Cartoon_City_Free.glb',
        (gltf) => {
          const cityModel = gltf.scene;
          cityModel.scale.set(CITY_SCALE, CITY_SCALE, CITY_SCALE);
          // Elevate cityModel so asphalt roadbed (-0.25m in GLTF) sits exactly at y = 0.00m,
          // and sidewalk curbs sit elevated at y = 0.25m
          cityModel.position.y = 0.25;
          cityModel.updateMatrixWorld(true);

          cityModel.traverse((node) => {
            const name = node.name || '';

            // Register spotlights with lighting manager & attach warm ground light pool decals
            if (name.startsWith('Spotlight_01')) {
              const worldPos = new THREE.Vector3();
              node.getWorldPosition(worldPos);
              this.lightingManager.addStreetLight(worldPos.x, worldPos.y, worldPos.z);

              // Circular ground light pool under the forward-extending lamp arm
              const poolGeo = new THREE.PlaneGeometry(13.5, 13.5);
              poolGeo.rotateX(-Math.PI / 2);
              const poolMesh = new THREE.Mesh(poolGeo, this.groundLightMaterial);
              poolMesh.position.set(0, 0.025, 2.6);
              node.add(poolMesh);
            } else if (name.startsWith('Spotlight_02')) {
              const worldPos = new THREE.Vector3();
              node.getWorldPosition(worldPos);
              this.lightingManager.addStreetLight(worldPos.x, worldPos.y, worldPos.z);

              // Multi-directional ground light pool for plaza lamp post
              const poolGeo = new THREE.PlaneGeometry(16.0, 16.0);
              poolGeo.rotateX(-Math.PI / 2);
              const poolMesh = new THREE.Mesh(poolGeo, this.groundLightMaterial);
              poolMesh.position.set(0, 0.025, 0);
              node.add(poolMesh);
            }

            // Hide static parked car nodes so TrafficManager drives working vehicles!
            // Also hide stray Billboard Line wires that cut across roads at street level
            if (
              name.startsWith('Car_') ||
              name.startsWith('Van') ||
              name.startsWith('Futuristic_Car') ||
              name.includes('Line')
            ) {
              node.visible = false;
            }

            if ((node as THREE.Mesh).isMesh) {
              const mesh = node as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              const parentName = node.parent ? (node.parent.name || '') : '';
              if (node.visible && (CityEnvironment.isWalkableMesh(name) || CityEnvironment.isWalkableMesh(parentName))) {
                this.walkableMeshes.push(mesh);
              }

              // Collect materials for dynamic Day/Night illumination & apply tactile procedural PBR textures
              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              mats.forEach((m) => {
                if (!m) return;
                const stdMat = m as THREE.MeshStandardMaterial;

                // Tactile Texturing & Surface Detail:
                const matName = (m.name || '').toLowerCase();
                const nodeName = name.toLowerCase();

                // 1. Roads & Asphalt (Smooth, clean tarmac without bumpy surface distortion)
                if (
                  matName.includes('asphalt') ||
                  matName.includes('road') ||
                  nodeName.includes('road') ||
                  nodeName.includes('asphalt')
                ) {
                  stdMat.map = CityTextures.getAsphaltDiffuse();
                  stdMat.bumpMap = null;
                  stdMat.bumpScale = 0;
                  stdMat.roughnessMap = CityTextures.getAsphaltRoughness();
                  stdMat.roughness = 0.82;
                  stdMat.metalness = 0.05;
                  stdMat.needsUpdate = true;
                }
                // 2. Sidewalks & Paved Walkways (Individual paving slabs with recessed grout lines)
                else if (
                  matName.includes('tile') ||
                  matName.includes('sidewalk') ||
                  matName.includes('pavement') ||
                  nodeName.includes('sidewalk')
                ) {
                  stdMat.map = CityTextures.getSidewalkDiffuse();
                  stdMat.bumpMap = CityTextures.getSidewalkBump();
                  stdMat.bumpScale = 0.08;
                  stdMat.roughness = 0.8;
                  stdMat.metalness = 0.04;
                  stdMat.needsUpdate = true;
                }
                // 3. Grass & Parkland Lawns (Lawn stripes, blade tufts, clover root shadows)
                else if (
                  matName.includes('grass') ||
                  matName.includes('lawn') ||
                  nodeName.includes('grass')
                ) {
                  stdMat.map = CityTextures.getGrassDiffuse();
                  stdMat.bumpMap = CityTextures.getGrassBump();
                  stdMat.bumpScale = 0.07;
                  stdMat.roughness = 0.9;
                  stdMat.metalness = 0.0;
                  stdMat.needsUpdate = true;
                }
                // 4. Concrete Walls & Architectural Facades (Fine architectural stucco grain relief)
                else if (
                  matName.includes('color') ||
                  matName.includes('wall') ||
                  matName.includes('building') ||
                  matName.includes('concrete')
                ) {
                  stdMat.bumpMap = CityTextures.getWallBump();
                  stdMat.bumpScale = 0.04;
                  stdMat.roughness = 0.72;
                  stdMat.needsUpdate = true;
                }
                // 5. Metal / Chrome / Structural Steel
                else if (
                  matName.includes('metal') ||
                  matName.includes('iron') ||
                  matName.includes('steel')
                ) {
                  stdMat.metalness = 0.8;
                  stdMat.roughness = 0.32;
                  stdMat.needsUpdate = true;
                }

                if (m.name === 'Glass' && !this.windowMaterials.includes(stdMat)) {
                  this.windowMaterials.push(stdMat);
                }
                if (m.name === 'Emissive' && !this.bulbMaterials.includes(stdMat)) {
                  const parentName = (node.parent?.name || '').toLowerCase();
                  if (
                    !name.toLowerCase().includes('traffic') &&
                    !parentName.includes('traffic') &&
                    !name.includes('111_1') &&
                    !name.includes('124_1') &&
                    !name.includes('107_1')
                  ) {
                    this.bulbMaterials.push(stdMat);
                  }
                }
                if (m.name === 'Billboard' && !this.billboardMaterials.includes(stdMat)) {
                  this.billboardMaterials.push(stdMat);
                }
                if (m.name === 'scrolling text' && !this.scrollingTextMaterials.includes(stdMat)) {
                  this.scrollingTextMaterials.push(stdMat);
                }
              });
            }

            // Solid Colliders:
            // 1. Buildings & Skyscrapers (Groups containing building meshes)
            const isBuilding = name.includes('Building') || name.includes('TwistedTower');

            // 2. Plaza landmarks (fountain, bus shelter)
            const isPlazaLandmark = name.includes('Fountain') || name.includes('Bus_Stop');

            if (isBuilding || isPlazaLandmark) {
              // Skip container groups whose descendants are themselves buildings — otherwise a
              // block-level parent (e.g. "Buildings") becomes one giant box swallowing whole streets.
              let hasBuildingDescendant = false;
              node.traverse((child) => {
                if (child === node || hasBuildingDescendant) return;
                const cn = child.name;
                if (cn.includes('Building') || cn.includes('TwistedTower') || cn.includes('Fountain') || cn.includes('Bus_Stop')) {
                  hasBuildingDescendant = true;
                }
              });

              if (!hasBuildingDescendant) {
                node.updateMatrixWorld(true);
                const box = new THREE.Box3().setFromObject(node);
                const size = new THREE.Vector3();
                box.getSize(size);
                // Sanity guard: buildings scaled by CITY_SCALE (2.5) are up to ~110m wide; filter whole-city root
                if (size.x > 0.4 && size.z > 0.4 && size.x < 160 && size.z < 180) {
                  // Landmark Buildings: Register exact street-level base footprints (leaving all small roads,
                  // alleys, cross-streets, and plazas open) and elevated upper volumes for high-altitude flight
                  if (name.includes('TwistedTower')) {
                    // Ground level base: opens up the 17m road/plaza at Z[75, 92] and X[43, 57]
                    this.baseColliders.push(new THREE.Box3(new THREE.Vector3(57.5, 0, 92.0), new THREE.Vector3(100.5, 35.0, 146.1)));
                    // Upper tower: covers the twisted cantilever at altitude for jetpack flight
                    this.baseColliders.push(new THREE.Box3(new THREE.Vector3(43.6, 35.0, 75.0), new THREE.Vector3(107.1, 133.0, 154.4)));
                  } else if (name.includes('Eco_Building_Slope001')) {
                    // Ground level base: opens up the 10m eastern sidewalk/small road at X[-25.2, -15.1]
                    this.baseColliders.push(new THREE.Box3(new THREE.Vector3(-107.0, 0, -3.8), new THREE.Vector3(-25.2, 35.0, 43.9)));
                    // Upper slope for high-altitude flight
                    this.baseColliders.push(new THREE.Box3(new THREE.Vector3(-111.3, 35.0, -4.2), new THREE.Vector3(-15.1, 144.0, 43.9)));
                  } else if (name.includes('Eco_Building_Slope004')) {
                    this.baseColliders.push(new THREE.Box3(new THREE.Vector3(-107.7, 0, 107.3), new THREE.Vector3(-25.8, 35.0, 155.0)));
                    this.baseColliders.push(new THREE.Box3(new THREE.Vector3(-112.0, 35.0, 106.9), new THREE.Vector3(-15.8, 144.0, 155.0)));
                  } else if (name.includes('Eco_Building_Slope005')) {
                    this.baseColliders.push(new THREE.Box3(new THREE.Vector3(-107.0, 0, -116.6), new THREE.Vector3(-25.2, 35.0, -68.9)));
                    this.baseColliders.push(new THREE.Box3(new THREE.Vector3(-111.3, 35.0, -117.0), new THREE.Vector3(-15.1, 144.0, -68.9)));
                  } else if (name.includes('Eco_Building_Grid005')) {
                    // Ground level base: opens up cross-streets at Z < -50 and Z > 16
                    this.baseColliders.push(new THREE.Box3(new THREE.Vector3(62.6, 0, -50.0), new THREE.Vector3(106.0, 35.0, 16.1)));
                    this.baseColliders.push(new THREE.Box3(new THREE.Vector3(60.1, 35.0, -55.6), new THREE.Vector3(106.3, 130.0, 21.6)));
                  } else if (name.includes('Eco_Building_Terrace008')) {
                    // Ground level base: opens up southern cross-street at Z < -147.5
                    this.baseColliders.push(new THREE.Box3(new THREE.Vector3(59.7, 0, -147.5), new THREE.Vector3(107.4, 25.0, -65.7)));
                    this.baseColliders.push(new THREE.Box3(new THREE.Vector3(59.7, 25.0, -157.6), new THREE.Vector3(107.4, 61.0, -62.0)));
                  } else if (name.includes('Fountain')) {
                    // Plaza fountains: compact central box so cars and pedestrians can drive and walk around in the plaza
                    const fCenter = new THREE.Vector3();
                    box.getCenter(fCenter);
                    this.baseColliders.push(new THREE.Box3(
                      new THREE.Vector3(fCenter.x - 4.2, 0, fCenter.z - 4.2),
                      new THREE.Vector3(fCenter.x + 4.2, 3.5, fCenter.z + 4.2)
                    ));
                  } else {
                    this.baseColliders.push(box);
                  }
                }
              }
            }

            // 3. Traffic Light Poles (slim vertical pole collider) + working signal heads
            if (name.startsWith('traffic_light') && !name.includes('Bulb') && !name.includes('Line')) {
              node.updateMatrixWorld(true);
              const polePos = new THREE.Vector3();
              node.getWorldPosition(polePos);
              const poleBox = new THREE.Box3(
                new THREE.Vector3(polePos.x - 0.22, 0, polePos.z - 0.22),
                new THREE.Vector3(polePos.x + 0.22, 4.5, polePos.z + 0.22)
              );
              this.baseColliders.push(poleBox);
              this.setupTrafficLightModel(node, polePos);
            }

            // 4. Streetlight Poles (slim vertical pole collider)
            if (name.startsWith('Spotlight_01') || name.startsWith('Spotlight_02')) {
              node.updateMatrixWorld(true);
              const lightPos = new THREE.Vector3();
              node.getWorldPosition(lightPos);
              const lightBox = new THREE.Box3(
                new THREE.Vector3(lightPos.x - 0.20, 0, lightPos.z - 0.20),
                new THREE.Vector3(lightPos.x + 0.20, 4.5, lightPos.z + 0.20)
              );
              this.baseColliders.push(lightBox);
            }

            // 5. Palm Trees (slim trunk collider)
            if (name.startsWith('Palm')) {
              node.updateMatrixWorld(true);
              const palmPos = new THREE.Vector3();
              node.getWorldPosition(palmPos);
              const palmBox = new THREE.Box3(
                new THREE.Vector3(palmPos.x - 0.25, 0, palmPos.z - 0.25),
                new THREE.Vector3(palmPos.x + 0.25, 4.5, palmPos.z + 0.25)
              );
              this.baseColliders.push(palmBox);
            }

            // 6. Billboards & Large Signboards
            if (name.startsWith('Billboard') && !name.includes('Line')) {
              node.updateMatrixWorld(true);
              const billPos = new THREE.Vector3();
              node.getWorldPosition(billPos);
              const billBox = new THREE.Box3(
                new THREE.Vector3(billPos.x - 0.35, 0, billPos.z - 0.35),
                new THREE.Vector3(billPos.x + 0.35, 4.5, billPos.z + 0.35)
              );
              this.baseColliders.push(billBox);
            }
          });

          // Prepare template chunk holding city base and all city props
          const templateChunk = new THREE.Group();
          templateChunk.name = 'City_Chunk_Template';
          templateChunk.add(cityModel);

          // Apply initial Day/Night material settings
          this.setDayNightVisuals(this.currentMode);

          // Load extra 3D city props (Bus Stops, Fountains, Palms, Trash Cans) into the template chunk
          this.loadCityProps(loader, templateChunk).finally(() => {
            this.templateChunk = templateChunk;
            this.chunkLocalColliders = [...this.baseColliders];
            this.initChunkPool();
            resolve();
          });
        },
        (xhr) => {
          if (xhr.total > 0 && onProgress) {
            onProgress(Math.round((xhr.loaded / xhr.total) * 100));
          }
        },
        (error) => {
          console.error('Error loading Cartoon_City_Free.glb:', error);
          reject(error);
        }
      );
    });
  }

  private async loadCityProps(loader: GLTFLoader, templateGroup: THREE.Group): Promise<void> {
    const propsGroup = new THREE.Group();
    propsGroup.name = 'City_Props_Pack';
    templateGroup.add(propsGroup);

    // 1. Bus Stop Shelters (Bus_Stop_02.glb)
    try {
      const gltf = await loader.loadAsync('/models/props/Bus_Stop_02.glb');
      const busStopTemplate = gltf.scene;
      busStopTemplate.scale.set(CITY_SCALE * 0.9, CITY_SCALE * 0.9, CITY_SCALE * 0.9);
      busStopTemplate.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });

      const busStopPositions = [
        { x: -22.5, y: 0.25, z: -15.0, rotY: Math.PI / 2 },
        { x: -18.2, y: 0.25, z: 25.0, rotY: Math.PI / 2 },
        { x: 38.5, y: 0.25, z: 85.0, rotY: -Math.PI / 2 },
        { x: 38.5, y: 0.25, z: -95.0, rotY: -Math.PI / 2 },
      ];

      for (const pos of busStopPositions) {
        const stop = busStopTemplate.clone(true);
        stop.position.set(pos.x, pos.y, pos.z);
        stop.rotation.y = pos.rotY;
        stop.updateMatrixWorld(true);
        propsGroup.add(stop);

        // Solid collider for the bus stop shelter
        const box = new THREE.Box3();
        box.setFromObject(stop);
        box.expandByScalar(0.2);
        this.baseColliders.push(box);
      }
    } catch (e) {
      console.warn('Could not load Bus_Stop_02.glb:', e);
    }

    // 2. Grand Plazas Fountain (Fountain_03.glb)
    try {
      const gltf = await loader.loadAsync('/models/props/Fountain_03.glb');
      const fountain = gltf.scene;
      fountain.scale.set(CITY_SCALE * 1.2, CITY_SCALE * 1.2, CITY_SCALE * 1.2);
      fountain.position.set(-31.5, 0.25, 75.5);
      fountain.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });
      propsGroup.add(fountain);
      fountain.updateMatrixWorld(true);

      const fountainBox = new THREE.Box3().setFromObject(fountain);
      const fSize = new THREE.Vector3();
      const fCenter = new THREE.Vector3();
      fountainBox.getSize(fSize);
      fountainBox.getCenter(fCenter);
      const fHalfX = fSize.x * 0.48;
      const fHalfZ = fSize.z * 0.48;
      // Octagonal cross approximation for circular plaza fountain
      this.baseColliders.push(
        new THREE.Box3(
          new THREE.Vector3(fCenter.x - fHalfX, fountainBox.min.y, fCenter.z - fHalfZ * 0.65),
          new THREE.Vector3(fCenter.x + fHalfX, fountainBox.max.y, fCenter.z + fHalfZ * 0.65)
        ),
        new THREE.Box3(
          new THREE.Vector3(fCenter.x - fHalfX * 0.65, fountainBox.min.y, fCenter.z - fHalfZ),
          new THREE.Vector3(fCenter.x + fHalfX * 0.65, fountainBox.max.y, fCenter.z + fHalfZ)
        )
      );
    } catch (e) {
      console.warn('Could not load Fountain_03.glb:', e);
    }

    // 3. Tropical Palms (Palm_03.glb)
    try {
      const gltf = await loader.loadAsync('/models/props/Palm_03.glb');
      const palmTemplate = gltf.scene;
      palmTemplate.scale.set(CITY_SCALE, CITY_SCALE, CITY_SCALE);
      palmTemplate.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });

      const palmSpots = [
        { x: -30.0, z: 65.0 },
        { x: -33.0, z: 85.0 },
        { x: -28.0, z: 88.0 },
        { x: 30.0, z: 40.0 },
        { x: 32.0, z: -40.0 },
        { x: -50.0, z: 120.0 },
        { x: 50.0, z: 120.0 },
        { x: -50.0, z: -120.0 },
        { x: 50.0, z: -120.0 },
      ];
      for (const spot of palmSpots) {
        const palm = palmTemplate.clone(true);
        palm.position.set(spot.x, 0.25, spot.z);
        palm.rotation.y = Math.random() * Math.PI * 2;
        palm.updateMatrixWorld(true);
        propsGroup.add(palm);

        // Solid trunk collider
        this.baseColliders.push(
          new THREE.Box3(
            new THREE.Vector3(spot.x - 0.45, 0, spot.z - 0.45),
            new THREE.Vector3(spot.x + 0.45, 5.0, spot.z + 0.45)
          )
        );
      }
    } catch (e) {
      console.warn('Could not load Palm_03.glb:', e);
    }

    // 4. Street Trash Cans (Trash_Can_04.glb)
    try {
      const gltf = await loader.loadAsync('/models/props/Trash_Can_04.glb');
      const trashTemplate = gltf.scene;
      trashTemplate.scale.set(CITY_SCALE * 0.8, CITY_SCALE * 0.8, CITY_SCALE * 0.8);
      trashTemplate.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });

      const trashSpots = [
        { x: -21.0, z: -17.0 },
        { x: -17.0, z: 32.0 },
        { x: 38.5, z: 92.0 },
        { x: 38.5, z: -102.0 },
      ];
      for (const spot of trashSpots) {
        const bin = trashTemplate.clone(true);
        bin.position.set(spot.x, 0.25, spot.z);
        bin.updateMatrixWorld(true);
        propsGroup.add(bin);

        // Solid receptacle collider
        this.baseColliders.push(
          new THREE.Box3(
            new THREE.Vector3(spot.x - 0.35, 0, spot.z - 0.35),
            new THREE.Vector3(spot.x + 0.35, 1.2, spot.z + 0.35)
          )
        );
      }
    } catch (e) {
      console.warn('Could not load Trash_Can_04.glb:', e);
    }
  }

  /**
   * Initializes the 3x3 Dynamic Infinite Chunk Pool.
   * Total active chunks is strictly capped at 9 (1 center + 8 surrounding neighbors).
   * Three.js .clone(true) shares GPU BufferGeometry & Materials, so VRAM is not duplicated!
   */
  private initChunkPool() {
    if (!this.templateChunk) return;
    this.chunks = [];
    this.centerChunkX = 0;
    this.centerChunkZ = 0;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const isCenter = dx === 0 && dz === 0;
        const chunkGroup = isCenter ? this.templateChunk : this.templateChunk.clone(true);
        chunkGroup.position.set(dx * CHUNK_WIDTH, 0, dz * CHUNK_DEPTH);
        chunkGroup.updateMatrixWorld(true);
        this.cityRootGroup.add(chunkGroup);

        const chunkColliders: THREE.Box3[] = this.chunkLocalColliders.map((box) => {
          const cb = box.clone();
          cb.translate(new THREE.Vector3(dx * CHUNK_WIDTH, 0, dz * CHUNK_DEPTH));
          return cb;
        });

        const walkable: THREE.Mesh[] = [];
        chunkGroup.traverse((node) => {
          if ((node as THREE.Mesh).isMesh && node.visible) {
            const name = node.name || '';
            const parentName = node.parent ? (node.parent.name || '') : '';
            if (CityEnvironment.isWalkableMesh(name) || CityEnvironment.isWalkableMesh(parentName)) {
              walkable.push(node as THREE.Mesh);
            }
          }
        });

        this.chunks.push({
          gridX: dx,
          gridZ: dz,
          group: chunkGroup,
          colliders: chunkColliders,
          walkableMeshes: walkable,
        });
      }
    }

    this.updateSpatialColliders(new THREE.Vector3(0, 0, 0));
  }

  /**
   * Shifts chunks when the active focus crosses into a new chunk.
   * Recycles out-of-range chunks to newly entered grid positions with zero memory allocation.
   */
  public updateChunkGrid(focusPos: THREE.Vector3) {
    if (this.chunks.length === 0) return;

    const targetChunkX = Math.round(focusPos.x / CHUNK_WIDTH);
    const targetChunkZ = Math.round(focusPos.z / CHUNK_DEPTH);

    if (targetChunkX === this.centerChunkX && targetChunkZ === this.centerChunkZ) {
      return;
    }

    this.centerChunkX = targetChunkX;
    this.centerChunkZ = targetChunkZ;

    // Desired 3x3 coords centered around targetChunk
    const desiredCoords: { x: number; z: number }[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        desiredCoords.push({ x: targetChunkX + dx, z: targetChunkZ + dz });
      }
    }

    const availableChunks: CityChunk[] = [];
    const occupiedCoords = new Set<string>();

    for (const chunk of this.chunks) {
      const inRange =
        Math.abs(chunk.gridX - targetChunkX) <= 1 &&
        Math.abs(chunk.gridZ - targetChunkZ) <= 1;
      if (inRange) {
        occupiedCoords.add(`${chunk.gridX},${chunk.gridZ}`);
      } else {
        availableChunks.push(chunk);
      }
    }

    // Reposition recycled chunks into missing slots
    for (const target of desiredCoords) {
      const key = `${target.x},${target.z}`;
      if (!occupiedCoords.has(key)) {
        const recycled = availableChunks.pop();
        if (recycled) {
          recycled.gridX = target.x;
          recycled.gridZ = target.z;
          recycled.group.position.set(target.x * CHUNK_WIDTH, 0, target.z * CHUNK_DEPTH);
          recycled.group.updateMatrixWorld(true);

          const offsetX = target.x * CHUNK_WIDTH;
          const offsetZ = target.z * CHUNK_DEPTH;
          for (let i = 0; i < this.chunkLocalColliders.length; i++) {
            const baseBox = this.chunkLocalColliders[i];
            recycled.colliders[i].min.set(baseBox.min.x + offsetX, baseBox.min.y, baseBox.min.z + offsetZ);
            recycled.colliders[i].max.set(baseBox.max.x + offsetX, baseBox.max.y, baseBox.max.z + offsetZ);
          }
        }
      }
    }
  }

  /**
   * Spatially partitions colliders and walkable meshes for constant-time O(1) physics.
   * Limits active collision test set to ~40-80 nearest boxes around the player/vehicle.
   */
  public updateSpatialColliders(focusPos: THREE.Vector3) {
    if (this.chunks.length === 0) return;

    const radius = 110.0;
    const radiusSq = radius * radius;
    const nearColliders: THREE.Box3[] = [];
    const nearWalkable: THREE.Mesh[] = [];

    for (let c = 0; c < this.chunks.length; c++) {
      const chunk = this.chunks[c];
      const chunkCenterX = chunk.gridX * CHUNK_WIDTH;
      const chunkCenterZ = chunk.gridZ * CHUNK_DEPTH;
      const chunkDistX = Math.abs(focusPos.x - chunkCenterX);
      const chunkDistZ = Math.abs(focusPos.z - chunkCenterZ);

      // Broadphase check: is chunk within reach?
      if (chunkDistX <= CHUNK_WIDTH * 0.5 + radius && chunkDistZ <= CHUNK_DEPTH * 0.5 + radius) {
        for (let b = 0; b < chunk.colliders.length; b++) {
          const box = chunk.colliders[b];
          const midX = (box.min.x + box.max.x) * 0.5;
          const midZ = (box.min.z + box.max.z) * 0.5;
          const dx = midX - focusPos.x;
          const dz = midZ - focusPos.z;
          if (dx * dx + dz * dz < radiusSq) {
            nearColliders.push(box);
          }
        }
      }

      // Collect walkable meshes within near vicinity (~60m reach)
      if (chunkDistX <= CHUNK_WIDTH * 0.5 + 40 && chunkDistZ <= CHUNK_DEPTH * 0.5 + 40) {
        nearWalkable.push(...chunk.walkableMeshes);
      }
    }

    this.activeColliders = nearColliders;
    this.baseColliders = nearColliders;
    this.walkableMeshes = nearWalkable;
  }

  /**
   * Returns colliders near a specific coordinate (for safe respawns / mission spawns).
   */
  public getCollidersNear(pos: THREE.Vector3, radius: number = 40): THREE.Box3[] {
    const rSq = radius * radius;
    const result: THREE.Box3[] = [];
    for (let c = 0; c < this.chunks.length; c++) {
      const chunk = this.chunks[c];
      const chunkDistX = Math.abs(pos.x - chunk.gridX * CHUNK_WIDTH);
      const chunkDistZ = Math.abs(pos.z - chunk.gridZ * CHUNK_DEPTH);
      if (chunkDistX <= CHUNK_WIDTH * 0.5 + radius && chunkDistZ <= CHUNK_DEPTH * 0.5 + radius) {
        for (let b = 0; b < chunk.colliders.length; b++) {
          const box = chunk.colliders[b];
          const midX = (box.min.x + box.max.x) * 0.5;
          const midZ = (box.min.z + box.max.z) * 0.5;
          const dx = midX - pos.x;
          const dz = midZ - pos.z;
          if (dx * dx + dz * dz < rSq) {
            result.push(box);
          }
        }
      }
    }
    return result;
  }

  private getSubtleHaloTexture(): THREE.Texture {
    if (this.subtleHaloTexture) return this.subtleHaloTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // High-definition radial bloom profile: soft core, gentle feathered exponential falloff
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 63);
      grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.18, 'rgba(255, 255, 255, 0.85)');
      grad.addColorStop(0.42, 'rgba(255, 255, 255, 0.40)');
      grad.addColorStop(0.70, 'rgba(255, 255, 255, 0.12)');
      grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    this.subtleHaloTexture = new THREE.CanvasTexture(canvas);
    this.subtleHaloTexture.needsUpdate = true;
    return this.subtleHaloTexture;
  }

  /**
   * Configures real signal lenses and subtle blooming light halos directly on the 3D traffic light model.
   * Inactive lights appear completely dull and unlit; active lights emit bright light with a soft radial halo.
   */
  private setupTrafficLightModel(node: THREE.Object3D, polePos: THREE.Vector3) {
    // 1. Hide the original unseparated emissive mesh from the GLB model
    node.children.forEach((c: any) => {
      if (c.material && c.material.name === 'Emissive') {
        c.visible = false;
      }
    });

    node.updateMatrixWorld(true);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(node.quaternion);
    const servesZ = Math.abs(fwd.z) >= Math.abs(fwd.x);

    const haloTexture = this.getSubtleHaloTexture();
    const lamps: TrafficSignalLamp[] = [];

    const addLamp = (
      type: 'traffic' | 'pedestrian',
      col: 'red' | 'yellow' | 'green',
      pos: THREE.Vector3,
      normal: THREE.Vector3 = new THREE.Vector3(0, 0, 1),
      isPed: boolean = false
    ) => {
      const cConf = CityEnvironment.SIGNAL_COLORS[col];
      // Lens initially dull and unlit
      const mat = new THREE.MeshStandardMaterial({
        color: cConf.dullColor,
        emissive: 0x000000,
        emissiveIntensity: 0.0,
        roughness: cConf.dullRoughness,
        metalness: 0.1,
      });

      const lens = new THREE.Mesh(isPed ? CityEnvironment.pedLensGeo : CityEnvironment.trafficLensGeo, mat);
      lens.position.copy(pos);
      lens.scale.set(1.0, 1.0, 0.35);

      if (normal.z < -0.5) lens.rotation.y = Math.PI;
      else if (normal.x > 0.5) lens.rotation.y = Math.PI / 2;
      else if (normal.x < -0.5) lens.rotation.y = -Math.PI / 2;
      node.add(lens);

      // Subtle light halo around the active light
      const glowMat = new THREE.MeshBasicMaterial({
        map: haloTexture,
        color: cConf.glowColor,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const glowMesh = new THREE.Mesh(isPed ? CityEnvironment.pedGlowGeo : CityEnvironment.trafficGlowGeo, glowMat);
      glowMesh.position.copy(pos).add(normal.clone().multiplyScalar(0.018));
      glowMesh.rotation.copy(lens.rotation);
      glowMesh.visible = false;
      node.add(glowMesh);

      lamps.push({ type, color: col, mat, glowMat, glowMesh });
    };

    let overheadLocalPos: THREE.Vector3 | undefined;
    const name = node.name || '';

    if (name.includes('001')) {
      // Overhead cantilever arm signal (facing +Z)
      addLamp('traffic', 'red', new THREE.Vector3(3.692, 5.690, 0.203), new THREE.Vector3(0, 0, 1));
      addLamp('traffic', 'yellow', new THREE.Vector3(3.692, 5.375, 0.203), new THREE.Vector3(0, 0, 1));
      addLamp('traffic', 'green', new THREE.Vector3(3.692, 5.064, 0.203), new THREE.Vector3(0, 0, 1));
      overheadLocalPos = new THREE.Vector3(3.692, 5.375, 0.203);
    } else if (name.includes('002')) {
      // Master intersection pole:
      // 1. Overhead cantilever arm (+Z face, facing +Z)
      addLamp('traffic', 'red', new THREE.Vector3(-3.692, 5.690, 0.203), new THREE.Vector3(0, 0, 1));
      addLamp('traffic', 'yellow', new THREE.Vector3(-3.692, 5.375, 0.203), new THREE.Vector3(0, 0, 1));
      addLamp('traffic', 'green', new THREE.Vector3(-3.692, 5.064, 0.203), new THREE.Vector3(0, 0, 1));
      // 2. Overhead cantilever arm (-Z face, facing -Z)
      addLamp('traffic', 'red', new THREE.Vector3(-3.692, 5.690, -0.206), new THREE.Vector3(0, 0, -1));
      addLamp('traffic', 'yellow', new THREE.Vector3(-3.692, 5.375, -0.206), new THREE.Vector3(0, 0, -1));
      addLamp('traffic', 'green', new THREE.Vector3(-3.692, 5.064, -0.206), new THREE.Vector3(0, 0, -1));
      // 3. Post-mounted secondary traffic signal (+Z face)
      addLamp('traffic', 'red', new THREE.Vector3(-0.379, 3.625, 0.205), new THREE.Vector3(0, 0, 1));
      addLamp('traffic', 'yellow', new THREE.Vector3(-0.379, 3.310, 0.205), new THREE.Vector3(0, 0, 1));
      addLamp('traffic', 'green', new THREE.Vector3(-0.379, 2.999, 0.205), new THREE.Vector3(0, 0, 1));
      // 4. Pedestrian signal (+X and -X faces)
      addLamp('pedestrian', 'red', new THREE.Vector3(0.055, 2.467, -0.333), new THREE.Vector3(1, 0, 0), true);
      addLamp('pedestrian', 'green', new THREE.Vector3(0.055, 2.193, -0.333), new THREE.Vector3(1, 0, 0), true);
      addLamp('pedestrian', 'red', new THREE.Vector3(-0.065, 2.467, -0.333), new THREE.Vector3(-1, 0, 0), true);
      addLamp('pedestrian', 'green', new THREE.Vector3(-0.065, 2.193, -0.333), new THREE.Vector3(-1, 0, 0), true);
      overheadLocalPos = new THREE.Vector3(-3.692, 5.375, 0.0);
    } else if (name.includes('003')) {
      // Standalone pedestrian crossing pole (+Z and -Z faces)
      addLamp('pedestrian', 'red', new THREE.Vector3(0.333, 2.467, 0.052), new THREE.Vector3(0, 0, 1), true);
      addLamp('pedestrian', 'green', new THREE.Vector3(0.333, 2.193, 0.052), new THREE.Vector3(0, 0, 1), true);
      addLamp('pedestrian', 'red', new THREE.Vector3(0.333, 2.467, -0.062), new THREE.Vector3(0, 0, -1), true);
      addLamp('pedestrian', 'green', new THREE.Vector3(0.333, 2.193, -0.062), new THREE.Vector3(0, 0, -1), true);
      overheadLocalPos = new THREE.Vector3(0.333, 2.33, 0.0);
    }

    const overheadWorldPos = overheadLocalPos ? overheadLocalPos.clone().applyMatrix4(node.matrixWorld) : undefined;
    this.trafficSignals.push({
      name,
      node,
      servesZ,
      worldPos: polePos.clone(),
      overheadPos: overheadWorldPos,
      lamps,
    });
  }

  /** Light the signal heads for the current global cycle */
  public setTrafficLightState(color: TrafficLightColor) {
    if (color === this.currentSignalColor) return;
    this.currentSignalColor = color;
    this.applyTrafficLightVisuals(color);
  }

  private applyTrafficLightVisuals(color: TrafficLightColor) {
    const opposite: TrafficLightColor = color === 'green' ? 'red' : color === 'red' ? 'green' : 'yellow';
    const isNight = this.currentMode === 'night';
    const haloOpacity = isNight ? 0.78 : this.currentMode === 'sunset' ? 0.68 : 0.55;

    for (const signal of this.trafficSignals) {
      const activeColor = signal.servesZ ? color : opposite;
      const pedActiveColor = activeColor === 'green' ? 'red' : 'green';

      for (const lamp of signal.lamps) {
        const isActive = lamp.type === 'traffic'
          ? (lamp.color === activeColor)
          : (lamp.color === pedActiveColor);

        const cConf = CityEnvironment.SIGNAL_COLORS[lamp.color];

        if (isActive) {
          // Active light: bright vibrant color, high emissive intensity, smooth reflection
          lamp.mat.color.setHex(cConf.activeColor);
          lamp.mat.emissive.setHex(cConf.activeEmissive);
          lamp.mat.emissiveIntensity = isNight ? 4.8 : 4.0;
          lamp.mat.roughness = cConf.activeRoughness;
          // Subtle light halo radiating around the active lamp
          lamp.glowMat.color.setHex(cConf.glowColor);
          lamp.glowMat.opacity = haloOpacity;
          lamp.glowMesh.visible = true;
        } else {
          // Inactive light: dull dark color, zero emissive, high matte roughness, no light around it
          lamp.mat.color.setHex(cConf.dullColor);
          lamp.mat.emissive.setHex(0x000000);
          lamp.mat.emissiveIntensity = 0.0;
          lamp.mat.roughness = cConf.dullRoughness;
          lamp.glowMat.opacity = 0.0;
          lamp.glowMesh.visible = false;
        }
      }
    }
  }

  update(carPos: THREE.Vector3, delta: number, onPOIEnter?: (poi: POI) => void): POI | null {
    const dt = Math.min(delta, 0.1);

    // 0. Dynamic 3x3 Chunk Grid shift & constant-time spatial collision broadphase
    this.updateChunkGrid(carPos);
    this.updateSpatialColliders(carPos);

    // Ocean water plane follows player to provide an endless horizon
    if (this.oceanMesh) {
      this.oceanMesh.position.x = carPos.x;
      this.oceanMesh.position.z = carPos.z;
    }

    // 1. Animate Ocean Waves and Shoreline Foam
    if (this.oceanTexture) {
      this.oceanTexture.offset.x = (this.oceanTexture.offset.x + dt * 0.014) % 1;
      this.oceanTexture.offset.y = (this.oceanTexture.offset.y + dt * 0.022) % 1;
    }
    if (this.shorelineFoamMaterial) {
      this.shorelineFoamMaterial.opacity = 0.65 + Math.sin(Date.now() * 0.003) * 0.18;
    }

    // 2. Animate POI Beacons
    let nearbyPOI: POI | null = null;
    this.poiBeacons.forEach(({ poi, mesh, ring }) => {
      mesh.rotation.y += dt * 0.8;
      ring.rotation.z -= dt * 1.2;

      // Distance check to POI
      const poiX = poi.position[0] * CITY_SCALE;
      const poiZ = poi.position[2] * CITY_SCALE;
      const dist = Math.hypot(carPos.x - poiX, carPos.z - poiZ);
      if (dist < 5.0) {
        nearbyPOI = poi;
        (mesh.material as THREE.MeshBasicMaterial).opacity = 0.7 + Math.sin(Date.now() * 0.007) * 0.2;
      } else {
        (mesh.material as THREE.MeshBasicMaterial).opacity = 0.3;
      }
    });

    // Detect entrance trigger
    if (nearbyPOI && (!this.currentActivePOI || this.currentActivePOI.id !== (nearbyPOI as POI).id)) {
      this.currentActivePOI = nearbyPOI;
      audioManager.playChime();
      if (onPOIEnter) onPOIEnter(nearbyPOI);
    } else if (!nearbyPOI) {
      this.currentActivePOI = null;
    }

    // 3. Subtle dynamic scene pointlights for closest traffic light poles across active chunks
    if (this.trafficPointLights.length > 0 && this.trafficSignals.length > 0 && this.chunks.length > 0) {
      let nearestOverhead: THREE.Vector3 | null = null;
      let nearestDistSq = Infinity;
      let nearestServesZ = true;

      for (let c = 0; c < this.chunks.length; c++) {
        const chunk = this.chunks[c];
        const offsetX = chunk.gridX * CHUNK_WIDTH;
        const offsetZ = chunk.gridZ * CHUNK_DEPTH;

        for (let s = 0; s < this.trafficSignals.length; s++) {
          const sig = this.trafficSignals[s];
          if (!sig.overheadPos) continue;

          const wx = sig.worldPos.x + offsetX;
          const wz = sig.worldPos.z + offsetZ;
          const dSq = (wx - carPos.x) ** 2 + (wz - carPos.z) ** 2;
          if (dSq < nearestDistSq) {
            nearestDistSq = dSq;
            nearestServesZ = sig.servesZ;
            nearestOverhead = new THREE.Vector3(sig.overheadPos.x + offsetX, sig.overheadPos.y, sig.overheadPos.z + offsetZ);
          }
        }
      }

      const isNight = this.currentMode === 'night';
      const intensity = isNight ? 2.6 : this.currentMode === 'sunset' ? 1.8 : 1.2;

      for (let i = 0; i < this.trafficPointLights.length; i++) {
        const pl = this.trafficPointLights[i];
        if (i === 0 && nearestOverhead && nearestDistSq < 2025) {
          pl.position.copy(nearestOverhead);
          const activeColor = nearestServesZ
            ? (this.currentSignalColor || 'green')
            : (this.currentSignalColor === 'green' ? 'red' : this.currentSignalColor === 'red' ? 'green' : 'yellow');
          const cConf = CityEnvironment.SIGNAL_COLORS[activeColor];
          pl.color.setHex(cConf.activeColor);
          pl.intensity = intensity;
          pl.visible = true;
        } else {
          pl.visible = false;
        }
      }
    }

    return this.currentActivePOI;
  }

  // Switch visual materials between Day, Sunset, and Night
  public setDayNightVisuals(mode: DayNightMode) {
    this.currentMode = mode;
    const isNight = mode === 'night';
    const isSunset = mode === 'sunset';

    // 1. Skyscraper Windows (Glass Material)
    this.windowMaterials.forEach((mat) => {
      if (isNight) {
        mat.emissive.setHex(0xffe488); // Radiant golden warm window illumination
        mat.emissiveIntensity = 4.2;
      } else if (isSunset) {
        mat.emissive.setHex(0xff9e44); // Sunset amber window glow
        mat.emissiveIntensity = 1.8;
      } else {
        mat.emissive.setHex(0x000000); // Daytime unlit glass
        mat.emissiveIntensity = 0.0;
      }
      mat.needsUpdate = true;
    });

    // 2. Streetlight Bulbs & Illuminated Signs (Emissive Material)
    this.bulbMaterials.forEach((mat) => {
      if (isNight) {
        mat.emissive.setHex(0xfff8c0); // Radiant golden-white lamp bulb blaze
        mat.emissiveIntensity = 6.5;
      } else if (isSunset) {
        mat.emissive.setHex(0xffb844);
        mat.emissiveIntensity = 3.0;
      } else {
        mat.emissive.setHex(0x111111);
        mat.emissiveIntensity = 0.1;
      }
      mat.needsUpdate = true;
    });

    // 3. Neon Advertising Billboards
    this.billboardMaterials.forEach((mat) => {
      if (isNight) {
        mat.emissive.setHex(0xffffff);
        mat.emissiveIntensity = 3.2;
      } else if (isSunset) {
        mat.emissive.setHex(0xffd8b0);
        mat.emissiveIntensity = 1.6;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0.0;
      }
      mat.needsUpdate = true;
    });

    // 4. Scrolling Neon Signage Text
    this.scrollingTextMaterials.forEach((mat) => {
      if (isNight) {
        mat.emissive.setHex(0x00ffff); // Electric neon cyan digital ticker
        mat.emissiveIntensity = 5.2;
      } else if (isSunset) {
        mat.emissive.setHex(0x00e5ff);
        mat.emissiveIntensity = 2.8;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0.0;
      }
      mat.needsUpdate = true;
    });

    // 5. Streetlight Ground Light Pools
    if (this.groundLightMaterial) {
      if (isNight) {
        this.groundLightMaterial.opacity = 0.95;
        this.groundLightMaterial.visible = true;
      } else if (isSunset) {
        this.groundLightMaterial.opacity = 0.55;
        this.groundLightMaterial.visible = true;
      } else {
        this.groundLightMaterial.opacity = 0.0;
        this.groundLightMaterial.visible = false;
      }
      this.groundLightMaterial.needsUpdate = true;
    }

    // 6. Ocean Water Surface
    if (this.oceanMaterial) {
      if (isNight) {
        this.oceanMaterial.color.setHex(0x040e24); // Deep midnight ocean
        this.oceanMaterial.roughness = 0.08;
        this.oceanMaterial.metalness = 0.45;
      } else if (isSunset) {
        this.oceanMaterial.color.setHex(0xb23b00); // Golden sunset waters
        this.oceanMaterial.roughness = 0.18;
        this.oceanMaterial.metalness = 0.35;
      } else {
        this.oceanMaterial.color.setHex(0x0077be); // Tropical crystal blue
        this.oceanMaterial.roughness = 0.12;
        this.oceanMaterial.metalness = 0.22;
      }
      this.oceanMaterial.needsUpdate = true;
    }

    // 7. Refresh Traffic Light active halos and emissive intensities for day/night
    if (this.currentSignalColor) {
      this.applyTrafficLightVisuals(this.currentSignalColor);
    }
  }

  /**
   * Continuous smooth blend for city materials as day turns to sunset and night:
   * - Building windows glow amber at sunset and radiant gold at night
   * - Streetlamp bulbs illuminate
   * - Billboards and neon signage turn on
   * - Ground streetlight light pools fade in
   * - Ocean water shifts from sparkling azure to sunset copper to deep midnight ink
   */
  public updateDayNightBlend(darkness: number, sunsetFactor: number) {
    const windowColorSunset = new THREE.Color(0xff9e44);
    const windowColorNight = new THREE.Color(0xffe488);
    const windowColor = windowColorSunset.clone().lerp(windowColorNight, darkness);
    const windowIntensity = Math.max(0.0, sunsetFactor * 1.8 + darkness * 4.2);

    for (let i = 0; i < this.windowMaterials.length; i++) {
      this.windowMaterials[i].emissive.copy(windowColor);
      this.windowMaterials[i].emissiveIntensity = windowIntensity;
    }

    const bulbIntensity = THREE.MathUtils.lerp(0.1, 6.5, Math.max(sunsetFactor * 0.45, darkness));
    const bulbColor = new THREE.Color(0xfff8c0).lerp(new THREE.Color(0xffb844), sunsetFactor);
    for (let i = 0; i < this.bulbMaterials.length; i++) {
      this.bulbMaterials[i].emissive.copy(bulbColor);
      this.bulbMaterials[i].emissiveIntensity = bulbIntensity;
    }

    const billboardIntensity = Math.max(0.0, sunsetFactor * 1.6 + darkness * 3.2);
    for (let i = 0; i < this.billboardMaterials.length; i++) {
      this.billboardMaterials[i].emissiveIntensity = billboardIntensity;
    }

    const textIntensity = Math.max(0.0, sunsetFactor * 2.8 + darkness * 5.2);
    for (let i = 0; i < this.scrollingTextMaterials.length; i++) {
      this.scrollingTextMaterials[i].emissiveIntensity = textIntensity;
    }

    if (this.groundLightMaterial) {
      const poolOpacity = Math.min(0.95, sunsetFactor * 0.55 + darkness * 0.95);
      this.groundLightMaterial.opacity = poolOpacity;
      this.groundLightMaterial.visible = poolOpacity > 0.02;
    }

    if (this.oceanMaterial) {
      const oceanDay = new THREE.Color(0x0077be);
      const oceanSunset = new THREE.Color(0xb23b00);
      const oceanNight = new THREE.Color(0x040e24);

      this.oceanMaterial.color.copy(oceanDay);
      this.oceanMaterial.color.lerp(oceanSunset, sunsetFactor);
      this.oceanMaterial.color.lerp(oceanNight, darkness);
      this.oceanMaterial.roughness = THREE.MathUtils.lerp(0.12, 0.08, darkness);
      this.oceanMaterial.metalness = THREE.MathUtils.lerp(0.22, 0.45, darkness);
    }
  }
}
