import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { HeadlightMode } from '../../types/game';

interface VehicleLightsHUDProps {
  onApplyHeadlights?: () => void;
  className?: string;
}

export const VehicleLightsHUD: React.FC<VehicleLightsHUDProps> = ({ onApplyHeadlights, className = '' }) => {
  const isDriving = useGameStore((state) => state.telemetry.playerMode === 'driving');
  const headlightMode = useGameStore((state) => state.headlightMode);
  const setHeadlightMode = useGameStore((state) => state.setHeadlightMode);
  const cycleHeadlightMode = useGameStore((state) => state.cycleHeadlightMode);

  if (!isDriving) return null;

  const handleSelectMode = (mode: HeadlightMode) => {
    setHeadlightMode(mode);
    onApplyHeadlights?.();
  };

  const handleCycle = () => {
    cycleHeadlightMode();
    onApplyHeadlights?.();
  };

  return (
    <div className={`pointer-events-auto select-none ${className}`}>
      <div className="glass-panel px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl flex items-center gap-1.5 sm:gap-2 text-white shadow-lg border border-white/10 backdrop-blur-md bg-slate-950/70 transition-all">
        {/* Automotive Cluster Beam Status Indicator */}
        <button
          type="button"
          onClick={handleCycle}
          title="Toggle Headlights (L)"
          className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg border transition-all active:scale-90 ${
            headlightMode === 'high'
              ? 'bg-blue-600/35 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.45)] ring-1 ring-cyan-400/50'
              : headlightMode === 'low'
              ? 'bg-emerald-600/30 border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.35)]'
              : 'bg-black/30 border-white/10 text-gray-500 hover:text-gray-400'
          }`}
        >
          {headlightMode === 'high' ? (
            // High Beam: Forward horizontal parallel piercing beams (standard ISO automotive symbol)
            <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4C8.5 4 6 7 6 12s2.5 8 6 8" />
              <line x1="6" y1="7" x2="1" y2="7" />
              <line x1="6" y1="10.5" x2="1" y2="10.5" />
              <line x1="6" y1="14" x2="1" y2="14" />
              <line x1="6" y1="17" x2="1" y2="17" />
            </svg>
          ) : headlightMode === 'low' ? (
            // Low Beam: Downward slanted road-dipped beams (standard ISO automotive symbol)
            <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4C8.5 4 6 7 6 12s2.5 8 6 8" />
              <line x1="6" y1="7" x2="1.5" y2="10" />
              <line x1="6" y1="11" x2="1.5" y2="14" />
              <line x1="6" y1="15" x2="1.5" y2="18" />
            </svg>
          ) : (
            // Off: Headlamp with slash
            <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4C8.5 4 6 7 6 12s2.5 8 6 8" />
              <line x1="3" y1="3" x2="21" y2="21" />
            </svg>
          )}
        </button>

        {/* Mode Selector Buttons */}
        <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5">
          {/* OFF Option */}
          <button
            type="button"
            onClick={() => handleSelectMode('off')}
            className={`px-1.5 py-1 sm:px-2 sm:py-1 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all ${
              headlightMode === 'off'
                ? 'bg-rose-500/25 text-rose-300 border border-rose-400/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            OFF
          </button>

          {/* LOW BEAM Option */}
          <button
            type="button"
            onClick={() => handleSelectMode('low')}
            className={`px-1.5 py-1 sm:px-2 sm:py-1 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${
              headlightMode === 'low'
                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 shadow-[0_0_8px_rgba(16,185,129,0.25)]'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            <span>LOW</span>
            <span className="hidden sm:inline text-[8px] opacity-75">BEAM</span>
          </button>

          {/* HIGH BEAM Option */}
          <button
            type="button"
            onClick={() => handleSelectMode('high')}
            className={`px-1.5 py-1 sm:px-2 sm:py-1 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${
              headlightMode === 'high'
                ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/60 shadow-[0_0_10px_rgba(6,182,212,0.35)] ring-1 ring-cyan-400/40'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            <span>HIGH</span>
            <span className="hidden sm:inline text-[8px] opacity-75">BEAM</span>
          </button>
        </div>

        {/* Keyboard Shortcut Hint badge */}
        <div className="hidden sm:flex flex-col items-center border-l border-white/10 pl-2 text-center">
          <span className="text-[7px] text-gray-400 font-bold uppercase tracking-wider">KEY</span>
          <kbd className="px-1.5 py-0.5 mt-0.5 rounded bg-white/10 text-cyan-300 font-mono font-bold text-[8px] border border-cyan-400/30">
            L
          </kbd>
        </div>
      </div>
    </div>
  );
};
