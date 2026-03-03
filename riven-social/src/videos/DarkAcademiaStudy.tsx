import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import { COLORS, SPRINGS } from '../constants';
import {
  GrainOverlay,
  Logo,
  DeckCard,
  GardenGrow,
  CardFlip,
} from '../components';
import { cormorant, lora, inter } from '../fonts';

// 10s = 600 frames at 60fps
// Cinematic, slow pans across Riven's default botanical aesthetic
// Targets the studygram/dark academia community on TikTok
export const DarkAcademiaStudy: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* No text hook - pure aesthetic fade in (0-60 / 0-1s) */}
      <Sequence durationInFrames={60}>
        <AbsoluteFill
          style={{
            backgroundColor: COLORS.bg,
            opacity: interpolate(frame, [0, 60], [0, 1]),
          }}
        />
      </Sequence>

      {/* Shot 1: Serif typography showcase (60-180 / 1-3s) */}
      <Sequence from={60} durationInFrames={120}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: 80,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              transform: `translateY(${interpolate(frame - 60, [0, 120], [0, -10])}px)`,
            }}
          >
            <div
              style={{
                fontFamily: cormorant,
                fontSize: 16,
                fontWeight: 600,
                color: COLORS.accent,
                letterSpacing: 4,
                textTransform: 'uppercase',
                opacity: spring({
                  frame: frame - 70,
                  fps,
                  config: SPRINGS.smooth,
                  from: 0,
                  to: 0.8,
                }),
              }}
            >
              Study Collection
            </div>
            <div
              style={{
                fontFamily: cormorant,
                fontSize: 52,
                fontWeight: 700,
                fontStyle: 'italic',
                color: COLORS.text,
                lineHeight: 1.1,
                textAlign: 'center',
                opacity: spring({
                  frame: frame - 80,
                  fps,
                  config: SPRINGS.smooth,
                  from: 0,
                  to: 1,
                }),
              }}
            >
              Renaissance Art History
            </div>
            <div
              style={{
                width: 60,
                height: 1,
                backgroundColor: COLORS.accent,
                opacity: spring({
                  frame: frame - 90,
                  fps,
                  config: SPRINGS.smooth,
                  from: 0,
                  to: 0.6,
                }),
              }}
            />
            <div
              style={{
                fontFamily: lora,
                fontSize: 18,
                color: COLORS.textMuted,
                fontStyle: 'italic',
                opacity: spring({
                  frame: frame - 95,
                  fps,
                  config: SPRINGS.smooth,
                  from: 0,
                  to: 0.7,
                }),
              }}
            >
              47 specimens catalogued
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Shot 2: Parchment deck cards (180-300 / 3-5s) */}
      <Sequence from={180} durationInFrames={120}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            gap: 16,
            transform: `translateY(${interpolate(frame - 180, [0, 120], [0, -8])}px)`,
          }}
        >
          <div style={{ display: 'flex', gap: 16 }}>
            <DeckCard
              title="Art History"
              cardCount={47}
              skin="parchment"
              tag="ART 310"
              delay={0}
              width={260}
              height={190}
            />
            <DeckCard
              title="Philosophy"
              cardCount={32}
              skin="midnight"
              tag="PHIL 201"
              delay={10}
              width={260}
              height={190}
            />
          </div>
          <DeckCard
            title="World Literature"
            cardCount={56}
            skin="forest"
            tag="LIT 250"
            delay={20}
            width={400}
            height={190}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Shot 3: Slow card flip (300-420 / 5-7s) */}
      <Sequence from={300} durationInFrames={120}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            transform: `translateY(${interpolate(frame - 300, [0, 120], [0, -6])}px)`,
          }}
        >
          <CardFlip
            front="Who painted 'The Birth of Venus'?"
            back="Sandro Botticelli, c. 1485"
            flipAtFrame={50}
            width={580}
            height={360}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Shot 4: Garden with botanical vibe (420-480 / 7-8s) */}
      <Sequence from={420} durationInFrames={60}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <GardenGrow
            growthPercent={interpolate(frame - 420, [0, 55], [40, 90], {
              extrapolateRight: 'clamp',
            })}
            dayCount={14}
            size={300}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Shot 5: Minimal wordmark (480-600 / 8-10s) */}
      <Sequence from={480} durationInFrames={120}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontFamily: cormorant,
              fontSize: 72,
              fontWeight: 700,
              fontStyle: 'italic',
              color: COLORS.text,
              letterSpacing: 8,
              opacity: spring({
                frame: frame - 490,
                fps,
                config: SPRINGS.smooth,
                from: 0,
                to: 1,
              }),
            }}
          >
            riven.
          </div>
        </AbsoluteFill>
      </Sequence>

      <GrainOverlay opacity={0.12} />
    </AbsoluteFill>
  );
};
