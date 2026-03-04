import React from 'react';
import { Composition } from 'remotion';
import { VIDEO } from './constants';

import { NobodyTalkingAbout } from './videos/NobodyTalkingAbout';
import { SyllabusDropped } from './videos/SyllabusDropped';
import { CanvasAutopilot } from './videos/CanvasAutopilot';
import { GardenTransformation } from './videos/GardenTransformation';
import { QuizletWho } from './videos/QuizletWho';
import { StudyWithMeAmbient } from './videos/StudyWithMeAmbient';
import { GroupStudyFOMO } from './videos/GroupStudyFOMO';
import { AestheticSetup } from './videos/AestheticSetup';
import { SpacedRepSecret } from './videos/SpacedRepSecret';
import { SemesterInSeconds } from './videos/SemesterInSeconds';
import { DarkAcademiaStudy } from './videos/DarkAcademiaStudy';
import { StreakChallenge } from './videos/StreakChallenge';

export const RemotionRoot: React.FC = () => {
  const { width, height, fps } = VIDEO;

  return (
    <>
      {/* Discovery & Hooks */}
      <Composition
        id="NobodyTalkingAbout"
        component={NobodyTalkingAbout}
        durationInFrames={fps * 15}
        fps={fps}
        width={width}
        height={height}
      />

      {/* Feature Demos */}
      <Composition
        id="SyllabusDropped"
        component={SyllabusDropped}
        durationInFrames={fps * 15}
        fps={fps}
        width={width}
        height={height}
      />
      <Composition
        id="CanvasAutopilot"
        component={CanvasAutopilot}
        durationInFrames={fps * 12}
        fps={fps}
        width={width}
        height={height}
      />

      {/* Satisfying Visuals */}
      <Composition
        id="GardenTransformation"
        component={GardenTransformation}
        durationInFrames={fps * 12}
        fps={fps}
        width={width}
        height={height}
      />
      <Composition
        id="AestheticSetup"
        component={AestheticSetup}
        durationInFrames={fps * 10}
        fps={fps}
        width={width}
        height={height}
      />
      <Composition
        id="DarkAcademiaStudy"
        component={DarkAcademiaStudy}
        durationInFrames={fps * 10}
        fps={fps}
        width={width}
        height={height}
      />

      {/* Competitive & Controversial */}
      <Composition
        id="QuizletWho"
        component={QuizletWho}
        durationInFrames={fps * 10}
        fps={fps}
        width={width}
        height={height}
      />

      {/* Social & FOMO */}
      <Composition
        id="GroupStudyFOMO"
        component={GroupStudyFOMO}
        durationInFrames={fps * 12}
        fps={fps}
        width={width}
        height={height}
      />
      <Composition
        id="StreakChallenge"
        component={StreakChallenge}
        durationInFrames={fps * 10}
        fps={fps}
        width={width}
        height={height}
      />

      {/* Educational */}
      <Composition
        id="SpacedRepSecret"
        component={SpacedRepSecret}
        durationInFrames={fps * 12}
        fps={fps}
        width={width}
        height={height}
      />

      {/* Compilations */}
      <Composition
        id="SemesterInSeconds"
        component={SemesterInSeconds}
        durationInFrames={fps * 15}
        fps={fps}
        width={width}
        height={height}
      />

      {/* Ambient */}
      <Composition
        id="StudyWithMeAmbient"
        component={StudyWithMeAmbient}
        durationInFrames={fps * 60}
        fps={fps}
        width={width}
        height={height}
      />
    </>
  );
};
