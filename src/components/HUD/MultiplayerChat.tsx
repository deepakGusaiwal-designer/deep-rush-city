import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Smile, Sparkles } from 'lucide-react';
import { ChatMessage } from '../../game/multiplayer/MultiplayerTypes';

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
  '🚀 Watch my jetpack jump!'
];

export const MultiplayerChat: React.FC<MultiplayerChatProps> = ({
  messages,
  onSendMessage,
  onlineCount,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showEmotes, setShowEmotes] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // Global 'Enter' key listener to open chat on desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const active = document.activeElement;
        const isInput = active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA';
        if (!isOpen && !isInput) {
          e.preventDefault();
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = inputText.trim();
    if (clean) {
      onSendMessage(clean);
      setInputText('');
    }
    inputRef.current?.blur();
  };

  const handleSendEmote = (emote: string) => {
    onSendMessage(emote);
    setShowEmotes(false);
  };

  return (
    <div className="fixed top-14 left-3 z-30 pointer-events-auto flex flex-col items-start gap-1.5 max-w-[280px] sm:max-w-xs select-none">
      {/* Chat toggle button & online pill */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className={`glass-panel px-2 py-1 rounded-xl border flex items-center gap-1.5 transition-all text-[11px] font-bold shadow-sm bg-slate-950/35 backdrop-blur-sm ${
            isOpen
              ? 'border-cyan-400/60 bg-cyan-950/40 text-cyan-300'
              : 'border-white/10 text-gray-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <MessageSquare className="w-3 h-3 text-cyan-400" />
          <span className="hidden sm:inline">Chat</span>
          <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-mono bg-emerald-950/40 px-1.5 py-0.5 rounded-full border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {onlineCount} {onlineCount === 1 ? 'player' : 'players'}
          </span>
        </button>

        {isOpen && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowEmotes(!showEmotes)}
            title="Quick Phrases"
            className={`p-1.5 rounded-xl border transition-all text-xs ${
              showEmotes
                ? 'bg-amber-500/30 border-amber-400 text-amber-200'
                : 'bg-slate-900/60 border-white/10 text-gray-300 hover:text-white'
            }`}
          >
            <Smile className="w-3.5 h-3.5 text-amber-400" />
          </button>
        )}
      </div>

      {/* Quick Emote Picker Dropdown */}
      {isOpen && showEmotes && (
        <div className="glass-panel p-2 rounded-xl border border-amber-500/40 bg-slate-950/90 shadow-xl flex flex-col gap-1 w-full animate-in fade-in zoom-in-95 duration-150">
          <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wider px-1">
            Quick Phrases
          </div>
          <div className="grid grid-cols-1 gap-1">
            {QUICK_EMOTES.map((emote, idx) => (
              <button
                key={idx}
                type="button"
                tabIndex={-1}
                onClick={() => handleSendEmote(emote)}
                className="text-left text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-amber-500/20 text-gray-200 hover:text-white transition-all"
              >
                {emote}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Messages Panel */}
      <div
        className={`glass-panel w-full rounded-2xl border border-white/10 bg-slate-950/80 p-2.5 flex flex-col gap-2 transition-all duration-200 shadow-2xl ${
          isOpen
            ? 'h-48 sm:h-56 opacity-100 scale-100'
            : 'h-auto max-h-24 opacity-75 hover:opacity-100 border-transparent bg-slate-950/40'
        }`}
      >
        {/* Messages scroll list */}
        <div className="flex-1 overflow-y-auto space-y-1.5 text-xs pr-1 font-sans">
          {messages.length === 0 ? (
            <div className="text-gray-400 text-[11px] italic py-2">
              City radio quiet. Say hi with Enter or tap chat!
            </div>
          ) : (
            messages.slice(-18).map((msg) => (
              <div
                key={msg.id}
                className={`break-words leading-snug rounded-lg px-2 py-1 ${
                  msg.isSystem
                    ? 'text-cyan-300/90 text-[11px] italic bg-cyan-950/30 border border-cyan-500/20'
                    : 'bg-white/5 text-gray-200'
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
        {isOpen && (
          <form onSubmit={handleSubmit} className="flex items-center gap-1 mt-auto pt-1 border-t border-white/10">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Send message..."
              maxLength={140}
              className="flex-1 bg-black/40 border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 transition-all font-bold"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
