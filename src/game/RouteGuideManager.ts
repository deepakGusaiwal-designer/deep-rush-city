import * as THREE from 'three';
import { CITY_SCALE } from './CityEnvironment';
import { CityTextures } from './CityTextures';

// Grid-aligned avenue X coordinates and street Z coordinates
export const ALL_AVENUES_X = [-131.25, -93.75, -56.25, -18.75, 18.75, 56.25, 93.75, 131.25];
export const ALL_STREETS_Z = [-168.75, -131.25, -93.75, -56.25, -18.75, 18.75, 56.25, 93.75, 131.25, 168.75];

export class RouteGuideManager {
  private scene: THREE.Scene;
  public activeRoutePoints: THREE.Vector3[] = [];

  // 3D Road Mesh & Materials
  private ribbonMesh: THREE.Mesh | null = null;
  private ribbonGeometry: THREE.BufferGeometry | null = null;
  private ribbonMaterial: THREE.MeshBasicMaterial;
  private chevronTexture: THREE.CanvasTexture;

  // Turn checkpoint beacons at corner intersections
  private turnBeaconsGroup: THREE.Group;

  // State
  public isVisible: boolean = false;
  private currentMode: 'pickup' | 'dropoff' = 'pickup';
  private targetDestination = new THREE.Vector3();
  private lastCarPos = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.chevronTexture = CityTextures.getRouteChevronTexture();

    this.ribbonMaterial = new THREE.MeshBasicMaterial({
      map: this.chevronTexture,
      transparent: true,
      opacity: 0.85,
      color: 0xfbbf24, // Amber default for pickup
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3.0,
      polygonOffsetUnits: -3.0,
    });

    this.turnBeaconsGroup = new THREE.Group();
    this.scene.add(this.turnBeaconsGroup);
  }

  // Calculate clean, road-following navigation route via city avenues & streets
  public calculateRoute(start: THREE.Vector3, dest: THREE.Vector3): THREE.Vector3[] {
    const waypoints: THREE.Vector3[] = [];
    waypoints.push(new THREE.Vector3(start.x, 0.04, start.z));

    // Find closest avenue X and street Z for start
    const startAve = ALL_AVENUES_X.reduce((prev, curr) =>
      Math.abs(curr - start.x) < Math.abs(prev - start.x) ? curr : prev
    );
    const startStreet = ALL_STREETS_Z.reduce((prev, curr) =>
      Math.abs(curr - start.z) < Math.abs(prev - start.z) ? curr : prev
    );

    // Find closest avenue X and street Z for dest
    const destAve = ALL_AVENUES_X.reduce((prev, curr) =>
      Math.abs(curr - dest.x) < Math.abs(prev - dest.x) ? curr : prev
    );
    const destStreet = ALL_STREETS_Z.reduce((prev, curr) =>
      Math.abs(curr - dest.z) < Math.abs(prev - dest.z) ? curr : prev
    );

    // If already on the same avenue, drive straight along avenue
    if (Math.abs(startAve - destAve) < 2.0) {
      waypoints.push(new THREE.Vector3(startAve, 0.04, start.z));
      waypoints.push(new THREE.Vector3(destAve, 0.04, dest.z));
    }
    // If on same street, drive straight along street
    else if (Math.abs(startStreet - destStreet) < 2.0) {
      waypoints.push(new THREE.Vector3(start.x, 0.04, startStreet));
      waypoints.push(new THREE.Vector3(dest.x, 0.04, destStreet));
    }
    // Cross-town navigation: choose best intersection turn
    else {
      // Lane 1: Start -> Avenue -> Cross Street -> Dest Avenue -> Dest
      waypoints.push(new THREE.Vector3(startAve, 0.04, start.z));
      waypoints.push(new THREE.Vector3(startAve, 0.04, destStreet));
      waypoints.push(new THREE.Vector3(destAve, 0.04, destStreet));
      waypoints.push(new THREE.Vector3(destAve, 0.04, dest.z));
    }

    waypoints.push(new THREE.Vector3(dest.x, 0.04, dest.z));

    // Subdivide segments into fine-grained points for smooth ribbon curvature
    const densePoints: THREE.Vector3[] = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const p0 = waypoints[i];
      const p1 = waypoints[i + 1];
      const dist = p0.distanceTo(p1);
      const steps = Math.max(1, Math.round(dist / 4.0));

      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        densePoints.push(new THREE.Vector3().lerpVectors(p0, p1, t));
      }
    }
    densePoints.push(waypoints[waypoints.length - 1]);

    return densePoints;
  }

  // Set active route target
  public setRoute(
    start: THREE.Vector3,
    dest: THREE.Vector3,
    mode: 'pickup' | 'dropoff' = 'pickup'
  ) {
    this.targetDestination.copy(dest);
    this.currentMode = mode;
    this.lastCarPos.copy(start);

    // Color theme: Glowing Amber for passenger pickup, Neon Emerald/Cyan for destination dropoff
    if (mode === 'pickup') {
      this.ribbonMaterial.color.setHex(0xfbbf24);
    } else {
      this.ribbonMaterial.color.setHex(0x10b981);
    }

    this.activeRoutePoints = this.calculateRoute(start, dest);
    this.rebuildRibbonMesh();
    this.rebuildTurnBeacons();
    this.show();
  }

  // Rebuild 3D Road Navigation Ribbon on asphalt surface
  private rebuildRibbonMesh() {
    if (this.activeRoutePoints.length < 2) return;

    if (this.ribbonMesh) {
      this.scene.remove(this.ribbonMesh);
      if (this.ribbonGeometry) this.ribbonGeometry.dispose();
      this.ribbonMesh = null;
    }

    const points = this.activeRoutePoints;
    const ribbonWidth = 2.4; // 2.4 meters wide (road driving lane)
    const halfWidth = ribbonWidth / 2;

    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    let totalDist = 0;
    const distAccum: number[] = [0];
    for (let i = 1; i < points.length; i++) {
      totalDist += points[i].distanceTo(points[i - 1]);
      distAccum.push(totalDist);
    }

    for (let i = 0; i < points.length; i++) {
      const p = points[i];

      // Calculate tangent along path
      let tx = 0;
      let tz = 1;
      if (i < points.length - 1) {
        tx = points[i + 1].x - p.x;
        tz = points[i + 1].z - p.z;
      } else if (i > 0) {
        tx = p.x - points[i - 1].x;
        tz = p.z - points[i - 1].z;
      }
      const len = Math.hypot(tx, tz) || 1;
      tx /= len;
      tz /= len;

      // Normal perpendicular to tangent on XZ plane: (-tz, 0, tx)
      const nx = -tz;
      const nz = tx;

      // Left vertex
      vertices.push(p.x - nx * halfWidth, 0.04, p.z - nz * halfWidth);
      // Right vertex
      vertices.push(p.x + nx * halfWidth, 0.04, p.z + nz * halfWidth);

      // UV mapping: U repeats along length of road, V across ribbon width (0 to 1)
      const u = distAccum[i] / 5.5; // chevron repeats every 5.5 meters
      uvs.push(u, 0);
      uvs.push(u, 1);

      if (i < points.length - 1) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }

    this.ribbonGeometry = new THREE.BufferGeometry();
    this.ribbonGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    this.ribbonGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    this.ribbonGeometry.setIndex(indices);

    this.ribbonMesh = new THREE.Mesh(this.ribbonGeometry, this.ribbonMaterial);
    this.ribbonMesh.renderOrder = 4;
    this.scene.add(this.ribbonMesh);
  }

  // Add glowing turn beacons at 90-degree corner intersections along route
  private rebuildTurnBeacons() {
    // Clear previous
    while (this.turnBeaconsGroup.children.length > 0) {
      const obj = this.turnBeaconsGroup.children.pop();
      if (obj) this.turnBeaconsGroup.remove(obj);
    }

    if (this.activeRoutePoints.length < 3) return;

    const points = this.activeRoutePoints;
    const color = this.currentMode === 'pickup' ? 0xfbbf24 : 0x10b981;

    for (let i = 2; i < points.length - 2; i += 4) {
      const p = points[i];
      const pPrev = points[i - 2];
      const pNext = points[i + 2];

      const v1 = new THREE.Vector2(p.x - pPrev.x, p.z - pPrev.z).normalize();
      const v2 = new THREE.Vector2(pNext.x - p.x, pNext.z - p.z).normalize();
      const dot = v1.dot(v2);

      // Detect corner turn where direction changes significantly
      if (dot < 0.75) {
        const ringGeo = new THREE.RingGeometry(1.6, 2.3, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.75,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(p.x, 0.05, p.z);
        this.turnBeaconsGroup.add(ring);
      }
    }
  }

  // Update dynamic chevron flow and route trimming
  public update(delta: number, carPos: THREE.Vector3) {
    if (!this.isVisible) return;

    const dt = Math.min(delta, 0.1);

    // 1. Scroll glowing chevrons forward along the road
    this.chevronTexture.offset.x -= dt * 1.85;

    // 2. Animate corner beacons
    this.turnBeaconsGroup.children.forEach((child) => {
      child.rotation.z -= dt * 1.6;
    });

    // 3. Dynamic route trim: remove waypoints already passed behind the vehicle
    if (this.activeRoutePoints.length > 3) {
      const firstDist = carPos.distanceTo(this.activeRoutePoints[0]);
      const nextDist = carPos.distanceTo(this.activeRoutePoints[1]);

      if (nextDist < firstDist && firstDist > 3.5) {
        this.activeRoutePoints.shift();
        // Snap the start of the ribbon directly to the car position
        this.activeRoutePoints[0].set(carPos.x, 0.04, carPos.z);
        this.rebuildRibbonMesh();
      }
    }

    // 4. Recalculate full route if car deviates more than 28 meters from planned path
    const distToRoute = this.getClosestDistanceToRoute(carPos);
    if (distToRoute > 28.0 && carPos.distanceTo(this.lastCarPos) > 8.0) {
      this.lastCarPos.copy(carPos);
      this.activeRoutePoints = this.calculateRoute(carPos, this.targetDestination);
      this.rebuildRibbonMesh();
      this.rebuildTurnBeacons();
    }
  }

  private getClosestDistanceToRoute(pos: THREE.Vector3): number {
    let minDist = Infinity;
    for (let i = 0; i < this.activeRoutePoints.length; i++) {
      const d = pos.distanceTo(this.activeRoutePoints[i]);
      if (d < minDist) minDist = d;
    }
    return minDist;
  }

  public show() {
    this.isVisible = true;
    if (this.ribbonMesh) this.ribbonMesh.visible = true;
    this.turnBeaconsGroup.visible = true;
  }

  public hide() {
    this.isVisible = false;
    this.activeRoutePoints = [];
    if (this.ribbonMesh) this.ribbonMesh.visible = false;
    this.turnBeaconsGroup.visible = false;
  }

  public dispose() {
    this.hide();
    if (this.ribbonMesh) {
      this.scene.remove(this.ribbonMesh);
      if (this.ribbonGeometry) this.ribbonGeometry.dispose();
      this.ribbonMesh = null;
    }
    this.scene.remove(this.turnBeaconsGroup);
  }
}
