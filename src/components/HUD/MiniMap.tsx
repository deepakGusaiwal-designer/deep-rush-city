import React, { useRef, useEffect, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { CITY_POIS } from '../../data/vehicles';
import { BASE_AVENUES_X, BASE_STREETS_Z } from '../../game/TrafficManager';
import { CITY_SCALE } from '../../game/CityEnvironment';
import { Compass } from 'lucide-react';

export const MiniMap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const getMapSize = () => {
    if (typeof window === 'undefined') return 130;
    return window.innerWidth < 768 || window.innerHeight < 520 ? 74 : 130;
  };

  const [canvasSize, setCanvasSize] = useState(getMapSize);

  useEffect(() => {
    const handleResize = () => {
      setCanvasSize(getMapSize());
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const telemetry = useGameStore((state) => state.telemetry);
  const cabMission = useGameStore((state) => state.cabMission);
  const navigationRoute = useGameStore((state) => state.navigationRoute);
  const blips = useGameStore((state) => state.blips);
  const activeMission = useGameStore((state) => state.activeMission);
  const wantedLevel = useGameStore((state) => state.wantedLevel);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // View radius: 85 meters around the player
    const viewRadius = 85;
    const mapScale = (width / 2 - 8) / viewRadius;

    const carX = telemetry.carPosition[0];
    const carZ = telemetry.carPosition[2];

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, width / 2 - 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 15, 29, 0.58)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.stroke();
    ctx.clip();

    // Radar distance rings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    [25, 50, 75].forEach((r) => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, r * mapScale, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Seawall / Island Coastline
    const halfW = 58.5 * CITY_SCALE;
    const halfD = 73.5 * CITY_SCALE;
    const seaLeft = centerX + (-halfW - carX) * mapScale;
    const seaRight = centerX + (halfW - carX) * mapScale;
    const seaTop = centerY + (-halfD - carZ) * mapScale;
    const seaBottom = centerY + (halfD - carZ) * mapScale;

    ctx.strokeStyle = 'rgba(14, 165, 233, 0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(seaLeft, seaTop, seaRight - seaLeft, seaBottom - seaTop);

    // Main Boulevards & Avenues (North-South)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.lineWidth = 8 * mapScale;
    ctx.lineCap = 'round';

    BASE_AVENUES_X.forEach((ax) => {
      const screenX = centerX + (ax - carX) * mapScale;
      ctx.beginPath();
      ctx.moveTo(screenX, seaTop);
      ctx.lineTo(screenX, seaBottom);
      ctx.stroke();
    });

    // Main Streets (East-West)
    BASE_STREETS_Z.forEach((sz) => {
      const screenY = centerY + (sz - carZ) * mapScale;
      ctx.beginPath();
      ctx.moveTo(seaLeft, screenY);
      ctx.lineTo(seaRight, screenY);
      ctx.stroke();
    });

    // --- Active GPS Navigation Route (Road following) ---
    if (navigationRoute && navigationRoute.length > 1) {
      const isPickup = cabMission.status === 'pickup';
      const isStory = activeMission.status === 'active';
      const routeColor = isStory ? '#22d3ee' : isPickup ? '#fbbf24' : '#10b981';
      const glowColor = isStory ? 'rgba(34, 211, 238, 0.38)' : isPickup ? 'rgba(251, 191, 36, 0.38)' : 'rgba(16, 185, 129, 0.38)';

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // 1. Soft glowing outer path
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      for (let i = 0; i < navigationRoute.length; i++) {
        const pt = navigationRoute[i];
        const sx = centerX + (pt[0] - carX) * mapScale;
        const sy = centerY + (pt[1] - carZ) * mapScale;
        ctx.lineTo(sx, sy);
      }
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 6.5 * mapScale;
      ctx.stroke();

      // 2. High-vis crisp core line
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      for (let i = 0; i < navigationRoute.length; i++) {
        const pt = navigationRoute[i];
        const sx = centerX + (pt[0] - carX) * mapScale;
        const sy = centerY + (pt[1] - carZ) * mapScale;
        ctx.lineTo(sx, sy);
      }
      ctx.strokeStyle = routeColor;
      ctx.lineWidth = 2.8 * mapScale;
      ctx.stroke();

      // 3. Flowing white dashed pulse towards target
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      for (let i = 0; i < navigationRoute.length; i++) {
        const pt = navigationRoute[i];
        const sx = centerX + (pt[0] - carX) * mapScale;
        const sy = centerY + (pt[1] - carZ) * mapScale;
        ctx.lineTo(sx, sy);
      }
      ctx.setLineDash([5, 3]);
      ctx.lineDashOffset = -Date.now() * 0.015;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2 * mapScale;
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.restore();
    }

    // Draw Nearby POI markers
    CITY_POIS.forEach((poi) => {
      const poiWorldX = poi.position[0] * CITY_SCALE;
      const poiWorldZ = poi.position[2] * CITY_SCALE;

      const screenX = centerX + (poiWorldX - carX) * mapScale;
      const screenY = centerY + (poiWorldZ - carZ) * mapScale;

      const distFromCenter = Math.hypot(screenX - centerX, screenY - centerY);
      if (distFromCenter < width / 2 - 8) {
        ctx.beginPath();
        ctx.arc(screenX, screenY, 4, 0, Math.PI * 2);
        ctx.fillStyle = poi.color;
        ctx.shadowColor = poi.color;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // Active Cab Mission Waypoint Marker (Golden 🚖 for Pickup, Green 🏁 for Dropoff)
    if (cabMission.status === 'pickup' || cabMission.status === 'driving') {
      const isPickup = cabMission.status === 'pickup';
      const targetPos = isPickup ? cabMission.pickupPos : cabMission.dropoffPos;
      const targetX = targetPos[0];
      const targetZ = targetPos[2];

      let screenX = centerX + (targetX - carX) * mapScale;
      let screenY = centerY + (targetZ - carZ) * mapScale;

      const dist = Math.hypot(screenX - centerX, screenY - centerY);
      const maxRadarRadius = width / 2 - 10;

      // Radar edge clamp if destination is further away
      if (dist > maxRadarRadius) {
        const angle = Math.atan2(screenY - centerY, screenX - centerX);
        screenX = centerX + Math.cos(angle) * maxRadarRadius;
        screenY = centerY + Math.sin(angle) * maxRadarRadius;
      }

      const pulse = 1 + Math.sin(Date.now() * 0.008) * 0.25;
      const color = isPickup ? '#fbbf24' : '#10b981';

      ctx.save();
      ctx.beginPath();
      ctx.arc(screenX, screenY, 6 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Inner diamond
      ctx.beginPath();
      ctx.arc(screenX, screenY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    }

    // --- GTA blips: mission markers, targets, packages, hospital, police -----------
    const maxRadarRadius = width / 2 - 10;
    const toScreen = (wx: number, wz: number, clamp: boolean) => {
      let sx = centerX + (wx - carX) * mapScale;
      let sy = centerY + (wz - carZ) * mapScale;
      const d = Math.hypot(sx - centerX, sy - centerY);
      const offEdge = d > maxRadarRadius;
      if (offEdge && clamp) {
        const ang = Math.atan2(sy - centerY, sx - centerX);
        sx = centerX + Math.cos(ang) * maxRadarRadius;
        sy = centerY + Math.sin(ang) * maxRadarRadius;
      }
      return { sx, sy, offEdge };
    };

    for (const b of blips) {
      if (b.kind === 'cop') {
        const { sx, sy, offEdge } = toScreen(b.x, b.z, true);
        ctx.save();
        ctx.translate(sx, sy);
        if (!offEdge) ctx.rotate(b.heading ?? 0);
        ctx.beginPath();
        if (offEdge) {
          ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        } else {
          ctx.moveTo(0, 6);
          ctx.lineTo(-4, -4);
          ctx.lineTo(0, -2);
          ctx.lineTo(4, -4);
          ctx.closePath();
        }
        const flash = Math.floor(Date.now() / 220) % 2 === 0;
        ctx.fillStyle = flash ? '#3b82f6' : '#ef4444';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.restore();
        continue;
      }

      if (b.kind === 'package') {
        const { sx, sy, offEdge } = toScreen(b.x, b.z, false);
        if (offEdge) continue;
        ctx.save();
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 5;
        ctx.fillRect(sx - 2.5, sy - 2.5, 5, 5);
        ctx.restore();
        continue;
      }

      if (b.kind === 'hospital') {
        const { sx, sy, offEdge } = toScreen(b.x, b.z, false);
        if (offEdge) continue;
        ctx.save();
        ctx.fillStyle = b.color;
        ctx.fillRect(sx - 1.2, sy - 4, 2.4, 8);
        ctx.fillRect(sx - 4, sy - 1.2, 8, 2.4);
        ctx.restore();
        continue;
      }

      if (b.kind === 'marker') {
        const { sx, sy, offEdge } = toScreen(b.x, b.z, false);
        if (offEdge) continue;
        ctx.save();
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(8,12,24,0.9)';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = b.color;
        ctx.stroke();
        if (b.label) {
          ctx.font = '7px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#fff';
          ctx.fillText(b.label, sx, sy + 0.5);
        }
        ctx.restore();
        continue;
      }

      // mission target / suspect: pulsing diamond, clamped to the radar edge
      const { sx, sy } = toScreen(b.x, b.z, true);
      const pulse = 1 + Math.sin(Date.now() * 0.008) * 0.25;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.PI / 4);
      const s = 5.5 * pulse;
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 12;
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-s, -s, s * 2, s * 2);
      ctx.restore();
    }

    // Wanted: red/blue sweep on the radar ring
    if (wantedLevel > 0) {
      ctx.save();
      const flash = Math.floor(Date.now() / 260) % 2 === 0;
      ctx.beginPath();
      ctx.arc(centerX, centerY, width / 2 - 3, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = flash ? 'rgba(59,130,246,0.85)' : 'rgba(239,68,68,0.85)';
      ctx.stroke();
      ctx.restore();
    }

    // Player Car Arrow (Always centered in player-tracking GPS mode)
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(telemetry.carHeadingRad);

    const arrowScale = canvasSize < 90 ? 0.72 : 1.0;
    ctx.scale(arrowScale, arrowScale);

    ctx.beginPath();
    ctx.moveTo(0, 9);      // Front nose (+Z in 3D)
    ctx.lineTo(-5.5, -6);  // Back left
    ctx.lineTo(0, -3);     // Inset tail
    ctx.lineTo(5.5, -6);   // Back right
    ctx.closePath();

    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = canvasSize < 90 ? 6 : 10;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = canvasSize < 90 ? 1 : 1.5;
    ctx.stroke();

    ctx.restore();
    ctx.restore();
  }, [telemetry.carPosition, telemetry.carHeadingRad, cabMission, navigationRoute, blips, activeMission.status, wantedLevel, canvasSize]);

  return (
    <div className="relative pointer-events-auto select-none">
      <div className="glass-panel p-0.5 sm:p-1 rounded-full shadow-2xl relative">
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          className="rounded-full cursor-pointer block"
        />
        {/* North Indicator */}
        <div
          className={`absolute top-0.5 left-1/2 -translate-x-1/2 rounded-full bg-cyan-500/20 font-bold text-cyan-300 border border-cyan-500/30 flex items-center gap-0.5 pointer-events-none ${
            canvasSize < 90 ? 'px-1 py-0 text-[7px]' : 'px-1.5 py-0.5 text-[9px]'
          }`}
        >
          <Compass className={canvasSize < 90 ? 'w-2 h-2' : 'w-2.5 h-2.5'} /> N
        </div>
      </div>
    </div>
  );
};
