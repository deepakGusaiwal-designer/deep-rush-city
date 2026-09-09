import type { Server, Socket } from 'socket.io';

export interface PlayerNetState {
  id: string;
  name: string;
  ping: number;
  mode: 'on_foot' | 'driving' | 'passenger';
  time: number;
  position: [number, number, number];
  heading: number;
  speed: number;
  animState: string;
  jetpack: {
    active: boolean;
    thrust: number;
  };
  vehicle?: {
    modelId: string;
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

interface RoomPlayer {
  id: string;
  name: string;
  roomId: string;
  lastState?: PlayerNetState;
  ping: number;
}

const players = new Map<string, RoomPlayer>();
const DEFAULT_ROOM = 'downtown-plaza';

export function setupSocketServer(io: Server) {
  io.on('connection', (socket: Socket) => {
    let currentRoom = DEFAULT_ROOM;
    let playerName = `Rider_${Math.floor(100 + Math.random() * 900)}`;

    socket.on('join_room', (data: { name?: string; roomId?: string }) => {
      if (data?.name && typeof data.name === 'string') {
        playerName = data.name.trim().slice(0, 16) || playerName;
      }
      if (data?.roomId && typeof data.roomId === 'string') {
        currentRoom = data.roomId.trim().slice(0, 32) || DEFAULT_ROOM;
      }

      socket.join(currentRoom);

      players.set(socket.id, {
        id: socket.id,
        name: playerName,
        roomId: currentRoom,
        ping: 20,
      });

      // Send list of all existing players in this room to the newly joined client
      const existingPlayersInRoom: PlayerNetState[] = [];
      players.forEach((p) => {
        if (p.roomId === currentRoom && p.id !== socket.id && p.lastState) {
          existingPlayersInRoom.push(p.lastState);
        }
      });

      socket.emit('room_joined', {
        yourId: socket.id,
        yourName: playerName,
        roomId: currentRoom,
        existingPlayers: existingPlayersInRoom,
      });

      // Notify other players in the room
      socket.to(currentRoom).emit('player_joined', {
        id: socket.id,
        name: playerName,
      });

      // Send system chat message
      io.to(currentRoom).emit('chat_message', {
        id: `sys_${Date.now()}_${Math.random()}`,
        senderId: 'SYSTEM',
        senderName: 'CITY RADIO',
        text: `🚗 ${playerName} entered the city!`,
        timestamp: Date.now(),
        isSystem: true,
      });
    });

    // 25Hz state broadcast relay
    socket.on('player_update', (state: PlayerNetState) => {
      const p = players.get(socket.id);
      if (!p) return;

      state.id = socket.id;
      state.name = p.name;
      p.lastState = state;

      // Relay to all other clients in the same room
      socket.to(p.roomId).emit('player_update', state);
    });

    // Chat messages
    socket.on('chat_send', (text: string) => {
      const p = players.get(socket.id);
      if (!p || typeof text !== 'string') return;
      const cleanText = text.trim().slice(0, 140);
      if (!cleanText) return;

      io.to(p.roomId).emit('chat_message', {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        senderId: socket.id,
        senderName: p.name,
        text: cleanText,
        timestamp: Date.now(),
        isSystem: false,
      });
    });

    // Vehicle inspection request for Car Meets
    socket.on('inspect_vehicle', (targetPlayerId: string) => {
      const target = players.get(targetPlayerId);
      if (target?.lastState?.vehicle) {
        socket.emit('inspect_vehicle_data', {
          ownerId: target.id,
          ownerName: target.name,
          vehicle: target.lastState.vehicle,
        });
      }
    });

    // Ping check
    socket.on('ping_check', (timestamp: number, callback: () => void) => {
      if (typeof callback === 'function') callback();
    });

    socket.on('disconnect', () => {
      const p = players.get(socket.id);
      if (p) {
        players.delete(socket.id);
        socket.to(p.roomId).emit('player_left', {
          id: socket.id,
          name: p.name,
        });

        io.to(p.roomId).emit('chat_message', {
          id: `sys_${Date.now()}`,
          senderId: 'SYSTEM',
          senderName: 'CITY RADIO',
          text: `${p.name} left the city.`,
          timestamp: Date.now(),
          isSystem: true,
        });
      }
    });
  });
}
