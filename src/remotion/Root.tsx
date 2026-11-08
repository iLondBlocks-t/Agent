import React from 'react';
import { Composition } from 'remotion';
import { SmallTraps } from './Film.tsx';
import { TOTAL_FRAMES } from '../story/timeline.ts';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="SmallTraps"
      component={SmallTraps}
      durationInFrames={TOTAL_FRAMES}
      fps={30}
      width={1080}
      height={1920}
    />
    {/* Landscape version: same film, re-framed by the letterboxed player page */}
    <Composition
      id="SmallTrapsWide"
      component={SmallTraps}
      durationInFrames={TOTAL_FRAMES}
      fps={30}
      width={1920}
      height={1080}
    />
  </>
);
