import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { MISSIONS } from '../../game/MissionDirector';
import { X, Play, Ban, Wrench, Trophy, Skull, ShieldAlert, Package, Car, Gauge } from 'lucide-react';

interface MissionMenuProps {
  onStartMission: (id: string) => void;
  onAbandonMission: () => void;
  onRepairVehicle: () => void;
}

const REPAIR_COST = 150;

/** Pause-style mission board (M). Pick a job, abandon the current one, repair the car, read your stats. */
export const MissionMenu: React.FC<MissionMenuProps> = ({ onStartMission, onAbandonMission, onRepairVehicle }) => {
  const isOpen = useGameStore((s) => s.isMissionMenuOpen);
  const setOpen = useGameStore((s) => s.setMissionMenuOpen);
  const active = useGameStore((s) => s.activeMission);
  const cash = useGameStore((s) => s.cash);
  const stats = useGameStore((s) => s.stats);
  const packages = useGameStore((s) => s.packagesCollected);
  const vehicleHealth = useGameStore((s) => s.vehicleHealth);

  if (!isOpen) return null;

  const isActive = active.status === 'active';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm pointer-events-auto animate-fade-in" onClick={() => setOpen(false)}>
      <div
        className="glass-panel-glow w-[92%] max-w-3xl max-h-[88vh] overflow-y-auto rounded-3xl border border-cyan-400/30 p-5 sm:p-6 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-300">Deep Rush City</div>
            <h2 className="text-2xl font-black tracking-tight">Mission Board</h2>
            <p className="text-xs text-gray-400 mt-0.5">Walk into a marker in the city or start a job here. Press <span className="font-mono text-cyan-300">M</span> to close.</p>
          </div>
          <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-white/10 text-gray-300 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active mission */}
        {isActive && (
          <div className="mb-4 p-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-300">In progress</div>
              <div className="font-bold truncate">{active.title}</div>
              <div className="text-xs text-gray-300 truncate">{active.objective}</div>
            </div>
            <button
              onClick={() => { onAbandonMission(); }}
              className="shrink-0 px-3 py-1.5 rounded-xl border border-rose-500/50 text-rose-300 hover:bg-rose-500/15 text-xs font-bold flex items-center gap-1.5"
            >
              <Ban className="w-3.5 h-3.5" /> Abandon
            </button>
          </div>
        )}

        {/* Mission list */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MISSIONS.map((m) => (
            <div
              key={m.id}
              className="rounded-2xl border border-white/10 bg-slate-900/60 p-3.5 flex flex-col gap-2 hover:border-white/25 transition-colors"
              style={{ boxShadow: `inset 3px 0 0 ${m.color}` }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: `${m.color}22`, border: `1px solid ${m.color}66` }}>
                    {m.icon}
                  </div>
                  <div>
                    <div className="font-black leading-tight">{m.title}</div>
                    <div className="text-[10px] text-gray-400">{m.giver}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono font-black text-emerald-300 text-sm">${m.reward.toLocaleString()}</div>
                  <div className="text-[9px] text-gray-400 tracking-wider">{'★'.repeat(m.difficulty)}{'☆'.repeat(3 - m.difficulty)}</div>
                </div>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">{m.description}</p>
              <button
                disabled={isActive}
                onClick={() => { onStartMission(m.id); setOpen(false); }}
                className={`mt-auto self-start px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${
                  isActive
                    ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                    : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300 hover:scale-105 active:scale-95 shadow-lg shadow-cyan-500/30'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Start
              </button>
            </div>
          ))}
        </div>

        {/* Garage + stats */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3.5 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-gray-400"><Car className="w-3.5 h-3.5" /> Vehicle</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-black/60 border border-white/10 overflow-hidden">
                <div
                  className={`h-full ${vehicleHealth > 50 ? 'bg-emerald-400' : vehicleHealth > 25 ? 'bg-amber-400' : 'bg-rose-500'}`}
                  style={{ width: `${vehicleHealth}%` }}
                />
              </div>
              <span className="font-mono text-xs">{Math.round(vehicleHealth)}%</span>
            </div>
            <button
              disabled={vehicleHealth >= 100 || cash < REPAIR_COST}
              onClick={onRepairVehicle}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 justify-center ${
                vehicleHealth >= 100 || cash < REPAIR_COST
                  ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                  : 'border border-emerald-400/50 text-emerald-300 hover:bg-emerald-500/15'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" /> Repair (${REPAIR_COST})
            </button>
          </div>

          <div className="sm:col-span-2 rounded-2xl border border-white/10 bg-slate-900/60 p-3.5">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2"><Trophy className="w-3.5 h-3.5" /> Record</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat icon={<Trophy className="w-3 h-3 text-amber-300" />} label="Missions" value={`${stats.missionsPassed}/${stats.missionsPassed + stats.missionsFailed}`} />
              <Stat icon={<Package className="w-3 h-3 text-emerald-300" />} label="Packages" value={`${packages.length}/12`} />
              <Stat icon={<ShieldAlert className="w-3 h-3 text-sky-300" />} label="Cops evaded" value={`${stats.copsEvaded}`} />
              <Stat icon={<Skull className="w-3 h-3 text-rose-300" />} label="Wasted / Busted" value={`${stats.timesWasted} / ${stats.timesBusted}`} />
              <Stat icon={<Car className="w-3 h-3 text-cyan-300" />} label="Fares" value={`${stats.faresCompleted}`} />
              <Stat icon={<Car className="w-3 h-3 text-orange-300" />} label="Cars wrecked" value={`${stats.carsWrecked}`} />
              <Stat icon={<Gauge className="w-3 h-3 text-violet-300" />} label="Top speed" value={`${stats.topSpeedKmh} km/h`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="rounded-xl bg-black/30 border border-white/5 px-2.5 py-1.5 flex flex-col gap-0.5">
    <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-gray-400">{icon}{label}</div>
    <div className="font-mono font-bold text-white">{value}</div>
  </div>
);
