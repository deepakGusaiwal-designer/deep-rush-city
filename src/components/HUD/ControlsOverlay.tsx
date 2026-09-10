import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { PlayerControls } from '../../types/game';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Zap,
  Rocket,
  Car,
  RotateCcw,
  Flashlight,
  Compass,
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
    e.preventDefault();
    if (activeTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    activeTouchId.current = touch.identifier;
    setIsEngaged(true);
    handlePointer(touch.clientX, touch.clientY);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeTouchId.current) {
        handlePointer(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
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
    if (e.touches.length === 0 && isEngaged) {
      activeTouchId.current = null;
      setIsEngaged(false);
      setKnobPos({ x: 0, y: 0 });
      onRelease();
    }
  };

  const onTouchCancel = (e: React.TouchEvent) => {
    e.preventDefault();
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
    if (e.touches.length === 0 && isEngaged) {
      activeTouchId.current = null;
      setIsEngaged(false);
      setKnobPos({ x: 0, y: 0 });
      onRelease();
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

export const triggerHaptic = (ms: number = 10) => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      // Safe fallback for restricted vibration environments
    }
  }
};

type ControlActionKey = keyof PlayerControls;

interface TouchActionButtonProps {
  action?: ControlActionKey;
  onTap?: () => void;
  className?: string;
  activeClassName?: string;
  title?: string;
  hapticMs?: number;
  children: React.ReactNode;
}

export const TouchActionButton: React.FC<TouchActionButtonProps> = ({
  action,
  onTap,
  className = '',
  activeClassName = '',
  title = '',
  hapticMs = 12,
  children,
}) => {
  const setControl = useGameStore((state) => state.setControl);
  const [isPressed, setIsPressed] = useState(false);
  const activeTouchId = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (activeTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    activeTouchId.current = touch.identifier;
    setIsPressed(true);
    triggerHaptic(hapticMs);
    if (action) setControl(action, true);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId.current) {
        activeTouchId.current = null;
        setIsPressed(false);
        if (action) setControl(action, false);
        if (onTap) onTap();
        break;
      }
    }
    if (e.touches.length === 0 && activeTouchId.current !== null) {
      activeTouchId.current = null;
      setIsPressed(false);
      if (action) setControl(action, false);
    }
  };

  const onTouchCancel = (e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId.current) {
        activeTouchId.current = null;
        setIsPressed(false);
        if (action) setControl(action, false);
        break;
      }
    }
    if (e.touches.length === 0 && activeTouchId.current !== null) {
      activeTouchId.current = null;
      setIsPressed(false);
      if (action) setControl(action, false);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') {
      setIsPressed(true);
      triggerHaptic(hapticMs);
      if (action) setControl(action, true);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') {
      setIsPressed(false);
      if (action) setControl(action, false);
      if (onTap) onTap();
    }
  };

  const onPointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && isPressed) {
      setIsPressed(false);
      if (action) setControl(action, false);
    }
  };

  useEffect(() => {
    const handleReset = () => {
      if (activeTouchId.current !== null || isPressed) {
        activeTouchId.current = null;
        setIsPressed(false);
        if (action) setControl(action, false);
      }
    };
    window.addEventListener('blur', handleReset);
    return () => window.removeEventListener('blur', handleReset);
  }, [action, isPressed, setControl]);

  return (
    <button
      type="button"
      title={title}
      onTouchStart={onTouchStart}
      onTouchMove={(e) => { e.preventDefault(); }}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      className={`${className} ${isPressed ? (activeClassName || 'scale-95 brightness-125') : ''} touch-none select-none transition-transform`}
      style={{ touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
    >
      {children}
    </button>
  );
};

/** Unified Left/Right steering pad allowing natural sliding transitions without stuck touches. */
export const MobileSteeringPad: React.FC = () => {
  const setControl = useGameStore((state) => state.setControl);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeDir, setActiveDir] = useState<'left' | 'right' | null>(null);
  const activeTouchId = useRef<number | null>(null);

  const updateSteeringFromPoint = (clientX: number, clientY: number, touchId: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    // If finger moves far outside, release
    if (clientY < rect.top - 50 || clientY > rect.bottom + 50 || clientX < rect.left - 50 || clientX > rect.right + 50) {
      if (activeTouchId.current === touchId) {
        activeTouchId.current = null;
        setActiveDir(null);
        setControl('left', false);
        setControl('right', false);
      }
      return;
    }

    const centerX = rect.left + rect.width / 2;
    if (clientX < centerX) {
      if (activeDir !== 'left') {
        setActiveDir('left');
        setControl('left', true);
        setControl('right', false);
        triggerHaptic(10);
      }
    } else {
      if (activeDir !== 'right') {
        setActiveDir('right');
        setControl('left', false);
        setControl('right', true);
        triggerHaptic(10);
      }
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    activeTouchId.current = touch.identifier;
    updateSteeringFromPoint(touch.clientX, touch.clientY, touch.identifier);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (activeTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeTouchId.current) {
        updateSteeringFromPoint(touch.clientX, touch.clientY, touch.identifier);
        break;
      }
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId.current) {
        activeTouchId.current = null;
        setActiveDir(null);
        setControl('left', false);
        setControl('right', false);
        break;
      }
    }
    if (e.touches.length === 0) {
      activeTouchId.current = null;
      setActiveDir(null);
      setControl('left', false);
      setControl('right', false);
    }
  };

  useEffect(() => {
    const handleReset = () => {
      activeTouchId.current = null;
      setActiveDir(null);
      setControl('left', false);
      setControl('right', false);
    };
    window.addEventListener('blur', handleReset);
    return () => window.removeEventListener('blur', handleReset);
  }, [setControl]);

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      className="flex items-center gap-2 touch-none select-none cursor-pointer"
      style={{ touchAction: 'none' }}
    >
      {/* Left Steer Button */}
      <div
        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 flex flex-col items-center justify-center transition-all duration-75 backdrop-blur-sm pointer-events-none select-none ${
          activeDir === 'left'
            ? 'bg-cyan-500/60 border-cyan-300 text-white shadow-[0_0_20px_rgba(0,240,255,0.6)] ring-2 ring-cyan-300 scale-95'
            : 'bg-cyan-950/35 border-cyan-400/40 text-cyan-200 shadow-[0_0_12px_rgba(0,240,255,0.15)]'
        }`}
      >
        <ChevronLeft className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.5]" />
        <span className="text-[8px] font-black tracking-wider">LEFT</span>
      </div>

      {/* Right Steer Button */}
      <div
        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 flex flex-col items-center justify-center transition-all duration-75 backdrop-blur-sm pointer-events-none select-none ${
          activeDir === 'right'
            ? 'bg-cyan-500/60 border-cyan-300 text-white shadow-[0_0_20px_rgba(0,240,255,0.6)] ring-2 ring-cyan-300 scale-95'
            : 'bg-cyan-950/35 border-cyan-400/40 text-cyan-200 shadow-[0_0_12px_rgba(0,240,255,0.15)]'
        }`}
      >
        <ChevronRight className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.5]" />
        <span className="text-[8px] font-black tracking-wider">RIGHT</span>
      </div>
    </div>
  );
};

/** Unified Gas & Brake pedals cluster supporting slide transitions and simultaneous touches. */
export const MobilePedalsCluster: React.FC = () => {
  const setControl = useGameStore((state) => state.setControl);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activePedal, setActivePedal] = useState<'forward' | 'backward' | null>(null);
  const activeTouchId = useRef<number | null>(null);

  const updatePedalsFromPoint = (clientX: number, clientY: number, touchId: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    if (clientY < rect.top - 50 || clientY > rect.bottom + 50 || clientX < rect.left - 50 || clientX > rect.right + 50) {
      if (activeTouchId.current === touchId) {
        activeTouchId.current = null;
        setActivePedal(null);
        setControl('forward', false);
        setControl('backward', false);
      }
      return;
    }

    // Brake is on left half, Gas is on right half
    const centerX = rect.left + rect.width / 2;
    if (clientX < centerX) {
      if (activePedal !== 'backward') {
        setActivePedal('backward');
        setControl('forward', false);
        setControl('backward', true);
        triggerHaptic(10);
      }
    } else {
      if (activePedal !== 'forward') {
        setActivePedal('forward');
        setControl('forward', true);
        setControl('backward', false);
        triggerHaptic(10);
      }
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    activeTouchId.current = touch.identifier;
    updatePedalsFromPoint(touch.clientX, touch.clientY, touch.identifier);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (activeTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeTouchId.current) {
        updatePedalsFromPoint(touch.clientX, touch.clientY, touch.identifier);
        break;
      }
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId.current) {
        activeTouchId.current = null;
        setActivePedal(null);
        setControl('forward', false);
        setControl('backward', false);
        break;
      }
    }
    if (e.touches.length === 0) {
      activeTouchId.current = null;
      setActivePedal(null);
      setControl('forward', false);
      setControl('backward', false);
    }
  };

  useEffect(() => {
    const handleReset = () => {
      activeTouchId.current = null;
      setActivePedal(null);
      setControl('forward', false);
      setControl('backward', false);
    };
    window.addEventListener('blur', handleReset);
    return () => window.removeEventListener('blur', handleReset);
  }, [setControl]);

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      className="flex items-end gap-2 touch-none select-none cursor-pointer"
      style={{ touchAction: 'none' }}
    >
      {/* Brake Pedal */}
      <div
        className={`w-12 h-14 sm:w-13 sm:h-15 rounded-xl border-2 flex flex-col items-center justify-center font-bold uppercase transition-all duration-75 backdrop-blur-sm pointer-events-none select-none ${
          activePedal === 'backward'
            ? 'bg-rose-600/60 border-rose-400 text-white shadow-[0_0_20px_rgba(244,63,94,0.6)] scale-95'
            : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
        }`}
      >
        <ChevronDown className="w-5 h-5 stroke-[2.5]" />
        <span className="text-[7.5px] font-bold tracking-wider">BRAKE</span>
      </div>

      {/* Gas Pedal */}
      <div
        className={`w-14 h-16 sm:w-15 sm:h-17 rounded-xl border-2 flex flex-col items-center justify-center uppercase transition-all duration-75 backdrop-blur-sm pointer-events-none select-none ${
          activePedal === 'forward'
            ? 'bg-cyan-500/70 border-cyan-300 text-white shadow-[0_0_25px_rgba(0,240,255,0.7)] ring-2 ring-cyan-300 scale-95'
            : 'bg-cyan-500/25 border-cyan-400/50 text-cyan-200'
        }`}
      >
        <ChevronUp className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.5]" />
        <span className="text-[8.5px] font-black tracking-wider">GAS</span>
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
  onToggleParachute?: () => void;
}

export const ControlsOverlay: React.FC<ControlsOverlayProps> = ({
  onResetCar,
  onToggleCabJob,
  onToggleCustoms,
  onToggleMissions,
  onToggleJetpack,
  onToggleParachute,
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
      if (key === 'p' || e.code === 'KeyP') onToggleParachute?.();
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
  }, [setControl, cycleCameraMode, cycleHeadlightMode, toggleDayNight, onResetCar, onToggleCabJob, onToggleCustoms, onToggleMissions, onToggleJetpack, onToggleParachute]);

  // Selective store subscriptions to avoid 60fps re-renders during gameplay
  const playerMode = useGameStore((state) => state.telemetry.playerMode ?? 'on_foot');
  const prompt = useGameStore((state) => state.telemetry.interactionPrompt);
  const jetpackActive = useGameStore((state) => state.telemetry.jetpackActive);
  const parachuteActive = useGameStore((state) => state.telemetry.parachuteActive);
  const altitude = useGameStore((state) => state.telemetry.altitude ?? 0);
  const jetpack = jetpackActive && playerMode === 'on_foot';

  // Mobile driving steering mode: 'buttons' (dedicated Left/Right steering buttons) or 'stick' (virtual thumbstick)
  const [drivingControlMode, setDrivingControlMode] = useState<'buttons' | 'stick'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('drc_driving_controls') as 'buttons' | 'stick') || 'buttons';
    }
    return 'buttons';
  });

  const toggleDrivingControlMode = () => {
    triggerHaptic(15);
    const next = drivingControlMode === 'buttons' ? 'stick' : 'buttons';
    setDrivingControlMode(next);
    localStorage.setItem('drc_driving_controls', next);
  };

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
            {parachuteActive ? (
              <>
                <span className="text-gray-700 text-[8px]">•</span>
                <div className="flex items-center gap-1">
                  <span className="px-1 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono font-bold text-[9px] border border-rose-500/30">P</span>
                  <span className="text-rose-300 font-bold">Cut Chute</span>
                </div>
                <span className="text-gray-700 text-[8px]">•</span>
                <div className="flex items-center gap-1">
                  <span className="px-1 py-0.5 rounded bg-white/10 text-gray-200 font-mono font-bold text-[9px]">S/SPACE</span>
                  <span>Flare Brake</span>
                </div>
              </>
            ) : (
              <>
                <span className="text-gray-700 text-[8px]">•</span>
                <div className="flex items-center gap-1">
                  <span className={`px-1 py-0.5 rounded font-mono font-bold text-[9px] border ${
                    altitude > 1.8 && !jetpack
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                      : 'bg-white/10 text-gray-200 border-transparent'
                  }`}>P</span>
                  <span className={altitude > 1.8 && !jetpack ? 'text-emerald-300 font-bold' : ''}>Parachute</span>
                </div>
              </>
            )}
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
        {/* Left Thumb Cluster (Bottom Left) */}
        <div className="fixed bottom-2.5 left-2.5 sm:bottom-3 sm:left-3 pointer-events-auto flex flex-col items-start gap-1">
          {playerMode === 'driving' && (
            <div className="flex items-center gap-1.5 mb-1">
              <TouchActionButton
                action="horn"
                className="px-2 h-6 rounded-lg bg-slate-950/40 backdrop-blur-sm border border-amber-400/30 flex items-center gap-1 text-amber-300/90 text-[9px] font-bold shadow-sm"
                activeClassName="bg-amber-500/40 border-amber-300 text-white"
                title="Horn (H)"
              >
                <Volume2 className="w-3 h-3" />
                <span>HORN</span>
              </TouchActionButton>
              <TouchActionButton
                onTap={() => { triggerHaptic(15); cycleHeadlightMode(); }}
                className={`px-2 h-6 rounded-lg bg-slate-950/40 backdrop-blur-sm border flex items-center gap-1 text-[9px] font-bold shadow-sm ${
                  headlightMode === 'high'
                    ? 'border-cyan-400/70 bg-cyan-500/30 text-cyan-200 ring-1 ring-cyan-400/50'
                    : headlightMode === 'low'
                    ? 'border-amber-400/50 bg-amber-500/25 text-amber-200'
                    : 'border-white/15 text-gray-400'
                }`}
                title="Toggle Headlights (L)"
              >
                <Flashlight className="w-3 h-3" />
                <span className="uppercase">{headlightMode === 'off' ? 'OFF' : headlightMode === 'low' ? 'LOW' : 'HIGH'}</span>
              </TouchActionButton>
              <TouchActionButton
                onTap={() => { triggerHaptic(15); onResetCar(); }}
                className="px-2 h-6 rounded-lg bg-slate-950/40 backdrop-blur-sm border border-white/15 flex items-center gap-1 text-gray-300 text-[9px] font-bold shadow-sm"
                activeClassName="bg-white/30 text-white"
                title="Reset Car (R)"
              >
                <RotateCcw className="w-3 h-3" />
                <span>RESET</span>
              </TouchActionButton>
              <button
                type="button"
                onClick={toggleDrivingControlMode}
                className="px-2 h-6 rounded-lg bg-cyan-950/40 backdrop-blur-sm border border-cyan-400/30 flex items-center gap-1 text-cyan-300 text-[9px] font-bold shadow-sm touch-none select-none active:scale-90"
                title="Switch between Steering Buttons and Thumbstick"
              >
                <Compass className="w-3 h-3 text-cyan-400" />
                <span>{drivingControlMode === 'buttons' ? 'STICK' : 'KEYS'}</span>
              </button>
            </div>
          )}

          {playerMode === 'driving' && drivingControlMode === 'buttons' ? (
            /* Dedicated Left / Right Steering Pad with fluid slide transitions */
            <MobileSteeringPad />
          ) : (
            <VirtualThumbstick
              onMove={(x, y) => setAnalogInput(x, y)}
              onRelease={() => setAnalogInput(0, 0)}
            />
          )}
        </div>

        {/* Right Thumb Cluster (Bottom Right) */}
        <div className="fixed bottom-2 right-2 sm:bottom-2.5 sm:right-2.5 pointer-events-auto">
          {playerMode === 'driving' ? (
            /* Driving: Gas, Brake, Drift, Nitro, Exit */
            <div className="flex flex-col items-end gap-1.5">
              {/* Secondary driving actions row */}
              <div className="flex items-center gap-1.5">
                <TouchActionButton
                  action="interact"
                  className="px-2.5 h-6 rounded-lg bg-slate-950/40 border border-cyan-400/40 flex items-center justify-center text-cyan-300 font-bold text-[9px] uppercase shadow-sm backdrop-blur-sm"
                  activeClassName="bg-cyan-500/50 border-cyan-300 text-white"
                  title="Exit Car (E)"
                >
                  EXIT
                </TouchActionButton>
                <TouchActionButton
                  action="boost"
                  className="w-9 h-6 rounded-lg bg-slate-950/40 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-sm backdrop-blur-sm"
                  activeClassName="bg-cyan-500/50 border-cyan-300 text-white shadow-[0_0_15px_rgba(0,240,255,0.5)]"
                  title="Nitro Boost (Shift)"
                >
                  <Zap className="w-3.5 h-3.5 text-cyan-300" />
                </TouchActionButton>
                <TouchActionButton
                  action="handbrake"
                  className="px-2.5 h-6 rounded-lg bg-slate-950/40 border border-amber-400/40 flex items-center justify-center text-amber-300 font-bold text-[9px] uppercase shadow-sm backdrop-blur-sm"
                  activeClassName="bg-amber-500/50 border-amber-300 text-white shadow-[0_0_15px_rgba(251,191,36,0.5)]"
                  title="Drift (Space)"
                >
                  DRIFT
                </TouchActionButton>
              </div>

              {/* Primary Pedals */}
              <MobilePedalsCluster />
            </div>
          ) : jetpack ? (
            /* Jetpack Flight: Thrust, Descend, Afterburner, Stow */
            <div className="flex flex-col items-end gap-1.5">
              {/* Secondary flight actions row */}
              <div className="flex items-center gap-1.5">
                <TouchActionButton
                  onTap={() => { triggerHaptic(15); onToggleJetpack?.(); }}
                  className="px-2.5 h-6 rounded-lg bg-orange-500/40 text-orange-200 border border-orange-400/50 flex items-center justify-center font-bold text-[9px] uppercase backdrop-blur-sm shadow-sm"
                  activeClassName="bg-orange-500/70 border-orange-300 text-white"
                  title="Stow Jetpack (J)"
                >
                  STOW
                </TouchActionButton>
                <TouchActionButton
                  action="boost"
                  className="px-2.5 h-6 rounded-lg bg-slate-950/40 border border-cyan-400/40 flex items-center justify-center text-cyan-300 font-bold text-[9px] uppercase backdrop-blur-sm shadow-sm"
                  activeClassName="bg-cyan-500/50 border-cyan-300 text-white shadow-[0_0_15px_rgba(0,240,255,0.5)]"
                  title="Afterburner Boost (Shift)"
                >
                  <Zap className="w-3 h-3 mr-1" />
                  <span>BOOST</span>
                </TouchActionButton>
              </div>

              {/* Vertical Thrusters */}
              <div className="flex items-end gap-2">
                <TouchActionButton
                  action="descend"
                  className="w-12 h-14 sm:w-13 sm:h-15 rounded-xl bg-amber-950/30 border-2 border-amber-500/40 flex flex-col items-center justify-center text-amber-300 font-bold text-[10px] uppercase backdrop-blur-sm shadow-sm"
                  activeClassName="bg-amber-600/55 border-amber-300 text-white shadow-[0_0_20px_rgba(245,158,11,0.5)] scale-95"
                  title="Descend (Ctrl)"
                >
                  <ChevronDown className="w-5 h-5 stroke-[2.5]" />
                  <span className="text-[7.5px] font-bold">DOWN</span>
                </TouchActionButton>
                <TouchActionButton
                  action="handbrake"
                  className="w-14 h-16 sm:w-15 sm:h-17 rounded-xl bg-orange-500/25 border-2 border-orange-400/50 text-orange-200 flex flex-col items-center justify-center font-black text-xs uppercase shadow-md backdrop-blur-sm"
                  activeClassName="bg-orange-500/65 border-orange-300 text-white shadow-[0_0_25px_rgba(249,115,22,0.6)] ring-2 ring-orange-300 scale-95"
                  title="Rocket Thrust (Space)"
                >
                  <Rocket className="w-6 h-6 sm:w-7 sm:h-7" />
                  <span className="text-[8.5px] font-black">THRUST</span>
                </TouchActionButton>
              </div>
            </div>
          ) : parachuteActive ? (
            /* Parachute Gliding: Flare Brake, Dive, Cut Lines */
            <div className="flex flex-col items-end gap-1.5">
              {/* Secondary action row */}
              <div className="flex items-center gap-1.5">
                <TouchActionButton
                  onTap={() => { triggerHaptic(20); onToggleParachute?.(); }}
                  className="px-2.5 h-6 rounded-lg bg-rose-500/40 text-rose-200 border border-rose-400/50 flex items-center justify-center font-bold text-[9px] uppercase backdrop-blur-sm shadow-sm"
                  activeClassName="bg-rose-500/70 border-rose-300 text-white"
                  title="Cut Parachute (P)"
                >
                  <span className="mr-1 text-[10px]">✂️</span>
                  <span>CUT CHUTE</span>
                </TouchActionButton>
              </div>

              {/* Primary Dive & Flare buttons */}
              <div className="flex items-end gap-2">
                <TouchActionButton
                  action="forward"
                  className="w-13 h-13 sm:w-14 sm:h-14 aspect-square rounded-2xl bg-cyan-950/40 border-2 border-cyan-400/50 text-cyan-200 flex flex-col items-center justify-center font-bold uppercase shadow-sm backdrop-blur-sm"
                  activeClassName="bg-cyan-500/55 border-cyan-300 text-white shadow-[0_0_20px_rgba(0,240,255,0.5)] scale-95"
                  title="Dive Glide (W)"
                >
                  <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
                  <span className="text-[7.5px] font-bold">DIVE</span>
                </TouchActionButton>
                <TouchActionButton
                  action="backward"
                  className="w-13 h-13 sm:w-14 sm:h-14 aspect-square rounded-2xl bg-amber-500/25 border-2 border-amber-400/50 text-amber-200 flex flex-col items-center justify-center font-black uppercase shadow-md backdrop-blur-sm"
                  activeClassName="bg-amber-500/65 border-amber-300 text-white shadow-[0_0_25px_rgba(245,158,11,0.6)] ring-2 ring-amber-300 scale-95"
                  title="Flare Brake (S / Space)"
                >
                  <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
                  <span className="text-[7.5px] font-black">FLARE</span>
                </TouchActionButton>
              </div>
            </div>
          ) : (
            /* On-Foot: Jump, Sprint, Enter Car, Jetpack, Parachute */
            <div className="flex flex-col items-end gap-1.5">
              {/* Secondary on-foot actions row */}
              <div className="flex items-center gap-1.5">
                <TouchActionButton
                  action="interact"
                  className={`px-2.5 h-6 rounded-lg border flex items-center justify-center font-bold text-[9px] uppercase transition-all shadow-sm backdrop-blur-sm ${
                    prompt
                      ? 'bg-cyan-500/40 text-cyan-100 border-cyan-400 ring-1 ring-cyan-400 animate-pulse'
                      : 'bg-slate-950/40 text-cyan-300 border-cyan-400/30'
                  }`}
                  activeClassName="bg-cyan-500/65 text-white border-cyan-300"
                  title="Enter Vehicle (E)"
                >
                  <Car className="w-3.5 h-3.5 mr-1" />
                  <span>ENTER</span>
                </TouchActionButton>
                <TouchActionButton
                  onTap={() => { triggerHaptic(15); onToggleParachute?.(); }}
                  className={`px-2.5 h-6 rounded-lg border flex items-center justify-center font-bold text-[9px] uppercase backdrop-blur-sm shadow-sm transition-all ${
                    altitude > 1.8 && !jetpack
                      ? 'bg-emerald-500/40 text-emerald-100 border-emerald-400 ring-1 ring-emerald-400 animate-pulse'
                      : 'bg-slate-950/40 border-emerald-500/30 text-emerald-300'
                  }`}
                  activeClassName="bg-emerald-500/60 border-emerald-300 text-white"
                  title="Deploy Parachute (P)"
                >
                  <span className="mr-1 text-[11px]">🪂</span>
                  <span>CHUTE</span>
                </TouchActionButton>
                <TouchActionButton
                  onTap={() => { triggerHaptic(15); onToggleJetpack?.(); }}
                  className="px-2.5 h-6 rounded-lg bg-slate-950/40 border border-orange-500/40 flex items-center justify-center text-orange-300 font-bold text-[9px] uppercase backdrop-blur-sm shadow-sm"
                  activeClassName="bg-orange-500/50 border-orange-300 text-white"
                  title="Equip Jetpack (J)"
                >
                  <Rocket className="w-3.5 h-3.5 mr-1 text-orange-400" />
                  <span>JETPACK</span>
                </TouchActionButton>
              </div>

              {/* Primary Jump & Sprint buttons */}
              <div className="flex items-end gap-2">
                <TouchActionButton
                  action="boost"
                  className="w-13 h-13 sm:w-14 sm:h-14 aspect-square rounded-2xl bg-slate-950/40 border-2 border-cyan-400/40 flex flex-col items-center justify-center text-cyan-300 font-bold uppercase backdrop-blur-sm shadow-sm"
                  activeClassName="bg-cyan-500/50 border-cyan-300 text-white shadow-[0_0_20px_rgba(0,240,255,0.5)] scale-95"
                  title="Sprint (Shift)"
                >
                  <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-[7.5px] font-bold">SPRINT</span>
                </TouchActionButton>
                <TouchActionButton
                  action="handbrake"
                  className="w-13 h-13 sm:w-14 sm:h-14 aspect-square rounded-2xl bg-emerald-500/25 border-2 border-emerald-400/50 text-emerald-200 flex flex-col items-center justify-center font-black uppercase shadow-md backdrop-blur-sm"
                  activeClassName="bg-emerald-500/65 border-emerald-300 text-white shadow-[0_0_25px_rgba(16,185,129,0.6)] ring-2 ring-emerald-300 scale-95"
                  title="Jump (Space)"
                >
                  <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
                  <span className="text-[7.5px] font-black">JUMP</span>
                </TouchActionButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
