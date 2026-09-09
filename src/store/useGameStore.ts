import { create } from 'zustand';
import {
  VehicleModelId,
  DayNightMode,
  CameraMode,
  POI,
  PlayerControls,
  GameTelemetry,
  GraphicsQuality,
  VehicleUpgrades,
  CabMission,
  ActiveMission,
  SplashKind,
  GameNotification,
  NotificationKind,
  MapBlip,
  PlayerStats,
  HeadlightMode,
} from '../types/game';
import { VEHICLE_LIST, CITY_POIS } from '../data/vehicles';

const DEFAULT_UPGRADES: VehicleUpgrades = {
  engineStage: 1,
  boostStage: 1,
  handlingStage: 1,
  paintColor: null,
  underglowColor: null,
  hasTaxiSign: false,
};

const DEFAULT_CAB_MISSION: CabMission = {
  id: '',
  status: 'idle',
  passengerName: '',
  passengerQuote: '',
  pickupPos: [0, 0, 0],
  dropoffPos: [0, 0, 0],
  destinationName: '',
  timeLimit: 60,
  timeRemaining: 60,
  distanceRemaining: 0,
  baseFare: 60,
  bonusTip: 0,
  streak: 0,
};

const DEFAULT_ACTIVE_MISSION: ActiveMission = {
  id: '',
  type: null,
  status: 'idle',
  title: '',
  objective: '',
  timeLimit: 0,
  timeRemaining: 0,
  progress: 0,
  progressMax: 0,
  reward: 0,
  targetPos: null,
  targetLabel: '',
  resultText: '',
};

const DEFAULT_STATS: PlayerStats = {
  missionsPassed: 0,
  missionsFailed: 0,
  faresCompleted: 0,
  copsEvaded: 0,
  timesBusted: 0,
  timesWasted: 0,
  packagesFound: 0,
  carsWrecked: 0,
  topSpeedKmh: 0,
};

let notificationSeq = 1;

interface GameState {
  // Loading
  isLoading: boolean;
  loadingProgress: number;
  loadingMessage: string;
  setLoading: (loading: boolean, progress?: number, message?: string) => void;

  // Economy & Cash
  cash: number;
  addCash: (amount: number) => void;
  deductCash: (amount: number) => boolean;

  // Vehicle Upgrades & Customs
  vehicleUpgrades: VehicleUpgrades;
  upgradeEngine: (cost: number) => boolean;
  upgradeBoost: (cost: number) => boolean;
  upgradeHandling: (cost: number) => boolean;
  setPaintColor: (color: string | null, cost?: number) => boolean;
  setUnderglowColor: (color: string | null, cost?: number) => boolean;
  toggleTaxiSign: (cost?: number) => boolean;

  // Cab Missions
  cabMission: CabMission;
  setCabMission: (mission: Partial<CabMission>) => void;
  resetCabMission: () => void;
  navigationRoute: [number, number][];
  setNavigationRoute: (route: [number, number][]) => void;

  // GTA Missions
  activeMission: ActiveMission;
  setActiveMission: (mission: Partial<ActiveMission>) => void;
  resetActiveMission: () => void;
  isMissionMenuOpen: boolean;
  setMissionMenuOpen: (open: boolean) => void;
  packagesCollected: string[];
  collectPackage: (id: string) => void;

  // Player Vitals & Law
  health: number;
  armor: number;
  setVitals: (health: number, armor: number) => void;
  vehicleHealth: number;
  setVehicleHealth: (hp: number) => void;
  wantedLevel: number;
  wantedHeat: number;
  setWanted: (level: number, heat: number) => void;

  // Screen splash (WASTED / BUSTED / MISSION PASSED)
  splash: SplashKind;
  splashSubtitle: string;
  setSplash: (kind: SplashKind, subtitle?: string) => void;

  // Toast feed
  notifications: GameNotification[];
  pushNotification: (text: string, kind?: NotificationKind) => void;
  removeNotification: (id: number) => void;

  // Minimap blips (cops, targets, packages)
  blips: MapBlip[];
  setBlips: (blips: MapBlip[]) => void;

  // Lifetime stats
  stats: PlayerStats;
  bumpStat: (key: keyof PlayerStats, amount?: number) => void;
  setStat: (key: keyof PlayerStats, value: number) => void;

  // UI Modals
  isCustomsOpen: boolean;
  setCustomsOpen: (open: boolean) => void;

  // Selected Vehicle
  selectedVehicleId: VehicleModelId;
  setSelectedVehicleId: (id: VehicleModelId) => void;

  // Visuals & Environment
  dayNightMode: DayNightMode;
  setDayNightMode: (mode: DayNightMode) => void;
  toggleDayNight: () => void;
  isAutoTimeCycle: boolean;
  setAutoTimeCycle: (enabled: boolean) => void;
  toggleAutoTimeCycle: () => void;

  // Vehicle Headlights
  headlightMode: HeadlightMode;
  setHeadlightMode: (mode: HeadlightMode) => void;
  cycleHeadlightMode: () => void;

  // Graphics Quality
  graphicsQuality: GraphicsQuality;
  setGraphicsQuality: (q: GraphicsQuality) => void;
  cycleGraphicsQuality: () => void;

  // Camera
  cameraMode: CameraMode;
  setCameraMode: (mode: CameraMode) => void;
  cycleCameraMode: () => void;

  // Sound
  isMuted: boolean;
  toggleMute: () => void;

  // UI Modals
  isGarageOpen: boolean;
  setGarageOpen: (open: boolean) => void;
  activePOI: POI | null;
  setActivePOI: (poi: POI | null) => void;
  discoveredPOIs: string[];
  markPOIDiscovered: (id: string) => void;

  // Telemetry (updated by physics loop)
  telemetry: GameTelemetry;
  updateTelemetry: (data: Partial<GameTelemetry>) => void;

  // Input Controls (Keyboard + Touch)
  controls: PlayerControls;
  setControl: (key: keyof PlayerControls, active: boolean) => void;
  setAnalogInput: (x: number, y: number) => void;
  resetControls: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  isLoading: true,
  loadingProgress: 0,
  loadingMessage: 'Initializing 3D World...',
  setLoading: (loading, progress, message) => set(state => ({
    isLoading: loading,
    loadingProgress: progress !== undefined ? progress : state.loadingProgress,
    loadingMessage: message !== undefined ? message : state.loadingMessage,
  })),

  // Economy & Cash
  cash: 150,
  addCash: (amount: number) => set((state) => ({ cash: Math.max(0, state.cash + amount) })),
  deductCash: (amount: number) => {
    const current = get().cash;
    if (current >= amount) {
      set({ cash: current - amount });
      return true;
    }
    return false;
  },

  // Vehicle Upgrades & Customs
  vehicleUpgrades: { ...DEFAULT_UPGRADES },
  upgradeEngine: (cost: number) => {
    if (get().deductCash(cost)) {
      set((state) => ({
        vehicleUpgrades: {
          ...state.vehicleUpgrades,
          engineStage: Math.min(5, state.vehicleUpgrades.engineStage + 1),
        },
      }));
      return true;
    }
    return false;
  },
  upgradeBoost: (cost: number) => {
    if (get().deductCash(cost)) {
      set((state) => ({
        vehicleUpgrades: {
          ...state.vehicleUpgrades,
          boostStage: Math.min(4, state.vehicleUpgrades.boostStage + 1),
        },
      }));
      return true;
    }
    return false;
  },
  upgradeHandling: (cost: number) => {
    if (get().deductCash(cost)) {
      set((state) => ({
        vehicleUpgrades: {
          ...state.vehicleUpgrades,
          handlingStage: Math.min(3, state.vehicleUpgrades.handlingStage + 1),
        },
      }));
      return true;
    }
    return false;
  },
  setPaintColor: (color: string | null, cost: number = 0) => {
    if (cost > 0 && !get().deductCash(cost)) return false;
    set((state) => ({
      vehicleUpgrades: {
        ...state.vehicleUpgrades,
        paintColor: color,
      },
    }));
    return true;
  },
  setUnderglowColor: (color: string | null, cost: number = 0) => {
    if (cost > 0 && !get().deductCash(cost)) return false;
    set((state) => ({
      vehicleUpgrades: {
        ...state.vehicleUpgrades,
        underglowColor: color,
      },
    }));
    return true;
  },
  toggleTaxiSign: (cost: number = 0) => {
    const current = get().vehicleUpgrades.hasTaxiSign;
    if (!current && cost > 0 && !get().deductCash(cost)) return false;
    set((state) => ({
      vehicleUpgrades: {
        ...state.vehicleUpgrades,
        hasTaxiSign: !current,
      },
    }));
    return true;
  },

  // Cab Missions
  cabMission: { ...DEFAULT_CAB_MISSION },
  setCabMission: (mission: Partial<CabMission>) =>
    set((state) => ({ cabMission: { ...state.cabMission, ...mission } })),
  resetCabMission: () =>
    set({ cabMission: { ...DEFAULT_CAB_MISSION }, navigationRoute: [] }),
  navigationRoute: [],
  setNavigationRoute: (route: [number, number][]) => set({ navigationRoute: route }),

  // GTA Missions
  activeMission: { ...DEFAULT_ACTIVE_MISSION },
  setActiveMission: (mission) =>
    set((state) => ({ activeMission: { ...state.activeMission, ...mission } })),
  resetActiveMission: () => set({ activeMission: { ...DEFAULT_ACTIVE_MISSION } }),
  isMissionMenuOpen: false,
  setMissionMenuOpen: (open) => set({ isMissionMenuOpen: open }),
  packagesCollected: [],
  collectPackage: (id) => set((state) => ({
    packagesCollected: state.packagesCollected.includes(id)
      ? state.packagesCollected
      : [...state.packagesCollected, id],
  })),

  // Player Vitals & Law
  health: 100,
  armor: 0,
  setVitals: (health, armor) => set({
    health: Math.max(0, Math.min(100, health)),
    armor: Math.max(0, Math.min(100, armor)),
  }),
  vehicleHealth: 100,
  setVehicleHealth: (hp) => set({ vehicleHealth: Math.max(0, Math.min(100, hp)) }),
  wantedLevel: 0,
  wantedHeat: 0,
  setWanted: (level, heat) => set({ wantedLevel: level, wantedHeat: heat }),

  // Splash
  splash: null,
  splashSubtitle: '',
  setSplash: (kind, subtitle = '') => set({ splash: kind, splashSubtitle: subtitle }),

  // Toast feed
  notifications: [],
  pushNotification: (text, kind = 'info') => set((state) => {
    const next: GameNotification = { id: notificationSeq++, text, kind, createdAt: Date.now() };
    // Keep the feed short like a GTA phone/notification stack
    const trimmed = [...state.notifications, next].slice(-5);
    return { notifications: trimmed };
  }),
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter((n) => n.id !== id),
  })),

  // Minimap blips
  blips: [],
  setBlips: (blips) => set({ blips }),

  // Stats
  stats: { ...DEFAULT_STATS },
  bumpStat: (key, amount = 1) => set((state) => ({
    stats: { ...state.stats, [key]: state.stats[key] + amount },
  })),
  setStat: (key, value) => set((state) => ({
    stats: { ...state.stats, [key]: value },
  })),

  // UI Modals
  isCustomsOpen: false,
  setCustomsOpen: (open: boolean) => set({ isCustomsOpen: open }),

  selectedVehicleId: 'Car_06',
  setSelectedVehicleId: (id) => set({ selectedVehicleId: id }),

  dayNightMode: 'day',
  setDayNightMode: (mode) => set({ dayNightMode: mode }),
  toggleDayNight: () => {
    const modes: DayNightMode[] = ['day', 'sunset', 'night'];
    const currIdx = modes.indexOf(get().dayNightMode);
    set({
      dayNightMode: modes[(currIdx + 1) % modes.length],
      isAutoTimeCycle: false,
    });
  },
  isAutoTimeCycle: false,
  setAutoTimeCycle: (enabled) => set({ isAutoTimeCycle: enabled }),
  toggleAutoTimeCycle: () => set((state) => ({ isAutoTimeCycle: !state.isAutoTimeCycle })),

  headlightMode: 'low',
  setHeadlightMode: (mode) => set({ headlightMode: mode }),
  cycleHeadlightMode: () => {
    const modes: HeadlightMode[] = ['off', 'low', 'high'];
    const currIdx = modes.indexOf(get().headlightMode);
    set({ headlightMode: modes[(currIdx + 1) % modes.length] });
  },

  graphicsQuality: 'medium',
  setGraphicsQuality: (q) => set({ graphicsQuality: q }),
  cycleGraphicsQuality: () => {
    const qualities: GraphicsQuality[] = ['low', 'medium', 'high'];
    const currIdx = qualities.indexOf(get().graphicsQuality);
    set({ graphicsQuality: qualities[(currIdx + 1) % qualities.length] });
  },

  cameraMode: 'chase',
  setCameraMode: (mode) => set({ cameraMode: mode }),
  cycleCameraMode: () => {
    const modes: CameraMode[] = ['chase', 'cockpit', 'orbit', 'topdown'];
    const currIdx = modes.indexOf(get().cameraMode);
    set({ cameraMode: modes[(currIdx + 1) % modes.length] });
  },

  isMuted: false,
  toggleMute: () => set(state => ({ isMuted: !state.isMuted })),

  isGarageOpen: false,
  setGarageOpen: (open) => set({ isGarageOpen: open }),

  activePOI: null,
  setActivePOI: (poi) => set({ activePOI: poi }),
  discoveredPOIs: [],
  markPOIDiscovered: (id) => set(state => ({
    discoveredPOIs: state.discoveredPOIs.includes(id)
      ? state.discoveredPOIs
      : [...state.discoveredPOIs, id]
  })),

  telemetry: {
    speedKmh: 0,
    rpm: 800,
    gear: 'N',
    isDrifting: false,
    driftScore: 0,
    carPosition: [0, 0, 0],
    carHeadingRad: 0,
    activePOI: null,
    trafficLight: 'green',
    lightTimer: 7,
    playerMode: 'on_foot',
    interactionPrompt: null,
    health: 100,
    armor: 0,
    vehicleHealth: 100,
    wantedLevel: 0,
    wantedHeat: 0,
    gForce: 0,
    jetpackActive: false,
    jetpackFuel: 100,
    altitude: 0,
    headlightMode: 'low',
  },
  updateTelemetry: (data) => set(state => ({
    telemetry: { ...state.telemetry, ...data }
  })),

  controls: {
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
  },
  setControl: (key, active) => set(state => ({
    controls: { ...state.controls, [key]: active }
  })),
  setAnalogInput: (x, y) => set(state => ({
    controls: {
      ...state.controls,
      analogX: x,
      analogY: y,
      forward: y < -0.25,
      backward: y > 0.25,
      left: x < -0.25,
      right: x > 0.25,
    }
  })),
  resetControls: () => set({
    controls: {
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
    }
  })
}));
