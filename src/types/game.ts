export type VehicleModelId =
  | 'Car_06'
  | 'Car_13'
  | 'Car_16'
  | 'Car_19'
  | 'Futuristic_Car_1'
  | 'Van'
  | 'Bus';

export interface VehicleStats {
  id: VehicleModelId;
  name: string;
  category: string;
  description: string;
  topSpeedKmh: number;
  acceleration: number; // 0 - 100 normalized
  handling: number;     // 0 - 100 normalized
  mass: number;         // kg
  driftFactor: number;
  colorHex: string;
  modelFile: string;
  wheelScale?: number;
  drivetrain?: 'rwd' | 'fwd' | 'awd';
}

export type DayNightMode = 'day' | 'sunset' | 'night';
export type CameraMode = 'chase' | 'cockpit' | 'orbit' | 'topdown';
export type GraphicsQuality = 'low' | 'medium' | 'high';
export type TrafficLightColor = 'green' | 'yellow' | 'red';
export type HeadlightMode = 'off' | 'low' | 'high';

export interface POI {
  id: string;
  name: string;
  category: 'Landmark' | 'Garage' | 'Plaza' | 'Transit' | 'Scenic';
  description: string;
  position: [number, number, number];
  color: string;
  rewardText?: string;
}

export type PlayerMode = 'on_foot' | 'entering_vehicle' | 'driving' | 'exiting_vehicle';

export interface PlayerControls {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
  horn: boolean;
  boost: boolean;
  interact?: boolean;
  /** Jetpack: push down (Ctrl) */
  descend?: boolean;
  /** Parachute deploy/cut (P) */
  parachute?: boolean;
  /** Analog thumb movement vector (-1.0 to 1.0) */
  analogX?: number;
  analogY?: number;
}

export interface GameTelemetry {
  speedKmh: number;
  rpm: number;
  gear: 'R' | 'N' | 'D' | '1' | '2' | '3' | '4' | '5' | '6' | string;
  isDrifting: boolean;
  driftScore: number;
  carPosition: [number, number, number];
  carHeadingRad: number; // yaw angle in radians
  activePOI: POI | null;
  trafficLight: TrafficLightColor;
  lightTimer: number;
  playerMode: PlayerMode;
  interactionPrompt: string | null;
  health: number;
  armor: number;
  vehicleHealth: number;
  wantedLevel: number;
  wantedHeat: number;
  gForce: number; // lateral G for the speedo
  jetpackActive: boolean;
  jetpackFuel: number; // 0..100
  parachuteActive: boolean;
  altitude: number;    // metres above street level
  headlightMode: HeadlightMode;
}

export interface VehicleUpgrades {
  engineStage: number;    // 1 to 5 (Stock -> Street -> Turbo -> Racing V8 -> Hyperdrive)
  boostStage: number;     // 1 to 4 (Stock -> NOS -> Dual Injectors -> Rocket Booster)
  handlingStage: number;  // 1 to 3 (Stock -> Sport Compound -> Drift Slicks)
  paintColor: string | null; // custom body paint hex or null for stock
  underglowColor: string | null; // underglow neon hex or null for off
  hasTaxiSign: boolean;
}

export type CabMissionStatus =
  | 'idle'
  | 'pickup'
  | 'passenger_entering'
  | 'driving'
  | 'passenger_exiting'
  | 'completed'
  | 'failed';

export interface CabMission {
  id: string;
  status: CabMissionStatus;
  passengerName: string;
  passengerQuote: string;
  pickupPos: [number, number, number];
  dropoffPos: [number, number, number];
  destinationName: string;
  timeLimit: number;
  timeRemaining: number;
  distanceRemaining: number;
  baseFare: number;
  bonusTip: number;
  streak: number;
  lastPayout?: number;
}

// ---------------------------------------------------------------------------
// GTA-style open world systems
// ---------------------------------------------------------------------------

export type MissionType = 'delivery' | 'race' | 'heist' | 'vigilante';

export type MissionStatus = 'idle' | 'active' | 'passed' | 'failed';

export interface MissionDefinition {
  id: string;
  type: MissionType;
  title: string;
  giver: string;          // who hands you the job (flavor text)
  description: string;
  reward: number;
  difficulty: 1 | 2 | 3;
  icon: string;           // emoji
  color: string;          // accent hex
  /** World-space XZ of the in-world mission marker */
  markerPos: [number, number];
}

export interface ActiveMission {
  id: string;
  type: MissionType | null;
  status: MissionStatus;
  title: string;
  objective: string;
  /** seconds; 0 = untimed */
  timeLimit: number;
  timeRemaining: number;
  progress: number;
  progressMax: number;
  reward: number;
  /** World-space target for the HUD arrow / minimap; null when none */
  targetPos: [number, number, number] | null;
  targetLabel: string;
  /** Latest pass/fail summary line */
  resultText: string;
}

export type SplashKind = 'wasted' | 'busted' | 'mission_passed' | 'mission_failed' | null;

export type NotificationKind = 'info' | 'cash' | 'wanted' | 'danger' | 'success';

export interface GameNotification {
  id: number;
  text: string;
  kind: NotificationKind;
  createdAt: number;
}

export type BlipKind = 'cop' | 'mission' | 'package' | 'hospital' | 'suspect' | 'marker' | 'player';

export interface MapBlip {
  x: number;
  z: number;
  kind: BlipKind;
  color: string;
  /** radians; only used for directional blips (cops) */
  heading?: number;
  label?: string;
}

export interface PlayerStats {
  missionsPassed: number;
  missionsFailed: number;
  faresCompleted: number;
  copsEvaded: number;
  timesBusted: number;
  timesWasted: number;
  packagesFound: number;
  carsWrecked: number;
  topSpeedKmh: number;
}
