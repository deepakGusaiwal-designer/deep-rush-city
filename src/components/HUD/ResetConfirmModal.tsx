import React, { useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { RotateCcw, X, AlertTriangle, ShieldCheck, MapPin } from 'lucide-react';

interface ResetConfirmModalProps {
  onConfirm: () => void;
  onCancel?: () => void;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({ onConfirm, onCancel }) => {
  const isOpen = useGameStore((state) => state.isResetConfirmOpen);
  const setOpen = useGameStore((state) => state.setResetConfirmOpen);

  const handleClose = () => {
    setOpen(false);
    onCancel?.();
  };

  const handleConfirm = () => {
    setOpen(false);
    onConfirm();
  };

  // Keyboard shortcut listener: [Enter] or [R] to confirm, [Escape] to cancel
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in chat input
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      } else if (e.key === 'Enter' || e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        e.stopPropagation();
        handleConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 pointer-events-auto select-none"
      onClick={handleClose}
    >
      <div
        className="glass-panel-glow relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-rose-500/30 text-white bg-slate-950/90 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Gradient Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500" />

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shadow-lg shadow-rose-500/20 shrink-0">
              <RotateCcw className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black tracking-widest text-rose-400 uppercase bg-rose-500/15 px-2 py-0.5 rounded-full border border-rose-500/20">
                  Confirmation
                </span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  [R]
                </span>
              </div>
              <h2 className="text-xl font-black text-white mt-0.5 tracking-tight">
                Reset Game & Vehicle?
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            title="Cancel (Esc)"
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors border border-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-3 space-y-4">
          <p className="text-sm text-gray-300 leading-relaxed">
            Are you sure you want to reset? This will instantly repair your vehicle, clear wanted heat, and return you to the downtown boulevard starting point.
          </p>

          {/* Action Highlights Card */}
          <div className="rounded-2xl bg-black/40 border border-white/10 p-3.5 space-y-2.5 text-xs">
            <div className="flex items-center gap-2.5 text-gray-200">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <span>Vehicle repaired to 100% health & restored to boulevard</span>
            </div>

            <div className="flex items-center gap-2.5 text-gray-200">
              <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <span>Hero positioned cleanly at ground level (<code className="text-cyan-300 font-mono text-[11px]">Y = 0.00m</code>)</span>
            </div>

            <div className="flex items-center gap-2.5 text-gray-200">
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <span>Police pursuit & wanted stars immediately cleared</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-900/60 border-t border-white/10 mt-1">
          {/* Cancel Button */}
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 transition-all flex items-center gap-1.5 active:scale-95"
          >
            <span>Cancel</span>
            <kbd className="hidden sm:inline px-1 py-0.5 rounded bg-black/40 text-[9px] font-mono text-gray-400 border border-white/10">
              Esc
            </kbd>
          </button>

          {/* Confirm Reset Button */}
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-lg shadow-rose-600/30 border border-rose-400/50 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Yes, Reset Game</span>
            <kbd className="hidden sm:inline px-1.5 py-0.5 rounded bg-black/30 text-[9px] font-mono text-white/80 border border-white/20">
              Enter / R
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
};
