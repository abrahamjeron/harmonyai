'use client';

import type { ChatMessage } from '@/types/stream';
import MessageList from './MessageList';
import InputBar from './InputBar';
import GradientOrbs from '@/components/ui/GradientOrbs';

interface ChatContainerProps {
  messages: ChatMessage[];
  onSend: (prompt: string) => void;
  isGenerating: boolean;
}

export default function ChatContainer({
  messages,
  onSend,
  isGenerating,
}: ChatContainerProps) {
  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-[#08080f]">
      {/* Ambient gradient background */}
      <GradientOrbs />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4
        border-b border-white/8 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl
            bg-linear-to-br from-violet-600 to-cyan-500 text-lg shadow-lg">
            🎼
          </div>
          <div>
            <h1 className="text-sm font-semibold bg-linear-to-r from-violet-300 via-cyan-300 to-pink-300
              bg-clip-text text-transparent leading-none">
              Harmony AI
            </h1>
            <p className="text-[11px] text-white/35 mt-0.5">Multi-agent music generation</p>
          </div>
        </div>

        {isGenerating && (
          <div className="flex items-center gap-2 rounded-full border border-violet-500/30
            bg-violet-500/10 px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-xs text-violet-300">Composing…</span>
          </div>
        )}
      </header>

      {/* Message feed */}
      <main className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
          <MessageList messages={messages} />
          <InputBar onSend={onSend} disabled={isGenerating} />
        </div>
      </main>
    </div>
  );
}
