import * as THREE from 'three';
import { VehicleController, DEFAULT_SPAWN_POS } from './VehicleController';
import { CityEnvironment } from './CityEnvironment';

export const PROTAGONIST_SPAWN_POS = new THREE.Vector3(2.2, 0.02, 5.0);
import { FollowCamera } from './FollowCamera';
import { LightingManager } from './LightingManager';
import { DynamicSky } from './DynamicSky';
import { audioManager } from './AudioManager';
import { TrafficManager } from './TrafficManager';
import { ImpactEffects } from './ImpactEffects';
import { SmokeEffects } from './SmokeEffects';
import { TireEffectsManager } from './TireEffectsManager';
import { BloodEffects } from './BloodEffects';
import { PedestrianManager } from './PedestrianManager';
import { MissionManager } from './MissionManager';
import { MissionDirector, HOSPITAL_POS, POLICE_STATION_POS } from './MissionDirector';
import { WantedSystem } from './WantedSystem';
import { PoliceManager } from './PoliceManager';
import { PlayerCharacter } from '../player/PlayerCharacter';
import { PlayerController } from '../player/PlayerController';
import { PlayerMode } from '../player/PlayerState';
import { VehicleInteraction } from './VehicleInteraction';
import { useGameStore } from '../store/useGameStore';
import { VehicleModelId, GraphicsQuality, DayNightMode, PlayerControls, MapBlip, HeadlightMode } from '../types/game';
import { MultiplayerClient } from './multiplayer/MultiplayerClient';
import { RemotePlayerManager } from './multiplayer/RemotePlayerManager';
import { CarMeetManager } from './multiplayer/CarMeetManager';
import { ChatMessage, CarMeetInspectData } from './multiplayer/MultiplayerTypes';

/** Thrown when the browser cannot provide a WebGL context (GPU disabled / blocklisted). */
export class WebGLUnavailableError extends Error {
  constructor(public readonly detail: string) {
    super('WebGL is unavailable in this browser: ' + detail);
    this.name = 'WebGLUnavailableError';
  }
}

/**
 * Create the renderer, retrying with conservative options. A machine with hardware
 * acceleration switched off can still refuse everything — surface that as a typed error
 * instead of an uncaught exception inside React.
 */
function createRenderer(): THREE.WebGLRenderer {
  // Quick capability probe with a clear reason
  const probe = document.createElement('canvas');
  const probeCtx = probe.getContext('webgl2') || probe.getContext('webgl') || probe.getContext('experimental-webgl');
  if (!probeCtx) {
    throw new WebGLUnavailableError(
      'the browser returned no WebGL context. Hardware acceleration is probably disabled or the GPU is blocklisted.'
    );
  }
  // Release the probe context so it does not count against the browser's live-context cap
  const lose = (probeCtx as WebGLRenderingContext).getExtension('WEBGL_lose_context');
  lose?.loseContext();

  const attempts: THREE.WebGLRendererParameters[] = [
    { powerPreference: 'high-performance', antialias: true, alpha: false },
    { powerPreference: 'default', antialias: false, alpha: false, failIfMajorPerformanceCaveat: false },
  ];
  let lastError: unknown = null;
  for (const params of attempts) {
    try {
      return new THREE.WebGLRenderer(params);
    } catch (err) {
      lastError = err;
    }
  }
  throw new WebGLUnavailableError(lastError instanceof Error ? lastError.message : String(lastError));
}

export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    ('ontouchstart' in window && window.innerWidth < 1024) ||
    (typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 0 && window.innerWidth < 1024)
  );
};

const EMPTY_CONTROLS: PlayerControls = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  handbrake: false,
  horn: false,
  boost: false,
  interact: false,
  descend: false,
  analogX: 0,
  analogY: 0,
};

export class CityGameEngine {
  private container: HTMLElement;
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public cameraSystem: FollowCamera;
  public lightingManager: LightingManager;
  public dynamicSky: DynamicSky;
  public vehicleController: VehicleController;
  public cityEnv: CityEnvironment;
  public trafficManager: TrafficManager;
  public pedestrianManager: PedestrianManager;
  public missionManager: MissionManager;
  public impactEffects: ImpactEffects;
  public smokeEffects: SmokeEffects;
  public tireEffects: TireEffectsManager;
  public bloodEffects: BloodEffects;

  // GTA systems
  public wanted: WantedSystem;
  public police: PoliceManager;
  public missions: MissionDirector;

  // Third-person Protagonist & GTA gameplay systems
  public playerCharacter: PlayerCharacter;
  public playerController: PlayerController;
  public vehicleInteraction: VehicleInteraction;
  public playerMode: PlayerMode = 'on_foot';

  // Multiplayer & Car Meet Systems
  public multiplayerClient: MultiplayerClient;
  public remotePlayerManager: RemotePlayerManager;
  public carMeetManager: CarMeetManager;
  public chatMessages: ChatMessage[] = [];
  public inspectedCarData: CarMeetInspectData | null = null;
  public onChatMessagesChanged?: (messages: ChatMessage[]) => void;
  public onInspectedCarChanged?: (data: CarMeetInspectData | null) => void;
  public onMultiplayerConnectionChanged?: (connected: boolean, count: number) => void;

  // Vitals
  private health: number = 100;
  private armor: number = 0;
  private regenTimer: number = 0;
  private isDown: boolean = false;
  private downKind: 'wasted' | 'busted' | null = null;
  private downTimer: number = 0;
  private blipTimer: number = 0;
  private telemetryTimer: number = 0;
  private wreckCameraTimer: number = 0;

  private clock: THREE.Clock;
  private isRunning: boolean = false;
  private isDisposed: boolean = false;
  private animationFrameId: number | null = null;
  private lastDayNightMode: DayNightMode | null = null;
  private lastHeadlightMode: HeadlightMode | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.clock = new THREE.Clock();

    // 1. Scene setup
    this.scene = new THREE.Scene();

    // 2. WebGL Renderer (throws WebGLUnavailableError if the browser has no GPU access)
    this.renderer = createRenderer();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    const isMobile = isMobileDevice();
    const maxDpr = isMobile ? 1.35 : 2.0;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDpr));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // 3. Camera, Dynamic Sky & Lighting
    this.cameraSystem = new FollowCamera(60, container.clientWidth / container.clientHeight);
    this.lightingManager = new LightingManager(this.scene);
    this.dynamicSky = new DynamicSky(this.scene);

    // 4. Vehicle & Environment
    this.vehicleController = new VehicleController('Car_06');
    this.scene.add(this.vehicleController.rootGroup);
    this.lightingManager.attachVehicleLights(
      this.vehicleController.lightsGroup,
      this.vehicleController.trackWidth * 0.42,
      this.vehicleController.wheelBase + 0.72,
      -this.vehicleController.wheelBase - 0.72
    );

    this.cityEnv = new CityEnvironment(this.scene, this.lightingManager);
    this.trafficManager = new TrafficManager(this.scene);
    this.pedestrianManager = new PedestrianManager(this.scene);
    this.missionManager = new MissionManager(this.scene, this.vehicleController);
    this.impactEffects = new ImpactEffects(this.scene);
    this.smokeEffects = new SmokeEffects(this.scene);
    this.tireEffects = new TireEffectsManager(this.scene);
    this.bloodEffects = new BloodEffects(this.scene);

    // 4b. Law & order + story missions
    this.wanted = new WantedSystem();
    this.police = new PoliceManager(this.scene, this.trafficManager);
    this.missions = new MissionDirector(this.scene, this.vehicleController, this.trafficManager, this.wanted);

    // 5. Protagonist Character & Vehicle Interaction
    this.playerCharacter = new PlayerCharacter();
    this.scene.add(this.playerCharacter.rootGroup);
    this.playerController = new PlayerController(this.playerCharacter);
    this.vehicleInteraction = new VehicleInteraction(
      this.playerController,
      this.playerCharacter,
      this.vehicleController,
      this.trafficManager,
      this.lightingManager
    );

    // 6. GTA Multiplayer & Car Meet Systems
    this.carMeetManager = new CarMeetManager(this.scene);
    this.remotePlayerManager = new RemotePlayerManager(this.scene, this.trafficManager);
    this.multiplayerClient = new MultiplayerClient();

    this.multiplayerClient.onPlayerJoined = (id, name) => {
      this.remotePlayerManager.handlePlayerJoined(id, name);
      useGameStore.getState().pushNotification(`🚗 ${name} entered the city!`, 'info');
      useGameStore.getState().setOnlineCount(this.multiplayerClient.onlineCount);
    };
    this.multiplayerClient.onPlayerLeft = (id, name) => {
      this.remotePlayerManager.handlePlayerLeft(id);
      if (name) useGameStore.getState().pushNotification(`${name} left the city.`, 'info');
      useGameStore.getState().setOnlineCount(this.multiplayerClient.onlineCount);
    };
    this.multiplayerClient.onPlayerUpdate = (state) => {
      if (state.id === this.multiplayerClient.playerId) return;
      this.remotePlayerManager.handlePlayerUpdate(state);
    };
    this.multiplayerClient.onExistingPlayers = (existing) => {
      this.remotePlayerManager.handleExistingPlayers(existing);
      useGameStore.getState().setOnlineCount(this.multiplayerClient.onlineCount);
    };
    this.multiplayerClient.onChatMessage = (msg) => {
      this.chatMessages.push(msg);
      if (this.chatMessages.length > 50) this.chatMessages.shift();
      this.onChatMessagesChanged?.([...this.chatMessages]);
    };
    this.multiplayerClient.onConnectionChange = (connected, count) => {
      this.onMultiplayerConnectionChanged?.(connected, count);
      useGameStore.getState().setMultiplayerConnected(connected);
      useGameStore.getState().setOnlineCount(count);
    };
    this.multiplayerClient.onInspectVehicleData = (data) => {
      this.inspectedCarData = data;
      this.onInspectedCarChanged?.(data);
    };

    this.multiplayerClient.connect();

    this.wireGameplayEvents();

    // Bind interactive mouse left-click drag orbit & zoom
    this.cameraSystem.bindEvents(this.renderer.domElement);

    // Bind window resize
    window.addEventListener('resize', this.onWindowResize);

    // Initialize audio on first click/interaction/touch
    const startAudio = () => {
      audioManager.init();
      window.removeEventListener('pointerdown', startAudio);
      window.removeEventListener('touchstart', startAudio);
      window.removeEventListener('keydown', startAudio);
    };
    window.addEventListener('pointerdown', startAudio);
    window.addEventListener('touchstart', startAudio, { passive: true });
    window.addEventListener('keydown', startAudio);
  }

  // ---------------------------------------------------------------------------
  // Gameplay wiring
  // ---------------------------------------------------------------------------

  private wireGameplayEvents() {
    const store = () => useGameStore.getState();

    // Crimes -> heat & blood effects
    this.pedestrianManager.onPedestrianHitByCar = (p, carVel) => {
      const inVigilante = this.missions.activeDef?.type === 'vigilante';
      const addedHeat = inVigilante ? 10 : 32 + Math.min(20, carVel.length());
      this.wanted.addHeat(addedHeat, 'pedestrian_hit');

      // Public Hit & Run: Authorize police lethal force immediately
      if (!this.police.isLethalForce()) {
        this.police.setLethalForce(true);
        audioManager.playPoliceRadioLethal();
        store().pushNotification('⚠️ POLICE RADIO: 10-99 HIT & RUN DETECTED! LETHAL FORCE AUTHORIZED — COPS WILL SHOOT!', 'danger');
      }

      // Spawn directional blood splatter in direction of vehicle impact
      const carSpeed = carVel.length();
      const hitPos = p.position.clone();
      hitPos.y = Math.max(0.15, hitPos.y + 0.35);

      const sprayDir = carVel.clone();
      if (sprayDir.lengthSq() > 0.01) {
        sprayDir.normalize();
        sprayDir.y += 0.45;
        sprayDir.normalize();
      } else {
        sprayDir.set(0, 1, 0);
      }

      const bloodCount = Math.min(48, Math.round(20 + carSpeed * 1.6));
      this.bloodEffects.emitSplatter(hitPos, sprayDir, bloodCount, 4.0 + carSpeed * 0.45, p.position.y);

      // Spawn ground blood pool under struck pedestrian
      const poolRadius = THREE.MathUtils.clamp(1.2 + carSpeed * 0.05, 1.2, 2.4);
      this.bloodEffects.spawnGroundPool(p.position, poolRadius);

      audioManager.playBloodSplatter(Math.min(0.6, 0.35 + carSpeed * 0.015));
    };
    this.pedestrianManager.onPedestrianTackled = () => {
      this.wanted.addHeat(6, 'pedestrian_tackle');
    };

    this.wanted.onLevelChanged = (lvl, prev) => {
      store().setWanted(lvl, this.wanted.heat);
      if (lvl > prev) {
        store().pushNotification(`Wanted level ${'★'.repeat(lvl)} — police dispatched`, 'wanted');
      }
    };
    this.wanted.onCleared = () => {
      this.police.setLethalForce(false);
      this.police.standDown();
      store().pushNotification('You lost the cops.', 'success');
      store().bumpStat('copsEvaded');
    };

    // Hard landings (jetpack out of fuel, toggled off mid-air, jumping off high rooftops) hurt & bleed
    this.playerController.onHardLanding = (impactSpeed) => {
      if (this.isDown) return;
      this.cameraSystem.addTrauma(Math.min(1, impactSpeed / 15));
      // Damage scales up to 100 on extreme terminal velocity falls
      this.damagePlayer(Math.min(100, (impactSpeed - 9) * 5.2));
      audioManager.playTumbleImpact();

      // Blood effects if falling impact is hard (e.g. falling from jetpack height or high jump)
      if (impactSpeed >= 12) {
        const landingPos = this.playerController.position.clone();
        const bloodCount = Math.min(65, Math.round(24 + (impactSpeed - 12) * 2.8));
        this.bloodEffects.emitSplatter(
          landingPos,
          new THREE.Vector3(0, 1, 0),
          bloodCount,
          impactSpeed * 0.65,
          landingPos.y
        );

        const poolRadius = THREE.MathUtils.clamp(1.3 + (impactSpeed - 12) * 0.08, 1.3, 2.8);
        this.bloodEffects.spawnGroundPool(landingPos, poolRadius);

        audioManager.playBloodSplatter(0.45);
      }

      if (impactSpeed > 14) {
        this.playerController.applyVehicleHit(
          new THREE.Vector3(
            Math.sin(this.playerController.heading) * 2.5,
            0,
            Math.cos(this.playerController.heading) * 2.5
          )
        );
      }
    };

    // Tumble pavement bounces emit directional blood spray & ground pool
    this.playerController.onTumbleBounce = (bounceSpeed) => {
      if (this.isDown) return;
      if (bounceSpeed > 2.8) {
        const bouncePos = this.playerController.position.clone();
        this.bloodEffects.emitSplatter(
          bouncePos,
          new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.85, (Math.random() - 0.5) * 0.6),
          Math.min(28, Math.round(10 + bounceSpeed * 2.5)),
          2.5 + bounceSpeed * 0.35,
          bouncePos.y
        );
        this.bloodEffects.spawnGroundPool(bouncePos, 1.1, bouncePos.y);
        audioManager.playBloodSplatter(0.35);
      }
    };

    // Police
    this.police.onBusted = () => this.handleBusted();
    this.police.onWarnClosing = () => store().pushNotification('Cops closing in — MOVE!', 'danger');
    this.police.onHitPlayerOnFoot = (copVel) => {
      if (this.isDown) return;
      this.playerController.applyVehicleHit(copVel);
      this.cameraSystem.addTrauma(0.6);
      this.damagePlayer(THREE.MathUtils.clamp(copVel.length() * 4.5, 10, 45));

      const hitPos = this.playerController.position.clone();
      hitPos.y += 0.4;
      this.bloodEffects.emitSplatter(hitPos, copVel.clone().normalize(), 30, copVel.length(), this.playerController.position.y);
      this.bloodEffects.spawnGroundPool(this.playerController.position, 1.3);
      audioManager.playBloodSplatter(0.4);
    };

    // Police Shoot-to-Kill Action (authorized on Hit & Run or wanted >= 2)
    this.police.onCopShotHit = (damage, hitPoint) => {
      if (this.isDown) return;
      this.cameraSystem.addTrauma(0.35);

      const isDriving = this.playerMode === 'driving';
      if (isDriving) {
        audioManager.playBulletImpact(true);
        this.bloodEffects.emitSplatter(hitPoint, new THREE.Vector3(0, 1, 0), 10, 3.5, hitPoint.y);
      } else {
        audioManager.playBulletImpact(false);
        audioManager.playBloodSplatter(0.35);
        this.bloodEffects.emitSplatter(hitPoint, new THREE.Vector3(0, 0.8, 0), 18, 4.0, this.playerController.position.y);
      }

      // Deal calibrated bullet damage (8 to 12 direct hits deplete 100 HP)
      this.damagePlayer(damage);
    };

    // Vehicle damage
    this.vehicleController.onDamage = (_amount, impactSpeed) => {
      if (this.playerMode !== 'driving' || this.isDown) return;
      if (this.carMeetManager?.isInsideZone(this.vehicleController.position)) return; // Car Meet safe zone
      this.cameraSystem.addTrauma(Math.min(1, impactSpeed / 12));
      if (impactSpeed > 11) {
        this.damagePlayer((impactSpeed - 11) * 3.5);
      }
    };
    this.vehicleController.onWrecked = () => {
      const pos = this.vehicleController.position.clone();
      pos.y = 0.8;
      this.smokeEffects.burst(pos, 36, 0.95);
      this.impactEffects.emit(pos, new THREE.Vector3(0, 1, 0), 40);
      this.cameraSystem.addTrauma(1.0);
      store().bumpStat('carsWrecked');
      store().pushNotification('Vehicle wrecked! Get out of the car — press [E] to bail out.', 'danger');
      if (this.playerMode === 'driving') this.damagePlayer(25);
    };

    // Story missions
    this.missions.onMissionPassed = (def, payout, summary) => {
      store().setSplash('mission_passed', `${def.title} · +$${payout.toLocaleString()}`);
      store().pushNotification(summary, 'success');
    };
    this.missions.onMissionFailed = (def, reason) => {
      store().setSplash('mission_failed', `${def.title} — ${reason}`);
    };
  }

  // ---------------------------------------------------------------------------
  // Vitals
  // ---------------------------------------------------------------------------

  public damagePlayer(amount: number) {
    if (this.isDown || amount <= 0) return;
    if (this.carMeetManager?.isInsideZone(this.playerController.position)) return; // Car Meet safe zone
    this.regenTimer = 0;
    // Armor soaks most of the hit first
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount * 0.7);
      this.armor -= absorbed;
      amount -= absorbed;
    }
    this.health = Math.max(0, this.health - amount);
    useGameStore.getState().setVitals(this.health, this.armor);
    if (this.health <= 0) this.handleWasted();
  }

  private handleWasted() {
    if (this.isDown) return;
    this.police.setLethalForce(false);
    const store = useGameStore.getState();
    this.isDown = true;
    this.downKind = 'wasted';
    this.downTimer = 4.0;
    store.resetControls();
    store.setSplash('wasted', 'You wake up at Fountain Plaza Hospital.');
    store.bumpStat('timesWasted');
    audioManager.playWasted();
    this.cameraSystem.addTrauma(0.8);
    this.missions.notifyPlayerDown('You got wasted.');
    if (this.missionManager.getIsActive()) this.missionManager.cancelCabJob();
    if (this.playerMode === 'on_foot' && !this.playerController.isTumbling) {
      this.playerController.applyVehicleHit(new THREE.Vector3(0.5, 0, 0.5));
    }
  }

  private handleBusted() {
    if (this.isDown) return;
    this.police.setLethalForce(false);
    const store = useGameStore.getState();
    this.isDown = true;
    this.downKind = 'busted';
    this.downTimer = 4.6;
    store.resetControls();

    // Officers drag the hero out of the car and cuff them on the spot
    if (this.playerMode === 'driving' || this.playerMode === 'entering_vehicle') {
      this.vehicleController.velocity.set(0, 0, 0);
      this.vehicleController.yawRate = 0;
      this.vehicleInteraction.startExitVehicle(this.cityEnv.activeColliders);
    }
    this.playerMode = 'on_foot';
    this.playerController.isTumbling = false;
    this.playerController.isRecovering = false;
    this.playerController.velocity.set(0, 0, 0);
    this.playerCharacter.setVisible(true);
    // Face the nearest cruiser
    const nearest = this.police.cops.reduce<{ d: number; x: number; z: number } | null>((best, c) => {
      const d = c.position.distanceTo(this.playerController.position);
      return !best || d < best.d ? { d, x: c.position.x, z: c.position.z } : best;
    }, null);
    if (nearest) {
      this.playerController.heading = Math.atan2(nearest.x - this.playerController.position.x, nearest.z - this.playerController.position.z);
      this.playerCharacter.rootGroup.rotation.y = this.playerController.heading;
    }

    store.setSplash('busted', 'Cuffed and hauled to the Transit precinct. Your fine has been deducted.');
    store.bumpStat('timesBusted');
    audioManager.playBusted();
    this.missions.notifyPlayerDown('You got busted.');
    if (this.missionManager.getIsActive()) this.missionManager.cancelCabJob();
  }

  /**
   * Nearest point around `pos` that is clear of static colliders (with `margin`),
   * searched on an expanding ring so respawns never land inside a fountain or lobby.
   */
  public findSafeSpot(pos: THREE.Vector3, margin: number = 1.4, maxRadius: number = 30): THREE.Vector3 {
    const colliders = this.cityEnv.getCollidersNear(pos, maxRadius + margin + 10);
    const isClear = (x: number, z: number) => {
      for (let i = 0; i < colliders.length; i++) {
        const b = colliders[i];
        if (x > b.min.x - margin && x < b.max.x + margin && z > b.min.z - margin && z < b.max.z + margin) return false;
      }
      return true;
    };
    if (isClear(pos.x, pos.z)) return new THREE.Vector3(pos.x, 0.02, pos.z);
    for (let r = 2; r <= maxRadius; r += 2) {
      const steps = Math.max(8, Math.round(r * 2));
      for (let s = 0; s < steps; s++) {
        const a = (s / steps) * Math.PI * 2;
        const x = pos.x + Math.cos(a) * r;
        const z = pos.z + Math.sin(a) * r;
        if (isClear(x, z)) return new THREE.Vector3(x, 0.02, z);
      }
    }
    return new THREE.Vector3(pos.x, 0.02, pos.z);
  }

  private respawn() {
    const store = useGameStore.getState();
    const kind = this.downKind;
    const spawn = this.findSafeSpot(kind === 'busted' ? POLICE_STATION_POS : HOSPITAL_POS);

    // Cash penalty
    const penalty = kind === 'busted'
      ? Math.min(store.cash, Math.max(100, Math.round(store.cash * 0.1)))
      : Math.min(store.cash, Math.max(100, Math.round(store.cash * 0.08)));
    if (penalty > 0) store.addCash(-penalty);

    // Reset vitals
    this.health = 100;
    this.armor = 0;
    this.regenTimer = 0;
    store.setVitals(this.health, this.armor);

    // Clear the law
    this.wanted.clear();
    this.police.clearAll();
    store.setWanted(0, 0);

    // Player back on foot, car repaired and parked nearby
    this.playerController.setPosition(spawn, 0);
    this.playerController.isTumbling = false;
    this.playerController.isRecovering = false;
    this.playerCharacter.setVisible(true);
    this.playerMode = 'on_foot';
    this.cameraSystem.snapFootFollow(spawn);

    this.vehicleController.repair();
    const carSpot = this.findSafeSpot(new THREE.Vector3(spawn.x + 6.0, 0, spawn.z + 3.0), 2.6);
    this.vehicleController.resetPosition(new THREE.Vector3(carSpot.x, 0, carSpot.z), 0);
    store.setVehicleHealth(100);

    store.pushNotification(
      kind === 'busted'
        ? `Busted. Fine paid: $${penalty}. Vehicle impounded & repaired.`
        : `Hospital bill: $${penalty}. Try not to die.`,
      'danger'
    );

    this.isDown = false;
    this.downKind = null;
  }

  // ---------------------------------------------------------------------------
  // Init / loop
  // ---------------------------------------------------------------------------

  async init(): Promise<void> {
    const store = useGameStore.getState();
    store.setLoading(true, 15, 'Streaming Deep Rush City (20MB)...');

    // Load City Level
    await this.cityEnv.loadCity((percent) => {
      store.setLoading(true, Math.round(15 + percent * 0.5), `Downloading City World: ${percent}%`);
    });

    store.setLoading(true, 68, 'Initializing Autonomous Traffic Fleet...');

    // Load AI Traffic Fleet
    await this.trafficManager.init((percent) => {
      store.setLoading(true, Math.round(68 + percent * 0.18), `Deploying City Traffic: ${percent}%`);
    });

    store.setLoading(true, 82, 'Configuring City Environment...');
    const initialPedCount = store.graphicsQuality === 'low' ? 10 : store.graphicsQuality === 'medium' ? 20 : 32;
    this.pedestrianManager.init(initialPedCount);

    store.setLoading(true, 88, 'Configuring Player Vehicle...');

    // Load Default Player Car
    await this.vehicleController.loadModel('Car_06', (percent) => {
      store.setLoading(true, Math.round(88 + percent * 0.12), `Tuning Coupe Turbo: ${percent}%`);
    });

    // React StrictMode / fast-refresh can dispose this engine while assets were still streaming.
    // Never start a loop on a dead engine — it would keep rendering to a detached canvas and
    // fight the live engine over the shared store.
    if (this.isDisposed) return;

    // Position vehicle in road lane and protagonist on sidewalk curb beside it (matching red boxes)
    this.vehicleController.resetPosition(DEFAULT_SPAWN_POS, 0);
    this.playerController.setPosition(PROTAGONIST_SPAWN_POS.clone(), 0);
    this.cameraSystem.snapFootFollow(PROTAGONIST_SPAWN_POS);
    this.playerMode = 'on_foot';
    this.playerCharacter.setVisible(true);

    if (isMobileDevice() && store.graphicsQuality === 'high') {
      store.setGraphicsQuality('medium');
    }

    this.applyGraphicsQuality(useGameStore.getState().graphicsQuality);
    this.setDayNightMode(store.dayNightMode);
    this.setHeadlightMode(store.headlightMode);

    store.setLoading(false, 100, 'Welcome to Deep Rush City!');
    store.pushNotification('Welcome to Deep Rush City. Press M for the mission board.', 'info');
    this.start();
  }

  start() {
    if (this.isRunning || this.isDisposed) return;
    this.isRunning = true;
    this.clock.start();
    this.loop();
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private loop = () => {
    if (!this.isRunning) return;
    this.animationFrameId = requestAnimationFrame(this.loop);
    this.tick(this.clock.getDelta(), true);
  };

  /**
   * Advance the whole simulation by `delta` seconds. Called by the rAF loop; also callable
   * directly (after stop()) for deterministic stepping in tests/tools.
   */
  public tick(delta: number, render: boolean = true) {
    const dt = Math.min(delta, 0.05);
    const store = useGameStore.getState();
    const controls = this.isDown ? EMPTY_CONTROLS : store.controls;
    const isNight = store.dayNightMode === 'night';

    // 0. Auto-sync Day/Night mode changes (Keyboard N, QuickSettings, store mutations)
    if (store.dayNightMode !== this.lastDayNightMode) {
      this.setDayNightMode(store.dayNightMode);
    }
    if (store.headlightMode !== this.lastHeadlightMode) {
      this.setHeadlightMode(store.headlightMode);
    }

    // 0a. Advance and sync Dynamic Celestial Sky System
    if (this.dynamicSky.isAutoCycle !== store.isAutoTimeCycle) {
      this.dynamicSky.isAutoCycle = store.isAutoTimeCycle;
    }
    this.dynamicSky.update(delta, this.cameraSystem.camera.position);

    // Coordinate sunset factor & day/night material blending across the city
    const sunsetFactor = Math.exp(-Math.pow((this.dynamicSky.sunDirection.y - 0.05) / 0.16, 2.0));
    this.cityEnv.updateDayNightBlend(this.dynamicSky.darknessFactor, sunsetFactor);

    // In continuous 24h auto-cycle mode, track time-of-day category for HUD indicators
    if (store.isAutoTimeCycle) {
      const currentCategory: DayNightMode =
        this.dynamicSky.darknessFactor > 0.45 ? 'night' : sunsetFactor > 0.35 ? 'sunset' : 'day';
      if (store.dayNightMode !== currentCategory) {
        this.lastDayNightMode = currentCategory;
        store.setDayNightMode(currentCategory);
      }
    }

    // 0b. Death / arrest sequence
    if (this.isDown) {
      this.downTimer -= dt;
      if (this.downTimer <= 0) this.respawn();
    }

    // 1. Update City Environment (Infinite Chunks & Active Colliders)
    const activeFocusPos = this.playerMode === 'driving' ? this.vehicleController.position : this.playerController.position;
    const activeVel = this.playerMode === 'driving' ? this.vehicleController.velocity : this.playerController.velocity;

    // Coordinate dynamic lighting & shadows with celestial sun/moon
    this.lightingManager.syncWithSky(this.dynamicSky, activeFocusPos);

    const activePOI = this.cityEnv.update(
      activeFocusPos,
      delta,
      (poi) => {
        store.setActivePOI(poi);
        store.markPOIDiscovered(poi.id);
      }
    );
    const staticColliders = this.cityEnv.activeColliders;

    // 2. Update Dynamic AI Traffic (with player lane detection & stopping)
    this.trafficManager.update(
      activeFocusPos,
      delta,
      this.playerMode === 'on_foot',
      this.vehicleController.position,
      staticColliders
    );

    // 2b. Update Walkaround Pedestrian NPCs
    this.pedestrianManager.update(
      activeFocusPos,
      activeVel,
      Boolean(controls.horn),
      delta,
      this.trafficManager.trafficLightColor,
      this.playerMode,
      this.playerController
    );

    // 2c. Traffic vs protagonist on foot
    if (this.playerMode === 'on_foot' && !this.playerController.isTumbling && !this.isDown) {
      const pPos = this.playerController.position;
      for (let i = 0; i < this.trafficManager.trafficCars.length; i++) {
        const tCar = this.trafficManager.trafficCars[i];
        const carVelSpeed = tCar.velocity.length();
        if (carVelSpeed > 1.6) {
          const distToCar = pPos.distanceTo(tCar.position);
          if (distToCar < tCar.halfLength + 0.7) {
            const playerCenter = new THREE.Vector3(pPos.x, pPos.y + 0.8, pPos.z);
            if (tCar.box.containsPoint(playerCenter)) {
              this.playerController.applyVehicleHit(tCar.velocity);
              this.cameraSystem.addTrauma(0.55);
              this.damagePlayer(THREE.MathUtils.clamp(carVelSpeed * 4.5, 8, 45));
              const hitPos = this.playerController.position.clone();
              hitPos.y += 0.4;
              this.bloodEffects.emitSplatter(hitPos, tCar.velocity.clone().normalize(), 28, carVelSpeed, this.playerController.position.y);
              this.bloodEffects.spawnGroundPool(this.playerController.position, 1.3);
              audioManager.playBloodSplatter(0.4);
              break;
            }
          }
        }
      }
    }

    // 2d. Police pursuit (frozen with lights running while the hero is being cuffed)
    const isArrestScene = this.isDown && this.downKind === 'busted';
    let policeResult: { hasEyes: boolean; nearestDist: number };
    if (isArrestScene) {
      this.police.updateVisualsOnly(delta, isNight);
      policeResult = { hasEyes: true, nearestDist: this.police.nearestCopDistance };
    } else {
      policeResult = this.police.update(
        delta,
        activeFocusPos,
        activeVel,
        this.playerMode,
        this.isDown ? 0 : this.wanted.level,
        staticColliders,
        isNight
      );
    }

    // 2d-ii. Working traffic signals on the poles follow the global cycle
    this.cityEnv.setTrafficLightState(this.trafficManager.trafficLightColor);

    // 2e. Wanted heat decay / escalation
    this.wanted.update(dt, policeResult.hasEyes);
    if (this.wanted.level > 0 || store.wantedHeat !== this.wanted.heat) {
      store.setWanted(this.wanted.level, this.wanted.heat);
    }

    // 3. Colliders for the protagonist on foot: buildings + every vehicle
    const footColliders: THREE.Box3[] = this.playerMode === 'on_foot'
      ? [...staticColliders, ...this.trafficManager.trafficBoxes, ...this.police.cops.map((c) => c.box), this.vehicleController.getBoundingBox()]
      : staticColliders;

    // 4. Interaction prompts (vehicles, mission markers)
    let interactionPrompt: string | null = null;

    const airborne = this.playerController.altitude > 0.6;
    if (this.playerMode === 'on_foot' && !this.isDown && !airborne) {
      const nearby = this.vehicleInteraction.checkProximity(this.playerController.position);
      const marker = nearby ? null : this.missions.getMarkerNear(this.playerController.position);

      if (nearby) {
        interactionPrompt = nearby.type === 'player_car'
          ? 'Press [E] to enter vehicle'
          : `Press [E] to steal vehicle (${nearby.name})`;

        if (controls.interact) {
          store.setControl('interact', false);
          // Stow the jetpack before getting in
          if (this.playerController.isJetpackOn) {
            this.playerController.toggleJetpack();
            this.playerCharacter.setJetpack(false, 0);
          }
          this.playerMode = 'entering_vehicle';
          this.vehicleInteraction.startEnterVehicle(nearby);
          if (nearby.type === 'traffic_car') {
            // Grand theft auto: witnesses call it in
            this.wanted.addHeat(14, 'property');
          }
        }
      } else if (marker) {
        interactionPrompt = this.missions.isActive
          ? `Finish your current mission first (${marker.title})`
          : `Press [E] to start: ${marker.title}`;
        if (controls.interact && !this.missions.isActive) {
          store.setControl('interact', false);
          this.startMission(marker.id);
        }
      } else if (!nearby && !marker) {
        const inspectTarget = this.remotePlayerManager.getNearbyVehicleToInspect(this.playerController.position);
        if (inspectTarget) {
          interactionPrompt = `Press [E] to inspect ${inspectTarget.ownerName}'s ${inspectTarget.vehicleModelId}`;
          if (controls.interact) {
            store.setControl('interact', false);
            this.inspectedCarData = inspectTarget;
            this.onInspectedCarChanged?.(inspectTarget);
          }
        }
      }
    } else if (this.playerMode === 'driving' && !this.isDown) {
      interactionPrompt = this.vehicleController.isWrecked ? 'Vehicle wrecked — Press [E] to bail out' : 'Press [E] to exit vehicle';
      if (controls.interact) {
        store.setControl('interact', false);
        const exitSpeedKmh = Math.abs(this.vehicleController.speedKmh);
        const isBailout = exitSpeedKmh >= 12.0;

        this.playerMode = 'exiting_vehicle';
        const exitPos = this.vehicleInteraction.startExitVehicle(footColliders, isBailout);
        this.playerMode = 'on_foot';

        if (isBailout) {
          const heading = this.vehicleController.heading;
          const fwd = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
          const left = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading));
          const exitSpeedMs = exitSpeedKmh / 3.6;

          // Ejection velocity: forward momentum + lateral ejection push away from door + upward pop
          const ejectionVel = new THREE.Vector3()
            .copy(this.vehicleController.velocity)
            .multiplyScalar(0.72)
            .addScaledVector(left, 3.2 + Math.min(exitSpeedMs * 0.18, 5.0))
            .add(new THREE.Vector3(0, 1.8 + Math.min(exitSpeedMs * 0.12, 2.5), 0));

          this.playerController.applyVehicleBailout(ejectionVel, exitSpeedKmh);

          // Calibrated damage based on speed (12 km/h: 8 dmg, 50 km/h: 24 dmg, 100 km/h: 54 dmg, 150 km/h: 84 dmg)
          const damage = THREE.MathUtils.clamp((exitSpeedKmh - 10) * 0.6, 8, 88);
          this.damagePlayer(damage);

          // Directional blood spray & ground splatter pool
          const pPos = this.playerController.position;
          const sprayDir = left.clone().multiplyScalar(0.7).add(fwd.clone().multiplyScalar(0.3)).normalize();
          const bloodCount = Math.min(60, Math.round(20 + exitSpeedKmh * 0.35));
          this.bloodEffects.emitSplatter(pPos, sprayDir, bloodCount, 4.5 + exitSpeedMs * 0.3, pPos.y);
          const poolRadius = THREE.MathUtils.clamp(0.8 + (exitSpeedKmh / 100) * 1.2, 0.9, 2.4);
          this.bloodEffects.spawnGroundPool(pPos, poolRadius, pPos.y);

          // Audio & camera trauma
          audioManager.playBloodSplatter(Math.min(0.65, 0.35 + (exitSpeedKmh / 150) * 0.3));
          audioManager.playTumbleImpact();
          this.cameraSystem.addTrauma(Math.min(1.0, 0.35 + exitSpeedKmh / 140));
        }
      }
    }

    // 5. State-Based Updates
    const isBraking = controls.backward || controls.handbrake;

    if (this.playerMode === 'entering_vehicle') {
      const targetVehicle = this.vehicleInteraction.getActiveTargetVehicle();
      const carPos = targetVehicle ? targetVehicle.position : this.vehicleController.position;
      const carHeading = targetVehicle ? targetVehicle.heading : this.vehicleController.heading;
      const doorPos = this.vehicleInteraction.getDoorPosition();
      const progress = this.vehicleInteraction.getEnterProgress();

      this.cameraSystem.updateCinematicEnter(carPos, carHeading, doorPos, progress, delta);
      this.lightingManager.updateCarPosition(carPos);

      this.vehicleInteraction.updateEnterTransition(delta, (hijackedId) => {
        if (hijackedId) {
          this.switchVehicle(hijackedId);
        }
        this.vehicleController.onDriverEnter();
        audioManager.startEngine(hijackedId || this.vehicleController.currentVehicleId);
        this.playerMode = 'driving';
      });
    } else if (this.playerMode === 'on_foot' && isArrestScene) {
      // Hands behind the back, cuffs on — no movement until the precinct
      this.playerCharacter.rootGroup.position.copy(this.playerController.position);
      this.playerCharacter.update(dt, 'ARRESTED', 0);
      this.cameraSystem.updateCharacter(
        this.playerController.position,
        this.playerController.heading,
        false,
        delta,
        staticColliders
      );
      this.vehicleController.setBrakeLights(false, isNight);
      this.vehicleController.updateSuspensionSpring(dt);
      this.lightingManager.updateCarPosition(this.playerController.position);
    } else if (this.playerMode === 'on_foot') {
      this.playerController.update(controls, delta, this.cameraSystem.camera, footColliders, this.cityEnv.walkableMeshes);
      this.cameraSystem.updateCharacter(
        this.playerController.position,
        this.playerController.heading,
        this.playerController.isSprinting || this.playerController.isAfterburner,
        delta,
        staticColliders
      );

      // Jetpack visuals: pack on the back, nozzle flames, exhaust vapour
      const pc = this.playerController;
      this.playerCharacter.setJetpack(pc.isJetpackOn, pc.thrust01);
      // Parachute container pack visibility (on back when airborne or deployed)
      this.playerCharacter.parachutePackMesh.visible = !pc.isJetpackOn && (pc.isParachuteOpen || (!pc.isGrounded && pc.altitude > 1.8));
      if (pc.isJetpackOn && pc.thrust01 > 0.1) {
        const nozzleL = new THREE.Vector3();
        const nozzleR = new THREE.Vector3();
        this.playerCharacter.getJetExhaustPositions(nozzleL, nozzleR);
        this.smokeEffects.emitExhaust(nozzleL, pc.thrust01, dt);
        this.smokeEffects.emitExhaust(nozzleR, pc.thrust01, dt);
      }
      audioManager.updateJetpack(pc.isJetpackOn, pc.thrust01, pc.isAfterburner);

      // Unoccupied vehicle coasting physics: rolls forward and decelerates naturally under drag & engine braking
      const carSpeedKmh = Math.abs(this.vehicleController.speedKmh);
      if (carSpeedKmh > 0.5 || this.vehicleController.velocity.lengthSq() > 0.04) {
        const EMPTY_CONTROLS: PlayerControls = {
          forward: false,
          backward: false,
          left: false,
          right: false,
          handbrake: false,
          boost: false,
          horn: false,
          interact: false,
        };
        this.vehicleController.update(
          EMPTY_CONTROLS,
          delta,
          staticColliders,
          (impactPos, impactNormal, intensity) => {
            this.impactEffects.emit(impactPos, impactNormal, Math.round(22 * intensity));
          }
        );
        this.vehicleController.setBrakeLights(false, isNight);
        this.resolveVehicleDynamics();
      } else {
        this.vehicleController.velocity.set(0, 0, 0);
        this.vehicleController.speedKmh = 0;
        this.vehicleController.setBrakeLights(false, isNight);
        this.vehicleController.updateSuspensionSpring(dt);
      }

      this.lightingManager.updateCarPosition(this.playerController.position);
    } else if (this.playerMode === 'driving') {
      this.vehicleController.update(
        controls,
        delta,
        staticColliders,
        (impactPos, impactNormal, intensity) => {
          this.impactEffects.emit(impactPos, impactNormal, Math.round(22 * intensity));
        }
      );

      // Momentum exchange with traffic and police
      this.resolveVehicleDynamics();

      const isDrifting = this.vehicleController.isDrifting;
      const isBoosting = this.vehicleController.isBoosting;
      const isSlipping = isDrifting || this.vehicleController.isWheelspin || (isBraking && Math.abs(this.vehicleController.speedKmh) > 18);

      this.vehicleController.setBrakeLights(isBraking || isDrifting, isNight);
      this.lightingManager.setBrakeLights(isBraking || isDrifting);

      this.tireEffects.emitTireEffects(
        this.vehicleController.rootGroup,
        this.vehicleController.getWheelGroundPositions(),
        isSlipping,
        isBraking,
        isBoosting,
        this.vehicleController.speedKmh,
        this.vehicleController.wheelBase,
        this.vehicleController.trackWidth
      );

      this.cameraSystem.setMode(store.cameraMode);
      this.cameraSystem.update(
        this.vehicleController.position,
        this.vehicleController.rootGroup.quaternion,
        this.vehicleController.speedKmh,
        delta,
        this.vehicleController.yawRate,
        this.vehicleController.isDrifting,
        this.vehicleController.isBoosting
      );

      this.lightingManager.updateCarPosition(this.vehicleController.position);

      // Top speed record
      const kmh = Math.abs(this.vehicleController.speedKmh);
      if (kmh > store.stats.topSpeedKmh) store.setStat('topSpeedKmh', kmh);
    }

    // 5b. Engine smoke on a damaged car (any mode — a smoking wreck keeps smoking)
    const dmg01 = 1 - this.vehicleController.health / 100;
    if (dmg01 >= 0.45) {
      const hood = this.vehicleController.rootGroup.localToWorld(new THREE.Vector3(0, 0.95, this.vehicleController.wheelBase * 0.9));
      this.smokeEffects.emitEngineSmoke(hood, this.vehicleController.velocity, dmg01, dt);
    }

    // 5c. Slow health regen after a quiet spell (GTA V style)
    this.regenTimer += dt;
    if (!this.isDown && this.regenTimer > 6 && this.health < 100) {
      this.health = Math.min(100, this.health + dt * 1.5);
      store.setVitals(this.health, this.armor);
    }

    // 6. Update Tire Effects Aging & Particles
    this.tireEffects.update(delta, this.cameraSystem.camera);
    this.impactEffects.update(delta);
    this.smokeEffects.update(delta);
    this.bloodEffects.update(delta);

    // 6b. Cab job + story missions
    this.missionManager.update(
      this.vehicleController.position,
      this.vehicleController.speedKmh,
      delta,
      this.playerMode
    );
    if (!this.isDown) {
      this.missions.update(dt, activeFocusPos, this.playerMode, this.playerMode === 'driving' ? Math.abs(this.vehicleController.speedKmh) : this.playerController.speed * 3.6);
    }

    // 6c. Minimap blips at 10 Hz
    this.blipTimer += dt;
    if (this.blipTimer > 0.1) {
      this.blipTimer = 0;
      const blips: MapBlip[] = this.missions.getBlips(activeFocusPos);
      for (const cop of this.police.cops) {
        if (cop.state === 'leaving') continue;
        blips.push({ x: cop.position.x, z: cop.position.z, kind: 'cop', color: '#3b82f6', heading: cop.heading });
      }
      // Add remote players to radar
      const remoteBlips = this.remotePlayerManager.getBlips();
      blips.push(...remoteBlips);
      store.setBlips(blips);
    }

    // 6d. Update Multiplayer Entities & Car Meet Zone
    this.remotePlayerManager.update(dt);
    this.carMeetManager.update(dt);

    // 6e. Send Local Player State Packet to Multiplayer Server (25 Hz)
    if (this.playerMode === 'driving') {
      const upgrades = store.vehicleUpgrades;
      this.multiplayerClient.sendPlayerUpdate({
        mode: 'driving',
        position: [activeFocusPos.x, activeFocusPos.y, activeFocusPos.z],
        heading: this.vehicleController.heading,
        speed: Math.abs(this.vehicleController.speedKmh),
        animState: 'IDLE',
        jetpack: { active: false, thrust: 0 },
        vehicle: {
          modelId: store.selectedVehicleId,
          position: [activeFocusPos.x, activeFocusPos.y, activeFocusPos.z],
          heading: this.vehicleController.heading,
          speedKmh: this.vehicleController.speedKmh,
          steering: this.vehicleController.steerAngle || 0,
          isBraking: Boolean(controls.backward || controls.handbrake),
          isDrifting: this.vehicleController.isDrifting,
          headlights: this.lastHeadlightMode || store.headlightMode || 'low',
          paintColor: upgrades.paintColor,
          underglowColor: upgrades.underglowColor,
          hasTaxiSign: upgrades.hasTaxiSign,
          health: this.vehicleController.health,
        },
      });
    } else {
      const pc = this.playerController;
      const animState = this.playerCharacter.animState;
      this.multiplayerClient.sendPlayerUpdate({
        mode: 'on_foot',
        position: [activeFocusPos.x, activeFocusPos.y, activeFocusPos.z],
        heading: pc.heading,
        speed: Math.round(pc.speed * 3.6),
        animState,
        jetpack: {
          active: pc.isJetpackOn,
          thrust: pc.thrust01,
        },
      });
    }

    // 7. Update UI Telemetry Store (Throttled to ~25Hz for high performance while keeping critical events instant)
    this.telemetryTimer += dt;
    const activePrompt = this.isDown ? null : interactionPrompt;
    const modeChanged = this.playerMode !== store.telemetry.playerMode;
    const promptChanged = activePrompt !== store.telemetry.interactionPrompt;
    const healthChanged = this.health !== store.telemetry.health;
    const wantedChanged = this.wanted.level !== store.telemetry.wantedLevel;

    if (this.telemetryTimer >= 0.04 || modeChanged || promptChanged || healthChanged || wantedChanged) {
      this.telemetryTimer = 0;
      const speed = this.playerMode === 'driving'
        ? this.vehicleController.speedKmh
        : Math.round(this.playerController.speed * 3.6);
      const absSpeed = Math.abs(speed);
      const rpm = this.playerMode === 'driving'
        ? (this.vehicleController.isWrecked ? 0 : this.vehicleController.currentRpm)
        : 0;

      store.updateTelemetry({
        speedKmh: speed,
        rpm,
        gear: this.playerMode === 'driving' ? this.vehicleController.currentGearLabel : 'N',
        isDrifting: this.playerMode === 'driving' ? this.vehicleController.isDrifting : false,
        driftScore: this.vehicleController.driftScore,
        carPosition: [activeFocusPos.x, activeFocusPos.y, activeFocusPos.z],
        carHeadingRad: this.playerMode === 'driving' ? this.vehicleController.heading : this.playerController.heading,
        activePOI: activePOI,
        trafficLight: this.trafficManager.trafficLightColor,
        lightTimer: Math.ceil(this.trafficManager.lightTimer),
        playerMode: this.playerMode,
        interactionPrompt: activePrompt,
        health: this.health,
        armor: this.armor,
        vehicleHealth: this.vehicleController.health,
        wantedLevel: this.wanted.level,
        wantedHeat: this.wanted.heat,
        gForce: this.playerMode === 'driving' ? this.vehicleController.lateralAccel / 9.81 : 0,
        jetpackActive: this.playerController.isJetpackOn,
        jetpackFuel: this.playerController.fuel,
        parachuteActive: this.playerController.isParachuteOpen,
        altitude: this.playerController.altitude,
        headlightMode: this.lastHeadlightMode || store.headlightMode || 'low',
      });
      if (store.vehicleHealth !== this.vehicleController.health) {
        store.setVehicleHealth(this.vehicleController.health);
      }
    }

    // 8. Render WebGL Scene
    if (render) this.renderer.render(this.scene, this.cameraSystem.camera);
  }

  /** Player car vs traffic cars & police cruisers: impulse exchange, damage, heat. */
  private resolveVehicleDynamics() {
    const vc = this.vehicleController;
    const store = useGameStore.getState();

    // Traffic
    const cars = this.trafficManager.trafficCars;
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      // Broad phase
      if (Math.abs(car.position.x - vc.position.x) > 7 || Math.abs(car.position.z - vc.position.z) > 7) continue;
      const res = vc.collideWithDynamicBox(car.box, car.mass, car.velocity);
      if (!res) continue;
      this.trafficManager.applyImpulse(car, res.otherDeltaV, res.otherShift, res.point);
      if (res.relSpeed > 1.0) {
        this.impactEffects.emit(res.point, res.normal, Math.round(14 * Math.min(2, res.relSpeed / 5)));
        this.cameraSystem.addTrauma(Math.min(0.9, res.relSpeed / 14));
      }
      if (res.relSpeed > 3.5 && !car.isSuspect) {
        this.wanted.addHeat(Math.min(22, 4 + res.relSpeed * 1.4), 'traffic_ram');
      }
    }

    // Police
    for (let i = 0; i < this.police.cops.length; i++) {
      const cop = this.police.cops[i];
      if (Math.abs(cop.position.x - vc.position.x) > 7 || Math.abs(cop.position.z - vc.position.z) > 7) continue;
      const res = vc.collideWithDynamicBox(cop.box, cop.mass, cop.velocity, 0.3);
      if (!res) continue;
      this.police.applyImpulse(cop, res.otherDeltaV, res.otherShift, res.point);
      if (res.relSpeed > 1.0) {
        this.impactEffects.emit(res.point, res.normal, Math.round(16 * Math.min(2, res.relSpeed / 5)));
        this.cameraSystem.addTrauma(Math.min(1.0, res.relSpeed / 12));
      }
      if (res.relSpeed > 2.5) {
        this.wanted.addHeat(10 + res.relSpeed, 'police_ram');
        if (this.police.onCopRammedPlayer) this.police.onCopRammedPlayer(res.relSpeed);
      }
    }

    if (store.vehicleHealth !== vc.health) store.setVehicleHealth(vc.health);
  }

  // ---------------------------------------------------------------------------
  // Public actions (App / HUD)
  // ---------------------------------------------------------------------------

  public startMission(id: string): boolean {
    if (this.isDown) return false;
    if (this.missionManager.getIsActive()) this.missionManager.cancelCabJob();
    const pos = this.playerMode === 'driving' ? this.vehicleController.position : this.playerController.position;
    return this.missions.startMission(id, pos);
  }

  public abandonMission() {
    this.missions.cancelMission('Mission abandoned.');
  }

  /** Equip / remove the jetpack (on foot only). */
  public toggleJetpack(): boolean {
    if (this.isDown) return false;
    const store = useGameStore.getState();
    if (this.playerMode === 'driving' || this.playerMode === 'entering_vehicle') {
      store.pushNotification('Exit vehicle first [E] to equip Jetpack.', 'info');
      return false;
    }
    if (this.playerMode !== 'on_foot') return false;

    const on = this.playerController.toggleJetpack();
    this.playerCharacter.setJetpack(on, 0);
    if (on) {
      store.pushNotification('🚀 Jetpack equipped! [SPACE] Fly Up · [CTRL] Descend · [WASD] Fly · [SHIFT] Turbo · [J] Unequip', 'info');
      audioManager.playJetpackEquip();
    } else {
      store.pushNotification('Jetpack stowed.', 'info');
      audioManager.playJetpackStow();
      audioManager.updateJetpack(false, 0, false);
    }
    return on;
  }

  /** Deploy / cut the parachute (on foot only). */
  public toggleParachute(): boolean {
    if (this.isDown) return false;
    const store = useGameStore.getState();
    if (this.playerMode === 'driving' || this.playerMode === 'entering_vehicle') {
      return false;
    }
    if (this.playerMode !== 'on_foot') return false;

    const isOpen = this.playerController.toggleParachute();
    if (isOpen) {
      store.pushNotification('🪂 Parachute deployed! [A/D] Steer · [S/SPACE] Flare Brake · [W] Dive Glide · [P] Cut Lines', 'info');
    } else {
      store.pushNotification('Parachute cut / stowed.', 'info');
    }
    return isOpen;
  }

  public toggleCabJob() {
    if (this.isDown) return;
    if (!this.missionManager.getIsActive() && this.missions.isActive) {
      this.missions.cancelMission('Took a cab shift instead.');
    }
    this.missionManager.toggleCabJob(this.vehicleController.position);
  }

  public repairVehicle(cost: number = 150): boolean {
    const store = useGameStore.getState();
    if (this.vehicleController.health >= 100) return false;
    if (!store.deductCash(cost)) {
      store.pushNotification('Not enough cash for repairs.', 'danger');
      return false;
    }
    this.vehicleController.repair();
    store.setVehicleHealth(100);
    store.pushNotification('Vehicle repaired.', 'success');
    audioManager.playUpgradeInstalled();
    return true;
  }

  applyGraphicsQuality(quality: GraphicsQuality) {
    if (quality === 'low') {
      this.renderer.shadowMap.enabled = false;
      this.renderer.setPixelRatio(1.0);
      this.trafficManager.setMaxCars(6);
      this.pedestrianManager.setMaxPedestrians(10);
      this.lightingManager.setSunShadows(false);
    } else if (quality === 'medium') {
      this.renderer.shadowMap.enabled = true;
      this.renderer.setPixelRatio(1.0);
      this.trafficManager.setMaxCars(10);
      this.pedestrianManager.setMaxPedestrians(20);
      this.lightingManager.setSunShadows(true);
    } else {
      this.renderer.shadowMap.enabled = true;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      this.trafficManager.setMaxCars(14);
      this.pedestrianManager.setMaxPedestrians(32);
      this.lightingManager.setSunShadows(true);
    }
  }

  async switchVehicle(vehicleId: VehicleModelId) {
    const store = useGameStore.getState();
    store.setSelectedVehicleId(vehicleId);

    // Remember current position, heading, and speed
    const currentPos = this.vehicleController.position.clone();
    const currentHeading = this.vehicleController.heading;
    const currentSpeed = this.vehicleController.currentSpeed;

    // Use pre-loaded template scene from trafficManager for instant swap without network delay
    const template = this.trafficManager.getTemplate(vehicleId);
    if (template) {
      this.vehicleController.setModelFromScene(vehicleId, template);
    } else {
      await this.vehicleController.loadModel(vehicleId);
    }

    this.vehicleController.resetPosition(currentPos, currentHeading);
    this.vehicleController.currentSpeed = currentSpeed;
    this.vehicleController.repair(); // a freshly stolen car is a fresh car
    store.setVehicleHealth(100);
    this.lightingManager.attachVehicleLights(
      this.vehicleController.lightsGroup,
      this.vehicleController.trackWidth * 0.42,
      this.vehicleController.wheelBase + 0.72,
      -this.vehicleController.wheelBase - 0.72
    );
    const hlMode = this.lastHeadlightMode || store.headlightMode || 'low';
    this.lightingManager.setHeadlightMode(hlMode);
    this.vehicleController.setHeadlights(hlMode);
    this.setDayNightMode(store.dayNightMode);
  }

  public setDayNightMode(mode: DayNightMode) {
    this.lastDayNightMode = mode;
    audioManager.setDayNightAmbience(mode === 'night');
    this.dynamicSky.setMode(mode, true);
    this.lightingManager.applyMode(mode);
    this.cityEnv.setDayNightVisuals(mode);
    const hlMode = this.lastHeadlightMode || useGameStore.getState().headlightMode || 'low';
    this.lightingManager.setHeadlightMode(hlMode);
    this.vehicleController.setHeadlights(hlMode);
  }

  public setHeadlightMode(mode: HeadlightMode) {
    this.lastHeadlightMode = mode;
    this.lightingManager.setHeadlightMode(mode);
    this.vehicleController.setHeadlights(mode);
  }

  resetCar() {
    if (this.isDown) return;
    const store = useGameStore.getState();
    const wasDamaged = this.vehicleController.health < 100;
    this.vehicleController.repair();
    store.setVehicleHealth(100);
    this.vehicleController.resetPosition(DEFAULT_SPAWN_POS, 0);
    if (this.playerMode === 'on_foot' || this.playerMode === 'entering_vehicle') {
      this.playerController.setPosition(PROTAGONIST_SPAWN_POS.clone(), 0);
      this.cameraSystem.snapFootFollow(PROTAGONIST_SPAWN_POS);
      this.playerMode = 'on_foot';
      this.playerCharacter.setVisible(true);
    }
    if (wasDamaged) store.pushNotification('Vehicle reset & repaired.', 'info');
  }

  teleportToCarMeet() {
    if (this.isDown) return;
    const store = useGameStore.getState();
    const plazaPos = new THREE.Vector3(0, 0.5, 5);
    if (this.playerMode === 'driving') {
      this.vehicleController.resetPosition(plazaPos, 0);
      this.cameraSystem.snapCarFollow(plazaPos);
    } else {
      this.playerController.setPosition(plazaPos.clone(), 0);
      this.cameraSystem.snapFootFollow(plazaPos);
    }
    store.pushNotification('Teleported to Central Plaza Car Meet!', 'success');
  }

  public syncVehicleUpgrades() {
    const upgrades = useGameStore.getState().vehicleUpgrades;
    this.vehicleController.setPerformanceUpgrades(
      upgrades.engineStage,
      upgrades.boostStage,
      upgrades.handlingStage
    );
    this.vehicleController.setCustomPaintColor(upgrades.paintColor);
    this.vehicleController.setUnderglowColor(upgrades.underglowColor);
    this.vehicleController.setTaxiRoofSign(upgrades.hasTaxiSign);
  }

  private onWindowResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.cameraSystem.setAspect(width / height);
    this.renderer.setSize(width, height);
    const isMobile = isMobileDevice();
    const maxDpr = isMobile ? 1.35 : 2.0;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDpr));
  };

  dispose() {
    this.isDisposed = true;
    this.stop();
    audioManager.updateJetpack(false, 0, false);
    window.removeEventListener('resize', this.onWindowResize);
    this.scene.remove(this.playerCharacter.rootGroup);
    this.missionManager.dispose();
    this.missions.dispose();
    this.police.dispose();
    this.pedestrianManager.dispose();
    this.tireEffects.dispose();
    this.smokeEffects.dispose();
    this.bloodEffects.dispose();
    this.dynamicSky.dispose();
    this.multiplayerClient.disconnect();
    this.remotePlayerManager.dispose();
    this.carMeetManager.dispose();
    this.renderer.dispose();
    // Actually release the GL context: StrictMode double-mounts and HMR would otherwise pile up
    // live contexts until the browser starts refusing new ones ("Could not create a WebGL context").
    this.renderer.forceContextLoss();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
