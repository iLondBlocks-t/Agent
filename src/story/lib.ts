import { METRICS } from './metrics.generated.ts';

// Shared maths, palette and SVG text helpers for the "Small Traps" vector engine.
// Everything here is pure: (numbers in) -> (SVG strings out). No DOM, no React.

export const W = 1080;
export const H = 1920;
export const FPS = 30;

export const C = {
  wallTop: '#5E3471',
  wallMid: '#4B2A5D',
  wallLow: '#3B234C',
  floor: '#2B1A3A',
  floorTop: '#37234A',
  floorLine: '#241534',
  cream: '#F8EBD8',
  paper: '#F6E5CE',
  paperDeep: '#E9D2B4',
  ink: '#35263F',
  inkSoft: '#5A4568',
  skin: '#F4E2C8',
  skinShade: '#E7D0B2',
  hoodie: '#F4633F',
  hoodieDark: '#DC4E2C',
  hoodieLight: '#FF8058',
  pants: '#3A2A4C',
  gold: '#E0A860',
  goldSoft: '#F0C68C',
  red: '#DF5A4E',
  redDeep: '#B23F3A',
  green: '#67B98D',
  greenDeep: '#3F8A66',
  violet: '#7A4B92',
  shadow: '#1B1028',
  white: '#FFF9EF',
};

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
export const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a || 1e-6));

export const ease = (x: number) => x * x * (3 - 2 * x); // smoothstep
export const easeIn = (x: number) => x * x * x;
export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
export const easeIoCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOutBack = (x: number, s = 1.6) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
export const easeOutElastic = (x: number) => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
};

/** Appear with fade + rise. Returns {o, dy} */
export function pop(t: number, at: number, dur = 0.45, rise = 18) {
  const x = seg(t, at, at + dur);
  return { o: easeOut(x), dy: (1 - easeOutBack(x, 1.2)) * rise };
}
/** Fade in then out over a window. */
export function windowFade(t: number, a: number, b: number, fadeIn = 0.4, fadeOut = 0.4) {
  return clamp01(Math.min(seg(t, a, a + fadeIn), 1 - seg(t, b - fadeOut, b)));
}

/** Keyframe interpolation over [time,value] pairs with smoothstep easing. */
export function kf(t: number, frames: [number, number][]) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    if (t <= frames[i][0]) {
      const [t0, v0] = frames[i - 1];
      const [t1, v1] = frames[i];
      return lerp(v0, v1, ease(seg(t, t0, t1)));
    }
  }
  return frames[frames.length - 1][1];
}

/** Keyframe with linear interpolation (good for continuous spins). */
export function kfLin(t: number, frames: [number, number][]) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    if (t <= frames[i][0]) {
      const [t0, v0] = frames[i - 1];
      const [t1, v1] = frames[i];
      return lerp(v0, v1, seg(t, t0, t1));
    }
  }
  return frames[frames.length - 1][1];
}

let seed = 7;
export function rand() {
  // deterministic pseudo random
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}
export function resetSeed(s: number) {
  seed = s;
}
export const noise1 = (x: number, s = 1) => {
  const v = Math.sin(x * 12.9898 + s * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

export const n = (x: number) => Math.round(x * 100) / 100;

/* ---------------------------------- text ---------------------------------- */

export const FONT = 'Poppins, "Nunito", system-ui, sans-serif';
export const SERIF = '"Playfair Display", Georgia, serif';

export function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

type TextOpts = {
  size?: number;
  weight?: number;
  fill?: string;
  anchor?: 'start' | 'middle' | 'end';
  family?: string;
  opacity?: number;
  letter?: number;
  italic?: boolean;
  shadow?: boolean;
  lh?: number;
};

export function text(x: number, y: number, str: string, o: TextOpts = {}) {
  const {
    size = 44,
    weight = 500,
    fill = C.cream,
    anchor: anchorIn = 'middle',
    family = FONT,
    opacity = 1,
    letter = 0,
    italic = false,
    shadow = false,
    lh = 1.22,
  } = o;
  if (opacity <= 0.002) return '';
  const anchor = anchorIn === ('center' as string) ? 'middle' : anchorIn;
  const lines = str.split('\n');
  const fillAttr = fill === 'none' ? 'none' : fill;
  const body = lines
    .map(
      (ln, i) =>
        `<tspan x="${n(x)}" dy="${i === 0 ? 0 : n(size * lh)}">${esc(ln)}</tspan>`,
    )
    .join('');
  const shadowAttr = shadow ? ` filter="url(#softShadow)"` : '';
  return `<text x="${n(x)}" y="${n(y)}" font-family='${family}' font-size="${n(size)}" font-weight="${weight}" fill="${fillAttr}" text-anchor="${anchor}" letter-spacing="${letter}" opacity="${n(opacity)}"${italic ? ' font-style="italic"' : ''}${shadowAttr}>${body}</text>`;
}

/** Real advance widths, measured from the embedded TTFs (see metrics_gen.py). */
export function measure(str: string, size: number, weight = 500, family: 'Poppins' | 'Playfair Display' = 'Poppins') {
  const fam = METRICS[family] ?? METRICS.Poppins;
  const key = fam[String(weight)] ? String(weight) : Object.keys(fam)[0];
  const adv = fam[key];
  const fallback = family === 'Poppins' ? 620 : 520;
  let w = 0;
  for (const ch of str) w += adv[ch] ?? fallback;
  return (w / 1000) * size;
}

/** Greedy wrap with explicit max width. */
export function wrap(str: string, size: number, maxW: number, weight = 500, family: 'Poppins' | 'Playfair Display' = 'Poppins') {
  const words = str.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (measure(test, size, weight, family) > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function roundRect(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  return `M${n(x + rr)},${n(y)} H${n(x + w - rr)} Q${n(x + w)},${n(y)} ${n(x + w)},${n(y + rr)} V${n(y + h - rr)} Q${n(x + w)},${n(y + h)} ${n(x + w - rr)},${n(y + h)} H${n(x + rr)} Q${n(x)},${n(y + h)} ${n(x)},${n(y + h - rr)} V${n(y + rr)} Q${n(x)},${n(y)} ${n(x + rr)},${n(y)} Z`;
}

export const g = (attrs: string, inner: string) => `<g ${attrs}>${inner}</g>`;
export const tr = (x: number, y: number, extra = '', inner: string) =>
  `<g transform="translate(${n(x)},${n(y)}) ${extra}">${inner}</g>`;
export const sc = (x: number, y: number, s: number, inner: string, rot = 0) =>
  `<g transform="translate(${n(x)},${n(y)}) rotate(${n(rot)}) scale(${n(s * 1000) / 1000})">${inner}</g>`;
