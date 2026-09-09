import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { DollarSign } from 'lucide-react';

export const CashDisplay: React.FC = () => {
  const cash = useGameStore((state) => state.cash);
  const [displayCash, setDisplayCash] = useState(cash);
  const [gainPopups, setGainPopups] = useState<{ id: number; amount: number }[]>([]);
  const prevCashRef = useRef(cash);

  useEffect(() => {
    const prevCash = prevCashRef.current;
    if (cash !== prevCash) {
      const diff = cash - prevCash;
      const popupId = Date.now() + Math.random();
      setGainPopups((prev) => [...prev, { id: popupId, amount: diff }]);

      // Remove after 2.5s
      setTimeout(() => {
        setGainPopups((prev) => prev.filter((p) => p.id !== popupId));
      }, 2500);
    }
    prevCashRef.current = cash;

    // Smooth counting ticker
    const duration = 600;
    const start = displayCash;
    const end = cash;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      const current = Math.round(start + (end - start) * progress);
      setDisplayCash(current);

      if (progress < 1.0) {
        requestAnimationFrame(animate);
      }
    };

    const animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [cash]);

  return (
    <div className="relative flex items-center select-none pointer-events-auto">
      {/* Emerald Green Cash Badge */}
      <div className="glass-panel px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-xl border border-emerald-500/30 shadow-md flex items-center gap-1 bg-slate-950/35 backdrop-blur-sm">
        <div className="w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full bg-emerald-500/20 border border-emerald-400/60 flex items-center justify-center">
          <DollarSign className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400 font-black" />
        </div>
        <span className="font-mono text-xs sm:text-sm font-black tracking-wider text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.3)]">
          {displayCash.toLocaleString()}
        </span>
      </div>

      {/* Floating Animated Gain Tickers (+$250) */}
      <div className="absolute -top-7 right-0 flex flex-col items-end pointer-events-none">
        {gainPopups.map((popup) => (
          <div
            key={popup.id}
            className={`text-xs font-black font-mono animate-bounce tracking-wider ${
              popup.amount >= 0
                ? 'text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.9)]'
                : 'text-rose-400 drop-shadow-[0_0_6px_rgba(244,63,94,0.9)]'
            }`}
          >
            {popup.amount >= 0 ? '+' : '-'}${Math.abs(popup.amount).toLocaleString()}
          </div>
        ))}
      </div>
    </div>
  );
};
