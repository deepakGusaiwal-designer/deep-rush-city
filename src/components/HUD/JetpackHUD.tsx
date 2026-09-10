import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { Rocket, Fuel, ArrowUp, ArrowDown, Zap } from 'lucide-react';

/** Fuel / altitude readout shown while the jetpack is equipped. */
export const JetpackHUD: React.FC = () => {
  const jetpackActive = useGameStore((s) => s.telemetry.jetpackActive);
  const playerMode = useGameStore((s) => s.telemetry.playerMode);
  const jetpackFuel = useGameStore((s) => s.telemetry.jetpackFuel);
  const altitude = useGameStore((s) => s.telemetry.altitude);

  if (!jetpackActive || playerMode === 'driving') return null;

  const fuel = Math.max(0, Math.min(100, jetpackFuel));
  const low = fuel < 20;
  const alt = Math.round(altitude);

  return (
    <div className="flex flex-col items-end pointer-events-none select-none">
      <div className={`glass-panel px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl flex items-center gap-2 sm:gap-3 text-white shadow-lg border backdrop-blur-sm bg-slate-950/30 ${low ? 'border-rose-500/50' : 'border-amber-400/30'}`}>
        <div className="flex flex-col items-center justify-center bg-black/25 px-2 py-1 rounded-lg border border-white/10 min-w-[44px] sm:min-w-[54px]">
          <span className="text-[8px] sm:text-[9px] text-gray-400 font-semibold tracking-wider flex items-center gap-0.5"><Rocket className="w-2.5 h-2.5 text-amber-300" /> ALT</span>
          <span className="text-lg sm:text-xl font-black text-amber-300 font-mono">{alt}<span className="text-[9px] sm:text-[10px] text-gray-400 ml-0.5">m</span></span>
        </div>

        <div className="flex flex-col min-w-[90px] sm:min-w-[120px]">
          <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold tracking-wider">
            <span className={`flex items-center gap-1 ${low ? 'text-rose-300 animate-pulse' : 'text-gray-300'}`}><Fuel className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> FUEL</span>
            <span className={`font-mono ${low ? 'text-rose-300' : 'text-amber-200'}`}>{Math.round(fuel)}%</span>
          </div>
          <div className="w-full h-1.5 sm:h-2 bg-gray-800/80 rounded-full mt-0.5 sm:mt-1 overflow-hidden p-[1px] border border-white/10">
            <div
              className={`h-full rounded-full transition-all duration-100 ${low ? 'bg-gradient-to-r from-rose-600 to-rose-400' : 'bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-300'}`}
              style={{ width: `${fuel}%` }}
            />
          </div>
          <div className="mt-1.5 hidden lg:flex items-center gap-2 text-[9px] text-gray-400">
            <span className="flex items-center gap-0.5"><kbd className="px-1 rounded bg-white/10 text-gray-200 font-mono">SPACE</kbd><ArrowUp className="w-2.5 h-2.5" /></span>
            <span className="flex items-center gap-0.5"><kbd className="px-1 rounded bg-white/10 text-gray-200 font-mono">CTRL</kbd><ArrowDown className="w-2.5 h-2.5" /></span>
            <span className="flex items-center gap-0.5"><kbd className="px-1 rounded bg-white/10 text-gray-200 font-mono">SHIFT</kbd><Zap className="w-2.5 h-2.5" /></span>
            <span><kbd className="px-1 rounded bg-white/10 text-gray-200 font-mono">J</kbd> off</span>
          </div>
        </div>
      </div>
    </div>
  );
};
