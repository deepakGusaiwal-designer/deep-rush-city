import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { Heart, Shield, Car, Wrench } from 'lucide-react';

export const GTAHealthBar: React.FC = () => {
  const telemetry = useGameStore((state) => state.telemetry);
  const health = useGameStore((state) => state.health);
  const armor = useGameStore((state) => state.armor);
  const vehicleHealth = useGameStore((state) => state.vehicleHealth);
  const playerMode = telemetry.playerMode ?? 'on_foot';

  const isDriving = playerMode === 'driving';
  const low = health <= 30;

  return (
    <div className="flex items-center pointer-events-auto select-none">
      {/* Small Compact Health & Status Block */}
      <div
        className={`glass-panel px-2 py-0.5 sm:py-1 rounded-xl border shadow-sm flex flex-col gap-0.5 min-w-[95px] sm:min-w-[115px] bg-slate-950/35 backdrop-blur-sm ${
          low ? 'border-rose-500/60 animate-pulse bg-rose-950/40' : 'border-white/10'
        }`}
      >
        {/* Top Mini Header: Icon + Mode Tag + HP % */}
        <div className="flex items-center justify-between gap-1 leading-none">
          <div className="flex items-center gap-1">
            <Heart
              className={`w-2.5 h-2.5 ${
                low ? 'text-rose-400 fill-rose-400' : 'text-emerald-400 fill-emerald-400'
              }`}
            />
            <span className="text-[9px] font-black uppercase text-gray-200">
              {isDriving ? 'CAR' : 'HP'}
            </span>
          </div>
          <span
            className={`text-[9px] font-mono font-bold ${
              low ? 'text-rose-300' : 'text-gray-300'
            }`}
          >
            {Math.round(health)}%
          </span>
        </div>

        {/* Health Bar (Slim) */}
        <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden p-[1px] border border-white/10">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              low
                ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'
                : 'bg-gradient-to-r from-emerald-500 to-teal-400'
            }`}
            style={{ width: `${Math.max(0, Math.min(100, health))}%` }}
          />
        </div>

        {/* Secondary Bars: Armor & Vehicle condition (ultra-slim) */}
        {(armor > 0 || isDriving) && (
          <div className="flex items-center gap-1 pt-0.5">
            {armor > 0 && (
              <div className="flex-1 flex items-center gap-0.5">
                <Shield className="w-2 h-2 text-cyan-400 shrink-0" />
                <div className="flex-1 h-1 bg-black/60 rounded-full overflow-hidden border border-white/5">
                  <div
                    className="h-full rounded-full bg-cyan-400 transition-all duration-300"
                    style={{ width: `${Math.max(0, Math.min(100, armor))}%` }}
                  />
                </div>
              </div>
            )}
            {isDriving && (
              <div className="flex-1 flex items-center gap-0.5">
                <Wrench className="w-2 h-2 text-amber-400 shrink-0" />
                <div className="flex-1 h-1 bg-black/60 rounded-full overflow-hidden border border-white/5">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      vehicleHealth > 40 ? 'bg-amber-400' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.max(0, Math.min(100, vehicleHealth))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
