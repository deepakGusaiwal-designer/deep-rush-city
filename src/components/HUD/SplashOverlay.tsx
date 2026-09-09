import React, { useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';

/** Full-screen GTA-style stingers: WASTED, BUSTED, MISSION PASSED / FAILED. */
export const SplashOverlay: React.FC = () => {
  const splash = useGameStore((s) => s.splash);
  const subtitle = useGameStore((s) => s.splashSubtitle);
  const setSplash = useGameStore((s) => s.setSplash);

  useEffect(() => {
    if (!splash) return;
    const life = splash === 'wasted' || splash === 'busted' ? 4200 : 3600;
    const t = setTimeout(() => setSplash(null), life);
    return () => clearTimeout(t);
  }, [splash, setSplash]);

  if (!splash) return null;

  const isDeath = splash === 'wasted' || splash === 'busted';
  const title =
    splash === 'wasted' ? 'WASTED' :
    splash === 'busted' ? 'BUSTED' :
    splash === 'mission_passed' ? 'MISSION PASSED' :
    'MISSION FAILED';

  const titleColor =
    splash === 'wasted' ? 'text-rose-500' :
    splash === 'busted' ? 'text-sky-400' :
    splash === 'mission_passed' ? 'text-amber-300' :
    'text-rose-400';

  const glow =
    splash === 'wasted' ? 'drop-shadow-[0_0_28px_rgba(244,63,94,0.85)]' :
    splash === 'busted' ? 'drop-shadow-[0_0_28px_rgba(56,189,248,0.85)]' :
    splash === 'mission_passed' ? 'drop-shadow-[0_0_28px_rgba(252,211,77,0.9)]' :
    'drop-shadow-[0_0_22px_rgba(251,113,133,0.8)]';

  return (
    <div
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center pointer-events-none ${
        isDeath ? 'animate-splash-bg-dark' : 'animate-splash-bg'
      }`}
      style={isDeath ? { backdropFilter: 'grayscale(0.85) saturate(0.6) brightness(0.55)', WebkitBackdropFilter: 'grayscale(0.85) saturate(0.6) brightness(0.55)' } : undefined}
    >
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <h1
          className={`font-game font-black tracking-[0.18em] text-6xl sm:text-7xl md:text-8xl ${titleColor} ${glow} animate-splash-title`}
          style={{ textShadow: '0 6px 0 rgba(0,0,0,0.55)' }}
        >
          {title}
        </h1>
        {splash === 'mission_passed' && (
          <div className="text-amber-200 font-black tracking-[0.3em] text-sm uppercase animate-splash-sub">Respect +</div>
        )}
        {subtitle && (
          <p className="text-white/90 text-sm sm:text-base font-semibold max-w-md animate-splash-sub drop-shadow">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};
