import React from 'react';
import {Composition} from 'remotion';
import {MainComposition} from './MainComposition';
import {TestCubeScene} from './TestCube';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Main"
        component={MainComposition}
        durationInFrames={3000}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="TestCube"
        component={TestCubeScene}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
