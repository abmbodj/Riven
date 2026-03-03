import React from 'react';
import { AbsoluteFill, staticFile } from 'remotion';

interface GrainOverlayProps {
  opacity?: number;
}

export const GrainOverlay: React.FC<GrainOverlayProps> = ({
  opacity = 0.08,
}) => {
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${staticFile('grain.png')})`,
        backgroundRepeat: 'repeat',
        backgroundSize: '512px 512px',
        mixBlendMode: 'overlay',
        opacity,
        zIndex: 999,
        pointerEvents: 'none',
      }}
    />
  );
};
