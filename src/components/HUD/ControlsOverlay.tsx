import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import {
  ChevronUp,
  ChevronDown,
  Volume2,
  Zap,
  Rocket,
  Car,
  RotateCcw,
  Flashlight,
} from 'lucide-react';

interface VirtualThumbstickProps {
  onMove: (x: number, y: number) => void;
  onRelease: () => void;
}

const VirtualThumbstick: React.FC<VirtualThumbstickProps> = ({ onMove, onRelease }) => {
  const baseRef = React.useRef<HTMLDivElement | null>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isEngaged, setIsEngaged] = useState(false);
  const activeTouchId = React.useRef<number | null>(null);

  const handlePointer = (clientX: number, clientY: number) => {
    if (!baseRef.current) return;
    const rect = baseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;

    const maxR = rect.width / 2 - 8;
    const dist = Math.hypot(dx, dy);

    let clampedX = dx;
    let clampedY = dy;
    if (dist > maxR && dist > 0.001) {
      clampedX = (dx / dist) * maxR;
      clampedY = (dy / dist) * maxR;
    }

    const normX = clampedX / maxR;
    const normY = clampedY / maxR;

    // Apply deadzone
    const finalX = Math.abs(normX) < 0.07 ? 0 : normX;
    const finalY = Math.abs(normY) < 0.07 ? 0 : normY;

    setKnobPos({ x: clampedX, y: clampedY });
    onMove(finalX, finalY);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (activeTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    activeTouchId.current = touch.identifier;
    setIsEngaged(true);
    handlePointer(touch.clientX, touch.clientY);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeTouchId.current) {
        handlePointer(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeTouchId.current) {
        activeTouchId.current = null;
        setIsEngaged(false);
        setKnobPos({ x: 0, y: 0 });
        onRelease();
        break;
      }
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') {
      setIsEngaged(true);
      handlePointer(e.clientX, e.clientY);
      const onMouseMove = (me: MouseEvent) => handlePointer(me.clientX, me.clientY);
      const onMouseUp = () => {
        setIsEngaged(false);
        setKnobPos({ x: 0, y: 0 });
        onRelease();
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
  };

  return (
    <div
      ref={baseRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onPointerDown={onPointerDown}
      className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border transition-all flex items-center justify-center touch-none select-none cursor-pointer backdrop-blur-sm ${
        isEngaged
          ? 'border-cyan-400/50 bg-cyan-950/20 shadow-[0_0_15px_rgba(0,240,255,0.2)] opacity-85'
          : 'border-cyan-500/20 bg-slate-950/20 shadow-[0_0_8px_rgba(0,240,255,0.08)] opacity-60 hover:opacity-75'
      }`}
    >
      {/* Concentric Guide Rings */}
      <div className="absolute inset-1.5 rounded-full border border-white/5 pointer-events-none" />
      <div className="absolute inset-4 rounded-full border border-cyan-400/10 pointer-events-none" />

      {/* Cardinal Direction Dots */}
      <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-400/30 pointer-events-none" />
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-400/30 pointer-events-none" />
      <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-cyan-400/30 pointer-events-none" />
      <div className="absolute right-1 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-cyan-400/30 pointer-events-none" />

      {/* Thumb Knob Puck */}
      <div
        style={{
          transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
          transition: isEngaged ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0.9, 0.3, 1)',
        }}
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-md border pointer-events-none backdrop-blur-sm transition-transform ${
          isEngaged
            ? 'bg-cyan-500/40 border-cyan-300/70 text-cyan-100 shadow-cyan-500/30 scale-105'
            : 'bg-slate-800/30 border-white/20 text-cyan-300/60 shadow-black/20'
        }`}
      >
        {/* Core Grip Indent */}
        <div className="w-4 h-4 rounded-full border border-black/20 bg-white/10 flex items-center justify-center shadow-inner">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-900/30" />
        </div>
      </div>
    </div>
  );
};

interface ControlsOverlayProps {
  onResetCar: () => void;
  onToggleCabJob?: () => void;
  onToggleCustoms?: () => void;
  onToggleMissions?: () => void;
  onToggleJetpack?: () => void;
}

export const ControlsOverlay: React.FC<ControlsOverlayProps> = ({
  onResetCar,
  onToggleCabJob,
  onToggleCustoms,
  onToggleMissions,
  onToggleJetpack,
}) => {
  const setControl = useGameStore((state) => state.setControl);
  const setAnalogInput = useGameStore((state) => state.setAnalogInput);
  const cycleCameraMode = useGameStore((state) => state.cycleCameraMode);
  const toggleDayNight = useGameStore((state) => state.toggleDayNight);
  const cycleHeadlightMode = useGameStore((state) => state.cycleHeadlightMode);
  const headlightMode = useGameStore((state) => state.headlightMode);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    // Detect mobile / touch screen
    setIsTouchDevice(
      'ontouchstart' in window ||
      (typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 0)
    );

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent spacebar from activating focused buttons or scrolling the page
      if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        (document.activeElement as HTMLElement)?.blur();
      }

      // Prevent arrow keys from scrolling the viewport
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
      }

      if (e.repeat) return;
      const key = e.key.toLowerCase();

      if (key === 'w' || key === 'arrowup') setControl('forward', true);
      if (key === 's' || key === 'arrowdown') setControl('backward', true);
      if (key === 'a' || key === 'arrowleft') setControl('left', true);
      if (key === 'd' || key === 'arrowright') setControl('right', true);
      if (e.code === 'Space' || key === ' ' || key === 'spacebar') setControl('handbrake', true);
      if (key === 'shift') setControl('boost', true);
      if (key === 'control' || (jetpack && (key === 'c' || key === 'x'))) {
        e.preventDefault();
        setControl('descend', true);
      }
      if (key === 'e') setControl('interact', true);
      if (key === 'h') setControl('horn', true);
      if (key === 'r') onResetCar();
      if (key === 'c' && !jetpack) cycleCameraMode();
      if (key === 'l') cycleHeadlightMode();
      if (key === 'n') toggleDayNight();
      if (key === 't') onToggleCabJob?.();
      if (key === 'u') onToggleCustoms?.();
      if (key === 'm') onToggleMissions?.();
      if (key === 'j' || e.code === 'KeyJ') onToggleJetpack?.();
      if (key === 'escape') {
        const s = useGameStore.getState();
        if (s.isMissionMenuOpen) s.setMissionMenuOpen(false);
        if (s.isCustomsOpen) s.setCustomsOpen(false);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
      }

      const key = e.key.toLowerCase();

      if (key === 'w' || key === 'arrowup') setControl('forward', false);
      if (key === 's' || key === 'arrowdown') setControl('backward', false);
      if (key === 'a' || key === 'arrowleft') setControl('left', false);
      if (key === 'd' || key === 'arrowright') setControl('right', false);
      if (e.code === 'Space' || key === ' ' || key === 'spacebar') setControl('handbrake', false);
      if (key === 'shift') setControl('boost', false);
      if (key === 'control' || key === 'c' || key === 'x') setControl('descend', false);
      if (key === 'e') setControl('interact', false);
      if (key === 'h') setControl('horn', false);
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setControl, cycleCameraMode, cycleHeadlightMode, toggleDayNight, onResetCar, onToggleCabJob, onToggleCustoms, onToggleMissions, onToggleJetpack]);

  const triggerHaptic = (ms: number = 10) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {
        // Safe fallback for restricted vibration environments
      }
    }
  };

  // Touch handlers with haptics & immediate zero-delay response
  const bindTouch = (action: Parameters<typeof setControl>[0], hapticMs: number = 10) => ({
    onTouchStart: (_e: React.TouchEvent) => {
      triggerHaptic(hapticMs);
      setControl(action, true);
    },
    onTouchEnd: (_e: React.TouchEvent) => {
      setControl(action, false);
    },
    onTouchCancel: (_e: React.TouchEvent) => {
      setControl(action, false);
    },
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') {
        setControl(action, true);
      }
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') {
        setControl(action, false);
      }
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') {
        setControl(action, false);
      }
    },
  });

  const telemetry = useGameStore((state) => state.telemetry);
  const playerMode = telemetry.playerMode ?? 'on_foot';
  const prompt = telemetry.interactionPrompt;
  const jetpack = telemetry.jetpackActive && playerMode === 'on_foot';

  return (
    <>
      {/* Floating GTA Context Interaction Prompt */}
      {prompt && (
        <div
          onClick={() => {
            triggerHaptic(15);
            setControl('interact', true);
            setTimeout(() => setControl('interact', false), 200);
          }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 px-3 py-1 rounded-xl bg-slate-950/45 border border-cyan-400/35 shadow-lg backdrop-blur-sm flex items-center gap-1.5 pointer-events-auto whitespace-nowrap z-30 cursor-pointer touch-none select-none transition-transform active:scale-95"
        >
          <span className="hidden lg:inline-block px-1.5 py-0.2 rounded bg-cyan-400/90 text-slate-950 font-black text-[10px] shadow-sm">
            E
          </span>
          <span className="text-white/90 font-bold text-[11px] tracking-wide drop-shadow">
            {isTouchDevice ? prompt.replace(/Press \[E\] to /i, 'Tap to ').replace(/\[E\]/gi, '') : prompt}
          </span>
        </div>
      )}

      {/* Bottom Center Hint Bar (Desktop Keyboard Legend) */}
      <div className="hidden lg:flex fixed bottom-2 left-1/2 -translate-x-1/2 items-center gap-1.5 px-2.5 py-0.5 rounded-lg glass-panel text-[9px] text-gray-400 pointer-events-none select-none border border-white/5 backdrop-blur-sm opacity-70 shadow-md z-20 whitespace-nowrap">
        {playerMode === 'on_foot' ? (
          <>
            <div className="flex items-center gap-1">
              <span className="px-1 py-0.5 rounded bg-white/10 text-gray-200 font-mono font-bold text-[9px]">WASD</span>
              <span>Move</span>
            </div>
            <span className="text-gray-700 text-[8px]">•</span>
            <div className="flex items-center gap-1">
              <span className="px-1 py-0.5 rounded bg-white/10 text-gray-200 font-mono font-bold text-[9px]">SHIFT</span>
              <span>{jetpack ? 'Afterburner' : 'Sprint'}</span>
            </div>
            <span className="text-gray-700 text-[8px]">•</span>
            <div className="flex items-center gap-1">
              <span className="px-1 py-0.5 rounded bg-white/10 text-gray-200 font-mono font-bold text-[9px]">SPACE</span>
              <span>{jetpack ? 'Thrust' : 'Jump'}</span>
            </div>
            {jetpack && (
              <>
                <span className="text-gray-700 text-[8px]">•</span>
                <div className="flex items-center gap-1">
                  <span className="px-1 py-0.5 rounded bg-white/10 text-gray-200 font-mono font-bold text-[9px]">CTRL</span>
                  <span>Descend</span>
                </div>
              </>
            )}
            <span className="text-gray-700 text-[8px]">•</span>
            <div className="flex items-center gap-1">
              <span className="px-1 py-0.5 rounded bg-orange-500/20 text-orange-300 font-mono font-bold text-[9px] border border-orange-500/30">J</span>
              <span className="text-orange-300">{jetpack ? 'Remove Jetpack' : 'Jetpack'}</span>
            </div>
            <span className="text-gray-700 text-[8px]">•</span>
            <div className="flex items-center gap-1">
              <span className="px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold text-[9px] border border-cyan-500/30">E</span>
              <span className="text-cyan-300/90">Enter Car</span>
            </div>
            <span className="text-gray-700 text-[8px]">•</span>
            <div className="flex items-center gap-1">
              <span className="px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold text-[9px] border border-cyan-500/30">DRAG</span>
              <span className="text-cyan-300/90">Orbit</span>
            </div>
            <span className="text-gray-700 text-[8px]">•</span>
            <div className="flex items-center gap-1">
              <span className="px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-[9px] border border-amber-500/30">M</span>
              <span className="text-amber-300">Missions</span>
            </div>
            <span className="text-gray-700 text-[8px]">•</span>
            <div className="flex items-center gap-1">
              <span className="px-1 py-0.5 rounded bg-white/10 text-gray-200 font-mono font-bold text-[9px]">R</span>
              <span>Reset</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1">
              <span className="px-1 py-0.5 rounded bg-white/10 text-gray-200 font-mono font-bold text-[9px]">WASD</span>
              <span>Drive</span>
            </div>
            <span className="text-gray-700 text-[8px]">•</span>
            <div className="flex items-center gap-1">
              <span className="px-1 py-0.5 rounded bg-white/10 text-gray-200 font-mono font-bold text-[9px]">SPACE</span>
              <span>Drift</span>
            </div>
            <span className="text-gray-700 text-[8px]">•</span>
            <div className="flex items-center gap-1">
              <span className="px-1 py-0.5 rounded bg-white/10 text-gray-200 font-mono font-bold text-[9px]">SHIFT</span>
              <span>Nitro</span>
            </div>
            <span className="text-gray-700 text-[8px]">•</span>
            <div className="flex items-center gap-1">
              <span className="px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold text-[9px] border border-cyan-500/30">E</span>
              <span className="text-cyan-300/90">Exit Car</span>
            </div>
            <span className="text-gray-700 text-[8px]">•</span>
            <div className="flex items-center gap-1">
              <span className="px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold text-[9px] border border-cyan-500/30">DRAG</span>
              <span className="text-cyan-300/90">Orbit</span>
            </div>
            <span className="text-gray-700 text-[8px]">•</span>
            <div className="flex items-center gap-1">
              <span className="px-1 py-0.5 rounded bg-white/10 text-gray-200 font-mono font-bold text-[9px]">C</span>
              <span>Cam</span>
            </div>
            <span className="text-gray-700 text-[8px]">•</span>
            <div className="flex items-center gap-1">
              <span className="px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-[9px] border border-amber-500/30">T</span>
              <span className="text-amber-300">Cab Job</span>
            </div>
            <span className="text-gray-700 text-[8px]">•</span>
            <div className="flex items-center gap-1">
              <span className="px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold text-[9px] border border-cyan-500/30">U</span>
              <span className="text-cyan-300">Customs</span>
            </div>
            <span className="text-gray-700 text-[8px]">•</span>
            <div className="flex items-center gap-1">
              <span className="px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold text-[9px] border border-cyan-500/30">L</span>
              <span className="text-cyan-300">Beam ({headlightMode})</span>
            </div>
            <span className="text-gray-700 text-[8px]">•</span>
            <div className="flex items-center gap-1">
              <span className="px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-[9px] border border-amber-500/30">M</span>
              <span className="text-amber-300">Missions</span>
            </div>
            <span className="text-gray-700 text-[8px]">•</span>
            <div className="flex items-center gap-1">
              <span className="px-1 py-0.5 rounded bg-white/10 text-gray-200 font-mono font-bold text-[9px]">R</span>
              <span>Reset</span>
            </div>
          </>
        )}
      </div>

      {/* Bottom Center Hint Bar (Mobile Touch Legend - Ultra-Compact, Transparent) */}
      <div className="flex lg:hidden fixed bottom-1.5 left-1/2 -translate-x-1/2 items-center gap-1 sm:gap-1.5 px-2 py-0.5 rounded-lg bg-slate-950/25 text-[8px] text-gray-400 pointer-events-none select-none border border-white/5 backdrop-blur-sm opacity-60 shadow-sm z-20 whitespace-nowrap">
        {playerMode === 'on_foot' ? (
          <>
            <span className="text-cyan-300 font-semibold">🕹️ Move</span>
            <span className="text-gray-700 text-[6px]">•</span>
            <span className="text-amber-300 font-semibold">⚡ Sprint</span>
            <span className="text-gray-700 text-[6px]">•</span>
            <span className="text-teal-300 font-semibold">⬆️ Jump</span>
            {jetpack && (
              <>
                <span className="text-gray-700 text-[6px]">•</span>
                <span className="text-orange-300 font-semibold">🚀 Jetpack</span>
              </>
            )}
            <span className="text-gray-700 text-[6px]">•</span>
            <span className="text-gray-300 font-semibold">👁️ Orbit</span>
          </>
        ) : (
          <>
            <span className="text-cyan-300 font-semibold">🕹️ Steer</span>
            <span className="text-gray-700 text-[6px]">•</span>
            <span className="text-emerald-300 font-semibold">🟩 Drive</span>
            <span className="text-gray-700 text-[6px]">•</span>
            <span className="text-rose-300 font-semibold">🟥 Brake</span>
            <span className="text-gray-700 text-[6px]">•</span>
            <span className="text-cyan-300 font-semibold">⚡ Nitro</span>
            <span className="text-gray-700 text-[6px]">•</span>
            <span className="text-gray-300 font-semibold">👁️ Orbit</span>
          </>
        )}
      </div>

      {/* Full-Screen Mobile Touch Controller (Visible on touch devices / screens below lg) */}
      <div className="lg:hidden fixed inset-0 pointer-events-none z-20">
        {/* Left Thumb Cluster (Bottom Left) - Virtual Thumbstick */}
        <div className="fixed bottom-2.5 left-2.5 sm:bottom-3 sm:left-3 pointer-events-auto flex flex-col items-start gap-1">
          {playerMode === 'driving' && (
            <div className="flex items-center gap-1.5 mb-0.5">
              <button
                {...bindTouch('horn', 15)}
                className="px-2 h-6 rounded-lg bg-slate-950/30 backdrop-blur-sm border border-amber-400/25 flex items-center gap-1 text-amber-300/90 active:scale-90 active:bg-amber-500/30 text-[9px] font-bold shadow-sm touch-none select-none"
                title="Horn (H)"
              >
                <Volume2 className="w-3 h-3" />
                <span>HORN</span>
              </button>
              <button
                onClick={() => { triggerHaptic(15); cycleHeadlightMode(); }}
                className={`px-2 h-6 rounded-lg bg-slate-950/30 backdrop-blur-sm border flex items-center gap-1 active:scale-90 text-[9px] font-bold shadow-sm touch-none select-none transition-all ${
                  headlightMode === 'high'
                    ? 'border-cyan-400/60 bg-cyan-500/25 text-cyan-200 ring-1 ring-cyan-400/50'
                    : headlightMode === 'low'
                    ? 'border-amber-400/40 bg-amber-500/20 text-amber-200'
                    : 'border-white/10 text-gray-400'
                }`}
                title="Toggle Headlights (L)"
              >
                <Flashlight className="w-3 h-3" />
                <span className="uppercase">{headlightMode === 'off' ? 'OFF' : headlightMode === 'low' ? 'LOW' : 'HIGH'}</span>
              </button>
              <button
                onClick={() => { triggerHaptic(15); onResetCar(); }}
                className="px-2 h-6 rounded-lg bg-slate-950/30 backdrop-blur-sm border border-white/10 flex items-center gap-1 text-gray-300 active:scale-90 active:bg-white/20 text-[9px] font-bold shadow-sm touch-none select-none"
                title="Reset Car (R)"
              >
                <RotateCcw className="w-3 h-3" />
                <span>RESET</span>
              </button>
            </div>
          )}
          <VirtualThumbstick
            onMove={(x, y) => setAnalogInput(x, y)}
            onRelease={() => setAnalogInput(0, 0)}
          />
        </div>

        {/* Right Thumb Cluster (Bottom Right) */}
        <div className="fixed bottom-2 right-2 sm:bottom-2.5 sm:right-2.5 pointer-events-auto">
          {playerMode === 'driving' ? (
            /* Driving: Gas, Brake, Drift, Nitro, Exit */
            <div className="flex flex-col items-end gap-1.5">
              {/* Secondary driving actions row */}
              <div className="flex items-center gap-1.5">
                <button
                  {...bindTouch('interact', 12)}
                  className="px-2 h-6 rounded-lg bg-slate-950/35 border border-cyan-400/40 flex items-center justify-center text-cyan-300 font-bold text-[9px] uppercase active:scale-95 active:bg-cyan-500/30 shadow-sm backdrop-blur-sm touch-none select-none"
                  title="Exit Car (E)"
                >
                  EXIT
                </button>
                <button
                  {...bindTouch('boost', 15)}
                  className="w-8 h-6 rounded-lg bg-slate-950/35 border border-cyan-400/35 flex items-center justify-center text-cyan-300 active:scale-95 active:bg-cyan-500/30 shadow-sm backdrop-blur-sm touch-none select-none"
                  title="Nitro Boost (Shift)"
                >
                  <Zap className="w-3 h-3 text-cyan-300" />
                </button>
                <button
                  {...bindTouch('handbrake', 15)}
                  className="px-2 h-6 rounded-lg bg-slate-950/35 border border-amber-400/35 flex items-center justify-center text-amber-300 font-bold text-[9px] uppercase active:scale-95 active:bg-amber-500/30 shadow-sm backdrop-blur-sm touch-none select-none"
                  title="Drift (Space)"
                >
                  DRIFT
                </button>
              </div>

              {/* Primary Pedals */}
              <div className="flex items-end gap-1.5">
                <button
                  {...bindTouch('backward', 10)}
                  className="w-10 h-12 sm:w-11 sm:h-13 rounded-xl bg-rose-950/25 border border-rose-500/30 flex flex-col items-center justify-center text-rose-300 font-bold text-[10px] uppercase active:scale-95 active:bg-rose-500/35 backdrop-blur-sm shadow-sm touch-none select-none"
                  title="Brake / Reverse (S)"
                >
                  <ChevronDown className="w-4 h-4" />
                  <span className="text-[7px] font-bold tracking-wider">BRAKE</span>
                </button>
                <button
                  {...bindTouch('forward', 12)}
                  className="w-12 h-14 sm:w-13 sm:h-15 rounded-xl bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 flex flex-col items-center justify-center font-black text-xs uppercase shadow-md active:scale-95 active:bg-cyan-500/50 backdrop-blur-sm touch-none select-none"
                  title="Gas / Accelerate (W)"
                >
                  <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
                  <span className="text-[8px] font-black tracking-wider">GAS</span>
                </button>
              </div>
            </div>
          ) : jetpack ? (
            /* Jetpack Flight: Thrust, Descend, Afterburner, Stow */
            <div className="flex flex-col items-end gap-1.5">
              {/* Secondary flight actions row */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { triggerHaptic(15); onToggleJetpack?.(); }}
                  className="px-2 h-6 rounded-lg bg-orange-500/40 text-orange-200 border border-orange-400/50 flex items-center justify-center font-bold text-[9px] uppercase active:scale-95 backdrop-blur-sm shadow-sm touch-none select-none"
                  title="Stow Jetpack (J)"
                >
                  STOW
                </button>
                <button
                  {...bindTouch('boost', 15)}
                  className="px-2 h-6 rounded-lg bg-slate-950/35 border border-cyan-400/35 flex items-center justify-center text-cyan-300 font-bold text-[9px] uppercase active:scale-95 active:bg-cyan-500/30 backdrop-blur-sm shadow-sm touch-none select-none"
                  title="Afterburner Boost (Shift)"
                >
                  <Zap className="w-3 h-3 mr-1" />
                  <span>BOOST</span>
                </button>
              </div>

              {/* Vertical Thrusters */}
              <div className="flex items-end gap-1.5">
                <button
                  {...bindTouch('descend', 10)}
                  className="w-10 h-12 sm:w-11 sm:h-13 rounded-xl bg-amber-950/25 border border-amber-500/30 flex flex-col items-center justify-center text-amber-300 font-bold text-[10px] uppercase active:scale-95 active:bg-amber-500/30 backdrop-blur-sm shadow-sm touch-none select-none"
                  title="Descend (Ctrl)"
                >
                  <ChevronDown className="w-4 h-4" />
                  <span className="text-[7px] font-bold">DOWN</span>
                </button>
                <button
                  {...bindTouch('handbrake', 15)}
                  className="w-12 h-14 sm:w-13 sm:h-15 rounded-xl bg-orange-500/25 border border-orange-400/40 text-orange-200 flex flex-col items-center justify-center font-black text-xs uppercase shadow-md active:scale-95 active:bg-orange-500/50 backdrop-blur-sm touch-none select-none"
                  title="Rocket Thrust (Space)"
                >
                  <Rocket className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="text-[8px] font-black">THRUST</span>
                </button>
              </div>
            </div>
          ) : (
            /* On-Foot: Jump, Sprint, Enter Car, Jetpack */
            <div className="flex flex-col items-end gap-1.5">
              {/* Secondary on-foot actions row */}
              <div className="flex items-center gap-1.5">
                <button
                  {...bindTouch('interact', 15)}
                  className={`px-2 h-6 rounded-lg border flex items-center justify-center font-bold text-[9px] uppercase active:scale-95 transition-all shadow-sm touch-none select-none backdrop-blur-sm ${
                    prompt
                      ? 'bg-cyan-500/40 text-cyan-200 border-cyan-400 animate-pulse'
                      : 'bg-slate-950/35 text-cyan-300 border-cyan-400/30'
                  }`}
                  title="Enter Vehicle (E)"
                >
                  <Car className="w-3 h-3 mr-1" />
                  <span>ENTER</span>
                </button>
                <button
                  onClick={() => { triggerHaptic(15); onToggleJetpack?.(); }}
                  className="px-2 h-6 rounded-lg bg-slate-950/35 border border-orange-500/35 flex items-center justify-center text-orange-300 font-bold text-[9px] uppercase active:scale-95 active:bg-orange-500/30 backdrop-blur-sm shadow-sm touch-none select-none"
                  title="Equip Jetpack (J)"
                >
                  <Rocket className="w-3 h-3 mr-1 text-orange-400" />
                  <span>JETPACK</span>
                </button>
              </div>

              {/* Primary Jump & Sprint buttons */}
              <div className="flex items-end gap-1.5">
                <button
                  {...bindTouch('boost', 10)}
                  className="w-11 h-11 sm:w-12 sm:h-12 aspect-square rounded-xl bg-slate-950/35 border border-cyan-400/30 flex flex-col items-center justify-center text-cyan-300 font-bold uppercase active:scale-95 active:bg-cyan-500/30 backdrop-blur-sm shadow-sm touch-none select-none"
                  title="Sprint (Shift)"
                >
                  <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="text-[7px] font-bold">SPRINT</span>
                </button>
                <button
                  {...bindTouch('handbrake', 15)}
                  className="w-11 h-11 sm:w-12 sm:h-12 aspect-square rounded-xl bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 flex flex-col items-center justify-center font-black uppercase shadow-md active:scale-95 active:bg-emerald-500/50 backdrop-blur-sm touch-none select-none"
                  title="Jump (Space)"
                >
                  <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                  <span className="text-[7px] font-black">JUMP</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
