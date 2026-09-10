import * as THREE from 'three';
import { PlayerNetState, CarMeetInspectData } from './MultiplayerTypes';
import { PlayerCharacter } from '../../player/PlayerCharacter';
import { TrafficManager } from '../TrafficManager';
import { VehicleModelId, MapBlip } from '../../types/game';

interface RemoteSnapshot {
  time: number;
  position: THREE.Vector3;
  heading: number;
  speedKmh: number;
  steering: number;
  animState: string;
  jetpackActive: boolean;
  jetpackThrust: number;
  mode: 'on_foot' | 'driving' | 'passenger';
  vehicle?: PlayerNetState['vehicle'];
}

interface RemotePlayerEntity {
  id: string;
  name: string;
  ping: number;
  mode: 'on_foot' | 'driving' | 'passenger';

  // On-foot 3D character
  character: PlayerCharacter;

  // Vehicle mesh
  vehicleGroup: THREE.Group;
  currentVehicleModelId: VehicleModelId | null;
  wheels: {
    fl: THREE.Object3D | null;
    fr: THREE.Object3D | null;
    rl: THREE.Object3D | null;
    rr: THREE.Object3D | null;
  };
  underglowMesh: THREE.Mesh | null;
  underglowMat: THREE.MeshBasicMaterial | null;

  // Overhead 3D Nametag
  nametagSprite: THREE.Sprite;
  nametagCanvas: HTMLCanvasElement;
  nametagTexture: THREE.CanvasTexture;
  lastNametagKey: string;

  // Interpolation buffer
  snapshots: RemoteSnapshot[];
  currentPos: THREE.Vector3;
  currentHeading: number;
  lastPacketTime: number;
  lastVehicleData?: PlayerNetState['vehicle'];
}

export class RemotePlayerManager {
  private scene: THREE.Scene;
  private trafficManager: TrafficManager;
  private players = new Map<string, RemotePlayerEntity>();

  // Entity Interpolation delay (~80ms = 2 packet intervals at 25Hz)
  private readonly INTERPOLATION_DELAY_MS = 80;

  constructor(scene: THREE.Scene, trafficManager: TrafficManager) {
    this.scene = scene;
    this.trafficManager = trafficManager;
  }

  public handlePlayerJoined(id: string, name: string) {
    if (this.players.has(id)) return;
    this.createPlayerEntity(id, name);
  }

  public handlePlayerLeft(id: string) {
    const player = this.players.get(id);
    if (!player) return;

    this.scene.remove(player.character.rootGroup);
    this.scene.remove(player.vehicleGroup);
    this.scene.remove(player.nametagSprite);

    player.nametagTexture.dispose();
    this.players.delete(id);
  }

  public handlePlayerUpdate(state: PlayerNetState) {
    let player = this.players.get(state.id);
    if (!player) {
      player = this.createPlayerEntity(state.id, state.name || `Player_${state.id.slice(0, 4)}`);
    }

    player.name = state.name || player.name;
    player.ping = state.ping || player.ping;
    player.mode = state.mode;
    player.lastPacketTime = performance.now();
    if (state.vehicle) {
      player.lastVehicleData = state.vehicle;
    }

    const pos = new THREE.Vector3(state.position[0], state.position[1], state.position[2]);

    if (player.snapshots.length === 0) {
      player.currentPos.copy(pos);
      player.currentHeading = state.heading;
    }

    player.snapshots.push({
      time: performance.now(),
      position: pos,
      heading: state.heading,
      speedKmh: state.speed || 0,
      steering: state.vehicle?.steering || 0,
      animState: state.animState || 'IDLE',
      jetpackActive: state.jetpack?.active || false,
      jetpackThrust: state.jetpack?.thrust || 0,
      mode: state.mode,
      vehicle: state.vehicle,
    });

    // Prune buffer: keep only last 12 snapshots
    if (player.snapshots.length > 12) {
      player.snapshots.shift();
    }
  }

  public handleExistingPlayers(existing: PlayerNetState[]) {
    existing.forEach((st) => this.handlePlayerUpdate(st));
  }

  private createPlayerEntity(id: string, name: string): RemotePlayerEntity {
    // 1. Procedural character avatar
    const character = new PlayerCharacter();
    this.scene.add(character.rootGroup);

    // 2. Vehicle container group
    const vehicleGroup = new THREE.Group();
    this.scene.add(vehicleGroup);

    // 3. Overhead 3D nametag billboard
    const nametagCanvas = document.createElement('canvas');
    nametagCanvas.width = 256;
    nametagCanvas.height = 64;
    const nametagTexture = new THREE.CanvasTexture(nametagCanvas);
    nametagTexture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: nametagTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const nametagSprite = new THREE.Sprite(spriteMat);
    nametagSprite.scale.set(2.4, 0.6, 1.0);
    this.scene.add(nametagSprite);

    const entity: RemotePlayerEntity = {
      id,
      name,
      ping: 25,
      mode: 'on_foot',
      character,
      vehicleGroup,
      currentVehicleModelId: null,
      wheels: { fl: null, fr: null, rl: null, rr: null },
      underglowMesh: null,
      underglowMat: null,
      nametagSprite,
      nametagCanvas,
      nametagTexture,
      lastNametagKey: '',
      snapshots: [],
      currentPos: new THREE.Vector3(0, 0, 0),
      currentHeading: 0,
      lastPacketTime: performance.now(),
    };

    this.players.set(id, entity);
    this.updateNametagSprite(entity);

    return entity;
  }

  private updateNametagSprite(player: RemotePlayerEntity) {
    const key = `${player.name}_${player.mode}_${player.ping}`;
    if (player.lastNametagKey === key) return;
    player.lastNametagKey = key;

    const canvas = player.nametagCanvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 256, 64);

    // Glassmorphic rounded pill background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.strokeStyle = player.mode === 'driving' ? 'rgba(6, 182, 212, 0.85)' : 'rgba(16, 185, 129, 0.85)';
    ctx.lineWidth = 2.5;

    const r = 14;
    const x = 8, y = 8, w = 240, h = 48;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Ping status dot
    ctx.fillStyle = player.ping < 70 ? '#10b981' : player.ping < 130 ? '#f59e0b' : '#ef4444';
    ctx.beginPath();
    ctx.arc(26, 32, 5, 0, Math.PI * 2);
    ctx.fill();

    // Player Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 19px system-ui, -apple-system, sans-serif';
    ctx.fillText(player.name, 40, 31);

    // Mode tag
    ctx.fillStyle = player.mode === 'driving' ? '#38bdf8' : '#34d399';
    ctx.font = 'bold 11px monospace';
    const tag = player.mode === 'driving' ? '🏎️ DRIVING' : '🚶 ON FOOT';
    ctx.fillText(`${tag} · ${player.ping}ms`, 40, 47);

    player.nametagTexture.needsUpdate = true;
  }

  public update(delta: number) {
    const renderTime = performance.now() - this.INTERPOLATION_DELAY_MS;

    this.players.forEach((player) => {
      // 1. Snapshot Interpolation / Dead Reckoning
      if (player.snapshots.length >= 2) {
        let s0: RemoteSnapshot | null = null;
        let s1: RemoteSnapshot | null = null;

        for (let i = 0; i < player.snapshots.length - 1; i++) {
          if (player.snapshots[i].time <= renderTime && player.snapshots[i + 1].time >= renderTime) {
            s0 = player.snapshots[i];
            s1 = player.snapshots[i + 1];
            break;
          }
        }

        if (s0 && s1) {
          const t = Math.max(0, Math.min(1, (renderTime - s0.time) / (s1.time - s0.time)));
          player.currentPos.lerpVectors(s0.position, s1.position, t);

          // Shortest arc rotation interpolation
          let diff = s1.heading - s0.heading;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          player.currentHeading = s0.heading + diff * t;

          // Apply wheel steering
          if (player.wheels.fl && player.wheels.fr) {
            const steer = THREE.MathUtils.lerp(s0.steering, s1.steering, t);
            player.wheels.fl.rotation.y = steer;
            player.wheels.fr.rotation.y = steer;
          }
        } else {
          // Extrapolate past latest packet
          const latest = player.snapshots[player.snapshots.length - 1];
          player.currentPos.copy(latest.position);
          player.currentHeading = latest.heading;
        }
      } else if (player.snapshots.length === 1) {
        player.currentPos.copy(player.snapshots[0].position);
        player.currentHeading = player.snapshots[0].heading;
      }

      // 2. Mode Representation (On Foot vs Driving)
      const isDriving = player.mode === 'driving' || player.mode === 'passenger';

      if (isDriving && player.lastVehicleData) {
        player.character.rootGroup.visible = false;
        player.vehicleGroup.visible = true;

        // Ensure proper vehicle model mesh is loaded
        if (player.currentVehicleModelId !== player.lastVehicleData.modelId) {
          this.switchRemoteVehicleModel(player, player.lastVehicleData.modelId);
        }

        player.vehicleGroup.position.copy(player.currentPos);
        player.vehicleGroup.rotation.y = player.currentHeading;

        // Update custom underglow color if set
        if (player.underglowMat && player.lastVehicleData.underglowColor) {
          player.underglowMat.color.setStyle(player.lastVehicleData.underglowColor);
          player.underglowMat.opacity = 0.85;
          if (player.underglowMesh) player.underglowMesh.visible = true;
        } else if (player.underglowMesh) {
          player.underglowMesh.visible = false;
        }

        // Position nametag above vehicle
        player.nametagSprite.position.set(player.currentPos.x, player.currentPos.y + 2.35, player.currentPos.z);
      } else {
        // On Foot
        player.vehicleGroup.visible = false;
        player.character.rootGroup.visible = true;

        player.character.rootGroup.position.copy(player.currentPos);
        player.character.rootGroup.rotation.y = player.currentHeading;

        const latestSnap = player.snapshots[player.snapshots.length - 1];
        const anim = (latestSnap?.animState as any) || 'IDLE';
        const speed = latestSnap?.speedKmh || 0;
        player.character.update(delta, anim, speed);

        if (latestSnap?.jetpackActive !== undefined) {
          player.character.setJetpack(latestSnap.jetpackActive, latestSnap.jetpackThrust || 0);
        }

        // Position nametag above character head
        player.nametagSprite.position.set(player.currentPos.x, player.currentPos.y + 2.15, player.currentPos.z);
      }

      this.updateNametagSprite(player);
    });

    // Cleanup stale disconnected players (no packets for > 15 seconds)
    const now = performance.now();
    const staleIds: string[] = [];
    this.players.forEach((player, id) => {
      if (now - player.lastPacketTime > 15000) {
        staleIds.push(id);
      }
    });
    staleIds.forEach((id) => this.handlePlayerLeft(id));
  }

  private switchRemoteVehicleModel(player: RemotePlayerEntity, modelId: VehicleModelId) {
    // Clear old vehicle mesh
    while (player.vehicleGroup.children.length > 0) {
      player.vehicleGroup.remove(player.vehicleGroup.children[0]);
    }

    const template = this.trafficManager.getTemplate(modelId) || this.trafficManager.getTemplate('Car_06');
    if (!template) return;

    const clone = template.clone(true);
    player.vehicleGroup.add(clone);
    player.currentVehicleModelId = modelId;

    player.wheels = { fl: null, fr: null, rl: null, rr: null };
    clone.traverse((child) => {
      const name = child.name;
      if (name.includes('Wheel_Front_Left')) player.wheels.fl = child;
      else if (name.includes('Wheel_Front_Right')) player.wheels.fr = child;
      else if (name.includes('Wheel_Rear_Left')) player.wheels.rl = child;
      else if (name.includes('Wheel_Rear_Right')) player.wheels.rr = child;

      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Attach neon underglow ribbon plane
    const underglowGeo = new THREE.PlaneGeometry(2.0, 4.4);
    underglowGeo.rotateX(-Math.PI / 2);
    player.underglowMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    player.underglowMesh = new THREE.Mesh(underglowGeo, player.underglowMat);
    player.underglowMesh.position.y = 0.08;
    player.vehicleGroup.add(player.underglowMesh);
  }

  /**
   * Returns live Minimap blips for each remote player.
   */
  public getBlips(): MapBlip[] {
    const blips: MapBlip[] = [];
    this.players.forEach((p) => {
      blips.push({
        x: p.currentPos.x,
        z: p.currentPos.z,
        kind: 'player',
        color: p.mode === 'driving' ? '#00f0ff' : '#10b981',
        heading: p.currentHeading,
        label: p.name,
      });
    });
    return blips;
  }

  /**
   * Returns active online players with distance calculations.
   */
  public getOnlinePlayersList(localPos?: THREE.Vector3) {
    const list: Array<{ id: string; name: string; mode: 'on_foot' | 'driving' | 'passenger'; ping: number; distance: number }> = [];
    this.players.forEach((p) => {
      const dist = localPos ? Math.round(p.currentPos.distanceTo(localPos)) : 0;
      list.push({ id: p.id, name: p.name, mode: p.mode, ping: p.ping, distance: dist });
    });
    return list;
  }

  /**
   * Check if local player is near a remote player's vehicle to inspect at Car Meets.
   */
  public getNearbyVehicleToInspect(localPos: THREE.Vector3, maxDist: number = 3.6): CarMeetInspectData | null {
    let bestDist = maxDist;
    let target: CarMeetInspectData | null = null;

    this.players.forEach((p) => {
      if (p.mode === 'driving' && p.lastVehicleData) {
        const d = p.currentPos.distanceTo(localPos);
        if (d < bestDist) {
          bestDist = d;
          target = {
            ownerId: p.id,
            ownerName: p.name,
            vehicleModelId: p.lastVehicleData.modelId,
            topSpeedKmh: Math.round(p.lastVehicleData.speedKmh),
            engineStage: 3,
            boostStage: 2,
            handlingStage: 2,
            paintColor: p.lastVehicleData.paintColor,
            underglowColor: p.lastVehicleData.underglowColor,
            hasTaxiSign: p.lastVehicleData.hasTaxiSign,
            health: p.lastVehicleData.health,
          };
        }
      }
    });

    return target;
  }

  public dispose() {
    this.players.forEach((p) => {
      this.scene.remove(p.character.rootGroup);
      this.scene.remove(p.vehicleGroup);
      this.scene.remove(p.nametagSprite);
      p.nametagTexture.dispose();
    });
    this.players.clear();
  }
}
