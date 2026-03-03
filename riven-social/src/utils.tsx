import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
} from 'remotion';
import { COLORS } from './constants';

/* ═══════════════════════════════════════════════
   Spring Configs (Remotion best practices)
   ═══════════════════════════════════════════════ */
export const SPRING = {
  smooth: { damping: 200 },
  snappy: { damping: 20, stiffness: 200 },
  bouncy: { damping: 8 },
  heavy: { damping: 15, stiffness: 80, mass: 2 },
} as const;

/* ═══════════════════════════════════════════════
   Typewriter text animation
   ═══════════════════════════════════════════════ */

/** Returns a slice of `text` based on elapsed frames and typing speed. */
export const getTypedText = (
  text: string,
  frame: number,
  fps: number,
  charsPerSecond = 25,
): string => {
  const chars = Math.floor((frame / fps) * charsPerSecond);
  return text.slice(0, Math.min(chars, text.length));
};

/** True once the typewriter has revealed the full string. */
export const isTypingDone = (
  text: string,
  frame: number,
  fps: number,
  charsPerSecond = 25,
): boolean => getTypedText(text, frame, fps, charsPerSecond).length >= text.length;

/** Frame at which typing finishes (useful for delay calculations). */
export const typingEndFrame = (
  text: string,
  fps: number,
  charsPerSecond = 25,
): number => Math.ceil((text.length / charsPerSecond) * fps);

/* ═══════════════════════════════════════════════
   Blinking cursor component
   ═══════════════════════════════════════════════ */
export const Cursor: React.FC<{ show: boolean }> = ({ show }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!show) return null;
  const blink = Math.floor(frame / (fps * 0.4)) % 2;
  return (
    <span
      style={{
        opacity: blink === 0 ? 1 : 0,
        color: COLORS.accent,
        fontWeight: 300,
        marginLeft: 2,
      }}
    >
      |
    </span>
  );
};

/* ═══════════════════════════════════════════════
   Word-highlight component
   Animated underline wipe using spring + scaleX
   ═══════════════════════════════════════════════ */
export const Highlight: React.FC<{
  children: string;
  color?: string;
  delay?: number;
}> = ({ children, color = COLORS.accent, delay = 10 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    delay,
    config: SPRING.smooth,
    durationInFrames: 25,
  });

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      {children}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: -6,
          right: -6,
          height: '35%',
          backgroundColor: color,
          borderRadius: 4,
          transform: `scaleX(${progress})`,
          transformOrigin: 'left center',
          opacity: 0.45,
          zIndex: -1,
        }}
      />
    </span>
  );
};
