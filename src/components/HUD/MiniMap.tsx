import React, { useRef, useEffect, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { CITY_POIS } from '../../data/vehicles';
import { BASE_AVENUES_X, BASE_STREETS_Z } from '../../game/TrafficManager';
import { CITY_SCALE, CHUNK_WIDTH, CHUNK_DEPTH } from '../../game/CityEnvironment';
import { Compass, Users, Maximize2, Minimize2, Radio } from 'lucide-react';

export const MiniMap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  
  const getMapSize = (expanded: boolean) => {
    if (typeof window === 'undefined') return 130;
    const isMobile = window.innerWidth < 768 || window.innerHeight < 520;
    if (expanded) {
      return isMobile ? 136 : 196;
    }
    return isMobile ? 74 : 130;
  };

  const [canvasSize, setCanvasSize] = useState(() => getMapSize(false));

  useEffect(() => {
    const handleResize = () => {
      setCanvasSize(getMapSize(isExpanded));
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [isExpanded]);

  const carPosition = useGameStore((state) => state.telemetry.carPosition);
  const carHeadingRad = useGameStore((state) => state.telemetry.carHeadingRad);
  const cabMission = useGameStore((state) => state.cabMission);
  const navigationRoute = useGameStore((state) => state.navigationRoute);
  const blips = useGameStore((state) => state.blips);
  const activeMission = useGameStore((state) => state.activeMission);
  const wantedLevel = useGameStore((state) => state.wantedLevel);
  const onlineCount = useGameStore((state) => state.onlineCount);

  // Filter remote player blips
  const playerBlips = blips.filter((b) => b.kind === 'player');
  const totalDisplayOnline = Math.max(onlineCount, playerBlips.length + 1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // View radius: 85 meters (tactical) or 275 meters (full city overview)
    const viewRadius = isExpanded ? 275 : 85;
    const mapScale = (width / 2 - 8) / viewRadius;

    const carX = carPosition[0];
    const carZ = carPosition[2];

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

    // Infinite City: Dynamic Avenue and Street Grid across all visible chunks
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.lineWidth = 8 * mapScale;
    ctx.lineCap = 'round';

    const minWorldX = carX - viewRadius - 20;
    const maxWorldX = carX + viewRadius + 20;
    const minWorldZ = carZ - viewRadius - 20;
    const maxWorldZ = carZ + viewRadius + 20;

    const minChunkX = Math.floor(minWorldX / CHUNK_WIDTH);
    const maxChunkX = Math.floor(maxWorldX / CHUNK_WIDTH);
    const minChunkZ = Math.floor(minWorldZ / CHUNK_DEPTH);
    const maxChunkZ = Math.floor(maxWorldZ / CHUNK_DEPTH);

    // North-South Avenues
    for (let cx = minChunkX; cx <= maxChunkX; cx++) {
      for (let i = 0; i < BASE_AVENUES_X.length; i++) {
        const worldAvX = cx * CHUNK_WIDTH + BASE_AVENUES_X[i];
        const screenX = centerX + (worldAvX - carX) * mapScale;
        ctx.beginPath();
        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, height);
        ctx.stroke();
      }
    }

    // East-West Streets
    for (let cz = minChunkZ; cz <= maxChunkZ; cz++) {
      for (let i = 0; i < BASE_STREETS_Z.length; i++) {
        const worldStZ = cz * CHUNK_DEPTH + BASE_STREETS_Z[i];
        const screenY = centerY + (worldStZ - carZ) * mapScale;
        ctx.beginPath();
        ctx.moveTo(0, screenY);
        ctx.lineTo(width, screenY);
        ctx.stroke();
      }
    }

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
      // 1. ONLINE PLAYERS (Driving or on-foot with directional arrow and name badge)
      if (b.kind === 'player') {
        const { sx, sy, offEdge } = toScreen(b.x, b.z, true);
        const isDriving = b.color === '#00f0ff' || b.color === '#38bdf8';
        const blipColor = isDriving ? '#00f0ff' : '#10b981';
        const pulse = 1 + Math.sin(Date.now() * 0.008) * 0.22;

        ctx.save();
        ctx.translate(sx, sy);

        if (offEdge) {
          // Off-radar: direction wedge pointing towards player in world space
          const angleToPlayer = Math.atan2(sy - centerY, sx - centerX);
          ctx.rotate(angleToPlayer);

          // Sleek neon pointer wedge on radar perimeter
          ctx.beginPath();
          ctx.moveTo(8.5, 0);
          ctx.lineTo(-4.5, -5.5);
          ctx.lineTo(-1, 0);
          ctx.lineTo(-4.5, 5.5);
          ctx.closePath();
          ctx.fillStyle = blipColor;
          ctx.shadowColor = blipColor;
          ctx.shadowBlur = 8;
          ctx.fill();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        } else {
          // Inside radar: oriented according to player's heading
          ctx.rotate(b.heading ?? 0);

          // Pulsing halo
          ctx.beginPath();
          ctx.arc(0, 0, (isDriving ? 8.5 : 6.5) * pulse, 0, Math.PI * 2);
          ctx.strokeStyle = blipColor;
          ctx.lineWidth = 1.2;
          ctx.globalAlpha = 0.55;
          ctx.stroke();
          ctx.globalAlpha = 1.0;

          if (isDriving) {
            // High-visibility vehicle arrow
            ctx.beginPath();
            ctx.moveTo(0, 8.5);     // Front nose (+Z in 3D)
            ctx.lineTo(-5.5, -6);   // Back left
            ctx.lineTo(0, -3);      // Inset notch
            ctx.lineTo(5.5, -6);    // Back right
            ctx.closePath();
            ctx.fillStyle = '#00f0ff';
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          } else {
            // On-foot player: glowing emerald disc with direction pip
            ctx.beginPath();
            ctx.arc(0, 0, 4.8, 0, Math.PI * 2);
            ctx.fillStyle = '#10b981';
            ctx.shadowColor = '#10b981';
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Forward direction notch pip
            ctx.beginPath();
            ctx.arc(0, 6, 1.8, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
          }
        }
        ctx.restore();

        // High-contrast player name badge on radar
        if (b.label) {
          ctx.save();
          ctx.translate(sx, sy);
          const badgeY = offEdge ? (sy > centerY ? -10 : 12) : -13;
          ctx.font = 'bold 8.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          const textMetrics = ctx.measureText(b.label);
          const badgeW = textMetrics.width + 8;
          const badgeH = 12;

          ctx.fillStyle = 'rgba(10, 15, 29, 0.92)';
          ctx.strokeStyle = blipColor;
          ctx.lineWidth = 1;

          ctx.beginPath();
          ctx.roundRect(-badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 3.5);
          ctx.fill();
          ctx.stroke();

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(b.label, 0, badgeY + 0.5);
          ctx.restore();
        }

        continue;
      }

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
    ctx.rotate(carHeadingRad);

    const arrowScale = canvasSize < 90 ? 0.72 : (isExpanded ? 1.15 : 1.0);
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
  }, [carPosition, carHeadingRad, cabMission, navigationRoute, blips, activeMission.status, wantedLevel, canvasSize, isExpanded]);

  return (
    <div className="relative pointer-events-auto select-none flex flex-col items-center gap-1.5">
      {/* Radar Glass Container */}
      <div
        onClick={() => setIsExpanded((prev) => !prev)}
        title={isExpanded ? 'Click to zoom in (Tactical View)' : 'Click to zoom out (City Overview)'}
        className="glass-panel p-0.5 sm:p-1 rounded-full shadow-2xl relative cursor-pointer hover:border-cyan-400/50 transition-all group"
      >
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          className="rounded-full block"
        />

        {/* North Indicator */}
        <div
          className={`absolute top-0.5 left-1/2 -translate-x-1/2 rounded-full bg-cyan-500/20 font-bold text-cyan-300 border border-cyan-500/30 flex items-center gap-0.5 pointer-events-none ${
            canvasSize < 90 ? 'px-1 py-0 text-[7px]' : 'px-1.5 py-0.5 text-[9px]'
          }`}
        >
          <Compass className={canvasSize < 90 ? 'w-2 h-2' : 'w-2.5 h-2.5'} /> N
        </div>

        {/* Map Zoom Mode Pill Overlay */}
        <div
          className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 rounded-full bg-slate-950/80 font-bold text-gray-300 border border-white/20 flex items-center gap-1 pointer-events-none group-hover:text-cyan-300 group-hover:border-cyan-400/40 transition-colors ${
            canvasSize < 90 ? 'px-1 text-[6.5px]' : 'px-1.5 py-0.5 text-[8.5px]'
          }`}
        >
          {isExpanded ? (
            <>
              <Minimize2 className="w-2 h-2" />
              <span>OVERVIEW</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-2 h-2" />
              <span>RADAR</span>
            </>
          )}
        </div>
      </div>

      {/* Online Players Status Pill */}
      <div className="relative">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowRoster((v) => !v)}
          title="Click to view online players list"
          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-950/85 hover:bg-slate-900 border border-cyan-500/30 hover:border-cyan-400 text-[10px] font-bold text-white shadow-lg backdrop-blur-md transition-all pointer-events-auto"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <Users className="w-3 h-3 text-cyan-400" />
          <span className="text-cyan-300">{totalDisplayOnline}</span>
          <span className="text-gray-300 text-[9px]">Online</span>
        </button>

        {/* Live Online Player Roster Dropdown Card */}
        {showRoster && (
          <div className="absolute bottom-full left-0 mb-2 w-56 rounded-2xl bg-slate-950/95 border border-cyan-500/40 shadow-2xl p-2.5 space-y-2 backdrop-blur-xl z-50 pointer-events-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-black text-cyan-300 uppercase tracking-wide">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>City Inhabitants</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                {totalDisplayOnline} in world
              </span>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {/* Local Player Entry */}
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[11px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0"></span>
                  <span className="font-bold text-white truncate">You</span>
                </div>
                <span className="text-[9px] text-cyan-300 font-medium px-1 py-0.5 rounded bg-cyan-950">Local</span>
              </div>

              {/* Remote Online Players */}
              {playerBlips.length === 0 ? (
                <div className="p-2 text-center text-[10px] text-gray-400">
                  Waiting for other riders to connect...
                  <p className="text-[9px] text-cyan-400/80 mt-1">Open another window/device to see them appear live on map!</p>
                </div>
              ) : (
                playerBlips.map((p, idx) => {
                  const dist = Math.round(Math.hypot(p.x - carPosition[0], p.z - carPosition[2]));
                  const isDriving = p.color === '#00f0ff' || p.color === '#38bdf8';
                  return (
                    <div
                      key={p.label || idx}
                      className="flex items-center justify-between p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-[11px] transition-colors"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isDriving ? 'bg-cyan-400' : 'bg-emerald-400'}`}></span>
                        <span className="font-semibold text-gray-200 truncate">{p.label || `Player_${idx + 1}`}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[9px] shrink-0 font-mono text-gray-400">
                        <span>{isDriving ? '🏎️' : '🏃'}</span>
                        <span>{dist}m</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-white/10 pt-1 text-[8.5px] text-gray-400 text-center">
              Shared global world • Zero room setup required
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
