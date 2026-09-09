import React, { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { VEHICLE_LIST } from '../../data/vehicles';
import { VehicleModelId } from '../../types/game';
import { Car, ChevronDown, Check, Gauge } from 'lucide-react';

interface VehicleDropdownProps {
  onSelectVehicle: (vehicleId: VehicleModelId) => void;
}

export const VehicleDropdown: React.FC<VehicleDropdownProps> = ({ onSelectVehicle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const selectedVehicleId = useGameStore((state) => state.selectedVehicleId);
  const currentVehicleStats =
    VEHICLE_LIST.find((v) => v.id === selectedVehicleId) || VEHICLE_LIST[0];

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

  const handleSelect = (vehicleId: VehicleModelId, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectVehicle(vehicleId);
    setIsOpen(false);
  };

  return (
    <div className="relative pointer-events-auto" ref={dropdownRef}>
      {/* Dropdown Trigger Button */}
      <button
        type="button"
        tabIndex={-1}
        onClick={handleToggle}
        title="Select Vehicle (Click to change ride)"
        className={`glass-panel px-2.5 py-1 rounded-xl flex items-center gap-1.5 border transition-all duration-200 text-[11px] shadow-md group ${
          isOpen
            ? 'border-cyan-400 bg-cyan-950/50 text-cyan-300 ring-2 ring-cyan-500/30'
            : 'border-white/10 hover:border-cyan-400/40 text-gray-300 hover:text-white'
        }`}
      >
        <span
          className="w-2 h-2 rounded-full shadow-sm shrink-0"
          style={{ backgroundColor: currentVehicleStats.colorHex }}
        />
        <Car className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span className="font-bold text-white tracking-wide truncate max-w-[110px] sm:max-w-[140px]">
          {currentVehicleStats.name}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-cyan-300 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1.5 w-64 sm:w-72 glass-panel-glow bg-slate-900/95 backdrop-blur-xl border border-cyan-500/40 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 text-white max-h-[calc(100vh-80px)] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1.5 border-b border-white/10 mb-1.5 flex items-center justify-between shrink-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
              Select Vehicle (Hot-Swap)
            </span>
            <span className="text-[9px] text-gray-400 font-mono">6 Rides</span>
          </div>

          <div
            className="flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y touch-scrollable custom-scrollbar pr-0.5"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {VEHICLE_LIST.map((vehicle) => {
              const isSelected = selectedVehicleId === vehicle.id;
              return (
                <button
                  key={vehicle.id}
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => handleSelect(vehicle.id, e)}
                  className={`w-full text-left p-2 rounded-xl transition-all flex items-center justify-between group/item border ${
                    isSelected
                      ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-sm'
                      : 'border-transparent hover:bg-white/10 hover:border-white/10 text-gray-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: vehicle.colorHex }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-xs text-white truncate">
                          {vehicle.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                        <span className="truncate">{vehicle.category}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5 text-cyan-300 font-mono">
                          <Gauge className="w-2.5 h-2.5" />
                          {vehicle.topSpeedKmh} km/h
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {isSelected ? (
                      <div className="w-5 h-5 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center font-bold shadow-sm">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    ) : (
                      <span className="text-[10px] text-cyan-400/60 opacity-0 group-hover/item:opacity-100 transition-opacity font-bold">
                        Swap
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
