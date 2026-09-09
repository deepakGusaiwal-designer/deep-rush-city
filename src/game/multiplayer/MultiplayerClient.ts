import { io, Socket } from 'socket.io-client';
import { PlayerNetState, ChatMessage, CarMeetInspectData } from './MultiplayerTypes';

const RANDOM_NAMES = [
  'TurboRider', 'NeonDrifter', 'ApexPredator', 'CityCruiser',
  'GhostRacer', 'HyperDrive', 'ViperDrift', 'SkylineKing',
  'SpeedDemon', 'UrbanLegend', 'PulseRacer', 'ShadowPilot'
];

export class MultiplayerClient {
  public socket: Socket | null = null;
  public playerId: string = '';
  public playerName: string = '';
  public roomId: string = 'downtown-plaza';
  public isConnected: boolean = false;
  public ping: number = 25;
  public onlineCount: number = 1;

  // Rate limiting (25Hz update transmission = 40ms interval)
  private lastSendTime: number = 0;
  private readonly SEND_INTERVAL_MS: number = 40;

  // Event callbacks
  public onPlayerJoined?: (id: string, name: string) => void;
  public onPlayerLeft?: (id: string, name: string) => void;
  public onPlayerUpdate?: (state: PlayerNetState) => void;
  public onExistingPlayers?: (states: PlayerNetState[]) => void;
  public onChatMessage?: (msg: ChatMessage) => void;
  public onInspectVehicleData?: (data: CarMeetInspectData) => void;
  public onConnectionChange?: (connected: boolean, count: number) => void;

  constructor() {
    this.playerName = this.loadOrGenerateName();
  }

  private loadOrGenerateName(): string {
    try {
      const saved = localStorage.getItem('deep_rush_city_player_name') || localStorage.getItem('cartoon_city_multiplayer_name');
      if (saved && saved.trim()) return saved.trim().slice(0, 16);
    } catch (_) {}
    const base = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    const num = Math.floor(10 + Math.random() * 90);
    const generated = `${base}_${num}`;
    try {
      localStorage.setItem('deep_rush_city_player_name', generated);
    } catch (_) {}
    return generated;
  }

  public setPlayerName(newName: string) {
    const clean = newName.trim().slice(0, 16);
    if (!clean) return;
    this.playerName = clean;
    try {
      localStorage.setItem('deep_rush_city_player_name', clean);
    } catch (_) {}
    if (this.socket && this.isConnected) {
      this.socket.emit('join_room', { name: this.playerName, roomId: this.roomId });
    }
  }

  public activeServerUrl: string = '';

  public resolveTargetUrl(explicitUrl?: string): string {
    if (explicitUrl && explicitUrl.trim()) {
      return explicitUrl.trim();
    }
    // 1. Check localStorage for user-entered server URL
    try {
      const stored = localStorage.getItem('deep_rush_server_url');
      if (stored && stored.trim()) return stored.trim();
    } catch (_) {}

    // 2. Check Vite environment variable (e.g. set in Vercel or .env)
    const envUrl = (import.meta as any).env?.VITE_SOCKET_SERVER_URL;
    if (envUrl && envUrl.trim()) return envUrl.trim();

    // 3. Fallback based on runtime environment:
    if (typeof window !== 'undefined') {
      const { hostname, protocol } = window.location;
      // Local development on Vite (default port 3000) -> server is on 3001
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `${protocol}//${hostname}:3001`;
      }
      // If served directly from Render (*.onrender.com) or custom domain
      return window.location.origin;
    }

    return 'http://localhost:3001';
  }

  public setServerUrl(newUrl: string) {
    const clean = newUrl.trim();
    try {
      if (clean) {
        localStorage.setItem('deep_rush_server_url', clean);
      } else {
        localStorage.removeItem('deep_rush_server_url');
      }
    } catch (_) {}
    this.reconnect(clean || undefined);
  }

  public reconnect(overrideUrl?: string) {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.onlineCount = 1;
    this.onConnectionChange?.(false, 1);
    this.connect(overrideUrl);
  }

  public connect(serverUrl?: string) {
    if (this.socket && this.socket.connected) return;

    const targetUrl = this.resolveTargetUrl(serverUrl);
    this.activeServerUrl = targetUrl;

    this.socket = io(targetUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.playerId = this.socket?.id || '';

      // Join the city room
      this.socket?.emit('join_room', {
        name: this.playerName,
        roomId: this.roomId,
      });

      this.onConnectionChange?.(true, this.onlineCount);
    });

    this.socket.on('room_joined', (data: { yourId: string; yourName: string; roomId: string; existingPlayers: PlayerNetState[] }) => {
      this.playerId = data.yourId;
      this.playerName = data.yourName;
      this.roomId = data.roomId;
      this.onlineCount = 1 + (data.existingPlayers ? data.existingPlayers.length : 0);

      if (data.existingPlayers && this.onExistingPlayers) {
        this.onExistingPlayers(data.existingPlayers);
      }
      this.onConnectionChange?.(true, this.onlineCount);
    });

    this.socket.on('player_joined', (data: { id: string; name: string }) => {
      this.onlineCount++;
      this.onPlayerJoined?.(data.id, data.name);
      this.onConnectionChange?.(true, this.onlineCount);
    });

    this.socket.on('player_left', (data: { id: string; name: string }) => {
      this.onlineCount = Math.max(1, this.onlineCount - 1);
      this.onPlayerLeft?.(data.id, data.name);
      this.onConnectionChange?.(true, this.onlineCount);
    });

    this.socket.on('player_update', (state: PlayerNetState) => {
      this.onPlayerUpdate?.(state);
    });

    this.socket.on('chat_message', (msg: ChatMessage) => {
      this.onChatMessage?.(msg);
    });

    this.socket.on('inspect_vehicle_data', (data: { ownerId: string; ownerName: string; vehicle: any }) => {
      if (this.onInspectVehicleData && data?.vehicle) {
        this.onInspectVehicleData({
          ownerId: data.ownerId,
          ownerName: data.ownerName,
          vehicleModelId: data.vehicle.modelId,
          topSpeedKmh: Math.round(data.vehicle.speedKmh || 160),
          engineStage: 3,
          boostStage: 2,
          handlingStage: 2,
          paintColor: data.vehicle.paintColor,
          underglowColor: data.vehicle.underglowColor,
          hasTaxiSign: data.vehicle.hasTaxiSign,
          health: data.vehicle.health,
        });
      }
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      this.onlineCount = 1;
      this.onConnectionChange?.(false, 1);
    });

    // Start periodic ping measurement
    this.startPingMonitor();
  }

  private startPingMonitor() {
    setInterval(() => {
      if (!this.socket || !this.isConnected) return;
      const start = performance.now();
      this.socket.emit('ping_check', start, () => {
        this.ping = Math.round(performance.now() - start);
      });
    }, 4000);
  }

  /**
   * Broadcast local player state at 25 Hz.
   */
  public sendPlayerUpdate(state: Omit<PlayerNetState, 'id' | 'name' | 'ping' | 'time'>) {
    if (!this.socket || !this.isConnected) return;

    const now = performance.now();
    if (now - this.lastSendTime < this.SEND_INTERVAL_MS) {
      return;
    }
    this.lastSendTime = now;

    const packet: PlayerNetState = {
      ...state,
      id: this.playerId,
      name: this.playerName,
      ping: this.ping,
      time: Date.now(),
    };

    this.socket.emit('player_update', packet);
  }

  public sendChatMessage(text: string) {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit('chat_send', text);
  }

  public requestInspectVehicle(targetPlayerId: string) {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit('inspect_vehicle', targetPlayerId);
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
  }
}
