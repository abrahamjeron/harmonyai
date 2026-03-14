'use client';

import { motion } from 'framer-motion';
import type { ChatMessage } from '@/types/stream';
import ThinkingBubble from './ThinkingBubble';
import StreamingText from './StreamingText';
import AgentStepBadgeList from './AgentStepBadge';
import AudioPlayer from '@/components/audio/AudioPlayer';
import GlassCard from '@/components/ui/GlassCard';

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end"
      >
        <div
          className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-3
            bg-white/8 border border-white/10 text-white/90 text-sm leading-7"
        >
          {message.text}
        </div>
      </motion.div>
    );
  }

  // Assistant bubble
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start"
    >
      {/* Avatar */}
      <div className="mr-3 mt-1 flex h-8 w-8 shrink-0 items-center justify-center
        rounded-full bg-linear-to-br from-violet-600 to-cyan-500 text-sm shadow-lg">
        🎵
      </div>

      <div className="flex flex-col gap-1 max-w-[85%]">
        {/* Agent step pills */}
        {message.agentSteps && message.agentSteps.length > 0 && (
          <AgentStepBadgeList steps={message.agentSteps} />
        )}

        {/* Thinking / content */}
        {message.isThinking && !message.text ? (
          <GlassCard className="px-4 py-3 inline-flex">
            <ThinkingBubble />
          </GlassCard>
        ) : (
          <GlassCard className="px-4 py-3">
            <StreamingText
              text={message.text}
              isStreaming={message.isStreaming ?? false}
            />
          </GlassCard>
        )}

        {/* Audio player */}
        {message.audioTracks && message.audioTracks.length > 0 && (
          <AudioPlayer tracks={message.audioTracks} />
        )}
      </div>
    </motion.div>
  );
}
