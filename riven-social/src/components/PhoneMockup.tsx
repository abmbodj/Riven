import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { SPRINGS } from '../constants';

interface PhoneMockupProps {
  children: React.ReactNode;
  delay?: number;
  width?: number;
  height?: number;
}

export const PhoneMockup: React.FC<PhoneMockupProps> = ({
  children,
  delay = 0,
  width = 340,
  height = 700,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: SPRINGS.snappy,
    from: 0,
    to: 1,
  });

  const scale = 0.8 + entrance * 0.2;
  const translateY = (1 - entrance) * 60;

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 44,
        border: '4px solid rgba(255,255,255,0.15)',
        backgroundColor: '#0a0a0a',
        overflow: 'hidden',
        position: 'relative',
        transform: `scale(${scale}) translateY(${translateY}px)`,
        opacity: entrance,
        boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
      }}
    >
      {/* Dynamic Island */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 120,
          height: 34,
          borderRadius: 20,
          backgroundColor: '#000',
          zIndex: 10,
        }}
      />

      {/* Screen content */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 40,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
};
