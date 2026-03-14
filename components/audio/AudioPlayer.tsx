'use client';

import { useRef, useEffect, useState } from 'react';
import type { AudioTrack } from '@/types/stream';
import GlassCard from '@/components/ui/GlassCard';

interface AudioPlayerProps {
  tracks: AudioTrack[];
}

const SECTION_LABELS: Record<string, string> = {
  full:   '🎵 Full Song',
  verse:  'Verse',
  chorus: 'Chorus',
  bridge: 'Bridge',
};

export default function AudioPlayer({ tracks }: AudioPlayerProps) {
  const [active, setActive] = useState<string>('full');
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Pick the best default tab
  useEffect(() => {
    if (tracks.some((t) => t.section === 'full')) setActive('full');
    else if (tracks.length > 0) setActive(tracks[0].section);
  }, [tracks]);

  const currentTrack = tracks.find((t) => t.section === active);

  // Reset when track changes
  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [active]);

  const handleTimeUpdate = () => {
    const el = audioRef.current;
    if (!el) return;
    setProgress(el.currentTime);
    setDuration(el.duration || 0);
  };

  const handleToggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) { el.pause(); setIsPlaying(false); }
    else           { el.play(); setIsPlaying(true); }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Number(e.target.value);
    setProgress(Number(e.target.value));
  };

  const handleDownload = async () => {
    if (!currentTrack) return;
    try {
      const response = await fetch(currentTrack.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentTrack.section}.mp3`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  if (tracks.length === 0) return null;

  return (
    <GlassCard className="mt-4 p-4 w-full max-w-lg">
      {/* Section tabs */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {/* Full song tab first */}
        {(['full', 'verse', 'chorus', 'bridge'] as const).map((sec) => {
          const exists = tracks.some((t) => t.section === sec);
          if (!exists) return null;
          return (
            <button
              key={sec}
              onClick={() => setActive(sec)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all
                ${active === sec
                  ? 'bg-violet-600 text-white shadow-[0_0_10px_rgba(139,92,246,0.5)]'
                  : 'bg-white/8 text-white/50 hover:bg-white/15 hover:text-white/80'
                }`}
            >
              {SECTION_LABELS[sec]}
            </button>
          );
        })}
      </div>

      {/* Hidden audio element */}
      {currentTrack && (
        <audio
          ref={audioRef}
          src={currentTrack.url}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
          preload="metadata"
        />
      )}

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleToggle}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full
            bg-linear-to-br from-violet-500 to-cyan-500
            shadow-[0_0_16px_rgba(139,92,246,0.5)] hover:scale-105 transition-transform"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="h-4 w-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5.14v14l11-7-11-7z" />
            </svg>
          )}
        </button>

        {/* Seek bar */}
        <div className="flex-1 flex flex-col gap-1">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={progress}
            onChange={handleSeek}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full
              bg-white/15 accent-violet-500 hover:accent-violet-400 transition-colors"
          />
          <div className="flex justify-between text-[10px] text-white/40 font-mono">
            <span>{fmt(progress)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>

        {/* Download button */}
        <button
          onClick={handleDownload}
          disabled={!currentTrack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full
            bg-white/10 text-white/60 hover:bg-white/20 hover:text-white/80 
            disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          aria-label="Download as MP3"
          title="Download as MP3"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
      </div>
    </GlassCard>
  );
}
