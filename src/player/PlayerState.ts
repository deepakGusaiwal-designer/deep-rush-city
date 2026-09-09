export type PlayerMode = 'on_foot' | 'entering_vehicle' | 'driving' | 'exiting_vehicle';

export type CharacterAnimState =
  | 'IDLE'
  | 'WALK'
  | 'RUN'
  | 'JUMP'
  | 'FALL'
  | 'ENTER_VEHICLE'
  | 'EXIT_VEHICLE'
  | 'TUMBLE_RAGDOLL'
  | 'GET_UP'
  | 'ARRESTED'
  | 'FLY';
