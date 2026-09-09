import * as THREE from 'three';
import { TrafficLightColor, PlayerMode } from '../types/game';
import { audioManager } from './AudioManager';
import { CITY_SCALE } from './CityEnvironment';
import { CityTextures } from './CityTextures';
import type { PlayerController } from '../player/PlayerController';

export type PedestrianState = 'walking' | 'waiting' | 'panic' | 'tumbling' | 'stagger';

export interface SidewalkSegment {
  id: string;
  axis: 'X' | 'Z'; // 'X' means corridor is fixed at X (pedestrian moves along Z). 'Z' means corridor is fixed at Z (pedestrian moves along X).
  coord: number;
  min: number;
  max: number;
  connectMin: string[];
  connectMax: string[];
}

const BASE_SIDEWALK_SEGMENTS: SidewalkSegment[] = [
  // --- Central Promenade Sidewalk (Near Player Spawn & Center Avenue) ---
  {
    id: 'center_promenade_w',
    axis: 'X',
    coord: -8.8,
    min: -61.5,
    max: 61.5,
    connectMin: ['b1_s', 'outer_s'],
    connectMax: ['b1_n', 'outer_n'],
  },
  {
    id: 'center_promenade_e',
    axis: 'X',
    coord: -4.5,
    min: -61.5,
    max: 61.5,
    connectMin: ['b1_s', 'outer_s'],
    connectMax: ['b1_n', 'outer_n'],
  },

  // --- Block 1 (South-West Block) ---
  {
    id: 'b1_w',
    axis: 'X',
    coord: -46.5,
    min: -61.5,
    max: 16.5,
    connectMin: ['b1_s'],
    connectMax: ['b1_n'],
  },
  {
    id: 'b1_e',
    axis: 'X',
    coord: 1.5,
    min: -61.5,
    max: 16.5,
    connectMin: ['b1_s'],
    connectMax: ['b1_n'],
  },
  {
    id: 'b1_s',
    axis: 'Z',
    coord: -61.5,
    min: -46.5,
    max: 1.5,
    connectMin: ['b1_w'],
    connectMax: ['b1_e'],
  },
  {
    id: 'b1_n',
    axis: 'Z',
    coord: 16.5,
    min: -46.5,
    max: 1.5,
    connectMin: ['b1_w'],
    connectMax: ['b1_e'],
  },

  // --- Block 2 (South-East Block) ---
  {
    id: 'b2_w',
    axis: 'X',
    coord: 13.5,
    min: -61.5,
    max: 16.5,
    connectMin: ['b2_s'],
    connectMax: ['b2_n'],
  },
  {
    id: 'b2_e',
    axis: 'X',
    coord: 46.5,
    min: -61.5,
    max: 16.5,
    connectMin: ['b2_s'],
    connectMax: ['b2_n'],
  },
  {
    id: 'b2_s',
    axis: 'Z',
    coord: -61.5,
    min: 13.5,
    max: 46.5,
    connectMin: ['b2_w'],
    connectMax: ['b2_e'],
  },
  {
    id: 'b2_n',
    axis: 'Z',
    coord: 16.5,
    min: 13.5,
    max: 46.5,
    connectMin: ['b2_w'],
    connectMax: ['b2_e'],
  },

  // --- Block 3 (North-West Block) ---
  {
    id: 'b3_w',
    axis: 'X',
    coord: -46.5,
    min: 28.5,
    max: 61.5,
    connectMin: ['b3_s'],
    connectMax: ['b3_n'],
  },
  {
    id: 'b3_e',
    axis: 'X',
    coord: 1.5,
    min: 28.5,
    max: 61.5,
    connectMin: ['b3_s'],
    connectMax: ['b3_n'],
  },
  {
    id: 'b3_s',
    axis: 'Z',
    coord: 28.5,
    min: -46.5,
    max: 1.5,
    connectMin: ['b3_w'],
    connectMax: ['b3_e'],
  },
  {
    id: 'b3_n',
    axis: 'Z',
    coord: 61.5,
    min: -46.5,
    max: 1.5,
    connectMin: ['b3_w'],
    connectMax: ['b3_e'],
  },

  // --- Block 4 (North-East Block) ---
  {
    id: 'b4_w',
    axis: 'X',
    coord: 13.5,
    min: 28.5,
    max: 61.5,
    connectMin: ['b4_s'],
    connectMax: ['b4_n'],
  },
  {
    id: 'b4_e',
    axis: 'X',
    coord: 46.5,
    min: 28.5,
    max: 61.5,
    connectMin: ['b4_s'],
    connectMax: ['b4_n'],
  },
  {
    id: 'b4_s',
    axis: 'Z',
    coord: 28.5,
    min: 13.5,
    max: 46.5,
    connectMin: ['b4_w'],
    connectMax: ['b4_e'],
  },
  {
    id: 'b4_n',
    axis: 'Z',
    coord: 61.5,
    min: 13.5,
    max: 46.5,
    connectMin: ['b4_w'],
    connectMax: ['b4_e'],
  },

  // --- Outer Perimeter Sidewalks (Oceanfront & City Sideways) ---
  {
    id: 'outer_w',
    axis: 'X',
    coord: -57.5,
    min: -73.0,
    max: 73.0,
    connectMin: ['outer_s'],
    connectMax: ['outer_n'],
  },
  {
    id: 'outer_e',
    axis: 'X',
    coord: 57.5,
    min: -73.0,
    max: 73.0,
    connectMin: ['outer_s'],
    connectMax: ['outer_n'],
  },
  {
    id: 'outer_s',
    axis: 'Z',
    coord: -73.0,
    min: -57.5,
    max: 57.5,
    connectMin: ['outer_w'],
    connectMax: ['outer_e'],
  },
  {
    id: 'outer_n',
    axis: 'Z',
    coord: 73.0,
    min: -57.5,
    max: 57.5,
    connectMin: ['outer_w'],
    connectMax: ['outer_e'],
  },
];

export const SIDEWALK_SEGMENTS: SidewalkSegment[] = BASE_SIDEWALK_SEGMENTS.map((s) => ({
  ...s,
  coord: s.coord * CITY_SCALE,
  min: s.min * CITY_SCALE,
  max: s.max * CITY_SCALE,
}));

export const SEGMENT_MAP = new Map<string, SidewalkSegment>(
  SIDEWALK_SEGMENTS.map((s) => [s.id, s])
);

export interface PedestrianNPC {
  id: number;
  root: THREE.Group;
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArmGroup: THREE.Group;
  rightArmGroup: THREE.Group;
  leftLegGroup: THREE.Group;
  rightLegGroup: THREE.Group;

  position: THREE.Vector3;
  velocity: THREE.Vector3;
  heading: number; // yaw in radians
  targetHeading: number;
  speed: number;
  baseSpeed: number;

  state: PedestrianState;
  stateTimer: number;

  // Animation
  walkCycle: number;
  animSpeed: number;

  // Tumbling / bounce dynamics
  tumbleVelocity: THREE.Vector3;
  tumbleRotVelocity: THREE.Vector3;
  staggerVelocity: THREE.Vector3;

  // Sidewalk Pathing (Strictly sideways, never main roads)
  currentSegmentId: string;
  currentAxis: 'X' | 'Z';
  direction: 1 | -1;
  corridorCoord: number; // fixed coordinate along the road (sidewalk X or Z)
  isJogger: boolean;
}

// Low-poly Color Palettes
const SKIN_COLORS = [0xf7d7c4, 0xe2b083, 0xa56839, 0xc88950, 0xffe2cc];
const SHIRT_COLORS = [
  0xf59e0b, 0x06b6d4, 0xec4899, 0x10b981, 0x8b5cf6, 0xef4444, 0x3b82f6,
  0x14b8a6, 0x6366f1, 0x84cc16, 0xe11d48, 0x38bdf8, 0xffffff, 0x1e293b,
];
const PANTS_COLORS = [0x1e3a8a, 0x2563eb, 0xd4a373, 0x1f2937, 0x475569, 0xf3f4f6];
const SHOE_COLORS = [0xffffff, 0x111111, 0xef4444, 0x3b82f6, 0xd97706];
const HAT_COLORS = [0xef4444, 0x10b981, 0x3b82f6, 0x111111, 0xf59e0b, 0x8b5cf6];

export class PedestrianManager {
  private scene: THREE.Scene;
  public pedestrians: PedestrianNPC[] = [];
  public maxPedestrians: number = 0;

  private nextId: number = 1;
  private soundCooldown: number = 0;

  // Gameplay hooks (wanted level etc.)
  public onPedestrianHitByCar: ((p: PedestrianNPC, carVel: THREE.Vector3) => void) | null = null;
  public onPedestrianTackled: ((p: PedestrianNPC) => void) | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  clearAll() {
    this.dispose();
  }

  init(initialCount: number = 0) {
    this.clearAll();
    this.maxPedestrians = initialCount;
    for (let i = 0; i < this.maxPedestrians; i++) {
      this.spawnPedestrian(new THREE.Vector3(0, 0, 0), true);
    }
  }

  setMaxPedestrians(count: number) {
    this.maxPedestrians = count;
    while (this.pedestrians.length > this.maxPedestrians) {
      const p = this.pedestrians.pop();
      if (p) {
        this.scene.remove(p.root);
        this.disposePedestrianMesh(p.root);
      }
    }
    while (this.pedestrians.length < this.maxPedestrians) {
      this.spawnPedestrian(new THREE.Vector3(0, 0, 0), false);
    }
  }

  // Create a stylized low-poly cartoon humanoid character
  private createPedestrianMesh(isJogger: boolean): {
    root: THREE.Group;
    torsoGroup: THREE.Group;
    headGroup: THREE.Group;
    leftArmGroup: THREE.Group;
    rightArmGroup: THREE.Group;
    leftLegGroup: THREE.Group;
    rightLegGroup: THREE.Group;
  } {
    const root = new THREE.Group();

    // Randomize archetype styles
    const skinCol = SKIN_COLORS[Math.floor(Math.random() * SKIN_COLORS.length)];
    const shirtCol = isJogger
      ? 0x22c55e // neon green athletic top
      : SHIRT_COLORS[Math.floor(Math.random() * SHIRT_COLORS.length)];
    const pantsCol = isJogger
      ? 0x0f172a // dark running shorts
      : PANTS_COLORS[Math.floor(Math.random() * PANTS_COLORS.length)];
    const shoeCol = SHOE_COLORS[Math.floor(Math.random() * SHOE_COLORS.length)];
    const hatCol = HAT_COLORS[Math.floor(Math.random() * HAT_COLORS.length)];

    const skinMat = new THREE.MeshStandardMaterial({ color: skinCol, roughness: 0.85, metalness: 0.05 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtCol, roughness: 0.85, metalness: 0.05 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pantsCol, roughness: 0.9, metalness: 0.05 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: shoeCol, roughness: 0.8, metalness: 0.1 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 });

    // 1. Torso Group
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, 0.84, 0);

    const torsoGeo = new THREE.BoxGeometry(0.44, 0.52, 0.26);
    const torsoMesh = new THREE.Mesh(torsoGeo, shirtMat);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    torsoGroup.add(torsoMesh);

    // Optional backpack (35% chance for citizens)
    if (!isJogger && Math.random() < 0.35) {
      const packGeo = new THREE.BoxGeometry(0.3, 0.36, 0.14);
      const packMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
      const packMesh = new THREE.Mesh(packGeo, packMat);
      packMesh.position.set(0, 0, -0.18);
      packMesh.castShadow = true;
      torsoGroup.add(packMesh);
    }

    // 2. Head Group
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.44, 0);

    const headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    headGroup.add(headMesh);

    // Eyes
    const eyeGeo = new THREE.BoxGeometry(0.05, 0.05, 0.02);
    const leftEye = new THREE.Mesh(eyeGeo, darkMat);
    leftEye.position.set(-0.08, 0.04, 0.155);
    const rightEye = new THREE.Mesh(eyeGeo, darkMat);
    rightEye.position.set(0.08, 0.04, 0.155);
    headGroup.add(leftEye);
    headGroup.add(rightEye);

    // Headwear: Cap / Headband / Hair
    if (isJogger) {
      // Running headband
      const bandGeo = new THREE.BoxGeometry(0.32, 0.08, 0.32);
      const bandMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.7 });
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.set(0, 0.08, 0);
      headGroup.add(band);
    } else {
      const hatType = Math.random();
      if (hatType < 0.45) {
        // Baseball cap with forward or backward brim
        const capGeo = new THREE.BoxGeometry(0.32, 0.12, 0.32);
        const capMat = new THREE.MeshStandardMaterial({ color: hatCol, roughness: 0.8 });
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.set(0, 0.14, 0);
        headGroup.add(cap);

        const visorGeo = new THREE.BoxGeometry(0.24, 0.025, 0.14);
        const visor = new THREE.Mesh(visorGeo, capMat);
        const isBackward = Math.random() < 0.35;
        visor.position.set(0, 0.1, isBackward ? -0.21 : 0.21);
        headGroup.add(visor);
      } else if (hatType < 0.8) {
        // Styled hair / beanie
        const hairGeo = new THREE.BoxGeometry(0.32, 0.14, 0.32);
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.9 });
        const hair = new THREE.Mesh(hairGeo, hairMat);
        hair.position.set(0, 0.14, -0.01);
        headGroup.add(hair);
      }
    }

    torsoGroup.add(headGroup);

    // 3. Arms (Pivot at shoulder)
    const armGeo = new THREE.BoxGeometry(0.12, 0.44, 0.12);
    armGeo.translate(0, -0.2, 0); // shift pivot to top shoulder

    const handGeo = new THREE.BoxGeometry(0.11, 0.12, 0.11);
    handGeo.translate(0, -0.4, 0);

    // Left Arm
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.3, 0.22, 0);
    const leftArmMesh = new THREE.Mesh(armGeo, shirtMat);
    const leftHandMesh = new THREE.Mesh(handGeo, skinMat);
    leftArmMesh.castShadow = true;
    leftHandMesh.castShadow = true;
    leftArmGroup.add(leftArmMesh);
    leftArmGroup.add(leftHandMesh);
    torsoGroup.add(leftArmGroup);

    // Right Arm
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.3, 0.22, 0);
    const rightArmMesh = new THREE.Mesh(armGeo, shirtMat);
    const rightHandMesh = new THREE.Mesh(handGeo, skinMat);
    rightArmMesh.castShadow = true;
    rightHandMesh.castShadow = true;
    rightArmGroup.add(rightArmMesh);
    rightArmGroup.add(rightHandMesh);

    // Smartphone accessory in right hand (40% chance for citizens)
    if (!isJogger && Math.random() < 0.4) {
      const phoneGeo = new THREE.BoxGeometry(0.06, 0.11, 0.015);
      const phoneMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });
      const phone = new THREE.Mesh(phoneGeo, phoneMat);
      phone.position.set(0, -0.42, 0.06);
      rightArmGroup.add(phone);
    }

    torsoGroup.add(rightArmGroup);
    root.add(torsoGroup);

    // 4. Legs (Pivot at hip)
    const legGeo = new THREE.BoxGeometry(0.16, 0.54, 0.16);
    legGeo.translate(0, -0.27, 0); // shift pivot to top hip

    // Foot sole reaches exactly y = 0.0 when root is at y = 0.0 (hip 0.65 - 0.58 - 0.07 = 0.00)
    const shoeGeo = new THREE.BoxGeometry(0.17, 0.14, 0.24);
    shoeGeo.translate(0, -0.58, 0.04); // foot slightly offset forward

    // Left Leg
    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-0.13, 0.65, 0);
    const leftLegMesh = new THREE.Mesh(legGeo, pantsMat);
    const leftShoeMesh = new THREE.Mesh(shoeGeo, shoeMat);
    leftLegMesh.castShadow = true;
    leftLegMesh.receiveShadow = true;
    leftShoeMesh.castShadow = true;
    leftShoeMesh.receiveShadow = true;
    leftLegGroup.add(leftLegMesh);
    leftLegGroup.add(leftShoeMesh);
    root.add(leftLegGroup);

    // Right Leg
    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(0.13, 0.65, 0);
    const rightLegMesh = new THREE.Mesh(legGeo, pantsMat);
    const rightShoeMesh = new THREE.Mesh(shoeGeo, shoeMat);
    rightLegMesh.castShadow = true;
    rightLegMesh.receiveShadow = true;
    rightShoeMesh.castShadow = true;
    rightShoeMesh.receiveShadow = true;
    rightLegGroup.add(rightLegMesh);
    rightLegGroup.add(rightShoeMesh);
    root.add(rightLegGroup);

    // Ground Contact Shadow Decal (soft ambient occlusion under feet)
    const shadowGeo = new THREE.PlaneGeometry(0.75, 0.7);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: CityTextures.getCharacterContactShadow(),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.set(0, 0.005, 0);
    shadowMesh.renderOrder = 2;
    root.add(shadowMesh);

    return {
      root,
      torsoGroup,
      headGroup,
      leftArmGroup,
      rightArmGroup,
      leftLegGroup,
      rightLegGroup,
    };
  }

  // Pick a valid sidewalk spawn coordinate on city sidewalk corridors
  private pickRandomSidewalkSpawn(nearPos?: THREE.Vector3): {
    segment: SidewalkSegment;
    position: THREE.Vector3;
    heading: number;
    direction: 1 | -1;
  } {
    let candidates = SIDEWALK_SEGMENTS;
    if (nearPos) {
      const closeCandidates = SIDEWALK_SEGMENTS.filter((seg) => {
        if (seg.axis === 'X') {
          return Math.abs(seg.coord - nearPos.x) < 65 * CITY_SCALE;
        } else {
          return Math.abs(seg.coord - nearPos.z) < 65 * CITY_SCALE;
        }
      });
      if (closeCandidates.length > 0) {
        candidates = closeCandidates;
      }
    }

    const seg = candidates[Math.floor(Math.random() * candidates.length)];
    const pad = Math.min(3.0, (seg.max - seg.min) * 0.15);
    const along = seg.min + pad + Math.random() * (seg.max - seg.min - pad * 2);
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;

    let posX = 0;
    let posZ = 0;
    let heading = 0;

    if (seg.axis === 'X') {
      posX = seg.coord;
      posZ = along;
      heading = dir === 1 ? 0 : Math.PI;
    } else {
      posX = along;
      posZ = seg.coord;
      heading = dir === 1 ? Math.PI / 2 : -Math.PI / 2;
    }

    return {
      segment: seg,
      position: new THREE.Vector3(posX, 0.0, posZ),
      heading,
      direction: dir,
    };
  }

  // Spawn an NPC pedestrian strictly on a sidewalk
  public spawnPedestrian(playerPos: THREE.Vector3, initial: boolean = false) {
    const isJogger = Math.random() < 0.2;
    const model = this.createPedestrianMesh(isJogger);
    const spawn = this.pickRandomSidewalkSpawn(initial ? undefined : playerPos);

    model.root.position.copy(spawn.position);
    model.root.rotation.set(0, spawn.heading, 0);
    this.scene.add(model.root);

    const baseSpeed = isJogger ? 2.5 + Math.random() * 0.6 : 1.15 + Math.random() * 0.4;

    const npc: PedestrianNPC = {
      id: this.nextId++,
      root: model.root,
      torsoGroup: model.torsoGroup,
      headGroup: model.headGroup,
      leftArmGroup: model.leftArmGroup,
      rightArmGroup: model.rightArmGroup,
      leftLegGroup: model.leftLegGroup,
      rightLegGroup: model.rightLegGroup,

      position: model.root.position,
      velocity: new THREE.Vector3(),
      heading: spawn.heading,
      targetHeading: spawn.heading,
      speed: baseSpeed,
      baseSpeed,

      state: 'walking',
      stateTimer: 0,
      walkCycle: Math.random() * Math.PI * 2,
      animSpeed: isJogger ? 8.5 : 4.8,

      tumbleVelocity: new THREE.Vector3(),
      tumbleRotVelocity: new THREE.Vector3(),
      staggerVelocity: new THREE.Vector3(),

      currentSegmentId: spawn.segment.id,
      currentAxis: spawn.segment.axis,
      direction: spawn.direction,
      corridorCoord: spawn.segment.coord,
      isJogger,
    };

    this.pedestrians.push(npc);
  }

  // Hero walks/bumps into pedestrian on foot -> realistic stagger and grumble (NO hands up!)
  public triggerHeroBump(p: PedestrianNPC, nx: number, nz: number) {
    if (p.state === 'tumbling' || p.state === 'stagger') return;

    p.state = 'stagger';
    p.stateTimer = 0.85;

    // Stumble backwards away from bump
    p.staggerVelocity.set(nx * 1.6, 0, nz * 1.6);

    // Audio grunt / "hey!"
    if (this.soundCooldown <= 0) {
      audioManager.playPedestrianGrunt();
      this.soundCooldown = 0.6;
    }
  }

  // Hero sprints into pedestrian at high speed -> knockback tumble/stumble
  public triggerHeroTackle(p: PedestrianNPC, heroVel: THREE.Vector3) {
    if (p.state === 'tumbling') return;

    p.state = 'tumbling';
    p.stateTimer = 0;

    const heroSpeed = heroVel.length();
    const dir = heroVel.clone().normalize();

    // Knockback along sprint direction
    p.tumbleVelocity.set(
      dir.x * (2.8 + heroSpeed * 0.25) + (Math.random() - 0.5) * 1.0,
      3.2 + Math.random() * 0.6,
      dir.z * (2.8 + heroSpeed * 0.25) + (Math.random() - 0.5) * 1.0
    );

    p.tumbleRotVelocity.set(
      (Math.random() - 0.5) * 8,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 6
    );

    audioManager.playTumbleImpact();
    if (this.soundCooldown <= 0) {
      audioManager.playPedestrianGrunt();
      this.soundCooldown = 0.8;
    }
    if (this.onPedestrianTackled) this.onPedestrianTackled(p);
  }

  // Trigger comical tumble when hit by car
  public triggerHit(p: PedestrianNPC, carVel: THREE.Vector3) {
    if (p.state === 'tumbling') return;

    p.state = 'tumbling';
    p.stateTimer = 0;

    // Launch into cartoon flip
    const carSpeed = carVel.length();
    const impactDir = carVel.clone().normalize();
    p.tumbleVelocity.set(
      impactDir.x * (3.0 + carSpeed * 0.25) + (Math.random() - 0.5) * 2,
      4.8 + Math.random() * 1.5, // Upward bounce
      impactDir.z * (3.0 + carSpeed * 0.25) + (Math.random() - 0.5) * 2
    );

    p.tumbleRotVelocity.set(
      (Math.random() - 0.5) * 12,
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 10
    );

    audioManager.playCartoonBoing();
    if (this.onPedestrianHitByCar) this.onPedestrianHitByCar(p, carVel);
  }

  // Trigger panic / dodge when a vehicle comes too close or honks
  public triggerPanic(p: PedestrianNPC, carPos: THREE.Vector3) {
    if (p.state === 'panic' || p.state === 'tumbling') return;

    p.state = 'panic';
    p.stateTimer = 1.6;

    // Sidestep away from car
    const away = p.position.clone().sub(carPos);
    away.y = 0;
    if (away.lengthSq() > 0.01) {
      away.normalize();
      p.velocity.copy(away).multiplyScalar(2.6);
    }

    if (this.soundCooldown <= 0) {
      audioManager.playPedestrianGasp();
      this.soundCooldown = 0.8;
    }
  }

  // Main update loop
  update(
    activePos: THREE.Vector3,
    activeVel: THREE.Vector3,
    isHornPressed: boolean,
    delta: number,
    trafficLight: TrafficLightColor,
    playerMode: PlayerMode = 'driving',
    playerController?: PlayerController
  ) {
    if (this.pedestrians.length === 0) return;

    const dt = Math.min(delta, 0.1);
    this.soundCooldown = Math.max(0, this.soundCooldown - dt);

    for (let i = 0; i < this.pedestrians.length; i++) {
      const p = this.pedestrians[i];

      // Distance to active player (vehicle or hero)
      const dx = p.position.x - activePos.x;
      const dz = p.position.z - activePos.z;
      const distToPlayer = Math.hypot(dx, dz);

      // 1. Despawn & Recycle distant pedestrians
      if (distToPlayer > 78.0 * CITY_SCALE) {
        const spawn = this.pickRandomSidewalkSpawn(activePos);
        p.currentSegmentId = spawn.segment.id;
        p.currentAxis = spawn.segment.axis;
        p.direction = spawn.direction;
        p.corridorCoord = spawn.segment.coord;
        p.position.copy(spawn.position);
        p.heading = spawn.heading;
        p.targetHeading = spawn.heading;
        p.root.rotation.set(0, spawn.heading, 0);
        p.state = 'walking';
        p.stateTimer = 0;
        continue;
      }

      // 2. Interaction & Collision Logic
      if (playerMode === 'on_foot') {
        // --- HERO ON FOOT INTERACTION --- (skipped while the hero is airborne on the jetpack)
        if (p.state !== 'tumbling' && activePos.y < 1.2) {
          // A. Solid Body Collision Check (Radius 0.38 + 0.38 = 0.76m)
          if (distToPlayer < 0.76) {
            const overlap = 0.76 - distToPlayer;
            const nx = distToPlayer > 0.001 ? dx / distToPlayer : 1;
            const nz = distToPlayer > 0.001 ? dz / distToPlayer : 0;

            // Push pedestrian back away from hero
            p.position.x += nx * overlap * 0.55;
            p.position.z += nz * overlap * 0.55;

            // Push hero back away from pedestrian (solid obstacle)
            if (playerController) {
              playerController.position.x -= nx * overlap * 0.45;
              playerController.position.z -= nz * overlap * 0.45;
            }

            // Trigger stumble or tackle reaction (NO hands up!)
            const heroSpeed = Math.hypot(activeVel.x, activeVel.z);
            if (heroSpeed > 5.0) {
              this.triggerHeroTackle(p, activeVel);
              if (playerController) {
                playerController.velocity.multiplyScalar(0.45);
              }
            } else if (p.state !== 'stagger') {
              this.triggerHeroBump(p, nx, nz);
            }
          }
          // B. Passing by / Crossing paths (Distance between 0.76m and 2.8m)
          else if (distToPlayer < 2.8) {
            // Casually glance towards hero as they cross paths (NO hands up!)
            const angleToHero = Math.atan2(-dx, -dz) - p.heading;
            let wrapped = angleToHero;
            while (wrapped < -Math.PI) wrapped += Math.PI * 2;
            while (wrapped > Math.PI) wrapped -= Math.PI * 2;
            if (Math.abs(wrapped) < 1.8) {
              p.headGroup.rotation.y = THREE.MathUtils.clamp(wrapped * 0.45, -0.6, 0.6);
            }

            // If walking closely head-on, politely steer slightly sideways to make room
            if (distToPlayer < 1.5 && p.state === 'walking') {
              const lateralDir = (dx * Math.cos(p.heading) - dz * Math.sin(p.heading)) > 0 ? 1 : -1;
              p.position.x += Math.cos(p.heading) * lateralDir * dt * 0.35;
              p.position.z -= Math.sin(p.heading) * lateralDir * dt * 0.35;
            }
          } else {
            // Neutral head posture when hero is not close
            p.headGroup.rotation.y *= 0.9;
          }
        }
      } else {
        // --- DRIVING VEHICLE INTERACTION ---
        if (p.state !== 'tumbling') {
          const carSpeedKmh = activeVel.length() * 3.6;

          // Vehicle impact check: car hits pedestrian
          if (distToPlayer < 1.85 && carSpeedKmh > 4.5) {
            this.triggerHit(p, activeVel);
          } else if (
            (isHornPressed && distToPlayer < 16.0) ||
            (distToPlayer < 4.2 && carSpeedKmh > 18.0)
          ) {
            this.triggerPanic(p, activePos);
          }
        }
      }

      // 3. State Behavior
      if (p.state === 'tumbling') {
        // Tumbling physics arc
        p.position.addScaledVector(p.tumbleVelocity, dt);
        p.tumbleVelocity.y -= 14.0 * dt; // gravity
        p.tumbleVelocity.x *= 0.96;
        p.tumbleVelocity.z *= 0.96;

        p.root.rotation.x += p.tumbleRotVelocity.x * dt;
        p.root.rotation.y += p.tumbleRotVelocity.y * dt;
        p.root.rotation.z += p.tumbleRotVelocity.z * dt;

        // Limbs flail in tumble
        p.leftArmGroup.rotation.x = Math.sin(p.stateTimer * 16) * 1.8;
        p.rightArmGroup.rotation.x = Math.cos(p.stateTimer * 16) * 1.8;
        p.leftLegGroup.rotation.x = Math.cos(p.stateTimer * 14) * 1.2;
        p.rightLegGroup.rotation.x = Math.sin(p.stateTimer * 14) * 1.2;

        p.stateTimer += dt;

        // Ground landing recovery
        if (p.position.y <= 0.0 && p.tumbleVelocity.y < 0) {
          p.position.y = 0.0;
          p.tumbleVelocity.set(0, 0, 0);
          p.root.rotation.set(0, p.heading, 0);
          p.state = 'waiting';
          p.stateTimer = 1.2; // brief moment to dust off
          if (p.currentAxis === 'X') {
            p.position.x = p.corridorCoord;
          } else {
            p.position.z = p.corridorCoord;
          }
        }
      } else if (p.state === 'stagger') {
        // Physical stagger back with friction
        p.staggerVelocity.y = 0;
        p.position.addScaledVector(p.staggerVelocity, dt);
        p.position.y = 0.0;
        p.staggerVelocity.multiplyScalar(0.88);

        // Keep smoothly pulled towards sidewalk corridor
        if (p.currentAxis === 'X') {
          p.position.x += (p.corridorCoord - p.position.x) * Math.min(dt * 3.0, 1.0);
        } else {
          p.position.z += (p.corridorCoord - p.position.z) * Math.min(dt * 3.0, 1.0);
        }

        // Stumble step animation:
        p.walkCycle += dt * 8.0;

        // Torso reclines back from the bump
        p.torsoGroup.rotation.x = -0.22;
        p.torsoGroup.position.y = 0.82 + Math.sin(p.walkCycle) * 0.02;

        // Natural defensive / balance recovery arms (NOT hands straight up!)
        p.leftArmGroup.rotation.x = -0.55 + Math.sin(p.walkCycle) * 0.15;
        p.rightArmGroup.rotation.x = -0.7 + Math.cos(p.walkCycle) * 0.15;
        p.leftArmGroup.rotation.z = 0.35;
        p.rightArmGroup.rotation.z = -0.35;

        // Legs take small stutter backsteps
        p.leftLegGroup.rotation.x = Math.sin(p.walkCycle) * 0.35;
        p.rightLegGroup.rotation.x = -Math.sin(p.walkCycle) * 0.35;

        p.stateTimer -= dt;
        if (p.stateTimer <= 0) {
          p.state = 'walking';
          p.torsoGroup.rotation.x = 0;
          p.leftArmGroup.rotation.z = 0;
          p.rightArmGroup.rotation.z = 0;
        }
      } else if (p.state === 'panic') {
        // Hurry away from vehicle danger
        p.position.addScaledVector(p.velocity, dt);
        p.velocity.multiplyScalar(0.92);

        // Keep smoothly pulled towards sidewalk corridor
        if (p.currentAxis === 'X') {
          p.position.x += (p.corridorCoord - p.position.x) * Math.min(dt * 4.0, 1.0);
        } else {
          p.position.z += (p.corridorCoord - p.position.z) * Math.min(dt * 4.0, 1.0);
        }

        p.walkCycle += p.animSpeed * 1.8 * dt;

        // Urgent athletic sprint (arms pump in running motion, leaning forward - NO hands up!)
        p.leftArmGroup.rotation.x = Math.sin(p.walkCycle) * 1.05;
        p.rightArmGroup.rotation.x = -Math.sin(p.walkCycle) * 1.05;
        p.leftArmGroup.rotation.z = 0.15;
        p.rightArmGroup.rotation.z = -0.15;
        p.leftLegGroup.rotation.x = Math.sin(p.walkCycle) * 0.75;
        p.rightLegGroup.rotation.x = -Math.sin(p.walkCycle) * 0.75;
        p.torsoGroup.position.y = 0.84 + Math.abs(Math.sin(p.walkCycle)) * 0.08;
        p.torsoGroup.rotation.x = 0.26; // forward athletic sprint lean

        p.stateTimer -= dt;
        if (p.stateTimer <= 0) {
          p.state = 'walking';
          p.torsoGroup.rotation.x = 0;
          p.leftArmGroup.rotation.z = 0;
          p.rightArmGroup.rotation.z = 0;
        }
      } else if (p.state === 'waiting') {
        // Idle on sidewalk / waiting
        p.walkCycle += dt * 2.0;

        // Gentle breathing bob
        p.torsoGroup.position.y = 0.84 + Math.sin(p.walkCycle) * 0.015;
        p.leftArmGroup.rotation.x = Math.sin(p.walkCycle) * 0.08;
        p.rightArmGroup.rotation.x = -1.1 + Math.sin(p.walkCycle) * 0.08; // checking phone / looking
        p.leftLegGroup.rotation.x = 0;
        p.rightLegGroup.rotation.x = 0;
        p.headGroup.rotation.y = Math.sin(p.walkCycle * 0.6) * 0.3; // look around

        p.stateTimer -= dt;
        if (p.stateTimer <= 0) {
          p.state = 'walking';
          p.headGroup.rotation.y = 0;
        }
      } else {
        // Normal Walking strictly along sidewalk
        p.walkCycle += p.animSpeed * dt;

        const moveDist = p.speed * dt;
        const seg = SEGMENT_MAP.get(p.currentSegmentId);

        if (p.currentAxis === 'X') {
          // Moving along Z axis
          p.position.z += p.direction * moveDist;
          // Smoothly clamp aligned to sidewalk line
          p.position.x += (p.corridorCoord - p.position.x) * Math.min(dt * 6.0, 1.0);

          if (seg) {
            if (p.direction === 1 && p.position.z >= seg.max) {
              p.position.z = seg.max;
              this.handleCornerArrival(p, seg, true);
            } else if (p.direction === -1 && p.position.z <= seg.min) {
              p.position.z = seg.min;
              this.handleCornerArrival(p, seg, false);
            }
          }
        } else {
          // Moving along X axis
          p.position.x += p.direction * moveDist;
          // Smoothly clamp aligned to sidewalk line
          p.position.z += (p.corridorCoord - p.position.z) * Math.min(dt * 6.0, 1.0);

          if (seg) {
            if (p.direction === 1 && p.position.x >= seg.max) {
              p.position.x = seg.max;
              this.handleCornerArrival(p, seg, true);
            } else if (p.direction === -1 && p.position.x <= seg.min) {
              p.position.x = seg.min;
              this.handleCornerArrival(p, seg, false);
            }
          }
        }

        // Procedural bipedal gait
        const legSwing = Math.sin(p.walkCycle) * (p.isJogger ? 0.75 : 0.55);
        const armSwing = Math.sin(p.walkCycle) * (p.isJogger ? 0.65 : 0.45);

        p.leftLegGroup.rotation.x = legSwing;
        p.rightLegGroup.rotation.x = -legSwing;

        p.leftArmGroup.rotation.x = -armSwing;
        p.rightArmGroup.rotation.x = armSwing;

        // Torso vertical bounce and slight hip sway
        const bounceFreq = p.walkCycle * 2;
        p.torsoGroup.position.y = 0.84 + Math.sin(bounceFreq) * (p.isJogger ? 0.06 : 0.035);
        p.torsoGroup.rotation.z = Math.sin(p.walkCycle) * 0.03;

        // Jogger forward lean
        if (p.isJogger) {
          p.torsoGroup.rotation.x = 0.12;
        }

        // Smooth rotation to target heading (wrap around +/- PI)
        let diff = p.targetHeading - p.heading;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        p.heading += diff * Math.min(dt * 6.0, 1.0);
        p.root.rotation.set(0, p.heading, 0);
      }
    }
  }

  // Handle pedestrian decision when reaching a sidewalk corner/intersection
  private handleCornerArrival(p: PedestrianNPC, seg: SidewalkSegment, isMax: boolean) {
    const connections = isMax ? seg.connectMax : seg.connectMin;
    const roll = Math.random();

    if (roll < 0.22) {
      // 1. Idle / pause at the sidewalk corner for a moment (check phone, admire view)
      p.state = 'waiting';
      p.stateTimer = 2.0 + Math.random() * 2.5;

      if (connections.length > 0 && Math.random() < 0.75) {
        const nextId = connections[Math.floor(Math.random() * connections.length)];
        this.switchSegment(p, nextId);
      } else {
        p.direction = (p.direction === 1 ? -1 : 1);
        this.updateTargetHeading(p);
      }
    } else if (connections.length > 0 && roll < 0.88) {
      // 2. Turn corner onto connecting perpendicular sidewalk!
      const nextId = connections[Math.floor(Math.random() * connections.length)];
      this.switchSegment(p, nextId);
    } else {
      // 3. Turn around and walk back along the same sidewalk
      p.direction = (p.direction === 1 ? -1 : 1);
      this.updateTargetHeading(p);
    }
  }

  // Switch pedestrian onto an adjacent sidewalk segment at a corner
  private switchSegment(p: PedestrianNPC, nextSegId: string) {
    const nextSeg = SEGMENT_MAP.get(nextSegId);
    if (!nextSeg) return;

    p.currentSegmentId = nextSeg.id;
    p.currentAxis = nextSeg.axis;
    p.corridorCoord = nextSeg.coord;

    if (nextSeg.axis === 'X') {
      // New movement is along Z (corridor is X)
      p.position.x = nextSeg.coord;
      const distToMin = Math.abs(p.position.z - nextSeg.min);
      const distToMax = Math.abs(p.position.z - nextSeg.max);
      if (distToMin < distToMax) {
        p.position.z = nextSeg.min + 0.15;
        p.direction = 1;
      } else {
        p.position.z = nextSeg.max - 0.15;
        p.direction = -1;
      }
    } else {
      // New movement is along X (corridor is Z)
      p.position.z = nextSeg.coord;
      const distToMin = Math.abs(p.position.x - nextSeg.min);
      const distToMax = Math.abs(p.position.x - nextSeg.max);
      if (distToMin < distToMax) {
        p.position.x = nextSeg.min + 0.15;
        p.direction = 1;
      } else {
        p.position.x = nextSeg.max - 0.15;
        p.direction = -1;
      }
    }

    this.updateTargetHeading(p);
  }

  private updateTargetHeading(p: PedestrianNPC) {
    if (p.currentAxis === 'X') {
      p.targetHeading = p.direction === 1 ? 0 : Math.PI;
    } else {
      p.targetHeading = p.direction === 1 ? Math.PI / 2 : -Math.PI / 2;
    }
  }

  private disposePedestrianMesh(obj: THREE.Object3D) {
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      }
    });
  }

  dispose() {
    this.pedestrians.forEach((p) => {
      this.scene.remove(p.root);
      this.disposePedestrianMesh(p.root);
    });
    this.pedestrians = [];
  }
}
