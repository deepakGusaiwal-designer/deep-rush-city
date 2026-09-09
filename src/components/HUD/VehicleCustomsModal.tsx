import React, { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { audioManager } from '../../game/AudioManager';
import { VEHICLE_LIST } from '../../data/vehicles';
import {
  Wrench,
  Zap,
  Gauge,
  Palette,
  Check,
  DollarSign,
  X,
  Sparkles,
  ShieldAlert,
  Flame,
  Car,
} from 'lucide-react';

const ENGINE_STAGES = [
  { stage: 1, name: 'Stock Engine', desc: 'Factory standard engine block', price: 0, speedBonus: '+0%', accelBonus: '+0%' },
  { stage: 2, name: 'Street ECU Stage 2', desc: 'Reflashed fuel mapping and sport exhaust', price: 150, speedBonus: '+16%', accelBonus: '+14%' },
  { stage: 3, name: 'Twin-Turbo Intercooler', desc: 'Forced induction high-boost turbocharging', price: 350, speedBonus: '+32%', accelBonus: '+28%' },
  { stage: 4, name: 'Pro Racing V8 Block', desc: 'Forged pistons and lightweight carbon flywheel', price: 650, speedBonus: '+48%', accelBonus: '+42%' },
  { stage: 5, name: 'Hyperdrive Warp Reactor', desc: 'Experimental plasma turbine with extreme top speed', price: 1100, speedBonus: '+64%', accelBonus: '+56%' },
];

const BOOST_STAGES = [
  { stage: 1, name: 'Stock Nitro', desc: 'Basic single-shot boost bottle', price: 0, boostBonus: 'Standard' },
  { stage: 2, name: 'Stage 1 Nitrous Shot', desc: 'Pressurized dual-nozzle nitrous delivery', price: 140, boostBonus: '+32% Boost Power' },
  { stage: 3, name: 'Dual Bottle High-Pressure NOS', desc: 'Direct port cryogenic nitro injection', price: 320, boostBonus: '+64% Boost Power' },
  { stage: 4, name: 'Supersonic Rocket Thruster', desc: 'Aerospace rocket surge with instant top-end acceleration', price: 600, boostBonus: '+96% Boost Power' },
];

const HANDLING_STAGES = [
  { stage: 1, name: 'Street Tires', desc: 'Standard road radials with comfortable ride', price: 0, gripBonus: 'Base' },
  { stage: 2, name: 'Track Sport Compound', desc: 'High-silica compound for sharper steering and braking', price: 180, gripBonus: '+18% Grip & Sharpness' },
  { stage: 3, name: 'Drift King Competition Slicks', desc: 'Maximum cornering grip and controlled power slides', price: 420, gripBonus: '+36% Grip & Drift Control' },
];

const PAINT_SWATCHES = [
  { name: 'Original', hex: null },
  { name: 'Electric Cyan', hex: '#00f0ff' },
  { name: 'Crimson Red', hex: '#ef4444' },
  { name: 'Racing Gold', hex: '#eab308' },
  { name: 'Acid Lime', hex: '#22c55e' },
  { name: 'Midnight Purple', hex: '#a855f7' },
  { name: 'Hot Pink', hex: '#f43f5e' },
  { name: 'Sunset Orange', hex: '#f97316' },
  { name: 'Matte Obsidian', hex: '#111827' },
  { name: 'Pure White', hex: '#f8fafc' },
  { name: 'Cab Yellow', hex: '#facc15' },
];

const UNDERGLOW_SWATCHES = [
  { name: 'Off', hex: null },
  { name: 'Cyan Bloom', hex: '#00f0ff' },
  { name: 'Laser Violet', hex: '#a855f7' },
  { name: 'Crimson Glow', hex: '#ef4444' },
  { name: 'Acid Green', hex: '#22c55e' },
  { name: 'Solar Amber', hex: '#fbbf24' },
];

interface VehicleCustomsModalProps {
  onSyncUpgrades: () => void;
}

export const VehicleCustomsModal: React.FC<VehicleCustomsModalProps> = ({ onSyncUpgrades }) => {
  const isCustomsOpen = useGameStore((state) => state.isCustomsOpen);
  const setCustomsOpen = useGameStore((state) => state.setCustomsOpen);
  const cash = useGameStore((state) => state.cash);
  const upgrades = useGameStore((state) => state.vehicleUpgrades);
  const selectedVehicleId = useGameStore((state) => state.selectedVehicleId);

  const upgradeEngine = useGameStore((state) => state.upgradeEngine);
  const upgradeBoost = useGameStore((state) => state.upgradeBoost);
  const upgradeHandling = useGameStore((state) => state.upgradeHandling);
  const setPaintColor = useGameStore((state) => state.setPaintColor);
  const setUnderglowColor = useGameStore((state) => state.setUnderglowColor);
  const toggleTaxiSign = useGameStore((state) => state.toggleTaxiSign);

  const [activeTab, setActiveTab] = useState<'tuning' | 'styling'>('tuning');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isCustomsOpen) return null;

  const currentVehicleStats = VEHICLE_LIST.find((v) => v.id === selectedVehicleId) || VEHICLE_LIST[0];

  const handleUpgradeEngine = (cost: number) => {
    if (cash < cost) {
      showError('Insufficient cash! Complete cab fares to earn more money.');
      return;
    }
    if (upgradeEngine(cost)) {
      audioManager.playUpgradeInstalled();
      onSyncUpgrades();
    }
  };

  const handleUpgradeBoost = (cost: number) => {
    if (cash < cost) {
      showError('Insufficient cash! Complete cab fares to earn more money.');
      return;
    }
    if (upgradeBoost(cost)) {
      audioManager.playUpgradeInstalled();
      onSyncUpgrades();
    }
  };

  const handleUpgradeHandling = (cost: number) => {
    if (cash < cost) {
      showError('Insufficient cash! Complete cab fares to earn more money.');
      return;
    }
    if (upgradeHandling(cost)) {
      audioManager.playUpgradeInstalled();
      onSyncUpgrades();
    }
  };

  const handleSelectPaint = (hex: string | null) => {
    const cost = hex === null ? 0 : 50;
    if (hex !== null && hex !== upgrades.paintColor && cash < cost) {
      showError('Insufficient cash for paint respray ($50)!');
      return;
    }
    if (setPaintColor(hex, hex === upgrades.paintColor ? 0 : cost)) {
      audioManager.playUpgradeInstalled();
      onSyncUpgrades();
    }
  };

  const handleSelectUnderglow = (hex: string | null) => {
    const cost = hex === null ? 0 : 80;
    if (hex !== null && hex !== upgrades.underglowColor && cash < cost) {
      showError('Insufficient cash for underglow neon ($80)!');
      return;
    }
    if (setUnderglowColor(hex, hex === upgrades.underglowColor ? 0 : cost)) {
      audioManager.playUpgradeInstalled();
      onSyncUpgrades();
    }
  };

  const handleToggleTaxiSign = () => {
    const cost = upgrades.hasTaxiSign ? 0 : 60;
    if (!upgrades.hasTaxiSign && cash < cost) {
      showError('Insufficient cash for Taxi Roof Sign ($60)!');
      return;
    }
    if (toggleTaxiSign(cost)) {
      audioManager.playUpgradeInstalled();
      onSyncUpgrades();
    }
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md select-none pointer-events-auto">
      <div className="glass-panel w-full max-w-xl rounded-3xl border border-cyan-500/40 shadow-2xl flex flex-col max-h-[90vh] bg-slate-900/95 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center shadow-lg">
              <Wrench className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-wide flex items-center gap-2">
                Customs & Performance Shop
              </h2>
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <Car className="w-3 h-3 text-cyan-400" />
                <span>{currentVehicleStats.name}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Cash Badge */}
            <div className="glass-panel px-3 py-1 rounded-xl border border-emerald-500/40 flex items-center gap-1 bg-slate-950/80">
              <DollarSign className="w-4 h-4 text-emerald-400 font-bold" />
              <span className="font-mono text-sm font-black text-emerald-400">
                {cash.toLocaleString()}
              </span>
            </div>

            <button
              onClick={() => setCustomsOpen(false)}
              className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error Alert Toast */}
        {errorMsg && (
          <div className="px-5 py-2 bg-rose-500/20 border-b border-rose-500/40 flex items-center gap-2 text-rose-300 text-xs font-semibold animate-pulse">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Category Tabs */}
        <div className="flex border-b border-white/10 bg-slate-950/40 px-5 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('tuning')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-xl font-bold text-xs transition-all ${
              activeTab === 'tuning'
                ? 'bg-cyan-500/20 text-cyan-300 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Performance Tuning</span>
          </button>

          <button
            onClick={() => setActiveTab('styling')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-xl font-bold text-xs transition-all ${
              activeTab === 'styling'
                ? 'bg-cyan-500/20 text-cyan-300 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Paint & Visuals</span>
          </button>
        </div>

        {/* Modal Scroll Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {activeTab === 'tuning' && (
            <>
              {/* 1. Engine & Top Speed Upgrade */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    <div>
                      <h4 className="text-sm font-bold text-white">Engine & Top Speed</h4>
                      <p className="text-[11px] text-gray-400">
                        {ENGINE_STAGES[upgrades.engineStage - 1].name}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 font-mono text-xs font-bold">
                    Stage {upgrades.engineStage}/5
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-gray-400 text-[10px]">Top Speed Bonus:</span>
                    <p className="font-mono font-bold text-cyan-300">
                      {ENGINE_STAGES[upgrades.engineStage - 1].speedBonus}
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-gray-400 text-[10px]">Acceleration Rate:</span>
                    <p className="font-mono font-bold text-cyan-300">
                      {ENGINE_STAGES[upgrades.engineStage - 1].accelBonus}
                    </p>
                  </div>
                </div>

                {upgrades.engineStage < 5 ? (
                  <button
                    onClick={() => handleUpgradeEngine(ENGINE_STAGES[upgrades.engineStage].price)}
                    className="w-full py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg hover:shadow-cyan-500/25 transition-all"
                  >
                    <span>Upgrade to {ENGINE_STAGES[upgrades.engineStage].name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-950/30 text-slate-950 font-mono">
                      ${ENGINE_STAGES[upgrades.engineStage].price}
                    </span>
                  </button>
                ) : (
                  <div className="py-1.5 text-center text-xs font-bold text-emerald-400 flex items-center justify-center gap-1">
                    <Check className="w-4 h-4" /> MAX STAGE REACHED
                  </div>
                )}
              </div>

              {/* 2. Nitro Rocket Booster Upgrade */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <div>
                      <h4 className="text-sm font-bold text-white">Nitro Rocket Booster</h4>
                      <p className="text-[11px] text-gray-400">
                        {BOOST_STAGES[upgrades.boostStage - 1].name}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-mono text-xs font-bold">
                    Stage {upgrades.boostStage}/4
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-black/30 border border-white/5 text-xs">
                  <span className="text-gray-400 text-[10px]">Thrust Modifier:</span>
                  <p className="font-mono font-bold text-amber-300">
                    {BOOST_STAGES[upgrades.boostStage - 1].boostBonus}
                  </p>
                </div>

                {upgrades.boostStage < 4 ? (
                  <button
                    onClick={() => handleUpgradeBoost(BOOST_STAGES[upgrades.boostStage].price)}
                    className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg hover:shadow-amber-500/25 transition-all"
                  >
                    <span>Upgrade to {BOOST_STAGES[upgrades.boostStage].name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-950/30 text-slate-950 font-mono">
                      ${BOOST_STAGES[upgrades.boostStage].price}
                    </span>
                  </button>
                ) : (
                  <div className="py-1.5 text-center text-xs font-bold text-emerald-400 flex items-center justify-center gap-1">
                    <Check className="w-4 h-4" /> MAX STAGE REACHED
                  </div>
                )}
              </div>

              {/* 3. Tires & Steering Handling Upgrade */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-emerald-400" />
                    <div>
                      <h4 className="text-sm font-bold text-white">Tires & Suspension Grip</h4>
                      <p className="text-[11px] text-gray-400">
                        {HANDLING_STAGES[upgrades.handlingStage - 1].name}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold">
                    Stage {upgrades.handlingStage}/3
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-black/30 border border-white/5 text-xs">
                  <span className="text-gray-400 text-[10px]">Tire Grip & Lateral Control:</span>
                  <p className="font-mono font-bold text-emerald-300">
                    {HANDLING_STAGES[upgrades.handlingStage - 1].gripBonus}
                  </p>
                </div>

                {upgrades.handlingStage < 3 ? (
                  <button
                    onClick={() => handleUpgradeHandling(HANDLING_STAGES[upgrades.handlingStage].price)}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-500/25 transition-all"
                  >
                    <span>Upgrade to {HANDLING_STAGES[upgrades.handlingStage].name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-950/30 text-slate-950 font-mono">
                      ${HANDLING_STAGES[upgrades.handlingStage].price}
                    </span>
                  </button>
                ) : (
                  <div className="py-1.5 text-center text-xs font-bold text-emerald-400 flex items-center justify-center gap-1">
                    <Check className="w-4 h-4" /> MAX STAGE REACHED
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'styling' && (
            <>
              {/* 1. Paint Color Respray Swatches */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-sm font-bold text-white">Body Paint Finish ($50)</h4>
                  </div>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {PAINT_SWATCHES.map((swatch) => {
                    const isSelected = upgrades.paintColor === swatch.hex;
                    return (
                      <button
                        key={swatch.name}
                        onClick={() => handleSelectPaint(swatch.hex)}
                        className={`p-2 rounded-xl flex flex-col items-center gap-1.5 border transition-all ${
                          isSelected
                            ? 'border-cyan-400 bg-cyan-500/20 shadow-md'
                            : 'border-white/10 hover:border-white/30 bg-black/20'
                        }`}
                      >
                        <div
                          className="w-6 h-6 rounded-full border border-white/30 shadow-inner flex items-center justify-center"
                          style={{ backgroundColor: swatch.hex ?? '#6b7280' }}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white drop-shadow" />}
                        </div>
                        <span className="text-[9px] font-semibold text-gray-300 truncate max-w-full">
                          {swatch.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Chassis Underglow Neon Light */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <h4 className="text-sm font-bold text-white">Chassis Underglow Neon ($80)</h4>
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {UNDERGLOW_SWATCHES.map((swatch) => {
                    const isSelected = upgrades.underglowColor === swatch.hex;
                    return (
                      <button
                        key={swatch.name}
                        onClick={() => handleSelectUnderglow(swatch.hex)}
                        className={`p-2 rounded-xl flex flex-col items-center gap-1.5 border transition-all ${
                          isSelected
                            ? 'border-purple-400 bg-purple-500/20 shadow-md'
                            : 'border-white/10 hover:border-white/30 bg-black/20'
                        }`}
                      >
                        <div
                          className="w-6 h-6 rounded-full border border-white/30 shadow-inner flex items-center justify-center"
                          style={{ backgroundColor: swatch.hex ?? '#374151' }}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white drop-shadow" />}
                        </div>
                        <span className="text-[9px] font-semibold text-gray-300 truncate max-w-full">
                          {swatch.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Lighted Taxi Roof Sign */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>🚖 Lighted Taxi Roof Fixture</span>
                  </h4>
                  <p className="text-[11px] text-gray-400">
                    Mount an illuminated 3D "TAXI" roof sign ($60)
                  </p>
                </div>

                <button
                  onClick={handleToggleTaxiSign}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                    upgrades.hasTaxiSign
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                  }`}
                >
                  {upgrades.hasTaxiSign ? 'Equipped (Active)' : 'Install ($60)'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
