import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { Flame, Gauge } from 'lucide-react';
import { VehicleLightsHUD } from './VehicleLightsHUD';

export const Speedometer: React.FC = () => {
  const isDriving = useGameStore((state) => state.telemetry.playerMode === 'driving');
  const speedKmh = useGameStore((state) => state.telemetry.speedKmh);
  const gear = useGameStore((state) => state.telemetry.gear);
  const gForceVal = useGameStore((state) => state.telemetry.gForce);
  const isDrifting = useGameStore((state) => state.telemetry.isDrifting);
  const driftScore = useGameStore((state) => state.telemetry.driftScore);
  const vehicleHealth = useGameStore((state) => state.telemetry.vehicleHealth);
  const rpm = useGameStore((state) => state.telemetry.rpm);

  // No dashboard when the hero is on foot
  if (!isDriving) return null;

  const speed = Math.abs(speedKmh);
  const maxDisplaySpeed = 300;
  const speedPercentage = Math.min((speed / maxDisplaySpeed) * 100, 100);
  const gearLabel = gear || (speed > 1 ? 'D' : speed < -1 ? 'R' : 'N');
  const gForce = Math.abs(gForceVal ?? 0);
  const wrecked = vehicleHealth <= 0;

  return (
    <div className="flex flex-col items-end gap-1.5 sm:gap-2 pointer-events-none select-none">
      {/* Drift Indicator */}
      {isDrifting && (
        <div className="flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 mb-0.5 rounded-full bg-amber-500/60 text-black font-black text-[10px] sm:text-xs uppercase tracking-wider animate-bounce shadow-md">
          <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
          <span>DRIFT +{driftScore}</span>
        </div>
      )}

      {/* Car Light Options (Off / Low Beam / High Beam) */}
      <VehicleLightsHUD />

      {/* Main Dial Panel */}
      <div className={`glass-panel px-2 py-1 sm:px-3.5 sm:py-2 rounded-xl flex items-center gap-1.5 sm:gap-3 text-white shadow-lg border backdrop-blur-sm bg-slate-950/40 ${wrecked ? 'border-rose-500/40' : 'border-white/10'}`}>
        {/* Gear Box */}
        <div className="flex flex-col items-center justify-center bg-black/25 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border border-white/5 min-w-[30px] sm:min-w-[42px]">
          <span className="text-[7px] sm:text-[9px] text-gray-400 font-semibold tracking-wider leading-none">GEAR</span>
          <span className={`text-sm sm:text-xl font-black leading-tight ${gearLabel === 'R' ? 'text-rose-400' : gearLabel === 'N' ? 'text-gray-400' : 'text-cyan-300'}`}>
            {gearLabel}
          </span>
          <span className={`text-[6.5px] sm:text-[8px] font-mono font-bold leading-none ${gForce > 0.8 ? 'text-amber-300' : 'text-gray-500'}`}>
            {gForce.toFixed(1)}G
          </span>
        </div>

        {/* Speed Number */}
        <div className="flex flex-col items-start min-w-[55px] sm:min-w-[80px]">
          <div className="flex items-baseline gap-1 leading-none">
            <span className="text-lg sm:text-3xl font-black tracking-tight text-white font-mono drop-shadow">
              {speed}
            </span>
            <span className="text-[8px] sm:text-[10px] font-bold text-cyan-300 tracking-wider">KM/H</span>
          </div>
          
          {/* Speed Bar */}
          <div className="w-full h-1 sm:h-1.5 bg-black/40 rounded-full mt-0.5 sm:mt-1 overflow-hidden p-[0.5px] border border-white/10">
            <div
              className="h-full rounded-full transition-all duration-75 bg-gradient-to-r from-cyan-400 via-blue-400 to-amber-400"
              style={{ width: `${speedPercentage}%` }}
            />
          </div>
        </div>

        {/* RPM indicator */}
        <div className="hidden sm:flex flex-col items-end text-right border-l border-white/10 pl-2.5">
          <span className="text-[9px] text-gray-400 flex items-center gap-1 font-semibold leading-none">
            <Gauge className="w-2.5 h-2.5 text-cyan-400" /> RPM
          </span>
          <span className="text-xs font-mono font-bold text-gray-200 mt-0.5">
            {rpm}
          </span>
        </div>
      </div>
    </div>
  );
};
