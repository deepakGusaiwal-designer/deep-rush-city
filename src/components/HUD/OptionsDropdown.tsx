import React, { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { VEHICLE_LIST } from '../../data/vehicles';
import {
  VehicleModelId,
  CameraMode,
  DayNightMode,
  GraphicsQuality,
  HeadlightMode,
} from '../../types/game';
import { audioManager } from '../../game/AudioManager';
import {
  SlidersHorizontal,
  ChevronDown,
  Car,
  Video,
  Sun,
  Sunset,
  Moon,
  Cpu,
  Volume2,
  VolumeX,
  RotateCcw,
  Wrench,
  ShieldCheck,
  Rocket,
  ClipboardList,
  Check,
  Sparkles,
  Flashlight,
  Users,
  Globe,
  Wifi,
  WifiOff,
  RefreshCw,
  Compass,
  Wind,
} from 'lucide-react';

interface OptionsDropdownProps {
  onSelectVehicle: (vehicleId: VehicleModelId) => void;
  onApplyLighting: () => void;
  onApplyGraphics: () => void;
  onResetCar: () => void;
  onRepairVehicle?: () => void;
  onClearWanted?: () => void;
  onToggleJetpack?: () => void;
  onToggleParachute?: () => void;
  onToggleCabJob?: () => void;
  onToggleMissions?: () => void;
  onToggleCustoms?: () => void;
  onApplyHeadlights?: () => void;
  onTeleportToCarMeet?: () => void;
  onlineCount?: number;
  playerName?: string;
  onChangePlayerName?: (name: string) => void;
  isMultiplayerConnected?: boolean;
  serverUrl?: string;
  onChangeServerUrl?: (url: string) => void;
}

export const OptionsDropdown: React.FC<OptionsDropdownProps> = ({
  onSelectVehicle,
  onApplyLighting,
  onApplyGraphics,
  onResetCar,
  onRepairVehicle,
  onClearWanted,
  onToggleJetpack,
  onToggleParachute,
  onToggleCabJob,
  onToggleMissions,
  onToggleCustoms,
  onApplyHeadlights,
  onTeleportToCarMeet,
  onlineCount = 1,
  playerName = 'Driver',
  onChangePlayerName,
  isMultiplayerConnected = false,
  serverUrl = '',
  onChangeServerUrl,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<
    'all' | 'multiplayer' | 'vehicles' | 'camera' | 'environment' | 'graphics' | 'cheats'
  >('all');
  const [editingName, setEditingName] = useState(playerName);
  const [editingServer, setEditingServer] = useState(serverUrl);

  useEffect(() => {
    if (serverUrl) setEditingServer(serverUrl);
  }, [serverUrl]);

  useEffect(() => {
    if (playerName) setEditingName(playerName);
  }, [playerName]);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const selectedVehicleId = useGameStore((state) => state.selectedVehicleId);
  const cameraMode = useGameStore((state) => state.cameraMode);
  const setCameraMode = useGameStore((state) => state.setCameraMode);
  const dayNightMode = useGameStore((state) => state.dayNightMode);
  const setDayNightMode = useGameStore((state) => state.setDayNightMode);
  const isAutoTimeCycle = useGameStore((state) => state.isAutoTimeCycle);
  const toggleAutoTimeCycle = useGameStore((state) => state.toggleAutoTimeCycle);
  const graphicsQuality = useGameStore((state) => state.graphicsQuality);
  const setGraphicsQuality = useGameStore((state) => state.setGraphicsQuality);
  const isMuted = useGameStore((state) => state.isMuted);
  const toggleMute = useGameStore((state) => state.toggleMute);
  const wantedLevel = useGameStore((state) => state.wantedLevel);
  const vehicleHealth = useGameStore((state) => state.vehicleHealth);
  const jetpackActive = useGameStore((state) => state.telemetry.jetpackActive);
  const parachuteActive = useGameStore((state) => state.telemetry.parachuteActive);
  const cabMission = useGameStore((state) => state.cabMission);
  const headlightMode = useGameStore((state) => state.headlightMode);
  const setHeadlightMode = useGameStore((state) => state.setHeadlightMode);

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

  const handleCameraChange = (mode: CameraMode) => {
    setCameraMode(mode);
  };

  const handleDayNightChange = (mode: DayNightMode) => {
    setDayNightMode(mode);
    onApplyLighting();
  };

  const handleHeadlightChange = (mode: HeadlightMode) => {
    setHeadlightMode(mode);
    onApplyHeadlights?.();
  };

  const handleGraphicsChange = (quality: GraphicsQuality) => {
    setGraphicsQuality(quality);
    onApplyGraphics();
  };

  const handleMuteToggle = () => {
    toggleMute();
    audioManager.setMuted(!isMuted);
  };

  return (
    <div className="relative pointer-events-auto" ref={dropdownRef}>
      {/* Options Dropdown Button Trigger */}
      <button
        type="button"
        tabIndex={-1}
        onClick={handleToggle}
        title="Game Options & Cheats (Click for full menu)"
        className={`glass-panel p-1.5 lg:px-2.5 lg:py-1.5 rounded-lg flex items-center gap-1 lg:gap-1.5 border transition-all duration-200 text-[11px] font-bold uppercase tracking-wider shadow-md hover:scale-105 active:scale-95 ${
          isOpen
            ? 'border-cyan-400 bg-cyan-950/60 text-cyan-300 ring-2 ring-cyan-500/30'
            : 'border-white/10 hover:border-cyan-400/50 text-gray-200 hover:text-white'
        }`}
      >
        <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
        <span className="hidden lg:inline">Options</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-cyan-300 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Options Dropdown Panel */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1.5 w-80 sm:w-96 glass-panel-glow bg-slate-900/95 backdrop-blur-xl border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 text-white max-h-[calc(100vh-65px)] sm:max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 py-2.5 bg-slate-950/70 border-b border-white/10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
              <span className="font-black text-xs uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400">
                Game Options & Controls
              </span>
            </div>
            <span className="text-[10px] text-gray-400 font-mono">v1.2</span>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-white/10 overflow-x-auto bg-slate-950/30 shrink-0 touch-pan-x">
            {[
              { id: 'all', label: 'All' },
              { id: 'multiplayer', label: 'Multiplayer 👥' },
              { id: 'vehicles', label: 'Rides' },
              { id: 'camera', label: 'Camera' },
              { id: 'environment', label: 'Time' },
              { id: 'graphics', label: 'Quality' },
              { id: 'cheats', label: 'Assists' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                tabIndex={-1}
                onClick={() => setActiveCategory(cat.id as any)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all shrink-0 ${
                  activeCategory === cat.id
                    ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/50'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Dropdown Options Body (Scrollable with touch-pan-y & overscroll-contain) */}
          <div
            className="p-3 flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y touch-scrollable custom-scrollbar space-y-3 divide-y divide-white/5"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {/* MULTIPLAYER & CAR MEETS SECTION */}
            {(activeCategory === 'all' || activeCategory === 'multiplayer') && (
              <div className="space-y-2 pt-1.5 first:pt-0">
                <div className="flex items-center justify-between text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Deep Rush Multiplayer Lobby</span>
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400 font-mono text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    {onlineCount || 1} Online
                  </span>
                </div>

                {/* Nickname Editor */}
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/10 space-y-1.5">
                  <label className="text-[10px] text-gray-300 font-semibold flex items-center justify-between">
                    <span>Gamer Tag / Nickname:</span>
                    <span className="text-[9px] text-gray-500 font-mono">Max 16 chars</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      maxLength={16}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          onChangePlayerName?.(editingName);
                          (e.currentTarget as HTMLElement).blur();
                        }
                      }}
                      onBlur={() => onChangePlayerName?.(editingName)}
                      placeholder="Enter nickname..."
                      className="flex-1 px-2.5 py-1 text-xs bg-slate-900 border border-white/15 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-mono"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => onChangePlayerName?.(editingName)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all shrink-0"
                    >
                      Save
                    </button>
                  </div>
                  <p className="text-[9px] text-gray-400">
                    Displays on 3D overhead nametags and chat messages to all players in the city.
                  </p>
                </div>

                {/* Cloud Multiplayer Server (Render / Web) */}
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-gray-300 font-semibold flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Multiplayer Server:</span>
                    </label>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono flex items-center gap-1 border ${
                        isMultiplayerConnected
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {isMultiplayerConnected ? (
                        <>
                          <Wifi className="w-2.5 h-2.5" />
                          <span>Connected</span>
                        </>
                      ) : (
                        <>
                          <WifiOff className="w-2.5 h-2.5" />
                          <span>Offline / Reconnecting</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={editingServer}
                      onChange={(e) => setEditingServer(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          onChangeServerUrl?.(editingServer);
                          (e.currentTarget as HTMLElement).blur();
                        }
                      }}
                      placeholder="https://your-service.onrender.com"
                      className="flex-1 px-2 py-1 text-[11px] bg-slate-900 border border-white/15 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 font-mono"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => onChangeServerUrl?.(editingServer)}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shrink-0 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Connect</span>
                    </button>
                    {editingServer && (
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => {
                          setEditingServer('');
                          onChangeServerUrl?.('');
                        }}
                        title="Reset to default local/auto server"
                        className="px-2 py-1 text-[10px] font-medium rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all shrink-0"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  <p className="text-[9px] text-gray-400 leading-normal">
                    Enter your Render backend URL (e.g. <span className="text-cyan-300 font-mono">https://deep-rush-city.onrender.com</span>) to play together across devices.
                  </p>
                </div>

                {/* Car Meet Quick Teleport & Info */}
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-950/50 to-purple-950/40 border border-cyan-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-black text-cyan-300 uppercase tracking-wide">
                      <span>📍 Central Plaza Car Meet</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-400/30">
                      Safe Zone
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-300 leading-relaxed">
                    Vehicles take 0 damage in the plaza. Walk up to any remote player's vehicle and press <span className="font-mono text-cyan-300 font-bold bg-white/10 px-1 rounded">[E]</span> to inspect their tuning specs, turbo stage, and underglow!
                  </p>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => {
                      onTeleportToCarMeet?.();
                      setIsOpen(false);
                    }}
                    className="w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5"
                  >
                    <span>🚗 Teleport to Plaza Car Meet</span>
                  </button>
                </div>
              </div>
            )}

            {/* 1. VEHICLES SECTION */}
            {(activeCategory === 'all' || activeCategory === 'vehicles') && (
              <div className="space-y-1.5 pt-1.5 first:pt-0">
                <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5 text-cyan-300">
                    <Car className="w-3 h-3 text-cyan-400" />
                    <span>Vehicle Hot-Swap</span>
                  </span>
                  <span>{VEHICLE_LIST.length} Cars</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {VEHICLE_LIST.map((v) => {
                    const isSelected = selectedVehicleId === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        tabIndex={-1}
                        onClick={() => {
                          onSelectVehicle(v.id);
                        }}
                        className={`p-2 rounded-xl text-left border transition-all flex items-center justify-between text-xs ${
                          isSelected
                            ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-sm'
                            : 'bg-white/5 border-white/5 hover:border-white/20 text-gray-300 hover:text-white'
                        }`}
                      >
                        <div className="truncate min-w-0 pr-1">
                          <div className="font-bold text-[11px] truncate flex items-center gap-1">
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: v.colorHex }}
                            />
                            <span className="truncate">{v.name}</span>
                          </div>
                          <span className="text-[9px] text-gray-400 font-mono">
                            {v.topSpeedKmh} km/h
                          </span>
                        </div>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. CAMERA ANGLE SECTION */}
            {(activeCategory === 'all' || activeCategory === 'camera') && (
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-300 uppercase tracking-wider">
                  <Video className="w-3 h-3 text-cyan-400" />
                  <span>Camera Perspective</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'chase', label: 'Chase Cam', desc: 'Dynamic Follow' },
                    { id: 'cockpit', label: 'Cockpit / Hood', desc: 'First-Person' },
                    { id: 'orbit', label: 'Free Orbit', desc: '360° Drag' },
                    { id: 'topdown', label: 'Top-Down', desc: 'Retro Aerial' },
                  ].map((cam) => {
                    const isSelected = cameraMode === cam.id;
                    return (
                      <button
                        key={cam.id}
                        type="button"
                        tabIndex={-1}
                        onClick={() => handleCameraChange(cam.id as CameraMode)}
                        className={`p-2 rounded-xl text-left border transition-all flex items-center justify-between text-xs ${
                          isSelected
                            ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-sm'
                            : 'bg-white/5 border-white/5 hover:border-white/20 text-gray-300 hover:text-white'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-[11px]">{cam.label}</div>
                          <div className="text-[9px] text-gray-400">{cam.desc}</div>
                        </div>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. TIME OF DAY & LIGHTING */}
            {(activeCategory === 'all' || activeCategory === 'environment') && (
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-1.5 text-amber-300">
                    <Sun className="w-3 h-3 text-amber-400" />
                    <span>Time of Day & Dynamic Sky</span>
                  </div>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => toggleAutoTimeCycle()}
                    className={`px-2 py-0.5 rounded-md text-[9px] font-semibold border transition-all flex items-center gap-1 ${
                      isAutoTimeCycle
                        ? 'bg-amber-500/30 border-amber-400 text-amber-200 shadow-sm'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isAutoTimeCycle ? 'bg-amber-400 animate-pulse' : 'bg-gray-500'}`} />
                    <span>{isAutoTimeCycle ? '24h Cycle: ON' : '24h Cycle: OFF'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'day', label: 'Day', icon: Sun, color: 'text-amber-400' },
                    { id: 'sunset', label: 'Sunset', icon: Sunset, color: 'text-orange-400' },
                    { id: 'night', label: 'Night', icon: Moon, color: 'text-cyan-300' },
                  ].map((t) => {
                    const Icon = t.icon;
                    const isSelected = dayNightMode === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        tabIndex={-1}
                        onClick={() => {
                          if (isAutoTimeCycle) toggleAutoTimeCycle();
                          handleDayNightChange(t.id as DayNightMode);
                        }}
                        className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-400 text-white shadow-sm'
                            : 'bg-white/5 border-white/5 hover:border-white/20 text-gray-400 hover:text-white'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${t.color}`} />
                        <span className="text-[10px] font-bold capitalize">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* HERO CAR HEADLIGHTS (LOW / HIGH BEAM) */}
            {(activeCategory === 'all' || activeCategory === 'environment') && (
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-300 uppercase tracking-wider">
                  <Flashlight className="w-3 h-3 text-cyan-400" />
                  <span>Hero Car Headlights</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'off', label: 'Off', desc: 'No Beams' },
                    { id: 'low', label: 'Low Beam', desc: 'Halogen Angle' },
                    { id: 'high', label: 'High Beam', desc: 'Piercing Xenon' },
                  ].map((b) => {
                    const isSelected = headlightMode === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        tabIndex={-1}
                        onClick={() => handleHeadlightChange(b.id as HeadlightMode)}
                        className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all ${
                          isSelected
                            ? 'bg-cyan-500/25 border-cyan-400 text-white shadow-sm ring-1 ring-cyan-400/40'
                            : 'bg-white/5 border-white/5 hover:border-white/20 text-gray-400 hover:text-white'
                        }`}
                      >
                        <span className="text-[11px] font-bold">{b.label}</span>
                        <span className="text-[8px] text-gray-400">{b.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. GRAPHICS PRESET */}
            {(activeCategory === 'all' || activeCategory === 'graphics') && (
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                  <Cpu className="w-3 h-3 text-emerald-400" />
                  <span>Graphics Quality</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'low', label: 'Low', desc: '60+ FPS' },
                    { id: 'medium', label: 'Medium', desc: 'Balanced' },
                    { id: 'high', label: 'High', desc: 'Ultra Shadows' },
                  ].map((g) => {
                    const isSelected = graphicsQuality === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        tabIndex={-1}
                        onClick={() => handleGraphicsChange(g.id as GraphicsQuality)}
                        className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all ${
                          isSelected
                            ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-sm'
                            : 'bg-white/5 border-white/5 hover:border-white/20 text-gray-400 hover:text-white'
                        }`}
                      >
                        <span className="text-[11px] font-bold">{g.label}</span>
                        <span className="text-[8px] text-gray-400">{g.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. QUICK CHEATS & GAME ASSISTS */}
            {(activeCategory === 'all' || activeCategory === 'cheats') && (
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-purple-300 uppercase tracking-wider">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  <span>Quick Cheats & Gameplay Assists</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {/* Instant Vehicle Repair */}
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => onRepairVehicle?.()}
                    className="p-2 rounded-xl bg-white/5 hover:bg-emerald-500/20 border border-white/5 hover:border-emerald-400/40 text-left transition-all flex items-center gap-2 group"
                  >
                    <Wrench className="w-4 h-4 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-white truncate">
                        Repair Car
                      </div>
                      <div className="text-[9px] text-emerald-300 font-mono">
                        HP: {Math.round(vehicleHealth)}%
                      </div>
                    </div>
                  </button>

                  {/* Clear Wanted Heat */}
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => onClearWanted?.()}
                    className="p-2 rounded-xl bg-white/5 hover:bg-cyan-500/20 border border-white/5 hover:border-cyan-400/40 text-left transition-all flex items-center gap-2 group"
                  >
                    <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 group-hover:scale-110 transition-transform" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-white truncate">
                        Lose Cops
                      </div>
                      <div className="text-[9px] text-cyan-300 font-mono">
                        {wantedLevel > 0 ? `${'★'.repeat(wantedLevel)} Clear` : 'No Heat'}
                      </div>
                    </div>
                  </button>

                  {/* Toggle Jetpack */}
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => onToggleJetpack?.()}
                    className={`p-2 rounded-xl border text-left transition-all flex items-center gap-2 group ${
                      jetpackActive
                        ? 'bg-orange-500/20 border-orange-400 text-orange-200'
                        : 'bg-white/5 hover:bg-orange-500/20 border-white/5 hover:border-orange-400/40 text-white'
                    }`}
                  >
                    <Rocket className="w-4 h-4 text-orange-400 shrink-0 group-hover:scale-110 transition-transform" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold truncate">Jetpack Flight</div>
                      <div className="text-[9px] text-gray-400">
                        {jetpackActive ? 'Equipped' : 'Stowed'}
                      </div>
                    </div>
                  </button>

                  {/* Toggle Parachute */}
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => onToggleParachute?.()}
                    className={`p-2 rounded-xl border text-left transition-all flex items-center gap-2 group ${
                      parachuteActive
                        ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                        : 'bg-white/5 hover:bg-emerald-500/20 border-white/5 hover:border-emerald-400/40 text-white'
                    }`}
                  >
                    <Wind className="w-4 h-4 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold truncate">Parachute Canopy</div>
                      <div className="text-[9px] text-gray-400">
                        {parachuteActive ? 'Gliding (P)' : 'Airborne Deploy (P)'}
                      </div>
                    </div>
                  </button>

                  {/* Toggle Taxi Shift */}
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => onToggleCabJob?.()}
                    className={`p-2 rounded-xl border text-left transition-all flex items-center gap-2 group ${
                      cabMission.status !== 'idle'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-white/5 hover:bg-amber-500/20 border-white/5 hover:border-amber-400/40 text-white'
                    }`}
                  >
                    <span className="text-base leading-none">🚖</span>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold truncate">Taxi Shift</div>
                      <div className="text-[9px] text-gray-400">
                        {cabMission.status !== 'idle' ? 'In Progress' : 'Start Fare'}
                      </div>
                    </div>
                  </button>

                  {/* Open Customs Shop */}
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => onToggleCustoms?.()}
                    className="p-2 rounded-xl bg-white/5 hover:bg-cyan-500/20 border border-white/5 hover:border-cyan-400/40 text-left transition-all flex items-center gap-2 group"
                  >
                    <Wrench className="w-4 h-4 text-cyan-400 shrink-0 group-hover:scale-110 transition-transform" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-white truncate">
                        Customs Shop
                      </div>
                      <div className="text-[9px] text-gray-400">Tuning & Neon</div>
                    </div>
                  </button>

                  {/* Open Mission Board */}
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => onToggleMissions?.()}
                    className="p-2 rounded-xl bg-white/5 hover:bg-cyan-500/20 border border-white/5 hover:border-cyan-400/40 text-left transition-all flex items-center gap-2 group"
                  >
                    <ClipboardList className="w-4 h-4 text-cyan-400 shrink-0 group-hover:scale-110 transition-transform" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-white truncate">
                        Mission Board
                      </div>
                      <div className="text-[9px] text-gray-400">Deep Rush Contracts</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer with Audio Toggle and Reset Car */}
          <div className="px-3 py-2 bg-slate-950/70 border-t border-white/10 flex items-center justify-between text-xs">
            <button
              type="button"
              tabIndex={-1}
              onClick={handleMuteToggle}
              className="flex items-center gap-1.5 text-gray-300 hover:text-white transition-colors"
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-[10px]">Unmute Sound</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[10px]">Audio: Active</span>
                </>
              )}
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                onResetCar();
                setIsOpen(false);
              }}
              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white text-[10px] font-bold flex items-center gap-1 transition-all"
            >
              <RotateCcw className="w-3 h-3 text-cyan-300" />
              <span>Reset Position (R)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
