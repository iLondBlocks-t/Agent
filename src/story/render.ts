// Composition renderer: turns a global frame number into one complete SVG frame.
import { C, H, W, n } from './lib.ts';
import { Finish, Room, SpeechBubble } from './props.ts';
import { SceneHook, SceneSetup, SceneRequest, SceneAfter } from './scenes-a.ts';
import { SceneSolution, ScenePayoff, SceneOutro } from './scenes-b.ts';
import { TIMELINE, TOTAL_FRAMES, locate } from './timeline.ts';

export type Caption = { at: number; out?: number; str: string; size?: number; y?: number; serif?: boolean };

const NARRATION: Record<string, { str: string; from: number; to: number }[]> = {
  hook: [
    { str: 'In one second… you said “yes.”', from: 0.1, to: 2.6 },
    { str: 'And you lost your day.', from: 3.3, to: 99 },
  ],
};

export function sceneFor(id: string, t: number, dur: number) {
  switch (id) {
    case 'hook':
      return SceneHook(t, dur);
    case 'setup':
      return SceneSetup(t, dur);
    case 'request':
      return SceneRequest(t, dur);
    case 'after':
      return SceneAfter(t, dur);
    case 'solution':
      return SceneSolution(t, dur);
    case 'payoff':
      return ScenePayoff(t, dur);
    case 'outro':
      return SceneOutro(t, dur);
    default:
      return '';
  }
}

/** Soft global fades so cuts never feel like a flash. */
function globalFade(frame: number) {
  const inFade = Math.min(1, frame / 12);
  const outFade = Math.min(1, (TOTAL_FRAMES - frame) / 18);
  return Math.min(inFade, outFade);
}

export function renderFrame(frame: number, opts: { grain?: boolean } = {}) {
  const { beat, local } = locate(frame);
  const scene = sceneFor(beat.id, local, beat.dur);
  const fade = globalFade(frame);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <clipPath id="frameClip"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="${C.shadow}"/>
  ${scene}
  <rect x="0" y="0" width="${W}" height="${H}" fill="#0F0818" opacity="${n((1 - fade) * 0.98)}"/>
</svg>`;
}

export { NARRATION, TOTAL_FRAMES, TIMELINE };
