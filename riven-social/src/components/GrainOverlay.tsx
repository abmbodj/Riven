import React from 'react';
import { AbsoluteFill, staticFile } from 'remotion';

type GrainOverlayProps = {
  opacity?: number;
};

export const GrainOverlay: React.FC<GrainOverlayProps> = ({
  opacity = 0.08,
}) => (
  <AbsoluteFill
    style={{
      backgroundImage: `url(${staticFile('grain.png')})`,
      backgroundRepeat: 'repeat',
      opacity,
      mixBlendMode: 'overlay',
      pointerEvents: 'none',
      zIndex: 999,
    }}
  />
);
