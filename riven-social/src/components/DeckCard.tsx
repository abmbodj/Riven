import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { SKINS, type SkinName, COLORS } from '../constants';
import { FONTS } from '../fonts';

type DeckCardProps = {
  title: string;
  cardCount: number;
  tag?: string;
  skin: SkinName;
  animateIn?: boolean;
  delay?: number;
};

export const DeckCard: React.FC<DeckCardProps> = ({
  title,
  cardCount,
  tag,
  skin,
  animateIn = true,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const skinDef = SKINS[skin];

  const entrance = animateIn
    ? spring({ frame, fps, delay, config: { damping: 14, stiffness: 120 } })
    : 1;

  const translateY = interpolate(entrance, [0, 1], [120, 0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  return (
    <div
      style={{
        width: 360,
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: `0 20px 60px ${COLORS.cardShadow}`,
        transform: `translateY(${translateY}px)`,
        opacity,
      }}
    >
      {/* Clip / top accent bar */}
      <div
        style={{
          height: 14,
          backgroundColor: skinDef.clip,
          borderRadius: '20px 20px 0 0',
        }}
      />

      {/* Card body */}
      <div
        style={{
          backgroundColor: skinDef.bg,
          padding: '36px 28px 28px',
          position: 'relative',
        }}
      >
        {tag && (
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: skinDef.clip,
              marginBottom: 10,
            }}
          >
            {tag}
          </div>
        )}

        <div
          style={{
            fontFamily: FONTS.serif,
            fontSize: 28,
            fontWeight: 700,
            color: skinDef.text,
            lineHeight: 1.3,
            marginBottom: 16,
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 15,
            color: skinDef.text,
            opacity: 0.6,
          }}
        >
          {cardCount} cards
        </div>

        {/* Galaxy skin — star particles */}
        {skin === 'galaxy' && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            {Array.from({ length: 12 }).map((_, i) => {
              const twinkle = interpolate(
                Math.sin((frame + i * 20) * 0.05),
                [-1, 1],
                [0.2, 0.9]
              );
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    width: 3,
                    height: 3,
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    opacity: twinkle,
                    top: `${10 + (i * 37) % 80}%`,
                    left: `${5 + (i * 53) % 90}%`,
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
