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
  TypewriterText,
  TextReveal,
  DeckCard,
  GardenGrow,
  CardFlip,
} from '../components';
import { inter, cormorant, lora } from '../fonts';

// 15s = 900 frames at 60fps
export const SemesterInSeconds: React.FC = () => {
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
          <TypewriterText
            text="set up your entire semester in under a minute"
            fontSize={46}
            font="serif"
            fontWeight={700}
            charsPerSecond={30}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: Speed-run montage (120-720 / 2-12s) */}
      {/* Step 1: Upload syllabus (120-195) */}
      <Sequence from={120} durationInFrames={75}>
        <MontageStep label="Upload Syllabus" frame={frame - 120} fps={fps}>
          <SyllabusUploadMini frame={frame - 120} fps={fps} />
        </MontageStep>
      </Sequence>

      {/* Step 2: Classes populate (195-270) */}
      <Sequence from={195} durationInFrames={75}>
        <MontageStep label="Classes Created" frame={frame - 195} fps={fps}>
          <ClassesMini frame={frame - 195} fps={fps} />
        </MontageStep>
      </Sequence>

      {/* Step 3: Canvas syncs (270-345) */}
      <Sequence from={270} durationInFrames={75}>
        <MontageStep label="Canvas Synced" frame={frame - 270} fps={fps}>
          <CanvasSyncMini frame={frame - 270} fps={fps} />
        </MontageStep>
      </Sequence>

      {/* Step 4: Assignments cascade (345-420) */}
      <Sequence from={345} durationInFrames={75}>
        <MontageStep label="Assignments Loaded" frame={frame - 345} fps={fps}>
          <AssignmentsMini frame={frame - 345} fps={fps} />
        </MontageStep>
      </Sequence>

      {/* Step 5: Create decks (420-495) */}
      <Sequence from={420} durationInFrames={75}>
        <MontageStep label="Study Decks Ready" frame={frame - 420} fps={fps}>
          <div style={{ display: 'flex', gap: 12 }}>
            <DeckCard title="Chem 201" cardCount={47} skin="forest" delay={0} width={200} height={140} />
            <DeckCard title="Bio 220" cardCount={32} skin="cherry" delay={8} width={200} height={140} />
          </div>
        </MontageStep>
      </Sequence>

      {/* Step 6: Study cards (495-570) */}
      <Sequence from={495} durationInFrames={75}>
        <MontageStep label="Studying" frame={frame - 495} fps={fps}>
          <CardFlip
            front="What is meiosis?"
            back="Cell division producing 4 haploid cells"
            flipAtFrame={25}
            width={420}
            height={260}
          />
        </MontageStep>
      </Sequence>

      {/* Step 7: Garden grows (570-645) */}
      <Sequence from={570} durationInFrames={75}>
        <MontageStep label="Garden Growing" frame={frame - 570} fps={fps}>
          <GardenGrow
            growthPercent={interpolate(frame - 570, [0, 70], [20, 80], {
              extrapolateRight: 'clamp',
            })}
            size={220}
          />
        </MontageStep>
      </Sequence>

      {/* Step 8: Streak builds (645-720) */}
      <Sequence from={645} durationInFrames={75}>
        <MontageStep label="Streak Active" frame={frame - 645} fps={fps}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span style={{ fontSize: 48 }}>🔥</span>
            <span
              style={{
                fontFamily: cormorant,
                fontSize: 72,
                fontWeight: 700,
                color: COLORS.accent,
              }}
            >
              7
            </span>
          </div>
        </MontageStep>
      </Sequence>

      {/* Scene 3: Payoff (720-840 / 12-14s) */}
      <Sequence from={720} durationInFrames={120}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: 60,
          }}
        >
          <TextReveal
            lines={['one app.', 'everything organized.']}
            fontSize={54}
            italic
            staggerFrames={12}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 4: Logo (840-900 / 14-15s) */}
      <Sequence from={840} durationInFrames={60}>
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

// Wrapper for each montage step
const MontageStep: React.FC<{
  label: string;
  frame: number;
  fps: number;
  children: React.ReactNode;
}> = ({ label, frame, fps, children }) => {
  const entrance = spring({
    frame,
    fps,
    config: SPRINGS.snappy,
    from: 0,
    to: 1,
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        gap: 24,
        opacity: entrance,
        transform: `scale(${0.9 + entrance * 0.1})`,
      }}
    >
      <div
        style={{
          fontFamily: inter,
          fontSize: 14,
          fontWeight: 600,
          color: COLORS.accent,
          letterSpacing: 3,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      {children}
    </AbsoluteFill>
  );
};

// Mini components for montage steps
const SyllabusUploadMini: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => (
  <div
    style={{
      width: 400,
      backgroundColor: COLORS.surface,
      borderRadius: 16,
      padding: 24,
      textAlign: 'center',
    }}
  >
    <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
    <div style={{ fontFamily: inter, fontSize: 16, color: COLORS.text, fontWeight: 600 }}>
      syllabus.pdf
    </div>
    <div
      style={{
        marginTop: 12,
        height: 4,
        backgroundColor: `${COLORS.text}15`,
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${spring({ frame, fps, config: SPRINGS.smooth, from: 0, to: 100 })}%`,
          height: '100%',
          backgroundColor: COLORS.accent,
          borderRadius: 2,
        }}
      />
    </div>
  </div>
);

const ClassesMini: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const classes = ['CS 201', 'CHEM 301', 'BIO 220', 'MATH 340'];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 500 }}>
      {classes.map((cls, i) => (
        <div
          key={i}
          style={{
            backgroundColor: COLORS.surface,
            borderRadius: 10,
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            opacity: spring({ frame: frame - i * 8, fps, config: SPRINGS.snappy, from: 0, to: 1 }),
            transform: `scale(${spring({ frame: frame - i * 8, fps, config: SPRINGS.snappy, from: 0.8, to: 1 })})`,
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: CLASS_COLORS[i] }} />
          <span style={{ fontFamily: lora, fontSize: 14, color: COLORS.text, fontWeight: 600 }}>{cls}</span>
        </div>
      ))}
    </div>
  );
};

const CanvasSyncMini: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => (
  <div
    style={{
      backgroundColor: COLORS.surface,
      borderRadius: 16,
      padding: 24,
      textAlign: 'center',
      width: 400,
    }}
  >
    <div
      style={{
        fontFamily: inter,
        fontSize: 18,
        color: COLORS.green,
        fontWeight: 600,
        opacity: spring({ frame, fps, config: SPRINGS.snappy, from: 0, to: 1 }),
      }}
    >
      Canvas Connected
    </div>
    <div
      style={{
        fontFamily: inter,
        fontSize: 14,
        color: COLORS.textMuted,
        marginTop: 8,
      }}
    >
      23 assignments synced
    </div>
  </div>
);

const AssignmentsMini: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const assignments = ['Chapter 1 Reading', 'Problem Set 1', 'Midterm', 'Lab Report', 'Final Exam'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 400 }}>
      {assignments.map((a, i) => (
        <div
          key={i}
          style={{
            backgroundColor: COLORS.surface,
            borderRadius: 8,
            padding: '8px 14px',
            fontFamily: inter,
            fontSize: 13,
            color: COLORS.text,
            opacity: spring({ frame: frame - i * 6, fps, config: SPRINGS.snappy, from: 0, to: 1 }),
            transform: `translateX(${(1 - spring({ frame: frame - i * 6, fps, config: SPRINGS.snappy, from: 0, to: 1 })) * 20}px)`,
          }}
        >
          {a}
        </div>
      ))}
    </div>
  );
};
