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

export class CityEnvironment {
  public scene: THREE.Scene;
  public cityRootGroup: THREE.Group;
  private lightingManager: LightingManager;

  // Static colliders extracted from Cartoon_City_Free.glb + boundary perimeter
  public baseColliders: THREE.Box3[] = [];
  public activeColliders: THREE.Box3[] = [];

  // Walkable meshes for raycast elevation & standing (buildings, roofs, roads, props)
  public walkableMeshes: THREE.Mesh[] = [];

  // Ocean & Coastal Seawall Environment
  private oceanMesh: THREE.Mesh | null = null;
  private oceanMaterial!: THREE.MeshStandardMaterial;
  private oceanTexture!: THREE.CanvasTexture;
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
  private trafficTimer: number = 0;
  private trafficState: 'green' | 'yellow' | 'red' = 'green';

  // Physical signal heads attached to every traffic light pole, driven by TrafficManager's cycle
  private signalHeads: { lamps: THREE.MeshStandardMaterial[]; glows: THREE.MeshBasicMaterial[]; servesZ: boolean }[] = [];
  private currentSignalColor: TrafficLightColor | null = null;
  private glowTexture: THREE.Texture | null = null;
  private static lampGeo = new THREE.SphereGeometry(0.13, 12, 10);
  private static glowGeo = new THREE.PlaneGeometry(0.6, 0.6);
  private static housingGeo = new THREE.BoxGeometry(0.32, 1.0, 0.3);
  private static housingMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7, metalness: 0.2 });

  constructor(scene: THREE.Scene, lightingManager: LightingManager) {
    this.scene = scene;
    this.lightingManager = lightingManager;
    this.cityRootGroup = new THREE.Group();
    this.scene.add(this.cityRootGroup);

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
    this.createCoastalSeawalls();
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
            if (name.startsWith('Car_') || name.startsWith('Van') || name.startsWith('Futuristic_Car')) {
              node.visible = false;
            }

            if ((node as THREE.Mesh).isMesh) {
              const mesh = node as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              if (node.visible) {
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
                  this.bulbMaterials.push(stdMat);
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
                // Sanity guard: no single building footprint is wider than a city block
                if (size.x > 0.4 && size.z > 0.4 && size.x < 70 && size.z < 70) {
                  // Special stepped terrace colliders for Eco_Building_Slope
                  if (name.includes('Eco_Building_Slope')) {
                    const tier1 = new THREE.Box3(
                      new THREE.Vector3(box.min.x, box.min.y, box.min.z),
                      new THREE.Vector3(box.max.x, box.min.y + 14.5, box.max.z)
                    );
                    const tier2 = new THREE.Box3(
                      new THREE.Vector3(box.min.x + 0.5, box.min.y + 14.5, box.min.z + 4.0),
                      new THREE.Vector3(box.max.x - 0.5, box.min.y + 28.5, box.max.z)
                    );
                    const tier3 = new THREE.Box3(
                      new THREE.Vector3(box.min.x + 1.0, box.min.y + 28.5, box.min.z + 10.0),
                      new THREE.Vector3(box.max.x - 1.0, box.min.y + 42.5, box.max.z)
                    );
                    const tier4 = new THREE.Box3(
                      new THREE.Vector3(box.min.x + 1.5, box.min.y + 42.5, box.min.z + 18.0),
                      new THREE.Vector3(box.max.x - 1.5, box.max.y, box.max.z)
                    );
                    this.baseColliders.push(tier1, tier2, tier3, tier4);
                  } else {
                    this.baseColliders.push(box);
                  }
                }
              }
            }

            // 3. Traffic Light Poles (vertical base pole solid collider) + working signal heads
            if (name.startsWith('traffic_light') && !name.includes('Bulb') && !name.includes('Line')) {
              node.updateMatrixWorld(true);
              const polePos = new THREE.Vector3();
              node.getWorldPosition(polePos);
              const poleBox = new THREE.Box3(
                new THREE.Vector3(polePos.x - 0.55, 0, polePos.z - 0.55),
                new THREE.Vector3(polePos.x + 0.55, 5.0, polePos.z + 0.55)
              );
              this.baseColliders.push(poleBox);
              this.attachSignalHead(node, polePos);
            }

            // 4. Streetlight Poles (vertical base pole solid collider)
            if (name.startsWith('Spotlight_01') || name.startsWith('Spotlight_02')) {
              node.updateMatrixWorld(true);
              const lightPos = new THREE.Vector3();
              node.getWorldPosition(lightPos);
              const lightBox = new THREE.Box3(
                new THREE.Vector3(lightPos.x - 0.45, 0, lightPos.z - 0.45),
                new THREE.Vector3(lightPos.x + 0.45, 5.0, lightPos.z + 0.45)
              );
              this.baseColliders.push(lightBox);
            }

            // 5. Palm Trees
            if (name.startsWith('Palm')) {
              node.updateMatrixWorld(true);
              const palmPos = new THREE.Vector3();
              node.getWorldPosition(palmPos);
              const palmBox = new THREE.Box3(
                new THREE.Vector3(palmPos.x - 0.45, 0, palmPos.z - 0.45),
                new THREE.Vector3(palmPos.x + 0.45, 5.0, palmPos.z + 0.45)
              );
              this.baseColliders.push(palmBox);
            }

            // 6. Billboards & Large Signboards
            if (name.startsWith('Billboard') && !name.includes('Line')) {
              node.updateMatrixWorld(true);
              const billPos = new THREE.Vector3();
              node.getWorldPosition(billPos);
              const billBox = new THREE.Box3(
                new THREE.Vector3(billPos.x - 0.55, 0, billPos.z - 0.55),
                new THREE.Vector3(billPos.x + 0.55, 5.0, billPos.z + 0.55)
              );
              this.baseColliders.push(billBox);
            }
          });

          // Add file-accurate city model directly to the scene at (0, 0, 0)
          this.cityRootGroup.add(cityModel);

          // Add perimeter boundary colliders aligned precisely with the coastal seawall retaining wall
          const boundX = 58.5 * CITY_SCALE;
          const boundZ = 73.5 * CITY_SCALE;
          this.baseColliders.push(
            new THREE.Box3(new THREE.Vector3(-boundX - 6, -2, -boundZ - 8), new THREE.Vector3(-boundX, 12.0, boundZ + 8)), // West seawall boundary
            new THREE.Box3(new THREE.Vector3(boundX, -2, -boundZ - 8), new THREE.Vector3(boundX + 6, 12.0, boundZ + 8)),   // East seawall boundary
            new THREE.Box3(new THREE.Vector3(-boundX - 8, -2, -boundZ - 6), new THREE.Vector3(boundX + 8, 12.0, -boundZ)), // South seawall boundary
            new THREE.Box3(new THREE.Vector3(-boundX - 8, -2, boundZ), new THREE.Vector3(boundX + 8, 12.0, boundZ + 6))   // North seawall boundary
          );

          this.activeColliders = [...this.baseColliders];

          // Apply initial Day/Night material settings
          this.setDayNightVisuals(this.currentMode);

          // Load extra 3D city props (Bus Stops, Fountains, Palms, Trash Cans) from /models/props
          this.loadCityProps(loader).finally(() => {
            this.activeColliders = [...this.baseColliders];
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

  private async loadCityProps(loader: GLTFLoader): Promise<void> {
    const propsGroup = new THREE.Group();
    propsGroup.name = 'City_Props_Pack';
    this.cityRootGroup.add(propsGroup);

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
        { x: -22.5, y: 0.1, z: -15.0, rotY: Math.PI / 2 },
        { x: -10.5, y: 0.1, z: 25.0, rotY: -Math.PI / 2 },
        { x: 14.5, y: 0.1, z: 85.0, rotY: -Math.PI / 2 },
        { x: 14.5, y: 0.1, z: -95.0, rotY: -Math.PI / 2 },
      ];

      for (const pos of busStopPositions) {
        const stop = busStopTemplate.clone(true);
        stop.position.set(pos.x, pos.y, pos.z);
        stop.rotation.y = pos.rotY;
        stop.updateMatrixWorld(true);
        stop.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) {
            this.walkableMeshes.push(c as THREE.Mesh);
          }
        });
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
      fountain.position.set(-31.5, 0.1, 75.5);
      fountain.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
          this.walkableMeshes.push(c as THREE.Mesh);
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
        palm.position.set(spot.x, 0.1, spot.z);
        palm.rotation.y = Math.random() * Math.PI * 2;
        palm.updateMatrixWorld(true);
        palm.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) this.walkableMeshes.push(c as THREE.Mesh);
        });
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
        { x: -12.0, z: 27.0 },
        { x: 13.0, z: 87.0 },
        { x: 13.0, z: -97.0 },
      ];
      for (const spot of trashSpots) {
        const bin = trashTemplate.clone(true);
        bin.position.set(spot.x, 0.1, spot.z);
        bin.updateMatrixWorld(true);
        bin.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) this.walkableMeshes.push(c as THREE.Mesh);
        });
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
   * The GLB signal is one mesh sharing a single "Emissive" material with every streetlight, so the
   * bulbs cannot be lit individually. Instead we mount a real three-lamp head at the end of the arm.
   */
  private attachSignalHead(node: THREE.Object3D, polePos: THREE.Vector3) {
    const box = new THREE.Box3().setFromObject(node);
    if (box.isEmpty()) return;
    const center = new THREE.Vector3();
    box.getCenter(center);

    // The arm reaches out from the pole base; the head hangs at its far end
    const armX = center.x - polePos.x;
    const armZ = center.z - polePos.z;
    const headX = polePos.x + armX * 1.7;
    const headZ = polePos.z + armZ * 1.7;
    const headY = box.max.y - 0.55;
    // An arm spanning east-west hangs over a north-south avenue -> it signals Z-axis traffic
    const servesZ = Math.abs(armX) >= Math.abs(armZ);

    if (!this.glowTexture) this.glowTexture = this.createLightPoolTexture();

    const group = new THREE.Group();
    group.position.set(headX, headY, headZ);
    group.rotation.y = servesZ ? 0 : Math.PI / 2;
    group.add(new THREE.Mesh(CityEnvironment.housingGeo, CityEnvironment.housingMat));

    const lamps: THREE.MeshStandardMaterial[] = [];
    const glows: THREE.MeshBasicMaterial[] = [];
    const colors = [0xff2a3c, 0xffb020, 0x22e07a]; // red, amber, green top->bottom
    colors.forEach((c, i) => {
      const lampMat = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.08, roughness: 0.3 });
      lamps.push(lampMat);
      // Lamps on both faces so traffic from either direction reads the signal
      for (const side of [1, -1]) {
        const lamp = new THREE.Mesh(CityEnvironment.lampGeo, lampMat);
        lamp.position.set(0, 0.32 - i * 0.32, side * 0.17);
        group.add(lamp);

        const glowMat = new THREE.MeshBasicMaterial({
          map: this.glowTexture!,
          color: c,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        glows.push(glowMat);
        const glow = new THREE.Mesh(CityEnvironment.glowGeo, glowMat);
        glow.position.set(0, 0.32 - i * 0.32, side * 0.3);
        if (side < 0) glow.rotation.y = Math.PI;
        group.add(glow);
      }
    });

    this.scene.add(group);
    this.signalHeads.push({ lamps, glows, servesZ });
  }

  /** Light the signal heads for the current global cycle (called every frame; cheap when unchanged). */
  public setTrafficLightState(color: TrafficLightColor) {
    if (color === this.currentSignalColor) return;
    this.currentSignalColor = color;
    const opposite: TrafficLightColor = color === 'green' ? 'red' : color === 'red' ? 'green' : 'yellow';
    for (const head of this.signalHeads) {
      const shown = head.servesZ ? color : opposite;
      const litIdx = shown === 'red' ? 0 : shown === 'yellow' ? 1 : 2;
      head.lamps.forEach((m, i) => {
        m.emissiveIntensity = i === litIdx ? 2.8 : 0.08;
      });
      head.glows.forEach((g, i) => {
        g.opacity = Math.floor(i / 2) === litIdx ? 0.55 : 0;
      });
    }
  }

  update(carPos: THREE.Vector3, delta: number, onPOIEnter?: (poi: POI) => void): POI | null {
    const dt = Math.min(delta, 0.1);

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

    // 3. Traffic Light Timer Cycle
    this.trafficTimer += dt;
    if (this.trafficTimer > 6.0) {
      this.trafficTimer = 0;
      this.trafficState = this.trafficState === 'green' ? 'yellow' : this.trafficState === 'yellow' ? 'red' : 'green';
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
