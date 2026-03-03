import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import { COLORS, SPRINGS, CLASS_COLORS } from '../constants';
import {
  GrainOverlay,
  Logo,
  TextReveal,
  PhoneMockup,
  ScreenShake,
} from '../components';
import { inter, cormorant, lora } from '../fonts';

// 12s = 720 frames at 60fps
export const CanvasAutopilot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* Scene 1: Hook (0-120 frames / 0-2s) */}
      <Sequence durationInFrames={120}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: 60,
          }}
        >
          <ScreenShake startFrame={5} intensity={10}>
            <TextReveal
              lines={['stop refreshing', 'canvas']}
              fontSize={72}
              font="serif"
              italic
              fontWeight={700}
              staggerFrames={10}
            />
          </ScreenShake>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: Phone mockup with Canvas sync (120-540 frames / 2-9s) */}
      <Sequence from={120} durationInFrames={420}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <PhoneMockup delay={0} width={360} height={720}>
            <CanvasSyncScreen frame={frame - 120} fps={fps} />
          </PhoneMockup>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: Payoff (540-660 frames / 9-11s) */}
      <Sequence from={540} durationInFrames={120}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: 60,
            gap: 20,
          }}
        >
          <TextReveal
            lines={['auto-synced.', 'always updated.']}
            fontSize={54}
            italic
            staggerFrames={12}
          />
          {/* Checkmark animation */}
          <div
            style={{
              opacity: spring({
                frame: frame - 580,
                fps,
                config: SPRINGS.bouncy,
                from: 0,
                to: 1,
              }),
              transform: `scale(${spring({
                frame: frame - 580,
                fps,
                config: SPRINGS.bouncy,
                from: 0.5,
                to: 1,
              })})`,
            }}
          >
            <svg width={60} height={60} viewBox="0 0 60 60">
              <circle cx={30} cy={30} r={28} fill={COLORS.green} opacity={0.2} />
              <path
                d="M18 30 L26 38 L42 22"
                stroke={COLORS.green}
                strokeWidth={4}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 4: Logo CTA (660-720 frames / 11-12s) */}
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

// Canvas sync screen inside phone
const CanvasSyncScreen: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  // Phase 1: Paste URL (0-90)
  // Phase 2: Loading pulse (90-180)
  // Phase 3: Results reveal (180-420)

  const urlPasted = frame > 40;
  const syncing = frame > 90 && frame < 180;
  const syncDone = frame > 180;

  const classes = [
    { name: 'CS 201', color: CLASS_COLORS[0] },
    { name: 'CHEM 301', color: CLASS_COLORS[1] },
    { name: 'MATH 340', color: CLASS_COLORS[4] },
    { name: 'BIO 220', color: CLASS_COLORS[2] },
    { name: 'PHYS 101', color: CLASS_COLORS[5] },
  ];

  const classCount = syncDone
    ? Math.min(
        5,
        Math.round(
          spring({ frame: frame - 180, fps, config: SPRINGS.smooth, from: 0, to: 5 })
        )
      )
    : 0;

  const assignmentCount = syncDone
    ? Math.min(
        23,
        Math.round(
          spring({ frame: frame - 200, fps, config: SPRINGS.smooth, from: 0, to: 23 })
        )
      )
    : 0;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.bg,
        padding: '50px 16px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          fontFamily: cormorant,
          fontSize: 20,
          fontWeight: 700,
          fontStyle: 'italic',
          color: COLORS.text,
          textAlign: 'center',
        }}
      >
        Canvas Sync
      </div>

      {/* URL input */}
      {!syncDone && (
        <div
          style={{
            backgroundColor: COLORS.surface,
            borderRadius: 10,
            padding: '12px 14px',
            border: `1px solid ${urlPasted ? COLORS.accent : COLORS.textMuted}44`,
          }}
        >
          <div
            style={{
              fontFamily: inter,
              fontSize: 12,
              color: urlPasted ? COLORS.text : COLORS.textMuted,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {urlPasted
              ? 'https://canvas.edu/feeds/calendars/user_8x...ics'
              : 'Paste Canvas Calendar Link (.ics)'}
          </div>
        </div>
      )}

      {/* Sync button */}
      {urlPasted && !syncDone && (
        <div
          style={{
            backgroundColor: syncing ? COLORS.surface : COLORS.accent,
            borderRadius: 10,
            padding: '12px 20px',
            textAlign: 'center',
            fontFamily: inter,
            fontSize: 14,
            fontWeight: 600,
            color: syncing ? COLORS.textMuted : COLORS.bg,
            opacity: spring({
              frame: frame - 50,
              fps,
              config: SPRINGS.snappy,
              from: 0,
              to: 1,
            }),
          }}
        >
          {syncing ? 'Syncing...' : 'Connect & Sync'}
        </div>
      )}

      {/* Loading pulse */}
      {syncing && (
        <div
          style={{
            height: 3,
            backgroundColor: `${COLORS.text}15`,
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${interpolate(frame - 90, [0, 90], [0, 100], {
                extrapolateRight: 'clamp',
              })}%`,
              height: '100%',
              backgroundColor: COLORS.accent,
              borderRadius: 2,
            }}
          />
        </div>
      )}

      {/* Sync results */}
      {syncDone && (
        <>
          {/* Counters */}
          <div
            style={{
              display: 'flex',
              gap: 16,
              justifyContent: 'center',
              opacity: spring({
                frame: frame - 185,
                fps,
                config: SPRINGS.snappy,
                from: 0,
                to: 1,
              }),
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontFamily: cormorant,
                  fontSize: 36,
                  fontWeight: 700,
                  color: COLORS.accent,
                }}
              >
                {classCount}
              </div>
              <div
                style={{
                  fontFamily: inter,
                  fontSize: 11,
                  color: COLORS.textMuted,
                }}
              >
                classes
              </div>
            </div>
            <div
              style={{
                width: 1,
                backgroundColor: `${COLORS.text}22`,
              }}
            />
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontFamily: cormorant,
                  fontSize: 36,
                  fontWeight: 700,
                  color: COLORS.accent,
                }}
              >
                {assignmentCount}
              </div>
              <div
                style={{
                  fontFamily: inter,
                  fontSize: 11,
                  color: COLORS.textMuted,
                }}
              >
                assignments
              </div>
            </div>
          </div>

          {/* Class cards */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {classes.map((cls, i) => {
              const itemEntrance = spring({
                frame: frame - 210 - i * 12,
                fps,
                config: SPRINGS.snappy,
                from: 0,
                to: 1,
              });
              return (
                <div
                  key={i}
                  style={{
                    backgroundColor: COLORS.surface,
                    borderRadius: 10,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    opacity: itemEntrance,
                    transform: `translateY(${(1 - itemEntrance) * 20}px)`,
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: cls.color,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: lora,
                      fontSize: 14,
                      fontWeight: 600,
                      color: COLORS.text,
                    }}
                  >
                    {cls.name}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
