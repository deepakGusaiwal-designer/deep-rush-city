import React, { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';
import {
  Briefcase,
  ChevronDown,
  Wrench,
  ClipboardList,
  Rocket,
  Check,
  Zap,
  Wind,
} from 'lucide-react';

interface ActivitiesDropdownProps {
  onToggleCabJob?: () => void;
  onToggleMissions?: () => void;
  onToggleCustoms?: () => void;
  onToggleJetpack?: () => void;
  onToggleParachute?: () => void;
}

export const ActivitiesDropdown: React.FC<ActivitiesDropdownProps> = ({
  onToggleCabJob,
  onToggleMissions,
  onToggleCustoms,
  onToggleJetpack,
  onToggleParachute,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const cabMission = useGameStore((state) => state.cabMission);
  const activeMission = useGameStore((state) => state.activeMission);
  const isMissionMenuOpen = useGameStore((state) => state.isMissionMenuOpen);
  const isCustomsOpen = useGameStore((state) => state.isCustomsOpen);
  const jetpackActive = useGameStore((state) => state.telemetry.jetpackActive);
  const parachuteActive = useGameStore((state) => state.telemetry.parachuteActive);
  const playerMode = useGameStore((state) => state.telemetry.playerMode);

  const isCabActive = cabMission.status !== 'idle';
  const isStoryActive = activeMission.status === 'active';
  const hasActiveActivity = isCabActive || isStoryActive;

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement)?.blur();
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative pointer-events-auto" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        tabIndex={-1}
        onClick={handleToggle}
        title="Jobs, Customs & Missions (Click to open menu)"
        className={`glass-panel p-1.5 lg:px-2.5 lg:py-1.5 rounded-lg flex items-center gap-1 lg:gap-1.5 border transition-all duration-200 text-[11px] font-bold uppercase tracking-wider shadow-md hover:scale-105 active:scale-95 ${
          hasActiveActivity
            ? 'border-amber-400 bg-amber-950/60 text-amber-300 ring-2 ring-amber-500/30'
            : isOpen
            ? 'border-cyan-400 bg-cyan-950/60 text-cyan-300 ring-2 ring-cyan-500/30'
            : 'border-white/10 hover:border-cyan-400/50 text-gray-200 hover:text-white'
        }`}
      >
        <Briefcase className={`w-3.5 h-3.5 ${hasActiveActivity ? 'text-amber-400' : 'text-cyan-400'}`} />
        <span className="hidden lg:inline">
          {isCabActive ? 'Cab Active' : isStoryActive ? 'Mission Active' : 'Activities'}
        </span>
        {hasActiveActivity && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Activities Menu Panel */}
      {isOpen && (
        <div
          className="absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 top-full mt-1.5 w-72 sm:w-80 glass-panel-glow bg-slate-900/95 backdrop-blur-xl border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 text-white max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-3.5 py-2 bg-slate-950/70 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-black text-xs uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-amber-300">
                Jobs & Activities
              </span>
            </div>
            <span className="text-[9px] text-gray-400 font-mono">Deep Rush Life</span>
          </div>

          {/* Activities List */}
          <div className="p-2 space-y-1.5 overflow-y-auto overscroll-contain touch-pan-y">
            {/* 1. Cab Driver Job */}
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                onToggleCabJob?.();
                setIsOpen(false);
              }}
              className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between group ${
                isCabActive
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-sm'
                  : 'bg-white/5 border-white/5 hover:bg-amber-500/10 hover:border-amber-400/40 text-gray-300 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                  🚖
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-white">Cab Driver Shift</span>
                    <span className="hidden lg:inline text-[9px] font-mono px-1 py-0.2 rounded bg-white/10 text-gray-400">T</span>
                  </div>
                  <div className="text-[10px] text-gray-400 truncate">
                    {isCabActive ? 'Ride in progress - earn cash!' : 'Pick up city fares for $250/ride'}
                  </div>
                </div>
              </div>
              <div className="shrink-0 ml-2">
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                    isCabActive
                      ? 'bg-amber-400 text-slate-950 border-amber-300 font-black'
                      : 'bg-white/5 text-gray-400 border-white/10'
                  }`}
                >
                  {isCabActive ? 'CANCEL' : 'START'}
                </span>
              </div>
            </button>

            {/* 2. Story Missions Board */}
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                onToggleMissions?.();
                setIsOpen(false);
              }}
              className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between group ${
                isStoryActive || isMissionMenuOpen
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-sm'
                  : 'bg-white/5 border-white/5 hover:bg-cyan-500/10 hover:border-cyan-400/40 text-gray-300 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shrink-0 group-hover:scale-110 transition-transform">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-white">Mission Board</span>
                    <span className="hidden lg:inline text-[9px] font-mono px-1 py-0.2 rounded bg-white/10 text-gray-400">M</span>
                  </div>
                  <div className="text-[10px] text-gray-400 truncate">
                    {isStoryActive ? activeMission.title : 'Browse 6 Deep Rush Syndicate contracts'}
                  </div>
                </div>
              </div>
              <div className="shrink-0 ml-2">
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                    isStoryActive
                      ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-black'
                      : 'bg-white/5 text-gray-400 border-white/10'
                  }`}
                >
                  {isStoryActive ? 'ACTIVE' : 'VIEW'}
                </span>
              </div>
            </button>

            {/* 3. Customs & Tuning Shop */}
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                onToggleCustoms?.();
                setIsOpen(false);
              }}
              className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between group ${
                isCustomsOpen
                  ? 'bg-purple-500/20 border-purple-400 text-purple-200 shadow-sm'
                  : 'bg-white/5 border-white/5 hover:bg-purple-500/10 hover:border-purple-400/40 text-gray-300 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shrink-0 group-hover:scale-110 transition-transform">
                  <Wrench className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-white">Customs & Tuning</span>
                    <span className="hidden lg:inline text-[9px] font-mono px-1 py-0.2 rounded bg-white/10 text-gray-400">U</span>
                  </div>
                  <div className="text-[10px] text-gray-400 truncate">
                    Engine, turbo, neon underglow & paint
                  </div>
                </div>
              </div>
              <div className="shrink-0 ml-2">
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-white/5 text-purple-300 border-purple-400/30">
                  TUNE
                </span>
              </div>
            </button>

            {/* 4. Jetpack Flight */}
            {playerMode !== 'driving' && (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => {
                  onToggleJetpack?.();
                  setIsOpen(false);
                }}
                className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between group ${
                  jetpackActive
                    ? 'bg-orange-500/20 border-orange-400 text-orange-200 shadow-sm'
                    : 'bg-white/5 border-white/5 hover:bg-orange-500/10 hover:border-orange-400/40 text-gray-300 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-400/30 flex items-center justify-center text-orange-300 shrink-0 group-hover:scale-110 transition-transform">
                    <Rocket className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-white">Jetpack Flight</span>
                      <span className="hidden lg:inline text-[9px] font-mono px-1 py-0.2 rounded bg-white/10 text-gray-400">J</span>
                    </div>
                    <div className="text-[10px] text-gray-400 truncate">
                      {jetpackActive ? 'Rocket pack active' : 'Equip thrusters for sky flight'}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 ml-2">
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                      jetpackActive
                        ? 'bg-orange-400 text-slate-950 border-orange-300 font-black'
                        : 'bg-white/5 text-gray-400 border-white/10'
                    }`}
                  >
                    {jetpackActive ? 'STOW' : 'FLY'}
                  </span>
                </div>
              </button>
            )}

            {/* 5. Parachute Canopy */}
            {playerMode !== 'driving' && (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => {
                  onToggleParachute?.();
                  setIsOpen(false);
                }}
                className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between group ${
                  parachuteActive
                    ? 'bg-rose-500/20 border-rose-400 text-rose-200 shadow-sm'
                    : 'bg-white/5 border-white/5 hover:bg-emerald-500/10 hover:border-emerald-400/40 text-gray-300 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0 group-hover:scale-110 transition-transform">
                    <Wind className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-white">Parachute Canopy</span>
                      <span className="hidden lg:inline text-[9px] font-mono px-1 py-0.2 rounded bg-white/10 text-gray-400">P</span>
                    </div>
                    <div className="text-[10px] text-gray-400 truncate">
                      {parachuteActive ? 'Canopy deployed · Gliding' : 'Deploy ram-air canopy in mid-air'}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 ml-2">
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                      parachuteActive
                        ? 'bg-rose-400 text-slate-950 border-rose-300 font-black'
                        : 'bg-white/5 text-gray-400 border-white/10'
                    }`}
                  >
                    {parachuteActive ? 'CUT' : 'DEPLOY'}
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
