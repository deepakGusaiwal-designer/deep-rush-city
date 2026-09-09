import { VehicleModelId } from '../../types/game';
import { CharacterAnimState } from '../../player/PlayerState';

export interface PlayerNetState {
  id: string;
  name: string;
  ping: number;
  mode: 'on_foot' | 'driving' | 'passenger';
  time: number;

  // On-foot position & kinematics
  position: [number, number, number];
  heading: number; // yaw in radians
  speed: number;
  animState: CharacterAnimState;
  jetpack: {
    active: boolean;
    thrust: number;
  };

  // Vehicle state (when mode === 'driving' or 'passenger')
  vehicle?: {
    modelId: VehicleModelId;
    position: [number, number, number];
    heading: number;
    speedKmh: number;
    steering: number;
    isBraking: boolean;
    isDrifting: boolean;
    headlights: 'off' | 'low' | 'high';
    paintColor: string | null;
    underglowColor: string | null;
    hasTaxiSign: boolean;
    health: number;
  };
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface RoomInfo {
  roomId: string;
  playerCount: number;
  maxPlayers: number;
  players: { id: string; name: string; ping: number }[];
}

export interface CarMeetInspectData {
  ownerId: string;
  ownerName: string;
  vehicleModelId: VehicleModelId;
  topSpeedKmh: number;
  engineStage: number;
  boostStage: number;
  handlingStage: number;
  paintColor: string | null;
  underglowColor: string | null;
  hasTaxiSign: boolean;
  health: number;
}
