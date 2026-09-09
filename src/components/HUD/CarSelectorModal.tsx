import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { VEHICLE_LIST } from '../../data/vehicles';
import { VehicleModelId } from '../../types/game';
import { X, Zap, Gauge, Compass, Weight, Check } from 'lucide-react';

interface CarSelectorModalProps {
  onSelectCar: (vehicleId: VehicleModelId) => void;
}

export const CarSelectorModal: React.FC<CarSelectorModalProps> = ({ onSelectCar }) => {
  const isGarageOpen = useGameStore((state) => state.isGarageOpen);
  const setGarageOpen = useGameStore((state) => state.setGarageOpen);
  const selectedVehicleId = useGameStore((state) => state.selectedVehicleId);

  if (!isGarageOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="glass-panel-glow w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-cyan-500/30 text-white animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/60">
          <div>
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Workshop & Dealership</span>
            <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-cyan-400">
              Select Your Ride
            </h2>
          </div>
          <button
            onClick={() => setGarageOpen(false)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Vehicles Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {VEHICLE_LIST.map((car) => {
            const isSelected = selectedVehicleId === car.id;
            return (
              <div
                key={car.id}
                onClick={() => {
                  onSelectCar(car.id);
                  setGarageOpen(false);
                }}
                className={`relative group rounded-2xl p-5 cursor-pointer transition-all duration-300 flex flex-col justify-between border ${
                  isSelected
                    ? 'bg-cyan-950/40 border-cyan-400 shadow-lg shadow-cyan-500/20'
                    : 'bg-slate-900/50 hover:bg-slate-800/60 border-white/10 hover:border-cyan-500/40'
                }`}
              >
                {/* Active Tag */}
                {isSelected && (
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-cyan-400 text-black text-[10px] font-black flex items-center gap-1 shadow-md">
                    <Check className="w-3 h-3" /> ACTIVE
                  </div>
                )}

                {/* Car Info */}
                <div>
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{car.category}</span>
                  <h3 className="text-lg font-black text-white group-hover:text-cyan-300 transition-colors">
                    {car.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                    {car.description}
                  </p>
                </div>

                {/* Stats Bar */}
                <div className="mt-4 space-y-2 pt-3 border-t border-white/5 text-xs">
                  {/* Top Speed */}
                  <div>
                    <div className="flex justify-between text-gray-400 mb-1">
                      <span className="flex items-center gap-1"><Gauge className="w-3.5 h-3.5 text-cyan-400" /> Top Speed</span>
                      <span className="font-mono font-bold text-white">{car.topSpeedKmh} KM/H</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-400 rounded-full"
                        style={{ width: `${(car.topSpeedKmh / 130) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Acceleration */}
                  <div>
                    <div className="flex justify-between text-gray-400 mb-1">
                      <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-amber-400" /> Acceleration</span>
                      <span className="font-mono font-bold text-white">{car.acceleration}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${car.acceleration}%` }}
                      />
                    </div>
                  </div>

                  {/* Handling */}
                  <div>
                    <div className="flex justify-between text-gray-400 mb-1">
                      <span className="flex items-center gap-1"><Compass className="w-3.5 h-3.5 text-emerald-400" /> Handling</span>
                      <span className="font-mono font-bold text-white">{car.handling}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full"
                        style={{ width: `${car.handling}%` }}
                      />
                    </div>
                  </div>

                  {/* Mass */}
                  <div className="flex justify-between text-gray-400 pt-1">
                    <span className="flex items-center gap-1"><Weight className="w-3.5 h-3.5 text-indigo-400" /> Weight</span>
                    <span className="font-mono font-bold text-white">{car.mass} KG</span>
                  </div>
                </div>

                {/* Select Button */}
                <button
                  className={`mt-4 w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 ${
                    isSelected
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 cursor-default'
                      : 'bg-white/10 hover:bg-cyan-500 hover:text-black text-white'
                  }`}
                >
                  {isSelected ? 'Currently Driving' : 'Select Car'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
