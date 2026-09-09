import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { Star } from 'lucide-react';

/** GTA-style wanted stars. Lit stars pulse; the whole row flashes when a star is gained. */
export const WantedStars: React.FC = () => {
  const level = useGameStore((s) => s.wantedLevel);
  const heat = useGameStore((s) => s.wantedHeat);
  const prevLevel = useRef(level);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (level > prevLevel.current) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 900);
      return () => clearTimeout(t);
    }
    prevLevel.current = level;
  }, [level]);

  useEffect(() => {
    prevLevel.current = level;
  }, [level]);

  const hot = level > 0;

  return (
    <div
      className={`flex flex-col items-end gap-1 pointer-events-none select-none transition-opacity duration-500 ${
        hot ? 'opacity-100' : 'opacity-45'
      }`}
    >
      <div
        className={`glass-panel px-2 py-1 rounded-lg border flex items-center gap-0.5 shadow-md bg-slate-950/35 backdrop-blur-sm ${
          hot ? 'border-amber-400/50' : 'border-white/10'
        } ${flash ? 'animate-wanted-flash' : ''}`}
      >
        {[1, 2, 3, 4, 5].map((i) => {
          const lit = i <= level;
          return (
            <Star
              key={i}
              className={`w-3.5 h-3.5 transition-all duration-300 ${
                lit
                  ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)] animate-star-pulse'
                  : 'text-slate-600 fill-slate-800/60'
              }`}
              style={lit ? { animationDelay: `${i * 90}ms` } : undefined}
            />
          );
        })}
      </div>
      {hot && (
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-300 drop-shadow">Wanted</span>
          <div className="w-16 h-1 rounded-full bg-black/60 border border-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-200"
              style={{ width: `${Math.min(100, (heat / 520) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
