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
  ScreenShake,
} from '../components';
import { inter, cormorant } from '../fonts';

// 12s = 720 frames at 60fps
export const SpacedRepSecret: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* Scene 1: Hook (0-120 / 0-2s) */}
      <Sequence durationInFrames={120}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: 60,
          }}
        >
          <TextReveal
            lines={['the study method', 'with a 92%', 'retention rate']}
            fontSize={56}
            italic
            staggerFrames={10}
            fontWeight={700}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: Timeline visualization (120-540 / 2-9s) */}
      <Sequence from={120} durationInFrames={420}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: 60,
          }}
        >
          <SpacedRepTimeline frame={frame - 120} fps={fps} />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: Payoff (540-660 / 9-11s) */}
      <Sequence from={540} durationInFrames={120}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: 60,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <TextReveal
              lines={['riven does this']}
              fontSize={52}
              italic
            />
            {/* Highlight underline on "automatically" */}
            <div style={{ position: 'relative' }}>
              <TextReveal
                lines={['automatically']}
                fontSize={52}
                italic
                color={COLORS.accent}
                delay={12}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: -4,
                  left: 0,
                  width: spring({
                    frame: frame - 560,
                    fps,
                    config: SPRINGS.snappy,
                    from: 0,
                    to: 100,
                  }),
                  height: 3,
                  backgroundColor: COLORS.accent,
                  borderRadius: 2,
                  maxWidth: '100%',
                }}
              />
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 4: Logo (660-720 / 11-12s) */}
      <Sequence from={660} durationInFrames={60}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Logo showWordmark delay={5} />
        </AbsoluteFill>
      </Sequence>

      <GrainOverlay />
    </AbsoluteFill>
  );
};

const SpacedRepTimeline: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  const intervals = [
    { day: 1, label: 'Day 1', retention: 70 },
    { day: 3, label: 'Day 3', retention: 78 },
    { day: 7, label: 'Day 7', retention: 85 },
    { day: 14, label: 'Day 14', retention: 90 },
    { day: 30, label: 'Day 30', retention: 95 },
  ];

  const timelineWidth = 700;
  const spacing = timelineWidth / (intervals.length - 1);

  return (
    <div
      style={{
        width: timelineWidth + 80,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 40,
      }}
    >
      {/* Title */}
      <div
        style={{
          fontFamily: cormorant,
          fontSize: 28,
          fontWeight: 700,
          fontStyle: 'italic',
          color: COLORS.text,
          opacity: spring({
            frame,
            fps,
            config: SPRINGS.snappy,
            from: 0,
            to: 1,
          }),
        }}
      >
        Spaced Repetition
      </div>

      {/* Timeline */}
      <div
        style={{
          position: 'relative',
          width: timelineWidth,
          height: 300,
        }}
      >
        {/* Baseline */}
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            left: 0,
            width: timelineWidth,
            height: 2,
            backgroundColor: `${COLORS.text}20`,
          }}
        />

        {/* Connecting lines and nodes */}
        {intervals.map((interval, i) => {
          const x = i * spacing;
          const showAt = 40 + i * 60;

          const nodeEntrance = spring({
            frame: frame - showAt,
            fps,
            config: SPRINGS.bouncy,
            from: 0,
            to: 1,
          });

          if (frame < showAt) return null;

          const barHeight = interpolate(interval.retention, [0, 100], [0, 180]);

          return (
            <React.Fragment key={i}>
              {/* Connecting line to previous */}
              {i > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 60,
                    left: (i - 1) * spacing + 12,
                    width: spring({
                      frame: frame - showAt + 20,
                      fps,
                      config: SPRINGS.smooth,
                      from: 0,
                      to: spacing - 24,
                    }),
                    height: 2,
                    backgroundColor: COLORS.accent,
                    opacity: 0.4,
                  }}
                />
              )}

              {/* Retention bar */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 62,
                  left: x - 16,
                  width: 32,
                  height: barHeight * nodeEntrance,
                  backgroundColor: `${COLORS.accent}22`,
                  borderRadius: '6px 6px 0 0',
                }}
              />

              {/* Node circle */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 52,
                  left: x - 8,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  backgroundColor: COLORS.accent,
                  transform: `scale(${nodeEntrance})`,
                  boxShadow: `0 0 12px ${COLORS.accent}60`,
                }}
              />

              {/* Day label */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 20,
                  left: x - 30,
                  width: 60,
                  textAlign: 'center',
                  fontFamily: inter,
                  fontSize: 14,
                  fontWeight: 600,
                  color: COLORS.textMuted,
                  opacity: nodeEntrance,
                }}
              >
                {interval.label}
              </div>

              {/* Retention badge */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 62 + barHeight * nodeEntrance + 8,
                  left: x - 24,
                  width: 48,
                  textAlign: 'center',
                  fontFamily: inter,
                  fontSize: 16,
                  fontWeight: 700,
                  color: COLORS.accent,
                  opacity: nodeEntrance,
                  transform: `scale(${nodeEntrance})`,
                }}
              >
                {interval.retention}%
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
