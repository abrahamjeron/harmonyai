'use client';

import { useEffect, useRef, useState } from 'react';

interface StreamingTextProps {
  text: string;
  isStreaming: boolean;
}

/**
 * StreamingText — renders markdown-ish text with a blinking cursor while streaming.
 * Bold **text** and section headers are lightly styled.
 */
export default function StreamingText({ text, isStreaming }: StreamingTextProps) {
  const [displayed, setDisplayed] = useState('');
  const prevRef = useRef('');

  // When new text arrives, display it immediately (parent drives the text state)
  useEffect(() => {
    setDisplayed(text);
    prevRef.current = text;
  }, [text]);

  // Render very basic markdown: **bold** and lines starting with # as headers
  const renderLine = (line: string, idx: number) => {
    const boldified = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    if (line.startsWith('# ')) {
      return (
        <h2
          key={idx}
          className="mt-4 mb-1 text-lg font-semibold text-white/90"
          dangerouslySetInnerHTML={{ __html: boldified.slice(2) }}
        />
      );
    }
    if (line.startsWith('## ')) {
      return (
        <h3
          key={idx}
          className="mt-3 mb-0.5 text-base font-semibold text-violet-300"
          dangerouslySetInnerHTML={{ __html: boldified.slice(3) }}
        />
      );
    }
    if (line === '') return <br key={idx} />;
    return (
      <p
        key={idx}
        className="leading-7 text-white/80"
        dangerouslySetInnerHTML={{ __html: boldified }}
      />
    );
  };

  const lines = displayed.split('\n');

  return (
    <div className="space-y-0.5 text-sm">
      {lines.map((line, idx) => renderLine(line, idx))}
      {isStreaming && (
        <span className="inline-block w-0.5 h-4 bg-violet-400 animate-blink align-middle ml-0.5" />
      )}
    </div>
  );
}
