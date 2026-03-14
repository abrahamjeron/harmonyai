'use client';

import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@/types/stream';
import MessageBubble from './MessageBubble';

interface MessageListProps {
  messages: ChatMessage[];
}

export default function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages / updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-4">
        <div className="text-5xl">🎶</div>
        <h2 className="text-2xl font-semibold bg-linear-to-r from-violet-400 via-cyan-400 to-pink-400
          bg-clip-text text-transparent">
          What song shall we create?
        </h2>
        <p className="text-white/40 text-sm max-w-xs leading-6">
          Describe a mood, theme, or story and Harmony AI will compose a full song —
          verse, chorus, bridge, and a mixed audio file.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 scroll-smooth">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
