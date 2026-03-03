import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, SPRINGS } from '../constants';
import { cormorant, inter } from '../fonts';

interface TextRevealProps {
  lines: string[];
  staggerFrames?: number;
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
  color?: string;
  font?: 'serif' | 'sans';
  fontWeight?: number;
  delay?: number;
  italic?: boolean;
}

export const TextReveal: React.FC<TextRevealProps> = ({
  lines,
  staggerFrames = 8,
  fontSize = 48,
  align = 'center',
  color = COLORS.text,
  font = 'serif',
  fontWeight = 700,
  delay = 0,
  italic = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems:
          align === 'center'
            ? 'center'
            : align === 'right'
            ? 'flex-end'
            : 'flex-start',
        gap: fontSize * 0.3,
      }}
    >
      {lines.map((line, i) => {
        const lineDelay = delay + i * staggerFrames;
        const progress = spring({
          frame: frame - lineDelay,
          fps,
          config: SPRINGS.snappy,
          from: 0,
          to: 1,
        });

        return (
          <div
            key={i}
            style={{
              fontFamily: font === 'serif' ? cormorant : inter,
              fontSize,
              fontWeight,
              fontStyle: italic ? 'italic' : 'normal',
              color,
              opacity: progress,
              transform: `translateY(${(1 - progress) * 30}px)`,
              textAlign: align,
              lineHeight: 1.2,
            }}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
};
