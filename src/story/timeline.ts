// Single source of truth for shot timing. Audio lengths decide scene lengths so
// the narration and the picture breathe together.
export const FPS = 30;

export type Beat = {
  id: string;
  title: string;
  /** narration file (public/audio) */
  audio: string;
  /** measured narration length in seconds (from ffmpeg) */
  voice: number;
  /** seconds of air before the voice starts */
  lead: number;
  /** seconds of air after the voice ends (the "pause" beats in the script) */
  tail: number;
};

// Voice lengths measured with ffprobe/ffmpeg on the generated tracks.
export const BEATS: Beat[] = [
  { id: 'hook', title: 'HOOK', audio: 'audio/01-hook.mp3', voice: 4.88, lead: 0.6, tail: 2.4 },
  { id: 'setup', title: 'SETUP', audio: 'audio/02-setup.mp3', voice: 14.2, lead: 0.45, tail: 1.5 },
  { id: 'request', title: 'REQUEST', audio: 'audio/03-request.mp3', voice: 10.72, lead: 0.4, tail: 1.0 },
  { id: 'after', title: 'AFTER YES', audio: 'audio/04-after.mp3', voice: 11.48, lead: 0.4, tail: 1.2 },
  { id: 'solution', title: 'SOLUTION', audio: 'audio/05-solution.mp3', voice: 15.36, lead: 0.4, tail: 2.0 },
  { id: 'payoff', title: 'PAYOFF', audio: 'audio/06-payoff.mp3', voice: 15.8, lead: 0.5, tail: 2.6 },
  { id: 'outro', title: 'OUTRO', audio: 'audio/07-outro.mp3', voice: 12.36, lead: 0.4, tail: 2.2 },
];

const snap = (s: number) => Math.round(s * FPS) / FPS;

export type BeatTiming = Beat & {
  start: number; // seconds
  dur: number; // seconds
  voiceStart: number;
  voiceEnd: number;
  from: number; // frame
  length: number; // frames
};

export const TIMELINE: BeatTiming[] = (() => {
  let acc = 0;
  return BEATS.map((b) => {
    const dur = snap(b.lead + b.voice + b.tail);
    const from = Math.round(acc * FPS);
    const t: BeatTiming = {
      ...b,
      start: acc,
      dur,
      voiceStart: b.lead,
      voiceEnd: b.lead + b.voice,
      from,
      length: Math.round(dur * FPS),
    };
    acc = (from + t.length) / FPS;
    return t;
  });
})();

export const TOTAL_FRAMES = TIMELINE.reduce((a, b) => a + b.length, 0);
export const TOTAL_SECONDS = TOTAL_FRAMES / FPS;

/** Which beat (and local time) a global frame belongs to. */
export function locate(frame: number) {
  for (const b of TIMELINE) {
    if (frame >= b.from && frame < b.from + b.length) {
      return { beat: b, local: (frame - b.from) / FPS, localFrame: frame - b.from };
    }
  }
  const last = TIMELINE[TIMELINE.length - 1];
  return { beat: last, local: last.dur, localFrame: last.length - 1 };
}
