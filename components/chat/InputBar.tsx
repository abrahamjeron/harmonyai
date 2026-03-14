'use client';

import { useState, useRef, KeyboardEvent } from 'react';

interface InputBarProps {
  onSend: (prompt: string) => void;
  disabled?: boolean;
}

export default function InputBar({ onSend, disabled }: InputBarProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  return (
    <div className="px-4 pb-6 pt-2">
      <div
        className={`relative flex items-end gap-2 rounded-2xl border px-4 py-3
          bg-white/5 backdrop-blur-xl transition-all duration-200
          ${disabled
            ? 'border-white/8 opacity-60'
            : 'border-white/15 focus-within:border-violet-500/60 focus-within:shadow-[0_0_0_2px_rgba(139,92,246,0.25)]'
          }`}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Describe the song you want to create…"
          className="flex-1 resize-none bg-transparent text-sm text-white/90
            placeholder:text-white/30 outline-none leading-6 max-h-44"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          aria-label="Send"
          className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl
            bg-linear-to-br from-violet-500 to-cyan-500 text-white
            transition-all duration-200
            disabled:opacity-30 disabled:cursor-not-allowed
            hover:enabled:scale-105 hover:enabled:shadow-[0_0_12px_rgba(139,92,246,0.5)]"
        >
          {disabled ? (
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </div>
      <p className="mt-2 text-center text-[11px] text-white/20">
        Press <kbd className="font-mono">Enter</kbd> to send · <kbd className="font-mono">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
}
