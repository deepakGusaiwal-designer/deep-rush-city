import * as THREE from 'three';
import { CITY_POIS } from '../data/vehicles';
import { CITY_SCALE } from './CityEnvironment';
import { BASE_AVENUES_X, BASE_STREETS_Z, LANE_OFFSET, TrafficManager, TrafficCar } from './TrafficManager';
import { RouteGuideManager } from './RouteGuideManager';
import { VehicleController } from './VehicleController';
import { WantedSystem } from './WantedSystem';
import { audioManager } from './AudioManager';
import { useGameStore } from '../store/useGameStore';
import { MissionDefinition, MapBlip, PlayerMode } from '../types/game';

const poiWorld = (id: string): THREE.Vector3 => {
  const poi = CITY_POIS.find((p) => p.id === id) ?? CITY_POIS[0];
  return new THREE.Vector3(poi.position[0] * CITY_SCALE, 0.25, poi.position[2] * CITY_SCALE);
};

const GARAGE = poiWorld('city-garage');
const TRANSIT = poiWorld('transit-hub');
const BANK = poiWorld('grand-bank');
const PLAZA = poiWorld('fountain-plaza');
const MARINA = poiWorld('ocean-marina');
export const HOSPITAL_POS = PLAZA.clone();
export const POLICE_STATION_POS = TRANSIT.clone();

export const MISSIONS: MissionDefinition[] = [
  {
    id: 'courier',
    type: 'delivery',
    title: 'Hot Wheels Courier',
    giver: 'Big Ray · Downtown Garage',
    description: 'Grab the crate at the garage and run it across town. Fragile cargo — keep the bodywork straight or the client walks.',
    reward: 450,
    difficulty: 1,
    icon: '📦',
    color: '#f59e0b',
    markerPos: [GARAGE.x, GARAGE.z],
  },
  {
    id: 'race',
    type: 'race',
    title: 'Neon Circuit',
    giver: 'Street racers · Transit Stop',
    description: 'Six checkpoints through downtown against the clock. Nitro is legal. Traffic is not your friend.',
    reward: 700,
    difficulty: 2,
    icon: '🏁',
    color: '#22d3ee',
    markerPos: [TRANSIT.x, TRANSIT.z],
  },
  {
    id: 'vigilante',
    type: 'vigilante',
    title: 'Street Justice',
    giver: 'Police scanner · Fountain Plaza',
    description: 'A stolen car is tearing through the city. Ram it until it stops. No stars for collateral — you are the good guy today.',
    reward: 600,
    difficulty: 2,
    icon: '🚨',
    color: '#ef4444',
    markerPos: [PLAZA.x, PLAZA.z],
  },
  {
    id: 'heist',
    type: 'heist',
    title: 'The Reserve Job',
    giver: 'The Crew · Metropolitan Reserve',
    description: 'Crack the vault at the Reserve Bank, then lose a three-star tail and make it to the Marina safehouse with the cash.',
    reward: 1500,
    difficulty: 3,
    icon: '💰',
    color: '#eab308',
    markerPos: [BANK.x, BANK.z],
  },
];

interface HiddenPackage {
  id: string;
  pos: THREE.Vector3;
  group: THREE.Group;
  collected: boolean;
}

type DeliveryPhase = 'pickup' | 'deliver';
type HeistPhase = 'goto_bank' | 'cracking' | 'escape';

/**
 * Story-style missions layered on top of the open world: courier runs, checkpoint races,
 * vigilante takedowns and a bank heist getaway — plus hidden packages scattered around town.
 */
export class MissionDirector {
  private scene: THREE.Scene;
  private vehicle: VehicleController;
  private traffic: TrafficManager;
  private wanted: WantedSystem;
  public routeGuide: RouteGuideManager;

  // World markers
  private markers: { def: MissionDefinition; group: THREE.Group; ring: THREE.Mesh; beam: THREE.Mesh }[] = [];
  private packages: HiddenPackage[] = [];

  // Target beacon (re-used across missions)
  private beacon: THREE.Group;
  private beaconRing: THREE.Mesh;
  private beaconBeam: THREE.Mesh;
  private suspectArrow: THREE.Mesh;

  // Active mission state
  public activeDef: MissionDefinition | null = null;
  private target: THREE.Vector3 | null = null;
  private timeRemaining: number = 0;
  private routeTimer: number = 0;

  private deliveryPhase: DeliveryPhase = 'pickup';
  private deliveryDrop = new THREE.Vector3();
  private deliveryStartHealth: number = 100;

  private raceCheckpoints: THREE.Vector3[] = [];
  private raceIndex: number = 0;

  private heistPhase: HeistPhase = 'goto_bank';
  private crackProgress: number = 0;

  private suspect: TrafficCar | null = null;

  public onMissionPassed: ((def: MissionDefinition, payout: number, summary: string) => void) | null = null;
  public onMissionFailed: ((def: MissionDefinition, reason: string) => void) | null = null;

  constructor(scene: THREE.Scene, vehicle: VehicleController, traffic: TrafficManager, wanted: WantedSystem) {
    this.scene = scene;
    this.vehicle = vehicle;
    this.traffic = traffic;
    this.wanted = wanted;
    this.routeGuide = new RouteGuideManager(scene);

    // Mission markers
    for (const def of MISSIONS) {
      const group = new THREE.Group();
      group.position.set(def.markerPos[0], 0.05, def.markerPos[1]);
      const col = new THREE.Color(def.color);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.9, 2.6, 40),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.06;
      group.add(ring);

      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 1.9, 7.0, 18, 1, true),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      beam.position.y = 3.5;
      group.add(beam);

      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: MissionDirector.makeIconTexture(def.icon, def.color), transparent: true, depthWrite: false }));
      sprite.scale.set(2.2, 2.2, 1);
      sprite.position.y = 4.2;
      group.add(sprite);

      scene.add(group);
      this.markers.push({ def, group, ring, beam });
    }

    // Reusable target beacon
    this.beacon = new THREE.Group();
    this.beacon.visible = false;
    this.beaconRing = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 3.4, 40),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    this.beaconRing.rotation.x = -Math.PI / 2;
    this.beaconRing.position.y = 0.08;
    this.beacon.add(this.beaconRing);
    this.beaconBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 12, 18, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.4, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.beaconBeam.position.y = 6;
    this.beacon.add(this.beaconBeam);
    scene.add(this.beacon);

    // Bobbing arrow above the vigilante suspect
    this.suspectArrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 1.0, 12),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.6 })
    );
    this.suspectArrow.rotation.x = Math.PI;
    this.suspectArrow.visible = false;
    scene.add(this.suspectArrow);

    this.createHiddenPackages();
  }

  private static makeIconTexture(icon: string, color: string): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(64, 64, 58, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(8, 12, 24, 0.85)';
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.font = '64px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, 64, 70);
    }
    return new THREE.CanvasTexture(canvas);
  }

  // ---------------------------------------------------------------------------
  // Hidden packages
  // ---------------------------------------------------------------------------

  private createHiddenPackages() {
    const curb = LANE_OFFSET + 3.2;
    const spots: [number, number][] = [];
    // Two per avenue (west/east curbs), two per street (north/south curbs) = 12
    const zPicks = [-120, -35, 40, 125];
    const xPicks = [-105, -30, 45, 110];
    BASE_AVENUES_X.forEach((ax, i) => {
      spots.push([ax - curb, zPicks[i % zPicks.length]]);
      spots.push([ax + curb, zPicks[(i + 2) % zPicks.length]]);
    });
    BASE_STREETS_Z.forEach((sz, i) => {
      spots.push([xPicks[i % xPicks.length], sz - curb]);
      spots.push([xPicks[(i + 2) % xPicks.length], sz + curb]);
    });

    const geo = new THREE.BoxGeometry(0.55, 0.4, 0.75);
    spots.forEach((s, idx) => {
      const group = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xf59e0b, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.3 });
      const box = new THREE.Mesh(geo, mat);
      box.position.y = 0.55;
      box.castShadow = true;
      group.add(box);
      const glow = new THREE.Mesh(
        new THREE.RingGeometry(0.6, 0.95, 24),
        new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.05;
      group.add(glow);
      group.position.set(s[0], 0, s[1]);
      this.scene.add(group);
      this.packages.push({ id: `pkg_${idx}`, pos: new THREE.Vector3(s[0], 0, s[1]), group, collected: false });
    });
  }

  public get totalPackages(): number {
    return this.packages.length;
  }

  // ---------------------------------------------------------------------------
  // Mission lifecycle
  // ---------------------------------------------------------------------------

  public getMarkerNear(pos: THREE.Vector3, radius: number = 3.2): MissionDefinition | null {
    for (const m of this.markers) {
      const d = Math.hypot(pos.x - m.group.position.x, pos.z - m.group.position.z);
      if (d < radius) return m.def;
    }
    return null;
  }

  public get isActive(): boolean {
    return this.activeDef !== null;
  }

  public startMission(id: string, playerPos: THREE.Vector3): boolean {
    const def = MISSIONS.find((m) => m.id === id);
    if (!def || this.activeDef) return false;

    const store = useGameStore.getState();
    this.activeDef = def;
    this.routeTimer = 0;
    this.beaconRing.material = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    (this.beaconBeam.material as THREE.MeshBasicMaterial).color.set(def.color);

    store.setActiveMission({
      id: def.id,
      type: def.type,
      status: 'active',
      title: def.title,
      objective: '',
      timeLimit: 0,
      timeRemaining: 0,
      progress: 0,
      progressMax: 0,
      reward: def.reward,
      targetPos: null,
      targetLabel: '',
      resultText: '',
    });

    switch (def.type) {
      case 'delivery': {
        this.deliveryPhase = 'pickup';
        this.deliveryStartHealth = this.vehicle.health;
        // Drop-off: a POI far from the garage
        const candidates = CITY_POIS.filter((p) => p.id !== 'city-garage' && Math.hypot(p.position[0] * CITY_SCALE - GARAGE.x, p.position[2] * CITY_SCALE - GARAGE.z) > 110);
        const dest = candidates[Math.floor(Math.random() * candidates.length)];
        this.deliveryDrop.set(dest.position[0] * CITY_SCALE, 0.05, dest.position[2] * CITY_SCALE);
        this.setTarget(GARAGE.clone(), playerPos, 'Pickup crate');
        this.timeRemaining = 0;
        store.setActiveMission({ objective: 'Drive to the garage and pick up the crate.', targetLabel: 'Downtown Garage' });
        break;
      }
      case 'race': {
        this.buildRaceCircuit();
        this.raceIndex = 0;
        this.timeRemaining = 105;
        this.setTarget(this.raceCheckpoints[0].clone(), playerPos, 'Checkpoint 1');
        store.setActiveMission({
          objective: 'Hit every checkpoint before the timer runs out.',
          timeLimit: this.timeRemaining,
          timeRemaining: this.timeRemaining,
          progress: 0,
          progressMax: this.raceCheckpoints.length,
        });
        break;
      }
      case 'vigilante': {
        const car = this.traffic.findNearestCar(playerPos, 35, 140) ?? this.traffic.findNearestCar(playerPos, 0, Infinity);
        if (!car) {
          this.activeDef = null;
          store.resetActiveMission();
          store.pushNotification('No suspect vehicle in range — try again later.', 'danger');
          return false;
        }
        this.suspect = car;
        this.traffic.setSuspect(car);
        this.suspectArrow.visible = true;
        this.timeRemaining = 120;
        this.setTarget(car.position.clone(), playerPos, 'Suspect');
        store.setActiveMission({
          objective: 'Ram the stolen car until it stops.',
          timeLimit: this.timeRemaining,
          timeRemaining: this.timeRemaining,
          progress: 0,
          progressMax: 100,
          targetLabel: 'Stolen vehicle',
        });
        break;
      }
      case 'heist': {
        this.heistPhase = 'goto_bank';
        this.crackProgress = 0;
        this.timeRemaining = 0;
        this.setTarget(BANK.clone(), playerPos, 'Reserve Bank');
        store.setActiveMission({ objective: 'Get to the Metropolitan Reserve Bank.', targetLabel: 'Metropolitan Reserve Bank' });
        break;
      }
    }

    audioManager.playMissionStart();
    store.pushNotification(`Mission started: ${def.title}`, 'info');
    return true;
  }

  private buildRaceCircuit() {
    // A loop around the central block using intersection corners nudged into the driving lane
    const ax = BASE_AVENUES_X;
    const sz = BASE_STREETS_Z;
    const L = LANE_OFFSET;
    this.raceCheckpoints = [
      new THREE.Vector3(ax[1] + L, 0.05, sz[1] - 40),
      new THREE.Vector3(ax[1] + L, 0.05, sz[2] - 12),
      new THREE.Vector3(ax[2] - L, 0.05, sz[2] - L),
      new THREE.Vector3(ax[2] - L, 0.05, sz[0] + 20),
      new THREE.Vector3(ax[0] + L, 0.05, sz[0] + L),
      new THREE.Vector3(ax[0] + L, 0.05, sz[1] + 30),
    ];
  }

  private setTarget(pos: THREE.Vector3, playerPos: THREE.Vector3, label: string) {
    this.target = pos;
    this.beacon.position.copy(pos);
    this.beacon.visible = true;
    this.routeGuide.setRoute(playerPos, pos, 'dropoff');
    const store = useGameStore.getState();
    store.setNavigationRoute(this.routeGuide.activeRoutePoints.map((p) => [p.x, p.z]));
    store.setActiveMission({ targetPos: [pos.x, pos.y, pos.z], targetLabel: label });
  }

  private clearTarget() {
    this.target = null;
    this.beacon.visible = false;
    this.routeGuide.hide();
    useGameStore.getState().setNavigationRoute([]);
  }

  public cancelMission(reason: string = 'Mission abandoned') {
    if (!this.activeDef) return;
    const def = this.activeDef;
    this.finish(false, reason, def);
  }

  /** Called by the engine when the player is busted or wasted. */
  public notifyPlayerDown(reason: string) {
    if (this.activeDef) this.cancelMission(reason);
  }

  private finish(passed: boolean, summary: string, def: MissionDefinition, payout: number = 0) {
    const store = useGameStore.getState();
    this.clearTarget();
    this.suspectArrow.visible = false;
    if (this.suspect) {
      this.traffic.setSuspect(null);
      this.suspect = null;
    }
    this.activeDef = null;

    store.setActiveMission({ status: passed ? 'passed' : 'failed', resultText: summary, targetPos: null });
    if (passed) {
      store.addCash(payout);
      store.bumpStat('missionsPassed');
      audioManager.playMissionPassed();
      if (this.onMissionPassed) this.onMissionPassed(def, payout, summary);
    } else {
      store.bumpStat('missionsFailed');
      audioManager.playMissionFailed();
      if (this.onMissionFailed) this.onMissionFailed(def, summary);
    }

    // Clear the banner after the splash has played
    window.setTimeout(() => {
      const s = useGameStore.getState();
      if (s.activeMission.status !== 'active') s.resetActiveMission();
    }, 4500);
  }

  // ---------------------------------------------------------------------------
  // Per-frame
  // ---------------------------------------------------------------------------

  update(dt: number, playerPos: THREE.Vector3, playerMode: PlayerMode, playerSpeedKmh: number) {
    const store = useGameStore.getState();
    const t = performance.now() * 0.001;

    // Marker & package idle animation
    for (const m of this.markers) {
      m.ring.rotation.z += dt * 0.8;
      (m.beam.material as THREE.MeshBasicMaterial).opacity = 0.16 + Math.sin(t * 2.2) * 0.06;
      m.group.visible = !this.activeDef || this.activeDef.id !== m.def.id;
    }
    for (const p of this.packages) {
      if (p.collected) continue;
      p.group.rotation.y += dt * 1.6;
      p.group.children[0].position.y = 0.55 + Math.sin(t * 3 + p.pos.x) * 0.08;
      const d = Math.hypot(playerPos.x - p.pos.x, playerPos.z - p.pos.z);
      if (d < 2.4 && playerPos.y < 2.0) this.collectPackage(p);
    }

    if (this.beacon.visible) {
      this.beaconRing.rotation.z -= dt * 1.4;
      this.beaconBeam.rotation.y += dt * 0.9;
    }

    if (!this.activeDef) return;
    const def = this.activeDef;

    this.routeGuide.update(dt, playerPos);

    // Timers
    if (this.timeRemaining > 0) {
      this.timeRemaining = Math.max(0, this.timeRemaining - dt);
      store.setActiveMission({ timeRemaining: this.timeRemaining });
      if (this.timeRemaining <= 0) {
        this.finish(false, 'Out of time.', def);
        return;
      }
    }

    const distToTarget = this.target ? Math.hypot(playerPos.x - this.target.x, playerPos.z - this.target.z) : Infinity;
    const stopped = playerSpeedKmh < 4;

    switch (def.type) {
      case 'delivery': {
        if (this.deliveryPhase === 'pickup') {
          if (distToTarget < 6.5 && stopped && playerMode === 'driving') {
            this.deliveryPhase = 'deliver';
            this.deliveryStartHealth = this.vehicle.health;
            const dist = this.deliveryDrop.distanceTo(playerPos);
            this.timeRemaining = Math.round(dist / 9.5) + 30;
            const destName = CITY_POIS.find((p) => Math.abs(p.position[0] * CITY_SCALE - this.deliveryDrop.x) < 1 && Math.abs(p.position[2] * CITY_SCALE - this.deliveryDrop.z) < 1)?.name ?? 'Drop-off';
            this.setTarget(this.deliveryDrop.clone(), playerPos, destName);
            store.setActiveMission({
              objective: `Deliver the crate to ${destName}. Don't wreck the cargo.`,
              timeLimit: this.timeRemaining,
              timeRemaining: this.timeRemaining,
              progress: 0,
              progressMax: 100,
            });
            audioManager.playCheckpoint();
            store.pushNotification('Crate loaded. Drive carefully!', 'info');
          }
        } else {
          const damageTaken = Math.max(0, this.deliveryStartHealth - this.vehicle.health);
          store.setActiveMission({ progress: Math.min(100, damageTaken), progressMax: 100 });
          if (damageTaken >= 55 || this.vehicle.isWrecked) {
            this.finish(false, 'Cargo destroyed in the crash.', def);
            return;
          }
          if (distToTarget < 7 && stopped && playerMode === 'driving') {
            const bonus = damageTaken < 12 ? 200 : damageTaken < 30 ? 80 : 0;
            const timeBonus = Math.round(this.timeRemaining * 2);
            const payout = def.reward + bonus + timeBonus;
            this.finish(true, `Delivered. ${bonus > 0 ? `Intact cargo bonus +$${bonus}. ` : ''}Time bonus +$${timeBonus}.`, def, payout);
            return;
          }
        }
        break;
      }

      case 'race': {
        if (distToTarget < 7.5) {
          this.raceIndex++;
          audioManager.playCheckpoint();
          if (this.raceIndex >= this.raceCheckpoints.length) {
            const timeBonus = Math.round(this.timeRemaining * 6);
            this.finish(true, `Circuit complete! Time bonus +$${timeBonus}.`, def, def.reward + timeBonus);
            return;
          }
          this.timeRemaining += 4; // small extension per gate
          this.setTarget(this.raceCheckpoints[this.raceIndex].clone(), playerPos, `Checkpoint ${this.raceIndex + 1}`);
          store.setActiveMission({
            progress: this.raceIndex,
            objective: `Checkpoint ${this.raceIndex + 1} of ${this.raceCheckpoints.length}`,
          });
        }
        break;
      }

      case 'vigilante': {
        const car = this.suspect;
        if (!car || !this.traffic.trafficCars.includes(car)) {
          this.finish(false, 'The suspect got away.', def);
          return;
        }
        // Follow the moving target
        this.target = car.position;
        this.beacon.position.copy(car.position);
        this.suspectArrow.position.set(car.position.x, 2.6 + Math.sin(t * 5) * 0.25, car.position.z);
        this.suspectArrow.rotation.y += dt * 3;
        this.routeTimer += dt;
        if (this.routeTimer > 2.5) {
          this.routeTimer = 0;
          this.routeGuide.setRoute(playerPos, car.position, 'dropoff');
          store.setNavigationRoute(this.routeGuide.activeRoutePoints.map((p) => [p.x, p.z]));
        }
        const damage = 100 - car.health;
        store.setActiveMission({
          progress: Math.round(damage),
          targetPos: [car.position.x, 0, car.position.z],
          objective: damage < 100 ? `Suspect vehicle integrity: ${Math.round(car.health)}%` : 'Suspect stopped!',
        });
        if (car.health <= 0) {
          const timeBonus = Math.round(this.timeRemaining * 3);
          this.finish(true, `Suspect taken down. Time bonus +$${timeBonus}.`, def, def.reward + timeBonus);
          return;
        }
        break;
      }

      case 'heist': {
        if (this.heistPhase === 'goto_bank') {
          if (distToTarget < 8) {
            this.heistPhase = 'cracking';
            this.crackProgress = 0;
            store.setActiveMission({ objective: 'Hold position — the crew is cracking the vault.', progress: 0, progressMax: 100 });
          }
        } else if (this.heistPhase === 'cracking') {
          if (distToTarget < 10) {
            this.crackProgress = Math.min(100, this.crackProgress + dt * 18);
          } else {
            this.crackProgress = Math.max(0, this.crackProgress - dt * 30);
          }
          store.setActiveMission({ progress: Math.round(this.crackProgress) });
          if (this.crackProgress >= 100) {
            this.heistPhase = 'escape';
            store.addCash(600);
            store.pushNotification('Vault emptied: +$600. ALARM TRIGGERED!', 'wanted');
            this.wanted.setMinimumStars(3);
            this.setTarget(MARINA.clone(), playerPos, 'Marina safehouse');
            store.setActiveMission({
              objective: 'Lose the cops and reach the Marina safehouse.',
              progress: 0,
              progressMax: 0,
            });
          }
        } else {
          const wantedLevel = this.wanted.level;
          if (distToTarget < 9) {
            if (wantedLevel === 0) {
              this.finish(true, 'Clean getaway. The crew is impressed.', def, def.reward);
              return;
            }
            store.setActiveMission({ objective: 'You are still hot — shake the cops before entering the safehouse!' });
          } else {
            store.setActiveMission({ objective: wantedLevel > 0 ? 'Lose the cops and reach the Marina safehouse.' : 'Heat is gone. Get to the safehouse.' });
          }
        }
        break;
      }
    }
  }

  private collectPackage(p: HiddenPackage) {
    p.collected = true;
    p.group.visible = false;
    const store = useGameStore.getState();
    store.collectPackage(p.id);
    store.addCash(100);
    store.bumpStat('packagesFound');
    audioManager.playPackagePickup();
    const found = this.packages.filter((x) => x.collected).length;
    store.pushNotification(`Hidden package ${found}/${this.packages.length} found (+$100)`, 'cash');
    if (found === this.packages.length) {
      store.addCash(2000);
      store.pushNotification('All hidden packages found! Bonus +$2000', 'success');
      audioManager.playMissionPassed();
    }
  }

  /** Blips for the minimap: markers, active target, nearby packages. */
  getBlips(playerPos: THREE.Vector3): MapBlip[] {
    const blips: MapBlip[] = [];
    for (const m of this.markers) {
      if (this.activeDef && this.activeDef.id === m.def.id) continue;
      blips.push({ x: m.group.position.x, z: m.group.position.z, kind: 'marker', color: m.def.color, label: m.def.icon });
    }
    if (this.activeDef && this.target) {
      blips.push({ x: this.target.x, z: this.target.z, kind: this.activeDef.type === 'vigilante' ? 'suspect' : 'mission', color: this.activeDef.color });
    }
    for (const p of this.packages) {
      if (p.collected) continue;
      if (Math.hypot(p.pos.x - playerPos.x, p.pos.z - playerPos.z) < 70) {
        blips.push({ x: p.pos.x, z: p.pos.z, kind: 'package', color: '#22c55e' });
      }
    }
    blips.push({ x: HOSPITAL_POS.x, z: HOSPITAL_POS.z, kind: 'hospital', color: '#f43f5e' });
    return blips;
  }

  dispose() {
    this.cancelMission();
    this.routeGuide.dispose();
    for (const m of this.markers) this.scene.remove(m.group);
    for (const p of this.packages) this.scene.remove(p.group);
    this.scene.remove(this.beacon);
    this.scene.remove(this.suspectArrow);
  }
}
