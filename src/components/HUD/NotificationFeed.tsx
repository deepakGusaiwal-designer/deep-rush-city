import React, { useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { DollarSign, Star, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { NotificationKind } from '../../types/game';

const STYLE: Record<NotificationKind, { border: string; icon: React.ReactNode }> = {
  info: { border: 'border-cyan-400/40', icon: <Info className="w-3.5 h-3.5 text-cyan-300" /> },
  cash: { border: 'border-emerald-400/50', icon: <DollarSign className="w-3.5 h-3.5 text-emerald-300" /> },
  wanted: { border: 'border-amber-400/60', icon: <Star className="w-3.5 h-3.5 text-amber-300 fill-amber-300" /> },
  danger: { border: 'border-rose-500/60', icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-300" /> },
  success: { border: 'border-emerald-400/60', icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> },
};

/** Phone-style toast stack; each message lives ~4.5s. */
export const NotificationFeed: React.FC = () => {
  const notifications = useGameStore((s) => s.notifications);
  const remove = useGameStore((s) => s.removeNotification);

  useEffect(() => {
    if (notifications.length === 0) return;
    const timers = notifications.map((n) => {
      const remaining = Math.max(200, 4500 - (Date.now() - n.createdAt));
      return setTimeout(() => remove(n.id), remaining);
    });
    return () => timers.forEach(clearTimeout);
  }, [notifications, remove]);

  if (notifications.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 pointer-events-none select-none max-w-[260px]">
      {notifications.map((n) => {
        const s = STYLE[n.kind];
        return (
          <div
            key={n.id}
            className={`glass-panel px-2 py-1 rounded-lg border ${s.border} flex items-center gap-1.5 shadow-sm animate-notif-in bg-slate-950/40 backdrop-blur-sm`}
          >
            <span className="shrink-0">{s.icon}</span>
            <span className="text-[10px] font-semibold text-white/90 leading-snug">{n.text}</span>
          </div>
        );
      })}
    </div>
  );
};
