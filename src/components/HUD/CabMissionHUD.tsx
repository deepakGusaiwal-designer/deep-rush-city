import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { Navigation, Clock, DollarSign, CheckCircle, AlertCircle, X, Flame } from 'lucide-react';

interface CabMissionHUDProps {
  onCancelJob: () => void;
}

export const CabMissionHUD: React.FC<CabMissionHUDProps> = ({ onCancelJob }) => {
  const mission = useGameStore((state) => state.cabMission);
  const carPosition = useGameStore((state) => state.telemetry.carPosition);
  const carHeadingRad = useGameStore((state) => state.telemetry.carHeadingRad);

  if (mission.status === 'idle') return null;

  // Calculate direction angle to target for waypoint arrow
  const isPickup = mission.status === 'pickup' || mission.status === 'passenger_entering';
  const targetPos = isPickup ? mission.pickupPos : mission.dropoffPos;
  const carX = carPosition[0];
  const carZ = carPosition[2];
  const dx = targetPos[0] - carX;
  const dz = targetPos[2] - carZ;
  const angleToTarget = Math.atan2(dx, dz);
  const relativeAngleRad = angleToTarget - carHeadingRad;
  const arrowRotationDeg = (relativeAngleRad * 180) / Math.PI;

  return (
    <div className="pointer-events-auto flex flex-col items-center select-none max-w-[320px] sm:max-w-sm w-full mx-auto animate-fade-in">
      {/* 1. Pick-up Phase Banner */}
      {mission.status === 'pickup' && (
        <div className="glass-panel px-3 py-1.5 rounded-xl border border-amber-400/40 shadow-lg bg-slate-950/40 backdrop-blur-md flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-2">
            {/* Nav directional arrow */}
            <div
              className="w-7 h-7 rounded-full bg-amber-400/20 border border-amber-400/50 flex items-center justify-center shadow-sm shrink-0"
              style={{ transform: `rotate(${arrowRotationDeg}deg)` }}
            >
              <Navigation className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                  🚖 Pickup Passenger
                </span>
                <span className="text-[9px] text-gray-400">• {mission.distanceRemaining}m</span>
              </div>
              <span className="text-xs font-bold text-white leading-tight">
                {mission.passengerName}
              </span>
              <span className="text-[9px] text-gray-300 italic truncate max-w-[180px]">
                "{mission.passengerQuote}"
              </span>
            </div>
          </div>

          <button
            onClick={onCancelJob}
            className="p-1 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            title="Cancel Cab Shift"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1b. Passenger Entering Cab Banner */}
      {mission.status === 'passenger_entering' && (
        <div className="glass-panel px-3 py-2 rounded-xl border border-amber-400/60 shadow-lg bg-slate-950/45 backdrop-blur-md flex items-center justify-between gap-3 w-full animate-pulse">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-amber-400/20 border border-amber-400/60 flex items-center justify-center shrink-0">
              <span className="text-sm">🚖</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                Boarding Cab...
              </span>
              <span className="text-xs font-bold text-white">
                {mission.passengerName} is entering the cab!
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Driving to Destination Phase Banner */}
      {mission.status === 'driving' && (
        <div className="glass-panel px-3 py-1.5 rounded-xl border border-emerald-400/40 shadow-lg bg-slate-950/40 backdrop-blur-md flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-2">
            {/* Nav directional arrow */}
            <div
              className="w-7 h-7 rounded-full bg-emerald-400/20 border border-emerald-400/60 flex items-center justify-center shadow-sm shrink-0"
              style={{ transform: `rotate(${arrowRotationDeg}deg)` }}
            >
              <Navigation className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                  🏁 Destination
                </span>
                <span className="text-[9px] text-gray-300 font-bold">• {mission.distanceRemaining}m</span>
              </div>
              <span className="text-xs font-black text-white leading-tight">
                {mission.destinationName}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-mono font-bold text-emerald-300">
                  Fare: ${mission.baseFare + mission.bonusTip}
                </span>
                {mission.bonusTip > 0 && (
                  <span className="text-[9px] text-emerald-400 font-semibold">
                    (+${mission.bonusTip} Tip)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Stats: Countdown Timer & Streak */}
          <div className="flex flex-col items-end gap-1">
            <div
              className={`px-1.5 py-0.5 rounded-lg border flex items-center gap-1 text-[10px] font-mono font-black ${
                mission.timeRemaining <= 15
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 animate-pulse'
                  : 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
              }`}
            >
              <Clock className="w-2.5 h-2.5" />
              <span>{Math.ceil(mission.timeRemaining)}s</span>
            </div>

            {mission.streak > 1 && (
              <div className="flex items-center gap-0.5 text-[8px] font-bold text-amber-400">
                <Flame className="w-2 h-2 fill-amber-400" />
                <span>{mission.streak}x Streak</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2b. Passenger Exiting Cab Banner */}
      {mission.status === 'passenger_exiting' && (
        <div className="glass-panel px-3 py-2 rounded-xl border border-emerald-400/60 shadow-lg bg-emerald-950/45 backdrop-blur-md flex items-center justify-between gap-3 w-full animate-pulse">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-emerald-400/20 border border-emerald-400/60 flex items-center justify-center shrink-0">
              <span className="text-sm">🏁</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                Fare Arrived!
              </span>
              <span className="text-xs font-bold text-white">
                {mission.passengerName} is exiting & thanking you... (+${mission.lastPayout ?? mission.baseFare})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Fare Completed Banner */}
      {mission.status === 'completed' && (
        <div className="glass-panel px-3 py-1.5 rounded-xl border border-emerald-400/60 shadow-lg bg-emerald-950/45 backdrop-blur-md flex items-center gap-2 text-center animate-bounce">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-black uppercase text-emerald-300 tracking-wider">
              Fare Completed!
            </span>
            <span className="text-xs font-bold text-white">
              Earned +${mission.lastPayout ?? mission.baseFare} Cash! Next fare incoming...
            </span>
          </div>
        </div>
      )}

      {/* 4. Fare Expired Banner */}
      {mission.status === 'failed' && (
        <div className="glass-panel px-3 py-1.5 rounded-xl border border-rose-500/60 shadow-lg bg-rose-950/45 backdrop-blur-md flex items-center gap-2 text-center">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-black uppercase text-rose-300 tracking-wider">
              Time Expired!
            </span>
            <span className="text-xs font-medium text-gray-200">
              Passenger left disappointed. Next passenger hailing soon...
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
