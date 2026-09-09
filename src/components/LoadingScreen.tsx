import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { Flame, ShieldAlert, Users, Wrench, Compass, Zap } from 'lucide-react';

const TIPS = [
  {
    icon: Flame,
    color: 'text-amber-400',
    title: 'Power Drifting',
    desc: 'Hold SPACE while steering into sharp turns to initiate high-scoring drifts!',
  },
  {
    icon: Zap,
    color: 'text-cyan-400',
    title: 'Nitro Afterburner',
    desc: 'Hit SHIFT to engage nitro boost and blast past 200 km/h on open highways!',
  },
  {
    icon: Compass,
    color: 'text-emerald-400',
    title: 'Jetpack Flight',
    desc: 'Press J to equip your jetpack, SPACE to gain altitude, and land cleanly on rooftops!',
  },
  {
    icon: Wrench,
    color: 'text-purple-400',
    title: 'Customs Garage',
    desc: 'Press C to paint your ride, install vibrant neon underglow, and upgrade performance stages!',
  },
  {
    icon: ShieldAlert,
    color: 'text-rose-400',
    title: 'Police Lethal Force',
    desc: 'Hit-and-run driving triggers 10-99 radio dispatch! Pursuing cruisers will shoot to kill!',
  },
  {
    icon: Users,
    color: 'text-sky-400',
    title: 'Multiplayer Car Meets',
    desc: 'Visit the Marina or Fountain Plaza to meet live drivers, inspect rides, and chat!',
  },
];

export const LoadingScreen: React.FC = () => {
  const isLoading = useGameStore((state) => state.isLoading);
  const loadingProgress = useGameStore((state) => state.loadingProgress);
  const loadingMessage = useGameStore((state) => state.loadingMessage);

  const [shouldRender, setShouldRender] = useState(isLoading);
  const [fadingOut, setFadingOut] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);

  // Smooth exit transition once loading completes
  useEffect(() => {
    if (!isLoading && shouldRender) {
      setFadingOut(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 500);
      return () => clearTimeout(timer);
    } else if (isLoading) {
      setShouldRender(true);
      setFadingOut(false);
    }
  }, [isLoading, shouldRender]);

  // Rotate helpful pro tips
  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % TIPS.length);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  if (!shouldRender) return null;

  const currentTip = TIPS[tipIndex];
  const TipIcon = currentTip.icon;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 p-6 select-none transition-all duration-500 overflow-hidden ${
        fadingOut ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Subtle Radial Cyber Ambient Light */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-cyan-600/15 via-blue-600/10 to-amber-500/10 rounded-full blur-[140px]" />
      </div>

      {/* Main Center Content with ample breathing room */}
      <div className="relative z-10 flex flex-col items-center max-w-[340px] sm:max-w-[380px] w-full text-center px-4 my-auto">
        {/* Crystal-Clear Compact Floating Logo */}
        <div className="mb-2 sm:mb-3 select-none">
          <img
            src="/logo.png"
            alt="Deep Rush City"
            className="h-20 sm:h-24 md:h-28 w-auto max-w-[240px] sm:max-w-[280px] object-contain animate-logo-float pointer-events-none mx-auto"
          />
        </div>

        {/* Tagline */}
        <p className="text-[10px] sm:text-[11px] font-semibold tracking-[0.3em] uppercase text-cyan-300/80 mb-4 sm:mb-5">
          Open World Urban Sandbox
        </p>

        {/* Futuristic Glowing Progress Bar */}
        <div className="w-full bg-slate-900/90 rounded-full h-2 sm:h-2.5 p-0.5 border border-cyan-500/30 shadow-[0_0_16px_rgba(0,240,255,0.2)] overflow-hidden mb-1.5 relative">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 via-sky-500 to-amber-400 rounded-full transition-all duration-300 relative shadow-[0_0_10px_rgba(0,240,255,0.6)]"
            style={{ width: `${Math.max(loadingProgress, 5)}%` }}
          >
            {/* White-hot leading edge spark */}
            <div className="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full shadow-[0_0_8px_#fff]" />
          </div>
        </div>

        {/* Status Telemetry Row */}
        <div className="flex justify-between items-center w-full text-[11px] font-mono px-1 mb-4 sm:mb-5">
          <span className="truncate max-w-[230px] sm:max-w-[270px] text-gray-400 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            {loadingMessage || 'Initializing Metropolis...'}
          </span>
          <span className="font-bold text-cyan-300 text-xs tracking-wider drop-shadow-[0_0_8px_rgba(0,240,255,0.6)]">
            {loadingProgress}%
          </span>
        </div>

        {/* Compact Pro Tip Box */}
        <div className="w-full p-2 sm:p-2.5 rounded-xl bg-slate-900/60 border border-white/10 backdrop-blur-md text-gray-300 text-xs flex items-center gap-2.5 text-left shadow-lg shadow-black/40 transition-all duration-300">
          <div className="p-1 rounded-lg bg-white/5 border border-white/10 shrink-0">
            <TipIcon className={`w-4 h-4 ${currentTip.color}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-white uppercase tracking-wider mb-0.5">
              {currentTip.title}
            </div>
            <div className="text-[10px] sm:text-[11px] text-gray-300 leading-tight">
              {currentTip.desc}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
