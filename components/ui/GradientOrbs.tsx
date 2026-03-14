'use client';

/**
 * GradientOrb — ambient background blobs that float slowly.
 * Two instances are used: one purple-left, one teal-right.
 */
export default function GradientOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {/* Purple orb — top-left */}
      <div
        className="absolute -top-40 -left-40 h-150 w-150 rounded-full
          bg-violet-600/25 blur-3xl animate-orb-1"
      />
      {/* Teal orb — bottom-right */}
      <div
        className="absolute -bottom-48 -right-40 h-175 w-175 rounded-full
          bg-cyan-500/20 blur-3xl animate-orb-2"
      />
      {/* Pink accent — top-right, subtle */}
      <div
        className="absolute top-10 right-0 h-87.5 w-87.5 rounded-full
          bg-pink-500/10 blur-3xl animate-orb-3"
      />
    </div>
  );
}
