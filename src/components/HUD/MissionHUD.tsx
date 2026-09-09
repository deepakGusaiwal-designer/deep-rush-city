import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { Navigation, Clock, Target, X } from 'lucide-react';

interface MissionHUDProps {
  onAbandon: () => void;
}

/** Objective banner for story missions (courier / race / vigilante / heist). */
export const MissionHUD: React.FC<MissionHUDProps> = ({ onAbandon }) => {
  const mission = useGameStore((s) => s.activeMission);
  const telemetry = useGameStore((s) => s.telemetry);

  if (mission.status !== 'active') return null;

  let arrowDeg = 0;
  let distance = 0;
  if (mission.targetPos) {
    const dx = mission.targetPos[0] - telemetry.carPosition[0];
    const dz = mission.targetPos[2] - telemetry.carPosition[2];
    distance = Math.round(Math.hypot(dx, dz));
    const angleToTarget = Math.atan2(dx, dz);
    arrowDeg = ((angleToTarget - telemetry.carHeadingRad) * 180) / Math.PI;
  }

  const urgent = mission.timeLimit > 0 && mission.timeRemaining <= 15;
  const isDamageBar = mission.type === 'delivery' && mission.progressMax === 100;
  const progressPct = mission.progressMax > 0 ? Math.min(100, (mission.progress / mission.progressMax) * 100) : 0;

  return (
    <div className="pointer-events-auto flex flex-col items-center select-none max-w-[320px] sm:max-w-sm w-full mx-auto animate-fade-in">
      <div className="glass-panel px-3 py-1.5 rounded-xl border border-cyan-400/30 shadow-lg bg-slate-950/40 backdrop-blur-md w-full">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {mission.targetPos ? (
              <div
                className="w-8 h-8 rounded-full bg-cyan-400/15 border border-cyan-400/50 flex items-center justify-center shrink-0"
                style={{ transform: `rotate(${arrowDeg}deg)` }}
              >
                <Navigation className="w-4 h-4 text-cyan-300 fill-cyan-300" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-cyan-400/15 border border-cyan-400/50 flex items-center justify-center shrink-0">
                <Target className="w-4 h-4 text-cyan-300" />
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300 truncate">{mission.title}</span>
                {mission.targetPos && <span className="text-[10px] text-gray-400">• {distance}m</span>}
              </div>
              <span className="text-xs font-bold text-white leading-tight">{mission.objective}</span>
              {mission.targetLabel && mission.targetPos && (
                <span className="text-[10px] text-gray-300 truncate">→ {mission.targetLabel}</span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            {mission.timeLimit > 0 && (
              <div
                className={`px-2 py-0.5 rounded-lg border flex items-center gap-1 text-[11px] font-mono font-black ${
                  urgent
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 animate-pulse'
                    : 'bg-cyan-500/15 border-cyan-400/30 text-cyan-200'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>{Math.ceil(mission.timeRemaining)}s</span>
              </div>
            )}
            <span className="text-[10px] font-mono font-bold text-emerald-300">${mission.reward.toLocaleString()}</span>
          </div>

          <button
            onClick={onAbandon}
            className="p-1 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            title="Abandon mission"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {mission.progressMax > 0 && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-black/60 border border-white/10 overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${
                  isDamageBar
                    ? 'bg-gradient-to-r from-amber-400 to-rose-500'
                    : 'bg-gradient-to-r from-cyan-400 to-emerald-400'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-gray-400 w-14 text-right">
              {isDamageBar ? `dmg ${Math.round(progressPct)}%` : mission.progressMax <= 12 ? `${mission.progress}/${mission.progressMax}` : `${Math.round(progressPct)}%`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
