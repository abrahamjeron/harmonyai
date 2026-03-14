'use client';

/**
 * ThinkingBubble — Gemini-style animated "thinking" indicator.
 * Three dots with a sliding gradient shimmer.
 */
export default function ThinkingBubble() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1" aria-label="Thinking…">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-2.5 w-2.5 rounded-full
            bg-linear-to-br from-violet-400 via-cyan-400 to-pink-400
            animate-thinking-dot"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </div>
  );
}
