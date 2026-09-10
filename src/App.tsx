import React, { useEffect, useRef, useState } from 'react';
import { CityGameEngine, WebGLUnavailableError } from './game/CityGameEngine';
import { WebGLErrorScreen } from './components/WebGLErrorScreen';
import { useGameStore } from './store/useGameStore';
import { VEHICLE_LIST } from './data/vehicles';
import { LoadingScreen } from './components/LoadingScreen';
import { Speedometer } from './components/HUD/Speedometer';
import { MiniMap } from './components/HUD/MiniMap';
import { QuickSettings } from './components/HUD/QuickSettings';
import { ControlsOverlay } from './components/HUD/ControlsOverlay';
import { POIPopup } from './components/POIPopup';
import { GTAHealthBar } from './components/HUD/GTAHealthBar';
import { CashDisplay } from './components/HUD/CashDisplay';
import { CabMissionHUD } from './components/HUD/CabMissionHUD';
import { VehicleCustomsModal } from './components/HUD/VehicleCustomsModal';
import { WantedStars } from './components/HUD/WantedStars';
import { MissionHUD } from './components/HUD/MissionHUD';
import { SplashOverlay } from './components/HUD/SplashOverlay';
import { NotificationFeed } from './components/HUD/NotificationFeed';
import { MissionMenu } from './components/HUD/MissionMenu';
import { JetpackHUD } from './components/HUD/JetpackHUD';
import { VehicleDropdown } from './components/HUD/VehicleDropdown';
import { CarSelectorModal } from './components/HUD/CarSelectorModal';
import { OrientationLock } from './components/HUD/OrientationLock';
import { ActivitiesDropdown } from './components/HUD/ActivitiesDropdown';
import { MultiplayerChat } from './components/HUD/MultiplayerChat';
import { CarMeetInspectModal } from './components/HUD/CarMeetInspectModal';
import { ChatMessage, CarMeetInspectData } from './game/multiplayer/MultiplayerTypes';
import { VehicleModelId } from './types/game';

export const App: React.FC = () => {
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CityGameEngine | null>(null);

  const selectedVehicleId = useGameStore((state) => state.selectedVehicleId);
  const isLoading = useGameStore((state) => state.isLoading);
  const isCustomsOpen = useGameStore((state) => state.isCustomsOpen);
  const setCustomsOpen = useGameStore((state) => state.setCustomsOpen);
  const isMissionMenuOpen = useGameStore((state) => state.isMissionMenuOpen);
  const setMissionMenuOpen = useGameStore((state) => state.setMissionMenuOpen);
  const cabMission = useGameStore((state) => state.cabMission);
  const activeMission = useGameStore((state) => state.activeMission);
  const jetpackActive = useGameStore((state) => state.telemetry.jetpackActive);
  const playerMode = useGameStore((state) => state.telemetry.playerMode);

  const currentVehicleStats = VEHICLE_LIST.find((v) => v.id === selectedVehicleId) || VEHICLE_LIST[0];

  // WebGL availability: null = fine, string = reason the renderer could not be created
  const [webglError, setWebglError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  // Multiplayer Social & Car Meet State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [inspectedCar, setInspectedCar] = useState<CarMeetInspectData | null>(null);
  const [playerName, setPlayerName] = useState<string>('Driver');
  const [isMultiplayerConnected, setIsMultiplayerConnected] = useState<boolean>(false);
  const [serverUrl, setServerUrl] = useState<string>('');

  useEffect(() => {
    if (!canvasContainerRef.current) return;

    // Create Game Engine — the renderer can legitimately fail on machines with GPU access disabled
    let engine: CityGameEngine;
    try {
      engine = new CityGameEngine(canvasContainerRef.current);
    } catch (err) {
      const detail = err instanceof WebGLUnavailableError
        ? err.detail
        : err instanceof Error ? err.message : String(err);
      console.error('Deep Rush City could not start the 3D renderer:', err);
      setWebglError(detail);
      useGameStore.getState().setLoading(false, 0, 'WebGL unavailable');
      return;
    }
    setWebglError(null);
    engineRef.current = engine;
    setPlayerName(engine.multiplayerClient.playerName);
    setServerUrl(engine.multiplayerClient.activeServerUrl);
    setIsMultiplayerConnected(engine.multiplayerClient.isConnected);

    // Wire multiplayer callbacks to React HUD
    engine.onChatMessagesChanged = (msgs) => setChatMessages([...msgs]);
    engine.onMultiplayerConnectionChanged = (connected, count) => {
      setIsMultiplayerConnected(connected);
      setOnlineCount(count);
      setServerUrl(engine.multiplayerClient.activeServerUrl);
    };
    engine.onInspectedCarChanged = (data) => setInspectedCar(data);

    if (import.meta.env.DEV) {
      // Debug handle for the dev console / automated smoke tests
      (window as unknown as { __engine?: CityGameEngine }).__engine = engine;
    }

    // Initialize (loads city GLB and vehicle)
    engine.init().then(() => {
      engine.syncVehicleUpgrades();
    }).catch((err) => {
      console.error('Failed to initialize CityGameEngine:', err);
    });

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [retryToken]);

  // Global window listener: Prevent spacebar from activating any focused buttons or scrolling
  useEffect(() => {
    const handleGlobalSpacePrevention = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        target?.blur();
      }
    };

    window.addEventListener('keydown', handleGlobalSpacePrevention, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleGlobalSpacePrevention);
    };
  }, []);

  // Disable right-click / context menu on mobile devices (long-press, tap-and-hold, mobile right-click)
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const isTouch =
        'ontouchstart' in window ||
        (typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 0);
      const isMobileScreen = window.innerWidth < 1024 || window.innerHeight < 1024;

      if (isTouch || isMobileScreen) {
        e.preventDefault();
        return false;
      }
    };

    window.addEventListener('contextmenu', handleContextMenu, { capture: true, passive: false });
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
    };
  }, []);

  // Mobile touch optimization: Prevent accidental double-tap-to-zoom and browser pinch-zoom
  useEffect(() => {
    let lastTouchEnd = 0;
    const handleTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        // Double-tap detected - prevent native browser page zoom
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    // Safari iOS gesture events for pinch-to-zoom
    const handleGesture = (e: Event) => {
      e.preventDefault();
    };

    // Prevent multi-touch gesture from scaling HTML document viewport (in-game camera handles 3D zoom)
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        const target = e.target as HTMLElement | null;
        if (!target?.closest('.touch-scrollable')) {
          e.preventDefault();
        }
      }
    };

    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('gesturestart', handleGesture, { passive: false });
    document.addEventListener('gesturechange', handleGesture, { passive: false });
    document.addEventListener('gestureend', handleGesture, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('gesturestart', handleGesture);
      document.removeEventListener('gesturechange', handleGesture);
      document.removeEventListener('gestureend', handleGesture);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  // Handle reset car position
  const handleResetCar = () => {
    if (engineRef.current) {
      engineRef.current.resetCar();
    }
  };

  // Handle day/night lighting change
  const handleApplyLighting = () => {
    if (engineRef.current) {
      setTimeout(() => {
        const mode = useGameStore.getState().dayNightMode;
        engineRef.current?.setDayNightMode(mode);
      }, 50);
    }
  };

  // Handle headlight beam change (off / low beam / high beam)
  const handleApplyHeadlights = () => {
    if (engineRef.current) {
      setTimeout(() => {
        const mode = useGameStore.getState().headlightMode;
        engineRef.current?.setHeadlightMode(mode);
      }, 50);
    }
  };

  // Handle graphics quality preset change
  const handleApplyGraphics = () => {
    if (engineRef.current) {
      setTimeout(() => {
        const quality = useGameStore.getState().graphicsQuality;
        engineRef.current?.applyGraphicsQuality(quality);
      }, 50);
    }
  };

  const handleToggleCabJob = () => {
    engineRef.current?.toggleCabJob();
  };

  const handleToggleCustoms = () => {
    setCustomsOpen(!isCustomsOpen);
  };

  const handleToggleMissions = () => {
    setMissionMenuOpen(!useGameStore.getState().isMissionMenuOpen);
  };

  const handleCancelCabJob = () => {
    if (engineRef.current) {
      engineRef.current.missionManager.cancelCabJob();
    }
  };

  const handleStartMission = (id: string) => {
    engineRef.current?.startMission(id);
  };

  const handleAbandonMission = () => {
    engineRef.current?.abandonMission();
  };

  const handleRepairVehicle = () => {
    engineRef.current?.repairVehicle(150);
  };

  const handleToggleJetpack = () => {
    engineRef.current?.toggleJetpack();
  };

  const handleToggleParachute = () => {
    engineRef.current?.toggleParachute();
  };

  const handleSelectVehicle = (vehicleId: VehicleModelId) => {
    engineRef.current?.switchVehicle(vehicleId);
  };

  const handleClearWanted = () => {
    if (engineRef.current) {
      engineRef.current.wanted.clear();
      engineRef.current.police.standDown();
      useGameStore.getState().setWanted(0, 0);
      useGameStore.getState().pushNotification('Police heat cleared!', 'success');
    }
  };

  const handleChangePlayerName = (name: string) => {
    if (engineRef.current) {
      engineRef.current.multiplayerClient.setPlayerName(name);
      setPlayerName(engineRef.current.multiplayerClient.playerName);
    }
  };

  const handleChangeServerUrl = (newUrl: string) => {
    if (engineRef.current) {
      engineRef.current.multiplayerClient.setServerUrl(newUrl);
      setServerUrl(engineRef.current.multiplayerClient.activeServerUrl);
      useGameStore.getState().pushNotification(
        newUrl ? `Connecting to ${newUrl}...` : 'Reset to auto-detected server',
        'info'
      );
    }
  };

  const handleTeleportToCarMeet = () => {
    engineRef.current?.teleportToCarMeet();
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950 select-none">
      {/* Mobile Orientation Lock (Strict Landscape Mode Enforcement) */}
      <OrientationLock />

      {/* 3D WebGL Canvas Viewport */}
      <div ref={canvasContainerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* No WebGL: explain and offer a retry instead of a blank page */}
      {webglError && (
        <WebGLErrorScreen
          detail={webglError}
          onRetry={() => {
            useGameStore.getState().setLoading(true, 0, 'Initializing 3D World...');
            setRetryToken((t) => t + 1);
          }}
        />
      )}

      {/* Loading Screen */}
      {!webglError && <LoadingScreen />}

      {/* Customs & Tuning Shop Modal */}
      <VehicleCustomsModal onSyncUpgrades={() => engineRef.current?.syncVehicleUpgrades()} />

      {/* Car Meet Ride Inspection Modal */}
      <CarMeetInspectModal
        data={inspectedCar}
        onClose={() => setInspectedCar(null)}
      />

      {/* Garage Vehicle Selector Modal (for POI / legacy trigger) */}
      <CarSelectorModal onSelectCar={handleSelectVehicle} />

      {/* Mission Board (M) */}
      <MissionMenu
        onStartMission={handleStartMission}
        onAbandonMission={handleAbandonMission}
        onRepairVehicle={handleRepairVehicle}
      />

      {/* WASTED / BUSTED / MISSION PASSED */}
      <SplashOverlay />

      {/* In-Game Multiplayer Chat & Quick Phrases */}
      {!isLoading && !webglError && (
        <MultiplayerChat
          messages={chatMessages}
          onSendMessage={(text) => engineRef.current?.multiplayerClient.sendChatMessage(text)}
          onlineCount={onlineCount}
        />
      )}

      {/* Main HUD Overlays (Only visible once game is loaded) */}
      {!isLoading && !webglError && (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4 md:p-6 safe-top safe-bottom safe-left safe-right">
          {/* Top Bar */}
          <div className="flex items-start justify-between w-full gap-2">
            {/* Left: Brand Badge, Health Bar, Cash Counter, Active Vehicle Dropdown & notifications */}
            <div className="flex flex-col gap-1 sm:gap-1.5 pointer-events-auto">
              <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap max-w-[340px] sm:max-w-none">
                {/* Brand Logo in Top-Left Corner (Small, sleek size) */}
                <div className="flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl bg-slate-950/40 backdrop-blur-md border border-white/10 shadow-lg shadow-black/30 hover:border-cyan-400/40 transition-all duration-300 w-fit group select-none cursor-default shrink-0">
                  <img
                    src="/logo.png"
                    alt="Deep Rush City"
                    className="h-4 sm:h-6 w-auto object-contain drop-shadow-[0_0_10px_rgba(255,180,0,0.35)] transition-all duration-300 group-hover:brightness-110"
                  />
                </div>

                <GTAHealthBar />
                <CashDisplay />

                {/* Interactive Vehicle Selection Dropdown */}
                <div className="flex items-center">
                  <VehicleDropdown onSelectVehicle={handleSelectVehicle} />
                </div>
              </div>

              <NotificationFeed />
            </div>

            {/* Center: Activities Dropdown (Jobs, Missions, Customs, Jetpack) & Active Mission Banners */}
            <div className="flex flex-col items-center gap-1.5 pointer-events-auto">
              {/* Single Unified Activities Dropdown */}
              <ActivitiesDropdown
                onToggleCabJob={handleToggleCabJob}
                onToggleMissions={handleToggleMissions}
                onToggleCustoms={handleToggleCustoms}
                onToggleJetpack={handleToggleJetpack}
                onToggleParachute={handleToggleParachute}
              />

              {/* Active Cab Mission Banner */}
              <CabMissionHUD onCancelJob={handleCancelCabJob} />

              {/* Active Story Mission Banner */}
              <MissionHUD onAbandon={handleAbandonMission} />
            </div>

            {/* Right: Quick Settings + Wanted Stars */}
            <div className="flex flex-col items-end gap-2">
              <QuickSettings
                onResetCar={handleResetCar}
                onApplyLighting={handleApplyLighting}
                onApplyGraphics={handleApplyGraphics}
                onApplyHeadlights={handleApplyHeadlights}
                onSelectVehicle={handleSelectVehicle}
                onRepairVehicle={handleRepairVehicle}
                onClearWanted={handleClearWanted}
                onToggleJetpack={handleToggleJetpack}
                onToggleParachute={handleToggleParachute}
                onToggleCabJob={handleToggleCabJob}
                onToggleMissions={handleToggleMissions}
                onToggleCustoms={handleToggleCustoms}
                onTeleportToCarMeet={handleTeleportToCarMeet}
                onlineCount={onlineCount}
                playerName={playerName}
                onChangePlayerName={handleChangePlayerName}
                isMultiplayerConnected={isMultiplayerConnected}
                serverUrl={serverUrl}
                onChangeServerUrl={handleChangeServerUrl}
              />
              <WantedStars />
            </div>
          </div>

          {/* Center: POI Toast Popup */}
          <POIPopup />

          {/* Bottom Bar: MiniMap, Controls Legend, Speedometer */}
          <div className="flex items-end justify-between w-full gap-2 sm:gap-4 pointer-events-none">
            {/* Bottom-Left: MiniMap (Desktop: static; Mobile: fixed at bottom-2.5 left-[134px] alongside steering pad) */}
            <div className="fixed bottom-2.5 left-[134px] sm:left-[144px] lg:static z-10 pointer-events-auto">
              <MiniMap />
            </div>

            {/* Bottom-Center: Controls Overlay (Desktop keyboard legend / full-screen mobile touch overlay) */}
            <div className="flex-1 flex justify-center pointer-events-none">
              <ControlsOverlay
                onResetCar={handleResetCar}
                onToggleCabJob={handleToggleCabJob}
                onToggleCustoms={handleToggleCustoms}
                onToggleMissions={handleToggleMissions}
                onToggleJetpack={handleToggleJetpack}
                onToggleParachute={handleToggleParachute}
              />
            </div>

            {/* Bottom-Right: Speedometer (driving) / Jetpack gauges (flying) */}
            {/* Mobile: fixed along bottom bezel at right-[132px] alongside pedals; pointer-events-none allows touches to pass through! */}
            <div className="fixed bottom-2.5 right-[132px] sm:right-[144px] lg:static z-10 pointer-events-none flex flex-col items-end gap-1.5 sm:gap-2">
              <Speedometer />
              <JetpackHUD />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
