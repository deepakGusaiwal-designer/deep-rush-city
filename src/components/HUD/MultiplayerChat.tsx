import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Smile } from 'lucide-react';
import { ChatMessage } from '../../game/multiplayer/MultiplayerTypes';
import { useGameStore } from '../../store/useGameStore';

interface MultiplayerChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onlineCount: number;
}

const QUICK_EMOTES = [
  '🚗 Meet at Plaza!',
  '🏁 Wanna race?',
  '🔥 Nice ride!',
  '🚨 Cops on me, need getaway!',
  '👋 Hey city!',
  '🚀 Watch my jetpack jump!',
];

export const MultiplayerChat: React.FC<MultiplayerChatProps> = ({
  messages,
  onSendMessage,
  onlineCount,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showEmotes, setShowEmotes] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);
  const prevNotificationsLengthRef = useRef(0);

  const notifications = useGameStore((s) => s.notifications);

  // Auto-scroll to bottom of messages when open
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Track incoming chat messages for unread red dot notification
  useEffect(() => {
    if (!isOpen) {
      if (messages.length > prevMessagesLengthRef.current) {
        const added = messages.length - prevMessagesLengthRef.current;
        setUnreadCount((prev) => prev + added);
        setHasUnread(true);
      }
    } else {
      setHasUnread(false);
      setUnreadCount(0);
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages.length, isOpen]);

  // Track incoming system notifications for unread red dot indicator
  useEffect(() => {
    if (!isOpen) {
      if (notifications.length > prevNotificationsLengthRef.current) {
        const added = notifications.length - prevNotificationsLengthRef.current;
        setUnreadCount((prev) => prev + added);
        setHasUnread(true);
      }
    }
    prevNotificationsLengthRef.current = notifications.length;
  }, [notifications.length, isOpen]);

  // Global 'Enter' key listener to open chat on desktop, 'Escape' to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const active = document.activeElement;
        const isInput = active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA';
        if (!isOpen && !isInput) {
          e.preventDefault();
          handleOpen();
        }
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
    setHasUnread(false);
    setUnreadCount(0);
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  const handleClose = () => {
    setIsOpen(false);
    setShowEmotes(false);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = inputText.trim();
    if (clean) {
      onSendMessage(clean);
      setInputText('');
    }
    inputRef.current?.focus();
  };

  const handleSendEmote = (emote: string) => {
    onSendMessage(emote);
    setShowEmotes(false);
  };

  // 1. Collapsed Floating Icon Mode (Completely removes screen congestion!)
  if (!isOpen) {
    return (
      <div className="fixed top-[62px] left-3 sm:left-4 z-40 pointer-events-auto select-none">
        <button
          type="button"
          tabIndex={-1}
          onClick={handleOpen}
          title="Open Chat & Radio (Press Enter)"
          className="relative group p-2.5 rounded-2xl border border-white/15 bg-slate-950/70 hover:bg-slate-900/90 hover:border-cyan-400/60 backdrop-blur-md shadow-lg shadow-black/50 hover:shadow-cyan-500/20 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        >
          <MessageSquare className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300 transition-colors drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />

          {/* Online green indicator dot */}
          {onlineCount > 0 && (
            <span
              title={`${onlineCount} player${onlineCount > 1 ? 's' : ''} online`}
              className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-slate-950 shadow-[0_0_6px_#34d399]"
            />
          )}

          {/* Glowing Red Dot Notification Badge for incoming messages/notifications */}
          {hasUnread && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-80" />
              {unreadCount > 1 ? (
                <span className="relative inline-flex items-center justify-center rounded-full h-4 min-w-4 px-1 bg-rose-500 text-[9px] font-black text-white ring-2 ring-slate-950 shadow-[0_0_10px_#f43f5e]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              ) : (
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 ring-2 ring-slate-950 shadow-[0_0_10px_#f43f5e]" />
              )}
            </span>
          )}
        </button>
      </div>
    );
  }

  // 2. Expanded Chat Dialog Mode
  return (
    <div className="fixed top-[62px] left-3 sm:left-4 z-40 pointer-events-auto select-none flex flex-col w-[290px] sm:w-[330px] animate-in fade-in zoom-in-95 duration-150">
      <div className="glass-panel rounded-2xl border border-cyan-500/35 bg-slate-950/92 backdrop-blur-xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden">
        {/* Header Bar */}
        <div className="px-3 py-2 bg-slate-900/60 border-b border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-cyan-500/20 text-cyan-300">
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold tracking-wide text-white">City Chat</span>
            <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-mono bg-emerald-950/50 px-1.5 py-0.5 rounded-full border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {onlineCount} {onlineCount === 1 ? 'online' : 'online'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowEmotes(!showEmotes)}
              title="Quick Phrases"
              className={`p-1.5 rounded-lg border transition-all text-xs cursor-pointer ${
                showEmotes
                  ? 'bg-amber-500/30 border-amber-400 text-amber-200'
                  : 'bg-slate-800/60 border-white/10 text-gray-300 hover:text-white'
              }`}
            >
              <Smile className="w-3.5 h-3.5 text-amber-400" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={handleClose}
              title="Close (Esc)"
              className="p-1.5 rounded-lg border border-white/10 bg-slate-800/60 text-gray-400 hover:text-white hover:bg-rose-500/20 hover:border-rose-400/40 transition-all cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quick Emote Picker Dropdown */}
        {showEmotes && (
          <div className="p-2 border-b border-white/10 bg-slate-900/90 flex flex-col gap-1 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="text-[9px] font-bold text-amber-300 uppercase tracking-wider px-1">
              Quick Phrases
            </div>
            <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto pr-0.5">
              {QUICK_EMOTES.map((emote, idx) => (
                <button
                  key={idx}
                  type="button"
                  tabIndex={-1}
                  onClick={() => handleSendEmote(emote)}
                  className="text-left text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-amber-500/20 text-gray-200 hover:text-white transition-all truncate cursor-pointer"
                >
                  {emote}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages scroll list */}
        <div className="h-52 sm:h-60 overflow-y-auto p-2.5 space-y-1.5 text-xs font-sans">
          {messages.length === 0 ? (
            <div className="text-gray-400 text-[11px] italic py-6 text-center">
              City radio is quiet. Send a message to chat!
            </div>
          ) : (
            messages.slice(-30).map((msg) => (
              <div
                key={msg.id}
                className={`break-words leading-snug rounded-xl px-2.5 py-1.5 ${
                  msg.isSystem
                    ? 'text-cyan-300/90 text-[11px] italic bg-cyan-950/40 border border-cyan-500/20'
                    : 'bg-white/5 text-gray-200 border border-white/5'
                }`}
              >
                {!msg.isSystem && (
                  <span className="font-bold text-amber-400 mr-1.5">{msg.senderName}:</span>
                )}
                <span>{msg.text}</span>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-1.5 p-2 bg-slate-900/60 border-t border-white/10"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Send message... (Enter)"
            maxLength={140}
            className="flex-1 bg-black/50 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 transition-all font-bold cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
