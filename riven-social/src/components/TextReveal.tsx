import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { COLORS } from '../constants';
import { FONTS } from '../fonts';

type TextRevealProps = {
  lines: string[];
  staggerFrames?: number;
  fontSize?: number;
  align?: 'left' | 'center';
};

export const TextReveal: React.FC<TextRevealProps> = ({
  lines,
  staggerFrames = 20,
  fontSize = 48,
  align = 'center',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'center' ? 'center' : 'flex-start',
        gap: 16,
      }}
    >
      {lines.map((line, i) => {
        const lineDelay = i * staggerFrames;
        const entrance = spring({
          frame: frame - lineDelay,
          fps,
          config: { damping: 16, stiffness: 100 },
        });

        const translateY = interpolate(entrance, [0, 1], [40, 0]);
        const opacity = interpolate(entrance, [0, 1], [0, 1]);

        return (
          <div
            key={i}
            style={{
              fontFamily: FONTS.serif,
              fontSize,
              fontWeight: 700,
              color: COLORS.text,
              opacity,
              transform: `translateY(${translateY}px)`,
              textAlign: align,
              lineHeight: 1.3,
            }}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
};
