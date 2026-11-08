// Staging helpers: camera, holds, and small composite objects reused across scenes.
import { C, H, W, clamp01, n, roundRect, seg, ease, lerp, easeOut, text, FONT } from './lib.ts';
import { Character, Stranger } from './character.ts';
import type { Face, Look } from './character.ts';
import { ThoughtBubble, SpeechBubble, mixHex } from './props.ts';

export type SceneFn = (t: number, dur: number) => string;

export function frame(inner: string) {
  return `<g clip-path="url(#frameClip)">${inner}</g>`;
}

/** Apply a virtual camera. zoom>=1 keeps the room covered. */
export function Camera(
  inner: string,
  o: { zoom?: number; cx?: number; cy?: number; t?: number; shake?: number; rot?: number } = {},
) {
  const { zoom = 1, cx = W / 2, cy = H / 2, t = 0, shake = 0, rot = 0 } = o;
  const sx = Math.sin(t * 31.4) * shake + Math.sin(t * 11.7) * shake * 0.6;
  const sy = Math.cos(t * 27.1) * shake * 0.7;
  return `<g transform="translate(${n(W / 2 + sx)},${n(H / 2 + sy)}) rotate(${n(rot)}) scale(${n(zoom * 1000) / 1000}) translate(${n(-cx)},${n(-cy)})">${inner}</g>`;
}

/** Hard cut helper: renders `a` before `at`, `b` after. */
export function cut(t: number, at: number, a: string, b: string) {
  return t < at ? a : b;
}
/** Sequential shot list: [[start, renderFn]] — the last one active wins. */
export function shots(t: number, list: [number, () => string][]) {
  let out = list[0][1]();
  for (const [start, fn] of list) if (t >= start) out = fn();
  return out;
}

export const groundY = 1400;

/** Speech bubble anchored above a character's head. */
export {
  SpeechBubble,
  ThoughtBubble,
};

/** Small "inner stickman" panel: a person's head cross-section with a tiny operator. */
export function InnerPanel(o: {
  x: number;
  y: number;
  s?: number;
  t: number;
  press?: number; // 0..1 button press animation
  face?: 'happy' | 'annoyed' | 'neutral';
  buttonP?: number;
  label?: string;
  opacity?: number;
  glow?: number;
}) {
  const { x, y, s = 1, t, press = 0, face = 'neutral', buttonP = 0, opacity = 1, glow = 0 } = o;
  const skin = '#F4E2C8';
  const inner = `
    <ellipse cx="0" cy="0" rx="250" ry="270" fill="#4A2B5E"/>
    <ellipse cx="0" cy="0" rx="228" ry="248" fill="#3A2149"/>
    <ellipse cx="0" cy="30" rx="200" ry="210" fill="#2E1A3C" opacity="0.9"/>
    ${glow > 0 ? `<ellipse cx="0" cy="0" rx="240" ry="260" fill="#F4633F" opacity="${n(0.16 * glow)}" filter="url(#soft)"/>` : ''}
    <!-- tiny operator -->
    <g transform="translate(0,110)">
      <circle cx="0" cy="-96" r="40" fill="${skin}"/>
      <circle cx="-13" cy="-102" r="4" fill="${C.ink}"/><circle cx="13" cy="-102" r="4" fill="${C.ink}"/>
      ${face === 'happy' ? `<path d="M-13,-82 q13,11 26,0" stroke="${C.ink}" stroke-width="4" fill="none" stroke-linecap="round"/>` : face === 'annoyed' ? `<path d="M-13,-78 q13,-9 26,0" stroke="${C.ink}" stroke-width="4" fill="none" stroke-linecap="round"/>` : `<path d="M-11,-82 h22" stroke="${C.ink}" stroke-width="4" stroke-linecap="round"/>`}
      <path d="M-34,-56 q34,-18 68,0 l8,62 q-42,16 -84,0 Z" fill="${C.hoodie}"/>
      <rect x="-30" y="2" width="14" height="52" rx="7" fill="${C.pants}"/>
      <rect x="16" y="2" width="14" height="52" rx="7" fill="${C.pants}"/>
      <g transform="translate(34,-30) rotate(${n(-40 - press * 40)})">
        <rect x="0" y="-9" width="62" height="18" rx="9" fill="${C.hoodie}"/>
        <circle cx="66" cy="0" r="12" fill="${skin}"/>
      </g>
      <rect x="-70" y="46" width="140" height="16" rx="8" fill="#241533"/>
      <rect x="-46" y="58" width="92" height="14" rx="7" fill="#1C1029"/>
    </g>
    <!-- accept button -->
    <g transform="translate(0,${n(-120 + press * 12)})">
      <path d="${roundRect(-88, -40, 176, 80, 40)}" fill="${buttonP > 0.4 ? C.green : '#5A3A74'}" stroke="#1D1129" stroke-width="4"/>
      ${text(0, 13, 'ACCEPT', { size: 34, weight: 600, fill: buttonP > 0.4 ? '#0E2C1E' : '#C9B2DA', letter: 2 })}
    </g>
  `;
  return `<g transform="translate(${n(x)},${n(y)}) scale(${n((s * 1000) / 1000)})" opacity="${n(opacity)}">${inner}</g>`;
}

/** Big soft-head "person" used in the LOOM silhouette / crowd. */
export function Crowd(x: number, y: number, count: number, s: number, opacity: number, t: number) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const wob = Math.sin(t * 1.2 + i) * 4;
    out += Stranger({
      x: x + (i - (count - 1) / 2) * 150 * s,
      y: y + wob,
      s: 0.55 * s,
      fill: '#1E1229',
      headFill: '#2A1A38',
      opacity,
    });
  }
  return out;
}

/** Floating hand-written annotation with a thin underline. */
export function Note(a: { x: number; y: number; str: string; size?: number; o?: number; fill?: string }) {
  const { x, y, str, size = 34, o = 1, fill = '#E7C9A6' } = a;
  if (o <= 0.01) return '';
  return text(x, y, str, { size, weight: 400, fill, opacity: o, family: '"Playfair Display", Georgia, serif', italic: true });
}

/** Little sparkle / dust particles around a point. */
export function Sparkles(o: { x: number; y: number; t: number; r?: number; n?: number; color?: string; opacity?: number; spread?: number }) {
  const { x, y, t, r = 240, n: count = 14, color = '#F0C68C', opacity = 0.7, spread = 1 } = o;
  let out = '';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + t * 0.4;
    const rad = r * spread * (0.55 + 0.45 * Math.abs(Math.sin(i * 3.3)));
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad * 0.55;
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 2.4 + i));
    out += `<circle cx="${n(px)}" cy="${n(py)}" r="${n(2.4 + (i % 3))}" fill="${color}" opacity="${n(opacity * tw)}"/>`;
  }
  return out;
}
