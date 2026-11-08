// Sets and props: the purple room from the reference frames, plus every object the story needs.
import { C, FONT, H, W, clamp01, esc, n, n as num, roundRect, text, measure, wrap, lerp, ease } from './lib.ts';

/** The recurring room: mauve wall, warm window, light shaft, dark floor band. */
export function Room(o: {
  t?: number;
  light?: number; // 0..1 window light strength
  floorY?: number;
  vignette?: number;
  beamOpacity?: number;
  window?: boolean;
  warm?: number;
  dust?: number;
  scale?: number;
}) {
  const {
    t = 0,
    light = 1,
    floorY = 1300,
    vignette = 1,
    beamOpacity = 1,
    window = true,
    warm = 1,
    dust = 0.5,
  } = o;
  const flick = 1 + Math.sin(t * 1.7) * 0.012 + Math.sin(t * 4.3) * 0.006;
  const panelW = 128;
  const panelH = 136;
  const wx = 86;
  const wy = 210;

  const grains = Array.from({ length: 22 }, (_, i) => {
    const r1 = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const r2 = (Math.sin(i * 78.233) * 12543.32) % 1;
    const px = 120 + Math.abs(r1) * 760;
    const py = 300 + ((Math.abs(r2) * 900 + t * (12 + i * 3)) % 900);
    return `<circle cx="${n(px)}" cy="${n(py)}" r="${n(2 + (i % 3))}" fill="#FFE1B8" opacity="${n(
      0.05 + (i % 4) * 0.02,
    )}"/>`;
  }).join('');

  return `<g>
    <defs>
      <linearGradient id="wallG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${C.wallTop}"/>
        <stop offset="0.55" stop-color="${C.wallMid}"/>
        <stop offset="1" stop-color="${C.wallLow}"/>
      </linearGradient>
      <linearGradient id="floorG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${C.floorTop}"/>
        <stop offset="1" stop-color="${C.floor}"/>
      </linearGradient>
      <radialGradient id="winGlow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#FFD9A8" stop-opacity="${n(0.55 * light)}"/>
        <stop offset="1" stop-color="#FFD9A8" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="beamG" x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0" stop-color="#FFD9A8" stop-opacity="${n(0.3 * light * beamOpacity)}"/>
        <stop offset="0.6" stop-color="#FFD9A8" stop-opacity="${n(0.1 * light * beamOpacity)}"/>
        <stop offset="1" stop-color="#FFD9A8" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="vig" cx="0.5" cy="0.45" r="0.78">
        <stop offset="0.45" stop-color="#000000" stop-opacity="0"/>
        <stop offset="1" stop-color="#1A0E26" stop-opacity="0.6"/>
      </radialGradient>
      <filter id="wallBlur"><feGaussianBlur stdDeviation="26"/></filter>
      <filter id="soft"><feGaussianBlur stdDeviation="10"/></filter>
      <filter id="softShadow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#1B0F28" flood-opacity="0.35"/>
      </filter>
      <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="18"/>
      </filter>
    </defs>

    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#wallG)"/>
    <rect x="0" y="${n(floorY)}" width="${W}" height="${H - floorY}" fill="url(#floorG)"/>
    <rect x="0" y="${n(floorY)}" width="${W}" height="5" fill="#1F1229" opacity="0.7"/>
    ${
      window
        ? `<g opacity="1">
      <rect x="${wx - 16}" y="${wy - 16}" width="${panelW * 2 + 52}" height="${panelH + 30}" rx="10" fill="#FFD9A8" opacity="${n(
            0.18 * light,
          )}" filter="url(#glow)"/>
      <rect x="${wx - 12}" y="${wy - 12}" width="${panelW * 2 + 40}" height="${panelH + 20}" rx="8" fill="#3A2450"/>
      <rect x="${wx}" y="${wy}" width="${panelW - 10}" height="${panelH - 10}" rx="6" fill="#FFD9A8" opacity="${n(0.72 * light * flick)}"/>
      <rect x="${wx + panelW + 14}" y="${wy}" width="${panelW - 10}" height="${panelH - 10}" rx="6" fill="#FFD9A8" opacity="${n(0.66 * light * flick)}"/>
      <rect x="${wx}" y="${wy + panelH + 14}" width="${panelW - 10}" height="${panelH - 10}" rx="6" fill="#FFD9A8" opacity="${n(0.6 * light * flick)}"/>
      <rect x="${wx + panelW + 14}" y="${wy + panelH + 14}" width="${panelW - 10}" height="${panelH - 10}" rx="6" fill="#FFD9A8" opacity="${n(0.54 * light * flick)}"/>
      <rect x="${wx - 24}" y="${wy - 24}" width="${panelW * 2 + 64}" height="${panelH * 2 + 28}" fill="url(#winGlow)" opacity="0.9"/>
    </g>`
        : ''
    }
    <!-- light shaft from the window across floor -->
    <g opacity="${n(0.85 * beamOpacity)}">
      <polygon points="${wx + 40},${wy + 120} ${wx + 300},${wy + 120} ${wx + 620},${floorY + 210} ${wx - 60},${floorY + 120}" fill="url(#beamG)"/>
      <polygon points="${wx + 30},${floorY} ${wx + 330},${floorY} ${wx + 470},${floorY + 300} ${wx - 40},${floorY + 260}" fill="#FFD9A8" opacity="${n(0.07 * light * beamOpacity)}"/>
    </g>
    <g opacity="${n(dust * light)}">${grains}</g>
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#vig)" opacity="${n(vignette)}"/>
  </g>`;
}

/** Rounded speech bubble with a tail pointing down-left (or custom). */
export function SpeechBubble(o: {
  x: number;
  y: number; // bottom-center anchor of the bubble body (tail root)
  w?: number;
  text: string;
  size?: number;
  tail?: 'bl' | 'br' | 'b' | 'none';
  opacity?: number;
  s?: number;
  weight?: number;
  dark?: boolean;
  padY?: number;
  align?: 'left' | 'center';
}) {
  const { x, y, text: str, size = 46, tail = 'bl', opacity = 1, s = 1, weight = 500, dark = false, padY = 34, align = 'center' } = o;
  if (opacity <= 0.004) return '';
  const maxW = o.w ?? 620;
  const lines = wrap(str, size, maxW, weight);
  const tw = Math.max(...lines.map((l) => measure(l, size, weight)));
  const w = Math.min(maxW + 84, tw + 88);
  const h = lines.length * size * 1.24 + padY * 2;
  const bx = -w / 2;
  const by = -h;
  const fill = dark ? '#241634' : C.paper;
  const ink = dark ? '#F6E5CE' : C.ink;
  const tailMap: Record<string, string> = {
    bl: `M${bx + 58},${by + h - 6} L${bx + 34},${by + h + 52} L${bx + 118},${by + h - 6} Z`,
    br: `M${bx + w - 118},${by + h - 6} L${bx + w - 34},${by + h + 52} L${bx + w - 58},${by + h - 6} Z`,
    b: `M-38,${by + h - 6} L0,${by + h + 54} L38,${by + h - 6} Z`,
    none: '',
  };
  const body = lines
    .map((ln, i) => text(align === 'center' ? 0 : bx + 38, by + padY + size * 0.86 + i * size * 1.24, ln, { size, weight, fill: ink, anchor: align === 'center' ? 'middle' : 'start' }))
    .join('');
  return `<g transform="translate(${n(x)},${n(y)}) scale(${n(s * 1000) / 1000})" opacity="${n(opacity)}">
    <g filter="url(#softShadow)">
      <path d="${roundRect(bx, by, w, h, 42)}" fill="${fill}"/>
      ${tailMap[tail] ? `<path d="${tailMap[tail]}" fill="${fill}"/>` : ''}
    </g>
    ${body}
  </g>`;
}

/** Cloud-shaped thought bubble (dark, like the reference). */
export function ThoughtBubble(o: { x: number; y: number; w: number; h: number; opacity?: number; s?: number; r?: number; inner: string; fill?: string }) {
  const { x, y, opacity = 1, s = 1, inner, fill = '#241634' } = o;
  const w = o.w;
  const h = o.h;
  const r = o.r ?? 54;
  if (opacity <= 0.004) return '';
  const bx = -w / 2;
  const by = -h / 2;
  return `<g transform="translate(${n(x)},${n(y)}) scale(${n(s * 1000) / 1000})" opacity="${n(opacity)}">
    <path d="${roundRect(bx, by, w, h, r)}" fill="${fill}" filter="url(#softShadow)"/>
    <circle cx="${bx + w * 0.22}" cy="${by + h + 40}" r="22" fill="${fill}"/>
    <circle cx="${bx + w * 0.12}" cy="${by + h + 82}" r="13" fill="${fill}"/>
    ${inner}
  </g>`;
}

/** Phone with a chat thread. `progress` grows the "yes" answer. */
export function Phone(o: {
  x: number;
  y: number;
  s?: number;
  rot?: number;
  opacity?: number;
  messages?: { side: 'in' | 'out'; txt: string; at?: number; t?: number }[];
  typing?: number; // 0..1 typing indicator opacity
  screenGlow?: number;
  sender?: string;
}) {
  const { x, y, s = 1, rot = 0, opacity = 1, messages = [], typing = 0, screenGlow = 1, sender = 'Sam' } = o;
  const pw = 300;
  const ph = 570;
  const body = messages
    .map((m, i) => {
      const o1 = m.at === undefined ? 1 : clamp01(((m.t ?? 0) - m.at) / 0.35);
      if (o1 <= 0.01) return '';
      const isIn = m.side === 'in';
      const size = 27;
      const bw = Math.min(210, measure(m.txt, size, 500) + 44);
      const bh = size * 2.1;
      const rowY = 168 + i * (bh + 16);
      const cx = isIn ? -78 : 78;
      return `<g opacity="${n(o1)}" transform="translate(0,${n((1 - o1) * 10)})">
        <path d="${roundRect(cx - bw / 2, rowY, bw, bh, 16)}" fill="${isIn ? '#3B2A4E' : '#E4603F'}"/>
        ${text(cx, rowY + bh * 0.66, m.txt, { size, weight: 500, fill: isIn ? '#F1E4D3' : '#FFF3E4' })}
      </g>`;
    })
    .join('');
  return `<g transform="translate(${n(x)},${n(y)}) rotate(${n(rot)}) scale(${n(s * 1000) / 1000})" opacity="${n(opacity)}">
    <g filter="url(#softShadow)">
      <rect x="${-pw / 2}" y="${-ph / 2}" width="${pw}" height="${ph}" rx="46" fill="#2A1B38" stroke="#160D22" stroke-width="6"/>
      <rect x="${-pw / 2 + 12}" y="${-ph / 2 + 12}" width="${pw - 24}" height="${ph - 24}" rx="36" fill="#241733"/>
    </g>
    <rect x="${-pw / 2}" y="${-ph / 2}" width="${pw}" height="${ph}" rx="46" fill="none" stroke="#4A3560" stroke-width="3" opacity="0.9"/>
    <rect x="${-52}" y="${-ph / 2 + 16}" width="104" height="16" rx="8" fill="#160D22"/>
    <!-- header -->
    <circle cx="${-pw / 2 + 54}" cy="${-ph / 2 + 74}" r="24" fill="#6B4B85"/>
    ${text(-pw / 2 + 92, -ph / 2 + 82, sender, { size: 30, weight: 600, fill: '#F3E5D3', anchor: 'start' })}
    <rect x="${-pw / 2 + 14}" y="${-ph / 2 + 112}" width="${pw - 28}" height="2" fill="#3B2A4E" opacity="0.8"/>
    ${body}
    ${
      typing > 0.01
        ? `<g opacity="${n(typing)}" transform="translate(-78,${n(168 + messages.length * 72)})">
            <path d="${roundRect(-100, -32, 140, 64, 16)}" fill="#3B2A4E"/>
            <circle cx="-58" cy="0" r="7" fill="#B79CC8"/><circle cx="-30" cy="0" r="7" fill="#B79CC8" opacity="0.75"/><circle cx="-2" cy="0" r="7" fill="#B79CC8" opacity="0.5"/>
          </g>`
        : ''
    }
    <rect x="${-28}" y="${ph / 2 - 42}" width="56" height="6" rx="3" fill="#4A3560" opacity="0.9"/>
    <rect x="${-pw / 2 + 26}" y="${-ph / 2 + 26}" width="${pw - 52}" height="${ph - 52}" rx="34" fill="#7A5CFF" opacity="${n(0.05 * screenGlow)}"/>
  </g>`;
}

/** Analog wall/app clock. `p` 0..1 selects colour from red to green. */
export function Clock(o: { x: number; y: number; r?: number; time?: number; p?: number; opacity?: number; ticks?: boolean; label?: string }) {
  const { x, y, r = 120, time = 0, p = 0, opacity = 1 } = o;
  if (opacity <= 0.004) return '';
  const ring = mixHex(C.red, C.green, p);
  const secA = time * 300;
  const minA = time * 26 + 40;
  const hourA = time * 3 + 120;
  const hand = (a: number, len: number, w: number, col: string) =>
    `<line x1="0" y1="0" x2="${n(Math.sin((a * Math.PI) / 180) * len)}" y2="${n(-Math.cos((a * Math.PI) / 180) * len)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
  const ticks = o.ticks === false ? '' : Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 * Math.PI) / 180;
    const r1 = r * 0.82;
    const r2 = r * 0.9;
    return `<line x1="${n(Math.sin(a) * r1)}" y1="${n(-Math.cos(a) * r1)}" x2="${n(Math.sin(a) * r2)}" y2="${n(-Math.cos(a) * r2)}" stroke="#C8A98E" stroke-width="5" stroke-linecap="round" opacity="0.8"/>`;
  }).join('');
  return `<g transform="translate(${n(x)},${n(y)})" opacity="${n(opacity)}">
    <g filter="url(#softShadow)">
      <circle r="${r}" fill="${C.paper}"/>
      <circle r="${n(r * 0.86)}" fill="none" stroke="${ring}" stroke-width="${n(r * 0.09)}" opacity="0.95"/>
    </g>
    ${ticks}
    <g opacity="0.95">${hand(hourA, r * 0.46, Math.max(6, r * 0.075), C.ink)}${hand(minA, r * 0.66, Math.max(4, r * 0.05), C.ink)}</g>
    ${hand(secA, r * 0.74, Math.max(3, r * 0.028), ring)}
    <circle r="${n(r * 0.07)}" fill="${C.ink}"/>
    <circle r="${n(r * 0.03)}" fill="${C.paper}"/>
    ${o.label ? text(0, r * 0.52, o.label, { size: r * 0.22, weight: 600, fill: ring }) : ''}
  </g>`;
}

function mixHex(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const pa = p(a);
  const pb = p(b);
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], clamp01(t))).toString(16).padStart(2, '0')).join('');
}

export { mixHex };

/** Simple door: frame, panel, handle, and optional light spill. */
export function Door(o: {
  x: number;
  y: number; // floor contact, door centre
  w?: number;
  h?: number;
  open?: number; // 0 closed, 1 open
  light?: number;
  opacity?: number;
  warm?: string;
}) {
  const { x, y, w = 280, h = 520, open = 0, light = 1, opacity = 1, warm = '#FFD9A8' } = o;
  if (opacity <= 0.004) return '';
  const bx = -w / 2;
  const by = -h;
  const leafW = w * (1 - 0.62 * open);
  return `<g transform="translate(${n(x)},${n(y)})" opacity="${n(opacity)}">
    <rect x="${bx - 16}" y="${by - 16}" width="${w + 32}" height="${h + 16}" rx="18" fill="#2A1838"/>
    <path d="${roundRect(bx - 16, by - 16, w + 32, h + 16, 18)}" fill="none" stroke="#5A3C72" stroke-width="6"/>
    <rect x="${bx}" y="${by}" width="${w}" height="${h}" rx="6" fill="#2B1740"/>
    <g opacity="${n(0.25 + 0.75 * open)}">
      <rect x="${bx + 6}" y="${by + 6}" width="${w - 12}" height="${h - 6}" fill="${warm}" opacity="${n(0.1 + 0.85 * open)}" filter="url(#soft)"/>
      <rect x="${bx + 20}" y="${by + 26}" width="${w - 40}" height="${h - 46}" fill="${warm}" opacity="${n(0.9 * open)}"/>
    </g>
    <g transform="translate(${bx},${by}) skewY(${n(-14 * open)}) scale(${n(leafW / w)},1)">
      <path d="${roundRect(0, 0, w, h, 8)}" fill="#7A4B92"/>
      <path d="${roundRect(28, 34, w - 56, h * 0.38, 6)}" fill="none" stroke="#8E5DA6" stroke-width="6"/>
      <path d="${roundRect(28, h * 0.5, w - 56, h * 0.4, 6)}" fill="none" stroke="#8E5DA6" stroke-width="6"/>
    </g>
    <circle cx="${bx + w - 46}" cy="${by + h * 0.52}" r="9" fill="${C.gold}" opacity="${n(1 - open * 0.6)}"/>
    ${open > 0.05 ? `<ellipse cx="0" cy="${-6}" rx="${n(w * 0.9)}" ry="26" fill="${warm}" opacity="${n(0.25 * open)}" filter="url(#soft)"/>` : ''}
  </g>`;
}

/** Small app-style "accept" button. */
export function Button(o: { x: number; y: number; w?: number; h?: number; label: string; p?: number; s?: number; pressed?: number; tone?: 'ember' | 'green' | 'ghost' }) {
  const { x, y, w = 240, h = 88, label, p = 0, s = 1, pressed = 0, tone = 'ember' } = o;
  const fill = tone === 'green' ? mixHex(C.green, '#FFFFFF', 0.05) : tone === 'ghost' ? 'none' : C.hoodie;
  const stroke = tone === 'ghost' ? C.goldSoft : 'none';
  return `<g transform="translate(${n(x)},${n(y)}) scale(${n((s * (1 - pressed * 0.06)) * 1000) / 1000})">
    ${p > 0.02 ? `<rect x="${-w / 2 - 12}" y="${-h / 2 - 12}" width="${w + 24}" height="${h + 24}" rx="${h}" fill="${fill === 'none' ? C.gold : fill}" opacity="${n(0.18 * p)}" filter="url(#soft)"/>` : ''}
    <path d="${roundRect(-w / 2, -h / 2, w, h, h / 2)}" fill="${fill}" stroke="${stroke}" stroke-width="${stroke === 'none' ? 0 : 4}" filter="url(#softShadow)"/>
    ${text(0, h * 0.17, label, { size: h * 0.42, weight: 600, fill: tone === 'ghost' ? C.goldSoft : '#FFF3E4' })}
  </g>`;
}

/** Calendar sheet with accumulating red marks. */
export function Calendar(o: { x: number; y: number; w?: number; h?: number; marks?: number; opacity?: number; s?: number }) {
  const { x, y, w = 380, h = 320, marks = 0, opacity = 1, s = 1 } = o;
  const cols = 6;
  const rows = 4;
  const cw = (w - 70) / cols;
  const ch = (h - 110) / rows;
  let cells = '';
  let k = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      k++;
      const cx = -w / 2 + 44 + c * cw;
      const cy = -h / 2 + 78 + r * ch;
      const marked = k <= marks;
      cells += `<rect x="${n(cx - cw * 0.34)}" y="${n(cy - ch * 0.24)}" width="${n(cw * 0.68)}" height="${n(ch * 0.52)}" rx="6" fill="${marked ? C.red : '#E7D6BE'}" opacity="${marked ? 0.95 : 0.5}"/>`;
    }
  }
  return `<g transform="translate(${n(x)},${n(y)}) scale(${n((s * 1000) / 1000)})" opacity="${n(opacity)}">
    <g filter="url(#softShadow)">
      <path d="${roundRect(-w / 2, -h / 2, w, h, 30)}" fill="${C.paper}"/>
      <path d="${roundRect(-w / 2, -h / 2, w, 54, 26)}" fill="${C.redDeep}"/>
      <rect x="${-w / 2}" y="${-h / 2 + 34}" width="${w}" height="20" fill="${C.redDeep}"/>
    </g>
    ${text(0, -h / 2 + 40, 'THIS MONTH', { size: 27, weight: 600, fill: '#FBE7D8', letter: 3 })}
    ${cells}
  </g>`;
}

/** Wordmark / word block, used for "yes", "no", "SUBSCRIBE". */
export function Word(o: {
  x: number;
  y: number;
  str: string;
  size?: number;
  fill?: string;
  opacity?: number;
  s?: number;
  weight?: number;
  family?: string;
  letter?: number;
  rot?: number;
  serif?: boolean;
}) {
  const { x, y, str, size = 160, fill = C.cream, opacity = 1, s = 1, weight = 600, letter = 0, rot = 0, serif = false } = o;
  if (opacity <= 0.004) return '';
  return `<g transform="translate(${n(x)},${n(y)}) rotate(${n(rot)}) scale(${n((s * 1000) / 1000)})" opacity="${n(opacity)}">${text(0, size * 0.35, str, {
    size,
    weight,
    fill,
    family: serif ? '"Playfair Display", Georgia, serif' : FONT,
    letter,
    italic: serif,
  })}</g>`;
}

/** Heavy cardboard box. */
export function Box(o: { x: number; y: number; s?: number; rot?: number; opacity?: number; label?: string }) {
  const { x, y, s = 1, rot = 0, opacity = 1, label = 'promises' } = o;
  const w = 300;
  const h = 210;
  return `<g transform="translate(${n(x)},${n(y)}) rotate(${n(rot)}) scale(${n((s * 1000) / 1000)})" opacity="${n(opacity)}">
    <g filter="url(#softShadow)">
      <path d="${roundRect(-w / 2, -h, w, h, 12)}" fill="#C99A63"/>
      <path d="M${-w / 2},${-h + 52} h${w} v18 h${-w} Z" fill="#B98B56" opacity="0.8"/>
      <rect x="-12" y="${-h}" width="24" height="52" fill="#E3B77F" opacity="0.7"/>
    </g>
    ${text(0, -h / 2 + 12, label, { size: 40, weight: 500, fill: '#4A3018' })}
  </g>`;
}

/** Little sketchy card (e.g. purchase card, chat icon). */
export function Card(o: { x: number; y: number; w?: number; h?: number; s?: number; rot?: number; opacity?: number; inner?: string; fill?: string; r?: number }) {
  const { x, y, w = 240, h = 160, s = 1, rot = 0, opacity = 1, inner = '', fill = C.paper, r = 22 } = o;
  return `<g transform="translate(${n(x)},${n(y)}) rotate(${n(rot)}) scale(${n((s * 1000) / 1000)})" opacity="${n(opacity)}">
    <path d="${roundRect(-w / 2, -h / 2, w, h, r)}" fill="${fill}" filter="url(#softShadow)"/>
    ${inner}
  </g>`;
}

/** A caption on a soft dark capsule, so it reads over the window/light shaft. */
export function CaptionBand(o: { x?: number; y: number; str: string; size?: number; fill?: string; opacity?: number; weight?: number; padX?: number }) {
  const { x = W / 2, y, str, size = 48, fill = '#F3E1CB', opacity = 1, weight = 500, padX = 54 } = o;
  if (opacity <= 0.004) return '';
  const tw = measure(str, size, weight);
  const w = Math.min(W - 60, tw + padX * 2);
  const h = size * 1.9;
  return `<g opacity="${n(opacity)}">
    <path d="${roundRect(x - w / 2, y - h * 0.66, w, h, h / 2)}" fill="#1B1028" opacity="0.58"/>
    ${text(x, y + size * 0.05, str, { size, weight, fill })}
  </g>`;
}

/** Soft dark band to keep captions legible over bright sets. */
export function Scrim(o: { y?: number; h?: number; opacity?: number; from?: string }) {
  const { y = 1560, h = 360, opacity = 0.55, from = '#170D23' } = o;
  return `<g opacity="${n(opacity)}"><defs><linearGradient id="scrimG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${from}" stop-opacity="0"/><stop offset="0.45" stop-color="${from}" stop-opacity="0.95"/>
    <stop offset="1" stop-color="${from}" stop-opacity="1"/></linearGradient></defs>
    <rect x="0" y="${n(y)}" width="${W}" height="${n(h)}" fill="url(#scrimG)"/></g>`;
}

/** Paper-grain overlay + vignette that goes on top of everything. */
export function Finish(o: { t?: number; grain?: number }) {
  const t = o.t ?? 0;
  const g = o.grain ?? 0.06;
  return `<g pointer-events="none">
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#vigTop)" opacity="0.9"/>
    <rect x="0" y="0" width="${W}" height="${H}" fill="#FFE9C9" opacity="${n(g * (0.6 + 0.4 * Math.sin(t)))}"/>
  </g>`;
}
