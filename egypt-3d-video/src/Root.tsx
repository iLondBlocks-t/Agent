import { Composition } from 'remotion';
import { EgyptCinematic } from './EgyptCinematic';

export const RemotionRoot = () => {
  return (
    <Composition
      id="egypt-cinematic"
      component={EgyptCinematic}
      durationInFrames={90}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
  );
};
