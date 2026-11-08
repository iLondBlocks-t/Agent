// The "Small Traps" cast. Cream head, dot eyes, oversized coral hoodie, violet legs.
import { C, clamp01, esc, lerp, n, roundRect } from './lib.ts';

export type Face =
  | 'neutral'
  | 'worried'
  | 'sad'
  | 'happy'
  | 'annoyed'
  | 'surprised'
  | 'relieved'
  | 'thinking'
  | 'flat';

export type Look = 'left' | 'right' | 'down' | 'up' | 'center';

export type Arm = { a: number; b?: number; len?: number; hand?: 'open' | 'fist' | 'point' | 'flat' };

export type CharOpts = {
  x: number;
  y: number; // ground contact point
  s?: number; // scale
  face?: Face;
  look?: Look;
  tilt?: number; // head tilt degrees
  lean?: number; // body lean degrees
  bob?: number; // vertical breathing offset
  opacity?: number;
  flip?: boolean;
  armL?: Arm | null;
  armR?: Arm | null;
  hood?: number; // 0..1 hood droop / collar height
  squash?: number; // 1 neutral, <1 slumped
  dim?: number; // 0..1 darken (silhouette-ish)
  breathing?: number; // time for idle breathing
};

const L = {
  headY: -352,
  headR: 92,
  neckY: -268,
  shoulderY: -252,
  hipY: -120,
};

function faceMarkup(face: Face, look: Look, s: number) {
  // eyes
  const lookDX = look === 'left' ? -6 : look === 'right' ? 6 : 0;
  const lookDY = look === 'down' ? 5 : look === 'up' ? -5 : 0;
  const eyeY = -6 + lookDY;
  const eyeL = -32 + lookDX;
  const eyeR = 32 + lookDX;
  let eyes = '';
  if (face === 'happy' || face === 'relieved') {
    eyes =
      `<path d="M${eyeL - 12},${eyeY + 2} q12,-14 24,0" stroke="${C.ink}" stroke-width="7" fill="none" stroke-linecap="round"/>` +
      `<path d="M${eyeR - 12},${eyeY + 2} q12,-14 24,0" stroke="${C.ink}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
  } else if (face === 'annoyed') {
    eyes =
      `<path d="M${eyeL - 12},${eyeY - 9} L${eyeL + 11},${eyeY - 2}" stroke="${C.ink}" stroke-width="6" stroke-linecap="round"/>` +
      `<path d="M${eyeR + 12},${eyeY - 9} L${eyeR - 11},${eyeY - 2}" stroke="${C.ink}" stroke-width="6" stroke-linecap="round"/>` +
      `<circle cx="${eyeL}" cy="${eyeY + 5}" r="7" fill="${C.ink}"/><circle cx="${eyeR}" cy="${eyeY + 5}" r="7" fill="${C.ink}"/>`;
  } else if (face === 'surprised') {
    eyes = `<circle cx="${eyeL}" cy="${eyeY}" r="11" fill="${C.ink}"/><circle cx="${eyeR}" cy="${eyeY}" r="11" fill="${C.ink}"/>`;
  } else if (face === 'flat') {
    eyes =
      `<path d="M${eyeL - 12},${eyeY} h24" stroke="${C.ink}" stroke-width="6" stroke-linecap="round"/>` +
      `<path d="M${eyeR - 12},${eyeY} h24" stroke="${C.ink}" stroke-width="6" stroke-linecap="round"/>`;
  } else {
    eyes =
      `<circle cx="${eyeL}" cy="${eyeY}" r="7.5" fill="${C.ink}"/><circle cx="${eyeR}" cy="${eyeY}" r="7.5" fill="${C.ink}"/>`;
  }

  // brows
  let brows = '';
  if (face === 'worried' || face === 'sad') {
    brows =
      `<path d="M${eyeL - 15},${eyeY - 26} q15,6 27,-1" stroke="${C.inkSoft}" stroke-width="5.5" fill="none" stroke-linecap="round"/>` +
      `<path d="M${eyeR + 15},${eyeY - 26} q-15,6 -27,-1" stroke="${C.inkSoft}" stroke-width="5.5" fill="none" stroke-linecap="round"/>`;
  } else if (face === 'thinking') {
    brows = `<path d="M${eyeL - 15},${eyeY - 25} q14,-4 26,3" stroke="${C.inkSoft}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  }

  // mouth
  const my = 40;
  let mouth = '';
  switch (face) {
    case 'happy':
      mouth = `<path d="M${-24 + lookDX},${my - 4} q24,26 48,0" stroke="${C.ink}" stroke-width="6.5" fill="none" stroke-linecap="round"/>`;
      break;
    case 'relieved':
      mouth = `<path d="M${-20 + lookDX},${my - 2} q20,16 40,-2" stroke="${C.ink}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
      break;
    case 'worried':
      mouth = `<path d="M${-22 + lookDX},${my + 6} q22,-16 44,0" stroke="${C.ink}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
      break;
    case 'sad':
      mouth = `<path d="M${-20 + lookDX},${my + 10} q20,-18 40,0" stroke="${C.ink}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
      break;
    case 'annoyed':
      mouth = `<path d="M${-22 + lookDX},${my + 4} q22,-8 44,-6" stroke="${C.ink}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
      break;
    case 'surprised':
      mouth = `<ellipse cx="${lookDX}" cy="${my + 4}" rx="12" ry="15" fill="${C.ink}"/>`;
      break;
    case 'flat':
      mouth = `<path d="M${-17 + lookDX},${my} h34" stroke="${C.ink}" stroke-width="6" stroke-linecap="round"/>`;
      break;
    case 'thinking':
      mouth = `<path d="M${-14 + lookDX},${my} q14,6 30,0" stroke="${C.ink}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
      break;
    default:
      mouth = `<path d="M${-18 + lookDX},${my - 2} q18,12 36,0" stroke="${C.ink}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  }
  return `<g>${brows}${eyes}${mouth}</g>`;
}

function handMarkup(x: number, y: number, kind: Arm['hand'], angle: number) {
  const r = 16;
  if (kind === 'point') {
    return `<g transform="translate(${n(x)},${n(y)}) rotate(${n(angle)})"><circle r="${r}" fill="${C.skin}"/><rect x="-5" y="-46" width="10" height="34" rx="5" fill="${C.skin}"/></g>`;
  }
  if (kind === 'flat') {
    return `<g transform="translate(${n(x)},${n(y)}) rotate(${n(angle)})"><rect x="-19" y="-15" width="38" height="30" rx="14" fill="${C.skin}"/></g>`;
  }
  return `<circle cx="${n(x)}" cy="${n(y)}" r="${kind === 'fist' ? 18 : r}" fill="${C.skin}"/>`;
}

function armMarkup(side: -1 | 1, arm: Arm | null | undefined, shoulder: [number, number], sleeve: string, rim: string) {
  if (arm === null) return '';
  const a = arm?.a ?? 14;
  const b = arm?.b ?? 6;
  const upper = 80;
  const fore = (arm?.len ?? 1) * 78;
  const sx = shoulder[0];
  const sy = shoulder[1];
  const a1 = (a * Math.PI) / 180;
  const a2 = ((a + b) * Math.PI) / 180;
  const ex = sx + side * Math.sin(a1) * upper;
  const ey = sy + Math.cos(a1) * upper;
  const hx = ex + side * Math.sin(a2) * fore;
  const hy = ey + Math.cos(a2) * fore;
  const w = 32;
  const seg1 = `M${n(sx)},${n(sy)} L${n(ex)},${n(ey)}`;
  const seg2 = `M${n(ex)},${n(ey)} L${n(hx)},${n(hy)}`;
  return `<g>
    <path d="${seg1}" stroke="${rim}" stroke-width="${w + 10}" stroke-linecap="round" fill="none" opacity="0.55"/>
    <path d="${seg2}" stroke="${rim}" stroke-width="${w + 6}" stroke-linecap="round" fill="none" opacity="0.55"/>
    <path d="${seg1}" stroke="${sleeve}" stroke-width="${w}" stroke-linecap="round" fill="none"/>
    <path d="${seg2}" stroke="${sleeve}" stroke-width="${w - 3}" stroke-linecap="round" fill="none"/>
    <path d="${seg2}" stroke="${mixHex(sleeve, '#FFFFFF', 0.12)}" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.5" transform="translate(${n(side * 7)},0)"/>
    ${handMarkup(hx, hy, arm?.hand, (a + b) * side)}
  </g>`;
}

/** The hero: an oversized peach-headed figure in a coral hoodie. */
export function Character(o: CharOpts) {
  const {
    x,
    y,
    s = 1,
    face = 'neutral',
    look = 'center',
    tilt = 0,
    lean = 0,
    bob = 0,
    opacity = 1,
    flip = false,
    armL = { a: 10 },
    armR = { a: 10 },
    hood = 0.5,
    squash = 1,
    dim = 0,
    breathing = 0,
  } = o;
  const br = Math.sin(breathing * 2.1) * 2.4;
  const sleeve = dim > 0 ? mixHex(C.hoodie, C.shadow, dim) : C.hoodie;
  const bodyFill = dim > 0 ? mixHex(C.hoodie, C.shadow, dim) : C.hoodie;
  const skinFill = dim > 0 ? mixHex(C.skin, C.shadow, dim) : C.skin;
  const inkFill = dim > 0 ? mixHex(C.ink, C.shadow, dim) : C.ink;

  const bodyH = 168 * squash;
  const bodyTop = L.shoulderY;
  const hoodY = bodyTop - 6 + hood * 6;

  const inner = `
    <g>
      <!-- legs -->
      <rect x="-56" y="${L.hipY - 4}" width="26" height="126" rx="13" fill="${mixHex(C.pants, C.shadow, dim)}"/>
      <rect x="30" y="${L.hipY - 4}" width="26" height="126" rx="13" fill="${mixHex(C.pants, C.shadow, dim)}"/>
      <ellipse cx="-44" cy="-6" rx="26" ry="11" fill="${mixHex(C.shadow, '#000000', 0.1)}" opacity="0.85"/>
      <ellipse cx="45" cy="-6" rx="26" ry="11" fill="${mixHex(C.shadow, '#000000', 0.1)}" opacity="0.85"/>
      <!-- arms behind body -->
      ${armMarkup(-1, armL, [-80, bodyTop + 18], sleeve, mixHex(sleeve, C.shadow, 0.45))}
      ${armMarkup(1, armR, [80, bodyTop + 18], sleeve, mixHex(sleeve, C.shadow, 0.45))}
      <!-- torso -->
      <path d="M-96,${bodyTop + 26}
               q0,-40 96,-40
               q96,0 96,40
               l6,${bodyH - 60}
               q0,34 -102,34
               q-102,0 -102,-34 Z" fill="${bodyFill}"/>
      <!-- hood collar -->
      <path d="M-88,${hoodY + 34} q40,-46 88,-46 q48,0 88,46 q-24,-18 -44,-8 q-20,10 -44,10 q-24,0 -44,-10 q-20,-10 -44,8 Z" fill="${mixHex(C.hoodieDark, C.shadow, dim)}" opacity="0.95"/>
      <path d="M-70,${bodyTop + 4} q34,-30 70,-30 q36,0 70,30" stroke="${mixHex(C.hoodieLight, C.shadow, dim)}" stroke-width="7" fill="none" opacity="0.55" stroke-linecap="round"/>
      <!-- pocket -->
      <path d="M-58,${bodyTop + 106} q58,16 116,0" stroke="${mixHex(C.hoodieDark, C.shadow, dim)}" stroke-width="8" fill="none" stroke-linecap="round" opacity="0.75"/>
      <!-- head -->
      <g transform="translate(0,${L.headY + br}) rotate(${n(tilt)})">
        <ellipse cx="0" cy="6" rx="94" ry="94" fill="${C.skin}" opacity="0"/>
        <circle cx="0" cy="0" r="${L.headR}" fill="${skinFill}"/>
        <circle cx="${-54}" cy="${22}" r="8" fill="${mixHex(C.gold, C.shadow, dim)}" opacity="0.3"/>
        <g>${faceMarkup(face, look, s).replace(/fill="([^"]+)"/g, (m, f) =>
          dim > 0 && (f === C.ink || f === C.inkSoft)
            ? `fill="${mixHex(f, C.shadow, dim * 0.6)}"`
            : m,
        ).replace(new RegExp(`stroke="${C.ink}"`, 'g'), `stroke="${mixHex(C.ink, C.shadow, dim * 0.6)}"`).replace(new RegExp(`stroke="${C.inkSoft}"`, 'g'), `stroke="${mixHex(C.inkSoft, C.shadow, dim * 0.6)}"`)}</g>
      </g>
    </g>`;

  const wrap = `<g transform="translate(${n(x)},${n(y)}) scale(${n((flip ? -s : s) * 100) / 100},${n(s * 100) / 100}) rotate(${n(lean)})" opacity="${n(opacity)}"${' '}>${inner}</g>`;
  return wrap;
}

export function mixHex(a: string, b: string, t: number) {
  const pa = hex(a);
  const pb = hex(b);
  const k = clamp01(t);
  return (
    '#' +
    [0, 1, 2]
      .map((i) => Math.round(lerp(pa[i], pb[i], k)).toString(16).padStart(2, '0'))
      .join('')
  );
}
function hex(h: string) {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

/** A tinier crowd/other person, used for "the world" and the inner stickman. */
export function Stranger(o: {
  x: number;
  y: number;
  s?: number;
  fill?: string;
  headFill?: string;
  opacity?: number;
  face?: Face;
  look?: Look;
}) {
  const { x, y, s = 0.72, fill = '#2A1738', headFill = '#3A2450', opacity = 1, face = 'neutral', look = 'center' }:
    any = o;
  return `<g transform="translate(${n(x)},${n(y)}) scale(${s})" opacity="${opacity}">
    <rect x="-78" y="-140" width="156" height="140" rx="34" fill="${fill}"/>
    <rect x="-52" y="-140" width="38" height="140" rx="16" fill="${fill}"/>
    <rect x="14" y="-140" width="38" height="140" rx="16" fill="${fill}"/>
    <circle cx="0" cy="-330" r="92" fill="${headFill}"/>
    ${face === 'neutral' ? '' : `<g opacity="0.9">${faceMarkup(face, look, s)}</g>`}
    <path d="M-70,-232 q70,-46 140,0 l0,110 l-140,0 Z" fill="${fill}"/>
  </g>`;
}

/** The enormous looming silhouette from the reference frames. */
export function LoomingFigure(o: {
  x: number;
  y: number;
  s?: number;
  opacity?: number;
  fill?: string;
  sway?: number;
}) {
  const { x, y, s = 1, opacity = 0.92, fill = '#150C20', sway = 0 } = o;
  return `<g transform="translate(${n(x)},${n(y)}) scale(${n(s)}) rotate(${n(sway)})" opacity="${opacity}">
    <circle cx="0" cy="-1180" r="150" fill="${fill}"/>
    <path d="M-150,-1035 q150,-70 300,0 q130,80 150,320 l30,715 l-330,0 Z" fill="${fill}"/>
    <path d="M-150,-1035 q-130,80 -160,320 l-30,715 l340,0 l0,-715 Z" fill="${fill}"/>
    <rect x="-250" y="-560" width="120" height="560" rx="58" fill="${fill}"/>
    <rect x="130" y="-560" width="120" height="560" rx="58" fill="${fill}"/>
  </g>`;
}

/** A "shadow on the wall" of the looming figure. */
export function wallShadow(x: number, y: number, s: number, opacity: number) {
  if (opacity <= 0.01) return '';
  return `<g transform="translate(${n(x)},${n(y)}) scale(${n(s)})" opacity="${n(opacity)}" filter="url(#wallBlur)">
    <ellipse cx="0" cy="-420" rx="220" ry="240" fill="#1B0F28"/>
    <path d="M-120,-360 q120,-40 240,0 l40,420 l-320,0 Z" fill="#1B0F28"/>
  </g>`;
}

export const charFace = (opts: CharOpts) => Character(opts);
export { faceMarkup, roundRect, esc };
