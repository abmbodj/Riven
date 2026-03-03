import React from 'react';
import { Composition, Folder } from 'remotion';
import { ExamPanic } from './videos/ExamPanic';
import { SeedReward } from './videos/SeedReward';
import { GardenLoop } from './videos/GardenLoop';
import { DeckSkinReveal } from './videos/DeckSkinReveal';
import { FeatureSpotlight } from './videos/FeatureSpotlight';
import { StudyWithMe } from './videos/StudyWithMe';
import { FeatureCramBlitz } from './videos/FeatureCramBlitz';
import { FeatureGardenGrow } from './videos/FeatureGardenGrow';
import { FeatureSkinDrop } from './videos/FeatureSkinDrop';
import { FeatureSpacedRep } from './videos/FeatureSpacedRep';
import { FeatureSeedRush } from './videos/FeatureSeedRush';
import { FeatureStreakFire } from './videos/FeatureStreakFire';

const V = { width: 1080, height: 1920, fps: 60 } as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Originals">
        <Composition
          id="ExamPanic"
          component={ExamPanic}
          durationInFrames={1800}
          {...V}
        />
        <Composition
          id="SeedReward"
          component={SeedReward}
          durationInFrames={900}
          {...V}
        />
        <Composition
          id="GardenLoop"
          component={GardenLoop}
          durationInFrames={900}
          {...V}
        />
        <Composition
          id="DeckSkinReveal"
          component={DeckSkinReveal}
          durationInFrames={1200}
          {...V}
        />
        <Composition
          id="FeatureSpotlight"
          component={FeatureSpotlight}
          durationInFrames={1200}
          {...V}
        />
        <Composition
          id="StudyWithMe"
          component={StudyWithMe}
          durationInFrames={3600}
          {...V}
        />
      </Folder>

      <Folder name="Features">
        <Composition
          id="FeatureCramBlitz"
          component={FeatureCramBlitz}
          durationInFrames={600}
          {...V}
        />
        <Composition
          id="FeatureGardenGrow"
          component={FeatureGardenGrow}
          durationInFrames={480}
          {...V}
        />
        <Composition
          id="FeatureSkinDrop"
          component={FeatureSkinDrop}
          durationInFrames={480}
          {...V}
        />
        <Composition
          id="FeatureSpacedRep"
          component={FeatureSpacedRep}
          durationInFrames={600}
          {...V}
        />
        <Composition
          id="FeatureSeedRush"
          component={FeatureSeedRush}
          durationInFrames={480}
          {...V}
        />
        <Composition
          id="FeatureStreakFire"
          component={FeatureStreakFire}
          durationInFrames={480}
          {...V}
        />
      </Folder>
    </>
  );
};
