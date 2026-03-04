import React from 'react';
import { AbsoluteFill, Img, useVideoConfig } from 'remotion';
import { PhoneMockup } from './PhoneMockup';
import { GrainOverlay } from './GrainOverlay';
import { TextReveal } from './TextReveal';

interface AppStoreScreenshotProps {
    imageSrc: string;
    titleLines: string[];
    subtitle?: string;
    backgroundColor?: string;
}

export const AppStoreScreenshot: React.FC<AppStoreScreenshotProps> = ({
    imageSrc,
    titleLines,
    subtitle,
    backgroundColor = '#1a2535',
}) => {
    const { width } = useVideoConfig();

    return (
        <AbsoluteFill style={{ backgroundColor }}>
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: 180,
                height: '100%',
                width: '100%',
                position: 'relative'
            }}>
                {/* Title and Subtitle Text Area */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    marginBottom: 100,
                    zIndex: 10,
                    textAlign: 'center'
                }}>
                    <div style={{ marginBottom: 30 }}>
                        <TextReveal
                            lines={titleLines}
                            staggerFrames={20}
                            fontSize={80}
                            align="center"
                        />
                    </div>
                    {subtitle && (
                        <div style={{
                            fontFamily: 'Inter, sans-serif',
                            fontSize: 40,
                            color: '#c8a96e', // Riven's warm amber/gold
                            opacity: 0.9,
                            letterSpacing: 2,
                            textTransform: 'uppercase',
                            animation: 'fadeIn 1s ease-in forwards'
                        }}>
                            {subtitle}
                        </div>
                    )}
                </div>

                {/* Device Frame Area */}
                <div style={{ position: 'relative', marginTop: 'auto', marginBottom: -100 }}>
                    <PhoneMockup delay={30} width={900} height={1950}>
                        <Img
                            src={imageSrc}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                borderRadius: 40
                            }}
                        />
                    </PhoneMockup>
                </div>
            </div>

            {/* Signature Grain Overlay */}
            <GrainOverlay opacity={0.08} />
        </AbsoluteFill>
    );
};
