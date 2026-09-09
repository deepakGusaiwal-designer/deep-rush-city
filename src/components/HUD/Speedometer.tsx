import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { Flame, Gauge } from 'lucide-react';

export const Speedometer: React.FC = () => {
  const telemetry = useGameStore((state) => state.telemetry);
  const selectedVehicleId = useGameStore((state) => state.selectedVehicleId);

  const speed = Math.abs(telemetry.speedKmh);
  const maxDisplaySpeed = 300;
  const speedPercentage = Math.min((speed / maxDisplaySpeed) * 100, 100);
  const isDriving = telemetry.playerMode === 'driving';
  // Six-speed box derived from speed, like an arcade GTA gearbox
  const gearNumber = isDriving && speed > 1 ? Math.min(6, 1 + Math.floor(speed / 28)) : 0;
  const gearLabel = telemetry.gear === 'R' ? 'R' : gearNumber === 0 ? 'N' : String(gearNumber);
  const gForce = Math.abs(telemetry.gForce ?? 0);
  const wrecked = isDriving && telemetry.vehicleHealth <= 0;

  // No dashboard when the hero is on foot
  if (!isDriving) return null;

  return (
    <div className="flex flex-col items-end pointer-events-none select-none">
      {/* Drift Indicator */}
      {telemetry.isDrifting && (
        <div className="flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 mb-1 rounded-full bg-amber-500/60 text-black font-black text-[10px] sm:text-xs uppercase tracking-wider animate-bounce shadow-md">
          <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
          <span>DRIFT +{telemetry.driftScore}</span>
        </div>
      )}

      {/* Main Dial Panel */}
      <div className={`glass-panel px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl flex items-center gap-2 sm:gap-3 text-white shadow-lg border backdrop-blur-sm bg-slate-950/30 ${wrecked ? 'border-rose-500/40' : 'border-white/10'}`}>
        {/* Gear Box */}
        <div className="flex flex-col items-center justify-center bg-black/25 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border border-white/5 min-w-[34px] sm:min-w-[42px]">
          <span className="text-[8px] sm:text-[9px] text-gray-400 font-semibold tracking-wider leading-none">GEAR</span>
          <span className={`text-base sm:text-xl font-black leading-tight ${telemetry.gear === 'R' ? 'text-rose-400' : 'text-cyan-300'}`}>
            {gearLabel}
          </span>
          {isDriving && (
            <span className={`text-[7px] sm:text-[8px] font-mono font-bold leading-none ${gForce > 0.8 ? 'text-amber-300' : 'text-gray-500'}`}>
              {gForce.toFixed(1)}G
            </span>
          )}
        </div>

        {/* Speed Number */}
        <div className="flex flex-col items-start min-w-[65px] sm:min-w-[80px]">
          <div className="flex items-baseline gap-1 leading-none">
            <span className="text-xl sm:text-3xl font-black tracking-tight text-white font-mono drop-shadow">
              {speed}
            </span>
            <span className="text-[9px] sm:text-[10px] font-bold text-cyan-300 tracking-wider">KM/H</span>
          </div>
          
          {/* Speed Bar */}
          <div className="w-full h-1 sm:h-1.5 bg-black/40 rounded-full mt-1 overflow-hidden p-[0.5px] border border-white/10">
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
            {telemetry.rpm}
          </span>
        </div>
      </div>
    </div>
  );
};
