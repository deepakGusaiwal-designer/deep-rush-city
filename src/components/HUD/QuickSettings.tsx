import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { Sun, Sunset, Moon, Video, Volume2, VolumeX, RotateCcw, Cpu, Flashlight } from 'lucide-react';
import { audioManager } from '../../game/AudioManager';
import { OptionsDropdown } from './OptionsDropdown';
import { VehicleModelId } from '../../types/game';

interface QuickSettingsProps {
  onResetCar: () => void;
  onApplyLighting: () => void;
  onApplyGraphics: () => void;
  onApplyHeadlights?: () => void;
  onSelectVehicle?: (vehicleId: VehicleModelId) => void;
  onRepairVehicle?: () => void;
  onClearWanted?: () => void;
  onToggleJetpack?: () => void;
  onToggleCabJob?: () => void;
  onToggleMissions?: () => void;
  onToggleCustoms?: () => void;
  onTeleportToCarMeet?: () => void;
  onlineCount?: number;
  playerName?: string;
  onChangePlayerName?: (name: string) => void;
  isMultiplayerConnected?: boolean;
  serverUrl?: string;
  onChangeServerUrl?: (url: string) => void;
}

export const QuickSettings: React.FC<QuickSettingsProps> = ({
  onResetCar,
  onApplyLighting,
  onApplyGraphics,
  onApplyHeadlights,
  onSelectVehicle,
  onRepairVehicle,
  onClearWanted,
  onToggleJetpack,
  onToggleCabJob,
  onToggleMissions,
  onToggleCustoms,
  onTeleportToCarMeet,
  onlineCount = 1,
  playerName = 'Driver',
  onChangePlayerName,
  isMultiplayerConnected,
  serverUrl,
  onChangeServerUrl,
}) => {
  const dayNightMode = useGameStore((state) => state.dayNightMode);
  const toggleDayNight = useGameStore((state) => state.toggleDayNight);
  const isAutoTimeCycle = useGameStore((state) => state.isAutoTimeCycle);
  const toggleAutoTimeCycle = useGameStore((state) => state.toggleAutoTimeCycle);
  const cameraMode = useGameStore((state) => state.cameraMode);
  const cycleCameraMode = useGameStore((state) => state.cycleCameraMode);
  const graphicsQuality = useGameStore((state) => state.graphicsQuality);
  const cycleGraphicsQuality = useGameStore((state) => state.cycleGraphicsQuality);
  const isMuted = useGameStore((state) => state.isMuted);
  const toggleMute = useGameStore((state) => state.toggleMute);
  const headlightMode = useGameStore((state) => state.headlightMode);
  const cycleHeadlightMode = useGameStore((state) => state.cycleHeadlightMode);

  const handlePreventSpace = (e: React.KeyboardEvent) => {
    if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      (e.currentTarget as HTMLElement)?.blur();
    }
  };

  const handleHeadlightClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    (e.currentTarget as HTMLElement)?.blur();
    cycleHeadlightMode();
    onApplyHeadlights?.();
  };

  const handleDayNightClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    (e.currentTarget as HTMLElement)?.blur();
    audioManager.playUiClick();
    if (isAutoTimeCycle) toggleAutoTimeCycle();
    toggleDayNight();
    onApplyLighting();
  };

  const handleGraphicsClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    (e.currentTarget as HTMLElement)?.blur();
    audioManager.playUiClick();
    cycleGraphicsQuality();
    onApplyGraphics();
  };

  const handleMuteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    (e.currentTarget as HTMLElement)?.blur();
    toggleMute();
    audioManager.setMuted(!isMuted);
  };

  const handleCameraClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    (e.currentTarget as HTMLElement)?.blur();
    audioManager.playUiClick();
    cycleCameraMode();
  };

  const handleResetClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    (e.currentTarget as HTMLElement)?.blur();
    audioManager.playUiClick();
    onResetCar();
  };

  return (
    <div className="flex items-center gap-1 sm:gap-1.5 pointer-events-auto">
      {/* Master Options Dropdown Menu */}
      <OptionsDropdown
        onSelectVehicle={(id) => onSelectVehicle?.(id)}
        onApplyLighting={onApplyLighting}
        onApplyGraphics={onApplyGraphics}
        onApplyHeadlights={onApplyHeadlights}
        onResetCar={onResetCar}
        onRepairVehicle={onRepairVehicle}
        onClearWanted={onClearWanted}
        onToggleJetpack={onToggleJetpack}
        onToggleCabJob={onToggleCabJob}
        onToggleMissions={onToggleMissions}
        onToggleCustoms={onToggleCustoms}
        onTeleportToCarMeet={onTeleportToCarMeet}
        onlineCount={onlineCount}
        playerName={playerName}
        onChangePlayerName={onChangePlayerName}
        isMultiplayerConnected={isMultiplayerConnected}
        serverUrl={serverUrl}
        onChangeServerUrl={onChangeServerUrl}
      />

      {/* Live Multiplayer Lobby Pill */}
      <button
        type="button"
        tabIndex={-1}
        onClick={() => onTeleportToCarMeet?.()}
        title={`${onlineCount} player${onlineCount === 1 ? '' : 's'} in Downtown Plaza. Click to teleport to Plaza Car Meet!`}
        className="glass-panel px-2 py-1 lg:px-2.5 lg:py-1.5 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 border border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
        <span className="font-mono">{onlineCount}</span>
        <span className="hidden lg:inline">Online</span>
      </button>

      {/* Graphics Quality Preset (Low / Medium / High) */}
      <button
        tabIndex={-1}
        onKeyDown={handlePreventSpace}
        onClick={handleGraphicsClick}
        title={`Graphics Quality: ${graphicsQuality.toUpperCase()} (Click to reduce if heavy)`}
        className={`glass-panel p-1.5 lg:px-2.5 lg:py-1.5 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 border flex items-center gap-1 lg:gap-1.5 text-[11px] font-bold uppercase tracking-wider ${
          graphicsQuality === 'low'
            ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300'
            : graphicsQuality === 'medium'
            ? 'border-cyan-500/40 bg-cyan-950/30 text-cyan-300'
            : 'border-amber-500/40 bg-amber-950/30 text-amber-300'
        }`}
      >
        <Cpu className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">
          {graphicsQuality === 'low' ? '⚡ Low' : graphicsQuality === 'medium' ? '⚖️ Med' : '✨ High'}
        </span>
      </button>

      {/* Day / Sunset / Night Toggle */}
      <button
        tabIndex={-1}
        onKeyDown={handlePreventSpace}
        onClick={handleDayNightClick}
        title={`Time of Day: ${dayNightMode.toUpperCase()}${isAutoTimeCycle ? ' (24h Auto-Cycle ON)' : ''}`}
        className="relative glass-panel p-1.5 sm:p-2 rounded-lg hover:bg-white/15 text-white transition-all duration-200 hover:scale-105 active:scale-95 border border-white/10"
      >
        {dayNightMode === 'day' ? (
          <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 fill-amber-400/20" />
        ) : dayNightMode === 'sunset' ? (
          <Sunset className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-400" />
        ) : (
          <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-300 fill-cyan-300/20" />
        )}
        {isAutoTimeCycle && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 border border-slate-900 animate-pulse" />
        )}
      </button>

      {/* Car Headlights (Low Beam / High Beam / Off) */}
      <button
        tabIndex={-1}
        onKeyDown={handlePreventSpace}
        onClick={handleHeadlightClick}
        title={`Car Headlights: ${headlightMode.toUpperCase()} (Click or press L to toggle)`}
        className={`glass-panel p-1.5 lg:px-2 lg:py-1.5 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 border flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider ${
          headlightMode === 'high'
            ? 'border-cyan-400 bg-cyan-950/40 text-cyan-300 shadow-sm shadow-cyan-500/20'
            : headlightMode === 'low'
            ? 'border-amber-400/50 bg-amber-950/30 text-amber-300'
            : 'border-white/10 text-gray-500 hover:text-gray-300'
        }`}
      >
        <Flashlight className={`w-3.5 h-3.5 ${headlightMode === 'high' ? 'text-cyan-300 fill-cyan-300/30' : headlightMode === 'low' ? 'text-amber-300 fill-amber-300/20' : 'text-gray-500'}`} />
        <span className="hidden lg:inline">
          {headlightMode === 'high' ? 'High' : headlightMode === 'low' ? 'Low' : 'Off'}
        </span>
      </button>

      {/* Camera Mode Toggle */}
      <button
        tabIndex={-1}
        onKeyDown={handlePreventSpace}
        onClick={handleCameraClick}
        title={`Camera View: ${cameraMode.toUpperCase()} (Or Drag with Mouse / Touch)`}
        className="glass-panel p-1.5 lg:px-2.5 lg:py-1.5 rounded-lg hover:bg-white/15 text-white transition-all duration-200 hover:scale-105 active:scale-95 border border-white/10 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider"
      >
        <Video className="w-3.5 h-3.5 text-cyan-400" />
        <span className="hidden lg:inline">{cameraMode}</span>
      </button>

      {/* Audio Mute Toggle */}
      <button
        tabIndex={-1}
        onKeyDown={handlePreventSpace}
        onClick={handleMuteClick}
        title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        className="glass-panel p-1.5 sm:p-2 rounded-lg hover:bg-white/15 text-white transition-all duration-200 hover:scale-105 active:scale-95 border border-white/10"
      >
        {isMuted ? (
          <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
        ) : (
          <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
        )}
      </button>

      {/* Reset Car Position Button */}
      <button
        tabIndex={-1}
        onKeyDown={handlePreventSpace}
        onClick={handleResetClick}
        title="Reset Car Position (Press R)"
        className="glass-panel p-1.5 sm:p-2 rounded-lg hover:bg-white/15 text-gray-300 hover:text-white transition-all duration-200 hover:scale-105 active:scale-95 border border-white/10"
      >
        <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-300" />
      </button>
    </div>
  );
};
