import React from 'react';
import { Composition, staticFile } from 'remotion';
import { AppStoreScreenshot } from '../components/AppStoreScreenshot';

// Composition 1: AI Generation Spotlight
export const Screenshot_AIGen: React.FC = () => {
    return (
        <AppStoreScreenshot
            // Use the staticFile helper to resolve public assets correctly
            imageSrc={staticFile('assets/screens/ai-gen.png')}
            titleLines={['Generate complete', 'study guides', 'in seconds.']}
            subtitle="AI-Powered Learning"
        />
    );
};

// Composition 2: Syllabus Parsing Spotlight
export const Screenshot_Syllabus: React.FC = () => {
    return (
        <AppStoreScreenshot
            imageSrc={staticFile('assets/screens/syllabus.png')}
            titleLines={['Your entire', 'semester,', 'organized.']}
            subtitle="Smart Syllabus Parsing"
        />
    );
};
