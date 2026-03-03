import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import { COLORS, SPRINGS, VIDEO } from '../constants';
import {
  GrainOverlay,
  Logo,
  TextReveal,
  DeckCard,
  GardenGrow,
  CardFlip,
  ScreenShake,
} from '../components';
import { cormorant, inter } from '../fonts';

// 15s = 900 frames at 60fps
export const NobodyTalkingAbout: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* Scene 1: Hook text (0-120 frames / 0-2s) */}
      <Sequence durationInFrames={120}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: 60,
          }}
        >
          <ScreenShake startFrame={5} intensity={6}>
            <TextReveal
              lines={['why is nobody', 'talking about', 'this study app']}
              fontSize={64}
              staggerFrames={10}
              font="serif"
              italic
            />
          </ScreenShake>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: Montage of Riven screens (120-600 frames / 2-10s) */}
      <Sequence from={120} durationInFrames={480}>
        <AbsoluteFill>
          {/* Shot 1: Deck cards spread (120-210) */}
          <Sequence durationInFrames={100}>
            <AbsoluteFill
              style={{
                justifyContent: 'center',
                alignItems: 'center',
                gap: 16,
                flexDirection: 'row',
                flexWrap: 'wrap',
                padding: 80,
              }}
            >
              <DeckCard title="Organic Chemistry" cardCount={47} skin="forest" tag="CHEM 201" delay={0} />
              <DeckCard title="Art History" cardCount={32} skin="parchment" tag="ART 110" delay={8} />
              <DeckCard title="Linear Algebra" cardCount={56} skin="midnight" tag="MATH 340" delay={16} />
              <DeckCard title="Anatomy" cardCount={89} skin="cherry" tag="BIO 220" delay={24} />
              <DeckCard title="Astrophysics" cardCount={41} skin="galaxy" tag="PHYS 301" delay={32} />
              <DeckCard title="World Literature" cardCount={28} skin="electric" tag="LIT 250" delay={40} />
            </AbsoluteFill>
          </Sequence>

          {/* Shot 2: Garden growing (210-310) */}
          <Sequence from={100} durationInFrames={100}>
            <AbsoluteFill
              style={{
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <GardenGrow
                growthPercent={interpolate(frame - 220, [0, 90], [0, 100], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                })}
                dayCount={Math.min(30, Math.floor((frame - 220) / 3))}
                size={400}
              />
            </AbsoluteFill>
          </Sequence>

          {/* Shot 3: Card flip with galaxy skin (310-400) */}
          <Sequence from={200} durationInFrames={90}>
            <AbsoluteFill
              style={{
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <CardFlip
                front="What is the powerhouse of the cell?"
                back="Mitochondria"
                flipAtFrame={30}
                width={600}
                height={380}
              />
            </AbsoluteFill>
          </Sequence>

          {/* Shot 4: Timetable mockup (400-480) */}
          <Sequence from={290} durationInFrames={90}>
            <AbsoluteFill
              style={{
                justifyContent: 'center',
                alignItems: 'center',
                padding: 60,
              }}
            >
              <TimetableMockup frame={frame - 410} fps={fps} />
            </AbsoluteFill>
          </Sequence>

          {/* Shot 5: Theme colors shifting (380-480) */}
          <Sequence from={380} durationInFrames={100}>
            <AbsoluteFill
              style={{
                justifyContent: 'center',
                alignItems: 'center',
                gap: 20,
              }}
            >
              <DeckCard title="Aesthetics" cardCount={24} skin="galaxy" tag="PREMIUM" delay={0} width={320} height={220} />
            </AbsoluteFill>
          </Sequence>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: Payoff text (600-780 frames / 10-13s) */}
      <Sequence from={600} durationInFrames={180}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: 60,
          }}
        >
          <TextReveal
            lines={['it literally makes', 'studying aesthetic']}
            fontSize={56}
            italic
            staggerFrames={12}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 4: Logo CTA (780-900 frames / 13-15s) */}
      <Sequence from={780} durationInFrames={120}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Logo showWordmark tagline="study smarter" delay={10} />
        </AbsoluteFill>
      </Sequence>

      <GrainOverlay />
    </AbsoluteFill>
  );
};

// Mini timetable component for montage
const TimetableMockup: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const classes = [
    { day: 0, start: 1, duration: 2, color: '#4f46e5', name: 'CS 101' },
    { day: 1, start: 3, duration: 1.5, color: '#dc2626', name: 'CHEM 201' },
    { day: 2, start: 0, duration: 2, color: '#16a34a', name: 'BIO 220' },
    { day: 2, start: 4, duration: 1, color: '#ca8a04', name: 'ART 110' },
    { day: 3, start: 2, duration: 2, color: '#9333ea', name: 'MATH 340' },
    { day: 4, start: 1, duration: 1.5, color: '#0891b2', name: 'PHYS 301' },
  ];

  return (
    <div
      style={{
        width: 700,
        height: 500,
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {days.map((day) => (
          <div
            key={day}
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
              color: COLORS.textMuted,
              fontWeight: 600,
            }}
          >
            {day}
          </div>
        ))}
      </div>
      {/* Grid */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', gap: 4 }}>
        {days.map((_, dayIdx) => (
          <div key={dayIdx} style={{ flex: 1, position: 'relative' }}>
            {classes
              .filter((c) => c.day === dayIdx)
              .map((cls, i) => {
                const entrance = spring({
                  frame: frame - dayIdx * 8 - i * 5,
                  fps,
                  config: SPRINGS.snappy,
                  from: 0,
                  to: 1,
                });
                return (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      top: `${cls.start * 16}%`,
                      height: `${cls.duration * 16}%`,
                      width: '100%',
                      backgroundColor: `${cls.color}33`,
                      borderLeft: `3px solid ${cls.color}`,
                      borderRadius: 6,
                      padding: '6px 8px',
                      opacity: entrance,
                      transform: `scaleY(${entrance})`,
                      transformOrigin: 'top',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: 11,
                        color: COLORS.text,
                        fontWeight: 600,
                      }}
                    >
                      {cls.name}
                    </span>
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
};
