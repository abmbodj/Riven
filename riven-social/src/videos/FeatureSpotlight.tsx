import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  spring,
  interpolate,
  useVideoConfig,
} from 'remotion';
import { COLORS } from '../constants';
import { FONTS } from '../fonts';
import { GrainOverlay } from '../components/GrainOverlay';
import { TextReveal } from '../components/TextReveal';
import { Logo } from '../components/Logo';
import { DeckCard } from '../components/DeckCard';
import { PhoneMockup } from '../components/PhoneMockup';
import { CardFlip } from '../components/CardFlip';

/**
 * FeatureSpotlight — 20s (1200 frames @ 60fps)
 * Reusable template — spotlight any single feature
 * Swap props to create new episodes
 *
 * 0:00–0:05 (0-300)     Hook text
 * 0:05–0:14 (300-840)   Feature demo
 * 0:14–0:18 (840-1080)  Payoff text
 * 0:18–0:20 (1080-1200) Logo CTA
 */

interface FeatureSpotlightProps {
  featureName?: string;
  hookText?: string[];
  demoComponent?: React.ReactNode;
  payoffText?: string;
}

// Default demo: Flashcard flip inside phone mockup
const DefaultDemo: React.FC = () => (
  <PhoneMockup animateIn>
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      }}
    >
      <CardFlip
        front="What is the powerhouse of the cell?"
        back="Mitochondria"
        flipAtFrame={180}
      />
    </AbsoluteFill>
  </PhoneMockup>
);

export const FeatureSpotlight: React.FC<FeatureSpotlightProps> = ({
  featureName = 'Smart Flashcards',
  hookText = ['Stop rereading.', 'Start actually learning.'],
  demoComponent,
  payoffText = 'Study smarter with Riven',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Feature name badge animation
  const badgeSlide = spring({
    frame: frame - 20,
    fps,
    config: { damping: 20, stiffness: 180 },
  });

  // Payoff text reveal
  const payoffOpacity = spring({
    frame: frame - 840,
    fps,
    config: { damping: 200 },
  });

  const payoffScale = spring({
    frame: frame - 840,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      {/* Scene 1: Hook text */}
      <Sequence from={0} durationInFrames={300} premountFor={30}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: 80,
          }}
        >
          {/* Feature badge at top */}
          <div
            style={{
              position: 'absolute',
              top: 260,
              transform: `translateY(${(1 - badgeSlide) * 40}px)`,
              opacity: badgeSlide,
            }}
          >
            <span
              style={{
                fontFamily: FONTS.sans,
                fontSize: 24,
                color: COLORS.background,
                backgroundColor: COLORS.accent,
                padding: '8px 28px',
                borderRadius: 6,
                letterSpacing: '0.2em',
                textTransform: 'uppercase' as const,
                fontWeight: 700,
              }}
            >
              {featureName}
            </span>
          </div>

          <TextReveal
            lines={hookText}
            staggerFrames={30}
            fontSize={60}
            align="center"
          />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: Feature demo */}
      <Sequence from={300} durationInFrames={540} premountFor={30}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {demoComponent ?? <DefaultDemo />}
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: Payoff text */}
      <Sequence from={840} durationInFrames={240} premountFor={30}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: 80,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.serif,
              fontSize: 56,
              color: COLORS.text,
              textAlign: 'center',
              lineHeight: 1.3,
              opacity: payoffOpacity,
              transform: `scale(${payoffScale})`,
            }}
          >
            {payoffText}
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 4: Logo CTA */}
      <Sequence from={1080} durationInFrames={120} premountFor={30}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Logo showWordmark animateIn tagline="Download Riven" />
        </AbsoluteFill>
      </Sequence>

      <GrainOverlay />
    </AbsoluteFill>
  );
};
