import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS } from '../constants';
import { cormorant, inter } from '../fonts';

interface TypewriterTextProps {
  text: string;
  charsPerSecond?: number;
  fontSize?: number;
  color?: string;
  font?: 'serif' | 'sans';
  fontWeight?: number;
  delay?: number;
  showCursor?: boolean;
  align?: 'left' | 'center' | 'right';
}

export const TypewriterText: React.FC<TypewriterTextProps> = ({
  text,
  charsPerSecond = 30,
  fontSize = 48,
  color = COLORS.text,
  font = 'serif',
  fontWeight = 700,
  delay = 0,
  showCursor = true,
  align = 'center',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const adjustedFrame = Math.max(0, frame - delay);
  const charsToShow = Math.floor((adjustedFrame / fps) * charsPerSecond);
  const displayedText = text.slice(0, Math.min(charsToShow, text.length));
  const isDone = charsToShow >= text.length;
  const cursorVisible = showCursor && (!isDone || Math.floor(frame / 20) % 2 === 0);

  return (
    <div
      style={{
        fontFamily: font === 'serif' ? cormorant : inter,
        fontSize,
        fontWeight,
        color,
        textAlign: align,
        lineHeight: 1.3,
      }}
    >
      {displayedText}
      {cursorVisible && (
        <span
          style={{
            color: COLORS.accent,
            fontWeight: 300,
            opacity: isDone ? (Math.floor(frame / 20) % 2 === 0 ? 1 : 0) : 1,
          }}
        >
          |
        </span>
      )}
    </div>
  );
};

// Utility functions
export const getTypedText = (
  text: string,
  frame: number,
  fps: number,
  charsPerSecond = 30
) => {
  const chars = Math.floor((frame / fps) * charsPerSecond);
  return text.slice(0, Math.min(chars, text.length));
};

export const isTypingDone = (
  text: string,
  frame: number,
  fps: number,
  charsPerSecond = 30
) => {
  const chars = Math.floor((frame / fps) * charsPerSecond);
  return chars >= text.length;
};

export const typingEndFrame = (
  text: string,
  fps: number,
  charsPerSecond = 30
) => {
  return Math.ceil((text.length / charsPerSecond) * fps);
};
