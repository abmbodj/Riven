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
  TextReveal,
  DeckCard,
  GardenGrow,
  ScreenShake,
} from '../components';
import { cormorant, inter } from '../fonts';

// 10s = 600 frames at 60fps
export const QuizletWho: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* Scene 1: "quizlet in 2026:" - boring card (0-120 / 0-2s) */}
      <Sequence durationInFrames={120}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            gap: 30,
          }}
        >
          <TextReveal
            lines={['quizlet in 2026:']}
            fontSize={42}
            font="sans"
            color={COLORS.textMuted}
          />
          {/* Boring plain flashcard */}
          <div
            style={{
              width: 500,
              height: 300,
              backgroundColor: '#ffffff',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #e0e0e0',
              opacity: spring({
                frame: frame - 20,
                fps,
                config: SPRINGS.snappy,
                from: 0,
                to: 1,
              }),
            }}
          >
            <span
              style={{
                fontFamily: 'Arial, sans-serif',
                fontSize: 24,
                color: '#333',
              }}
            >
              What is photosynthesis?
            </span>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: Hard cut to Riven (120-240 / 2-4s) */}
      <Sequence from={120} durationInFrames={120}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            gap: 30,
          }}
        >
          <ScreenShake startFrame={0} intensity={12}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 30,
              }}
            >
              <TextReveal
                lines={['riven:']}
                fontSize={48}
                font="serif"
                italic
                color={COLORS.accent}
              />
              <DeckCard
                title="Photosynthesis"
                cardCount={32}
                skin="galaxy"
                tag="BIO 201"
                delay={8}
                width={500}
                height={300}
              />
            </div>
          </ScreenShake>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: Feature montage (240-480 / 4-8s) */}
      <Sequence from={240} durationInFrames={240}>
        <AbsoluteFill>
          {/* Garden */}
          <Sequence durationInFrames={60}>
            <AbsoluteFill
              style={{
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <GardenGrow
                growthPercent={interpolate(frame - 240, [0, 55], [20, 100], {
                  extrapolateRight: 'clamp',
                })}
                size={300}
              />
            </AbsoluteFill>
          </Sequence>

          {/* Group cram */}
          <Sequence from={60} durationInFrames={60}>
            <AbsoluteFill
              style={{
                justifyContent: 'center',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <GroupCramMini frame={frame - 300} fps={fps} />
            </AbsoluteFill>
          </Sequence>

          {/* Streaks + seeds */}
          <Sequence from={120} durationInFrames={60}>
            <AbsoluteFill
              style={{
                justifyContent: 'center',
                alignItems: 'center',
                gap: 20,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 36 }}>🔥</span>
                <span
                  style={{
                    fontFamily: cormorant,
                    fontSize: 64,
                    fontWeight: 700,
                    color: COLORS.accent,
                  }}
                >
                  14
                </span>
              </div>
              <span
                style={{
                  fontFamily: inter,
                  fontSize: 18,
                  color: COLORS.textMuted,
                }}
              >
                day streak
              </span>
            </AbsoluteFill>
          </Sequence>

          {/* Theme switching */}
          <Sequence from={180} durationInFrames={60}>
            <AbsoluteFill
              style={{
                justifyContent: 'center',
                alignItems: 'center',
                gap: 16,
                flexDirection: 'row',
              }}
            >
              <DeckCard title="Organic Chem" cardCount={47} skin="forest" delay={0} width={220} height={160} />
              <DeckCard title="Astrophysics" cardCount={41} skin="midnight" delay={6} width={220} height={160} />
              <DeckCard title="Art History" cardCount={28} skin="cherry" delay={12} width={220} height={160} />
            </AbsoluteFill>
          </Sequence>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 4: CTA (480-600 / 8-10s) */}
      <Sequence from={480} durationInFrames={120}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            gap: 30,
          }}
        >
          <TextReveal
            lines={['upgrade your', 'study game']}
            fontSize={56}
            italic
            staggerFrames={10}
          />
          <Logo showWordmark={false} delay={30} />
        </AbsoluteFill>
      </Sequence>

      <GrainOverlay />
    </AbsoluteFill>
  );
};

// Mini group cram display
const GroupCramMini: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const users = [
    { name: 'Alex', progress: 78, color: '#4f46e5' },
    { name: 'Sam', progress: 65, color: '#dc2626' },
    { name: 'Jordan', progress: 82, color: '#16a34a' },
    { name: 'Riley', progress: 55, color: '#ca8a04' },
  ];

  return (
    <div
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 24,
        width: 500,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div
        style={{
          fontFamily: cormorant,
          fontSize: 20,
          fontWeight: 700,
          fontStyle: 'italic',
          color: COLORS.text,
        }}
      >
        Group Cram Session
      </div>
      {users.map((u, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              backgroundColor: u.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: inter,
              fontSize: 12,
              fontWeight: 700,
              color: '#fff',
            }}
          >
            {u.name[0]}
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                height: 6,
                backgroundColor: `${COLORS.text}15`,
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${spring({
                    frame: frame - i * 8,
                    fps,
                    config: SPRINGS.smooth,
                    from: 0,
                    to: u.progress,
                  })}%`,
                  height: '100%',
                  backgroundColor: u.color,
                  borderRadius: 3,
                }}
              />
            </div>
          </div>
          <span
            style={{
              fontFamily: inter,
              fontSize: 12,
              color: COLORS.textMuted,
              width: 36,
              textAlign: 'right',
            }}
          >
            {Math.round(
              spring({
                frame: frame - i * 8,
                fps,
                config: SPRINGS.smooth,
                from: 0,
                to: u.progress,
              })
            )}
            %
          </span>
        </div>
      ))}
    </div>
  );
};
