import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { renderFrame } from '../story/render.ts';
import { TIMELINE, TOTAL_FRAMES } from '../story/timeline.ts';

/**
 * The whole film is a pure function of the frame number: the story engine emits
 * one self-contained SVG per frame, so Remotion only has to look up the frame,
 * mount the SVG, and lay the narration tracks on the timeline.
 */
export const SvgFrame: React.FC<{ frame: number }> = ({ frame }) => {
  const svg = useMemo(() => renderFrame(frame), [frame]);
  return (
    <AbsoluteFill
      style={{ backgroundColor: '#120A1C' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

export const SmallTraps: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const f = Math.min(frame, (durationInFrames || TOTAL_FRAMES) - 1);

  return (
    <AbsoluteFill style={{ backgroundColor: '#120A1C' }}>
      <SvgFrame frame={f} />

      {/* narration: one track per beat, each starting where its scene starts */}
      {TIMELINE.map((beat) => (
        <Sequence key={beat.id} from={Math.round(beat.voiceStart * 30)} durationInFrames={Math.ceil(beat.voice * 30)}>
          <Audio src={staticFile(beat.audio)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
