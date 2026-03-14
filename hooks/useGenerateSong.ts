'use client';

import { useState, useCallback, useRef } from 'react';
import type { ChatMessage, StreamEvent, AgentStep, AudioTrack, AgentName } from '@/types/stream';

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export function useGenerateSong() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const updateAssistantMsg = useCallback(
    (id: string, updater: (prev: ChatMessage) => ChatMessage) => {
      setMessages((msgs) =>
        msgs.map((m) => (m.id === id ? updater(m) : m))
      );
    },
    []
  );

  const sendMessage = useCallback(
    async (prompt: string) => {
      if (isGenerating) return;

      // 1. Append user message
      const userMsg: ChatMessage = {
        id: makeId(),
        role: 'user',
        text: prompt,
        timestamp: Date.now(),
      };

      // 2. Create empty assistant placeholder
      const asstId = makeId();
      const asstMsg: ChatMessage = {
        id: asstId,
        role: 'assistant',
        text: '',
        isThinking: true,
        isStreaming: false,
        agentSteps: [],
        audioTracks: [],
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg, asstMsg]);
      setIsGenerating(true);

      abortRef.current = new AbortController();

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (!res.body) throw new Error('No response body');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() ?? '';

          for (const chunk of lines) {
            const line = chunk.replace(/^data:\s?/, '').trim();
            if (!line) continue;

            let event: StreamEvent;
            try { event = JSON.parse(line); } catch { continue; }

            switch (event.type) {
              case 'thinking':
                updateAssistantMsg(asstId, (m) => ({
                  ...m,
                  isThinking: true,
                }));
                break;

              case 'agent_step':
                updateAssistantMsg(asstId, (m) => {
                  const existing = m.agentSteps ?? [];
                  const idx = existing.findIndex((s) => s.agent === (event as { agent: AgentName }).agent);
                  const newStep: AgentStep = {
                    agent: (event as { agent: AgentName }).agent,
                    status: (event as { status: 'active' | 'done' }).status,
                  };
                  if (idx === -1) return { ...m, agentSteps: [...existing, newStep] };
                  const updated = [...existing];
                  updated[idx] = newStep;
                  return { ...m, agentSteps: updated };
                });
                break;

              case 'text_delta':
                updateAssistantMsg(asstId, (m) => ({
                  ...m,
                  isThinking: false,
                  isStreaming: true,
                  text: m.text + (event as { text: string }).text,
                }));
                break;

              case 'audio_ready':
                updateAssistantMsg(asstId, (m) => {
                  const ev = event as { section: AudioTrack['section']; url: string; duration?: number };
                  const existing = m.audioTracks ?? [];
                  if (existing.some((t) => t.section === ev.section)) return m;
                  return {
                    ...m,
                    audioTracks: [
                      ...existing,
                      { section: ev.section, url: ev.url, duration: ev.duration },
                    ],
                  };
                });
                break;

              case 'done':
                updateAssistantMsg(asstId, (m) => ({
                  ...m,
                  isStreaming: false,
                  isThinking: false,
                }));
                break;

              case 'error':
                updateAssistantMsg(asstId, (m) => ({
                  ...m,
                  isStreaming: false,
                  isThinking: false,
                  text: m.text || `⚠️ ${(event as { message: string }).message}`,
                }));
                break;
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          updateAssistantMsg(asstId, (m) => ({
            ...m,
            isStreaming: false,
            isThinking: false,
            text: m.text || `⚠️ Connection error. Please try again.`,
          }));
        }
      } finally {
        setIsGenerating(false);
      }
    },
    [isGenerating, updateAssistantMsg]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
  }, []);

  return { messages, isGenerating, sendMessage, stop };
}
