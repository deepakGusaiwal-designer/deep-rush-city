import React, { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { Sparkles, MapPin, Wrench, X } from 'lucide-react';
import confetti from 'canvas-confetti';

export const POIPopup: React.FC = () => {
  const activePOI = useGameStore((state) => state.activePOI);
  const setActivePOI = useGameStore((state) => state.setActivePOI);

  useEffect(() => {
    if (activePOI) {
      // Trigger subtle celebratory confetti burst
      try {
        confetti({
          particleCount: 18,
          spread: 35,
          origin: { y: 0.15 },
          colors: ['#00f0ff', '#ffe600', '#ff007f']
        });
      } catch {}

      // Auto-dismiss after 4.5 seconds so it doesn't block the screen
      const timer = setTimeout(() => {
        setActivePOI(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [activePOI?.id, setActivePOI]);

  if (!activePOI) return null;

  return (
    <div className="fixed top-3 sm:top-4 left-1/2 -translate-x-1/2 z-40 max-w-[280px] sm:max-w-sm w-auto px-2 animate-in slide-in-from-top-3 duration-300 pointer-events-auto">
      <div className="glass-panel-glow px-3 py-1.5 sm:py-2 rounded-xl flex items-center gap-2.5 text-white border border-cyan-400/30 shadow-lg backdrop-blur-md bg-slate-950/40">
        {/* Compact Icon */}
        <div
          className="p-1.5 rounded-lg flex items-center justify-center text-black shrink-0 shadow-sm"
          style={{ backgroundColor: activePOI.color }}
        >
          {activePOI.category === 'Garage' ? (
            <Wrench className="w-3.5 h-3.5 fill-current" />
          ) : (
            <MapPin className="w-3.5 h-3.5 fill-current" />
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-cyan-300 leading-none">
            <Sparkles className="w-2.5 h-2.5" />
            <span>{activePOI.category} Discovered</span>
          </div>
          <h3 className="text-xs sm:text-sm font-black text-white truncate leading-tight mt-0.5">{activePOI.name}</h3>
          <p className="text-[10px] text-gray-300 truncate leading-tight mt-0.5 max-w-[180px] sm:max-w-[240px]">{activePOI.description}</p>
        </div>

        {/* Dismiss */}
        <button
          onClick={() => setActivePOI(null)}
          className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
