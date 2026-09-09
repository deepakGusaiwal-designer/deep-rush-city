import * as THREE from 'three';
import { CITY_SCALE } from '../CityEnvironment';

export interface CarMeetZoneConfig {
  center: THREE.Vector3;
  radius: number;
  name: string;
}

export class CarMeetManager {
  private scene: THREE.Scene;
  public zone: CarMeetZoneConfig;
  private perimeterGroup: THREE.Group;
  private ringMesh: THREE.Mesh | null = null;
  private beaconPillars: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // Central Plaza location
    this.zone = {
      center: new THREE.Vector3(0, 0.05, 0),
      radius: 42.0,
      name: 'Central Plaza Car Meet',
    };

    this.perimeterGroup = new THREE.Group();
    this.scene.add(this.perimeterGroup);

    this.createCarMeetVisuals();
  }

  private createCarMeetVisuals() {
    const { center, radius } = this.zone;

    // 1. Glowing neon boundary ring on asphalt
    const ringGeo = new THREE.RingGeometry(radius - 0.4, radius + 0.4, 64);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4, // Cyan neon
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.ringMesh = new THREE.Mesh(ringGeo, ringMat);
    this.ringMesh.position.set(center.x, center.y + 0.03, center.z);
    this.perimeterGroup.add(this.ringMesh);

    // 2. Corner holographic light pillars marking meet entrance
    const pillarAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    pillarAngles.forEach((angle) => {
      const px = center.x + Math.cos(angle) * radius;
      const pz = center.z + Math.sin(angle) * radius;

      const beamGeo = new THREE.CylinderGeometry(0.2, 0.6, 12, 16, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xa855f7, // Purple neon glow
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(px, center.y + 6.0, pz);
      this.perimeterGroup.add(beam);
      this.beaconPillars.push(beam);
    });
  }

  public isInsideZone(pos: THREE.Vector3): boolean {
    const dist = Math.hypot(pos.x - this.zone.center.x, pos.z - this.zone.center.z);
    return dist <= this.zone.radius;
  }

  public update(delta: number) {
    const time = Date.now() * 0.002;
    if (this.ringMesh) {
      (this.ringMesh.material as THREE.MeshBasicMaterial).opacity = 0.60 + Math.sin(time * 2.5) * 0.20;
    }
    this.beaconPillars.forEach((p, idx) => {
      p.rotation.y += delta * (idx % 2 === 0 ? 0.6 : -0.6);
    });
  }

  public dispose() {
    this.scene.remove(this.perimeterGroup);
  }
}
