'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { AgentStep } from '@/types/stream';

const AGENT_LABELS: Record<string, string> = {
  HarmonyAI:     '🎼 HarmonyAI',
  VerseCreator:  '✍️  Verse',
  ChorusCreator: '🎵 Chorus',
  BridgeCreator: '🌉 Bridge',
  Orchestrator:  '🎚️  Mix',
};

interface AgentStepBadgeListProps {
  steps: AgentStep[];
}

export default function AgentStepBadgeList({ steps }: AgentStepBadgeListProps) {
  if (steps.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-3">
      <AnimatePresence initial={false}>
        {steps.map((step) => (
          <motion.span
            key={step.agent}
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: step.status === 'done' ? 0.45 : 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium
              border transition-all duration-300
              ${step.status === 'active'
                ? 'border-violet-500/60 bg-violet-500/15 text-violet-300 shadow-[0_0_8px_rgba(139,92,246,0.4)]'
                : 'border-white/10 bg-white/5 text-white/40'
              }`}
          >
            {AGENT_LABELS[step.agent] ?? step.agent}
            {step.status === 'active' && (
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
            )}
            {step.status === 'done' && (
              <span className="text-emerald-400">✓</span>
            )}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}
