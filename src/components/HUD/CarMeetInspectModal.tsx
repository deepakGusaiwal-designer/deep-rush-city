import React from 'react';
import { X, Wrench, Zap, Gauge, Shield, Palette, Sparkles, User } from 'lucide-react';
import { CarMeetInspectData } from '../../game/multiplayer/MultiplayerTypes';

interface CarMeetInspectModalProps {
  data: CarMeetInspectData | null;
  onClose: () => void;
}

export const CarMeetInspectModal: React.FC<CarMeetInspectModalProps> = ({ data, onClose }) => {
  if (!data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-auto">
      <div className="glass-panel w-full max-w-sm rounded-3xl border border-cyan-500/40 bg-slate-950/90 shadow-2xl p-5 flex flex-col gap-4 text-white animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-wide text-cyan-300 uppercase">
                Car Meet Inspection
              </h3>
              <p className="text-[11px] text-gray-400 flex items-center gap-1">
                <User className="w-3 h-3" />
                Owner: <span className="text-white font-bold">{data.ownerName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Vehicle Badge & Model */}
        <div className="bg-white/5 rounded-2xl p-3 border border-white/10 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              Vehicle Chassis
            </div>
            <div className="text-base font-black text-amber-400">{data.vehicleModelId}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              Est. Top Speed
            </div>
            <div className="text-sm font-mono font-bold text-cyan-300">
              {Math.max(120, data.topSpeedKmh)} km/h
            </div>
          </div>
        </div>

        {/* Custom Styling Swatches */}
        <div className="grid grid-cols-2 gap-2">
          {/* Custom Paint */}
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5 flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full border border-white/40 shadow-inner shrink-0"
              style={{ backgroundColor: data.paintColor || '#38bdf8' }}
            />
            <div className="min-w-0">
              <div className="text-[9px] text-gray-400 font-bold uppercase">Custom Paint</div>
              <div className="text-xs font-mono font-bold truncate">
                {data.paintColor || 'Stock Factory'}
              </div>
            </div>
          </div>

          {/* Underglow */}
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5 flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full border border-white/40 shadow-inner shrink-0"
              style={{ backgroundColor: data.underglowColor || 'transparent' }}
            />
            <div className="min-w-0">
              <div className="text-[9px] text-gray-400 font-bold uppercase">Neon Underglow</div>
              <div className="text-xs font-mono font-bold truncate">
                {data.underglowColor ? 'Active Neon' : 'None'}
              </div>
            </div>
          </div>
        </div>

        {/* Performance Tuning Stages */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            Tuning Stages
          </div>

          {/* Engine */}
          <div className="flex items-center justify-between text-xs bg-white/5 px-3 py-2 rounded-xl border border-white/5">
            <span className="flex items-center gap-1.5 text-gray-300">
              <Gauge className="w-3.5 h-3.5 text-amber-400" />
              Engine Stage
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((st) => (
                <span
                  key={st}
                  className={`w-2.5 h-2.5 rounded-full ${
                    st <= data.engineStage ? 'bg-amber-400' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Nitro Boost */}
          <div className="flex items-center justify-between text-xs bg-white/5 px-3 py-2 rounded-xl border border-white/5">
            <span className="flex items-center gap-1.5 text-gray-300">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              Nitro Turbo
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((st) => (
                <span
                  key={st}
                  className={`w-2.5 h-2.5 rounded-full ${
                    st <= data.boostStage ? 'bg-cyan-400' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Handling */}
          <div className="flex items-center justify-between text-xs bg-white/5 px-3 py-2 rounded-xl border border-white/5">
            <span className="flex items-center gap-1.5 text-gray-300">
              <Wrench className="w-3.5 h-3.5 text-emerald-400" />
              Handling / Suspension
            </span>
            <div className="flex gap-1">
              {[1, 2, 3].map((st) => (
                <span
                  key={st}
                  className={`w-2.5 h-2.5 rounded-full ${
                    st <= data.handlingStage ? 'bg-emerald-400' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Dismiss button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 font-bold text-xs uppercase tracking-wider text-slate-950 transition-all shadow-lg shadow-cyan-500/20"
        >
          Close Inspection
        </button>
      </div>
    </div>
  );
};
