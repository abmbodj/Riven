import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';

type PhoneMockupProps = {
  children: React.ReactNode;
  animateIn?: boolean;
};

export const PhoneMockup: React.FC<PhoneMockupProps> = ({
  children,
  animateIn = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = animateIn
    ? spring({ frame, fps, config: { damping: 16, stiffness: 80 } })
    : 1;

  const scale = interpolate(entrance, [0, 1], [0.85, 1]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);
  const translateY = interpolate(entrance, [0, 1], [60, 0]);

  return (
    <div
      style={{
        transform: `scale(${scale}) translateY(${translateY}px)`,
        opacity,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Phone frame — iPhone 15 Pro style */}
      <div
        style={{
          width: 340,
          height: 700,
          borderRadius: 48,
          border: '4px solid #2a2a2a',
          backgroundColor: '#000',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(0,0,0,0.5), inset 0 0 0 2px #3a3a3a',
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
            position: 'absolute',
            top: 4,
            left: 4,
            right: 4,
            bottom: 4,
            borderRadius: 44,
            overflow: 'hidden',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
