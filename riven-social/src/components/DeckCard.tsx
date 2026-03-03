import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, SKINS, SPRINGS, type SkinName } from '../constants';
import { cormorant, inter } from '../fonts';

interface DeckCardProps {
  title: string;
  cardCount: number;
  tag?: string;
  skin?: SkinName;
  delay?: number;
  width?: number;
  height?: number;
}

export const DeckCard: React.FC<DeckCardProps> = ({
  title,
  cardCount,
  tag,
  skin = 'parchment',
  delay = 0,
  width = 280,
  height = 200,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const skinDef = SKINS[skin];

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: SPRINGS.snappy,
    from: 0,
    to: 1,
  });

  const translateY = (1 - entrance) * 40;
  const rotation = (1 - entrance) * (delay % 2 === 0 ? -0.8 : 0.8);

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: skinDef.bg,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        opacity: entrance,
        transform: `translateY(${translateY}px) rotate(${rotation}deg)`,
        boxShadow: `0 8px 24px ${COLORS.cardShadow}`,
      }}
    >
      {/* Top accent bar */}
      <div
        style={{
          height: 6,
          backgroundColor: skinDef.clip,
          width: '100%',
        }}
      />

      {/* Galaxy stars */}
      {skin === 'galaxy' &&
        Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: 2,
              height: 2,
              borderRadius: '50%',
              backgroundColor: '#fff',
              top: `${15 + Math.random() * 70}%`,
              left: `${5 + Math.random() * 90}%`,
              opacity: 0.4 + Math.sin((frame + i * 20) / 15) * 0.4,
            }}
          />
        ))}

      {/* Content */}
      <div style={{ padding: '20px 18px' }}>
        {tag && (
          <div
            style={{
              fontFamily: inter,
              fontSize: 11,
              fontWeight: 600,
              color: skinDef.clip,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              marginBottom: 8,
            }}
          >
            {tag}
          </div>
        )}
        <div
          style={{
            fontFamily: cormorant,
            fontSize: 22,
            fontWeight: 700,
            fontStyle: 'italic',
            color: skinDef.text,
            lineHeight: 1.2,
            marginBottom: 12,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: inter,
            fontSize: 13,
            color: skinDef.text,
            opacity: 0.6,
          }}
        >
          {cardCount} cards
        </div>
      </div>

      {/* Paper texture overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.01) 3px, rgba(0,0,0,0.01) 4px)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};
