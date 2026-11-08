// Scenes 1–4: hook, setup, the request, the aftermath.
import { C, FONT, H, W, clamp01, ease, easeOut, easeOutBack, easeOutElastic, kf, lerp, n, roundRect, seg, text } from './lib.ts';
import { Character, LoomingFigure, Stranger, wallShadow } from './character.ts';
import {
  Box,
  Calendar,
  Card,
  Clock,
  Door,
  Phone,
  Room,
  SpeechBubble,
  ThoughtBubble,
  Word,
  mixHex,
} from './props.ts';
import { Camera, InnerPanel, Sparkles, cut, frame, groundY, shots } from './stage.ts';

/* --------------------------------- helpers -------------------------------- */

function Chair(x: number, y: number, o: { opacity?: number; front?: number } = {}) {
  const { opacity = 1, front = 1 } = o;
  const w = 250;
  const seatY = -128;
  return `<g transform="translate(${n(x)},${n(y)})" opacity="${n(opacity)}">
    <rect x="${-w / 2}" y="${seatY - 210}" width="${w}" height="210" rx="26" fill="#37224A"/>
    <rect x="${-w / 2 + 16}" y="${seatY - 194}" width="${w - 32}" height="130" rx="18" fill="#412A57" opacity="0.8"/>
    <rect x="${-w / 2 - 14}" y="${seatY - 10}" width="${w + 28}" height="30" rx="14" fill="#4A3060"/>
    <g opacity="${n(front)}">
      <rect x="${-w / 2 + 6}" y="${seatY + 18}" width="18" height="${-seatY - 18}" rx="9" fill="#2E1C3E"/>
      <rect x="${w / 2 - 24}" y="${seatY + 18}" width="18" height="${-seatY - 18}" rx="9" fill="#2E1C3E"/>
      <rect x="${-w / 2 + 6}" y="${seatY + 18}" width="${w - 12}" height="16" rx="8" fill="#2A1838"/>
    </g>
  </g>`;
}

function Caption(o: { t: number; at: number; out?: number; str: string; y?: number; size?: number; o2?: number; opacity?: number }) {
  const { t, at, out = 99, y = 1710, size = 46, o2 = 1500 } = o;
  const op = clamp01(Math.min(seg(t, at, at + 0.4), 1 - seg(t, out, out + 0.4)));
  if (op <= 0.004) return '';
  return text(W / 2, y, o.str, { size, weight: 500, fill: '#F7E9D6', opacity: op * 0.94, letter: 0.4 });
}

/* ------------------------------- 1. HOOK --------------------------------- */

export function SceneHook(t: number, dur: number) {
  const g = groundY + 210;
  const cx = 286;

  const hold = kf(t, [[0, 0.55], [0.7, 1], [3.0, 1], [3.9, 0.45]]);
  const tapX = seg(t, 2.4, 2.75);
  const pressed = seg(t, 2.58, 2.72) * (1 - seg(t, 2.85, 3.2));
  const slump = ease(seg(t, 3.05, 4.4));
  const sigh = Math.sin(t * 1.4);

  const zoom = kf(t, [[0, 1.02], [2.4, 1.07], [4.6, 1.0], [dur, 1.06]]);

  const phoneY = lerp(-262, -170, slump);
  const phoneRot = lerp(-5, -20, slump);
  const phoneS = lerp(1.02, 0.8, slump) * lerp(0.82, 1, hold);
  const phoneA = lerp(0.35, 1, hold);

  const heroFace = t < 2.9 ? (t < 1.5 ? 'neutral' : 'worried') : 'sad';

  const room = Room({ t, floorY: groundY + 100, light: 1 - 0.5 * seg(t, 3.4, 5.4), beamOpacity: 1 - 0.45 * seg(t, 3.4, 5.4) });

  const body = `
    ${Chair(cx + 6, g + 6, { front: 1, opacity: 0.9 })}
    ${Character({
      x: cx,
      y: g,
      s: 1.34,
      face: heroFace,
      look: 'down',
      lean: lerp(0, -8, slump),
      tilt: lerp(-2, 12, slump),
      squash: lerp(1, 0.94, slump),
      bob: slump * 10,
      armL: { a: lerp(10, 18, slump), b: 4, hand: 'open' },
      armR: { a: lerp(20, 30, hold), b: lerp(26, -4, hold) + tapX * 18, hand: 'open' },
      breathing: t + sigh * 0.2,
      hood: 0.6,
    })}
    ${Phone({
      x: cx + 356,
      y: g - 340 + phoneY * 0.1,
      s: phoneS * 1.3,
      rot: phoneRot,
      opacity: phoneA,
      sender: 'Sam',
      messages: [
        { side: 'in', txt: 'Can you help me?', at: 0.95, t },
        { side: 'out', txt: 'yes', at: 2.66, t },
      ],
      typing: clamp01(seg(t, 1.55, 1.75)) * (1 - seg(t, 2.35, 2.55)),
    })}
    ${SpeechBubble({
      x: cx - 6,
      y: g - 690,
      text: 'Can you help me?',
      size: 42,
      tail: 'bl',
      w: 560,
      opacity: clamp01(seg(t, 0.65, 1.0)) * (1 - seg(t, 4.3, 5.0)),
      s: 0.9 + easeOutBack(seg(t, 0.65, 1.2), 1.3) * 0.1,
    })}
    ${pressed > 0.05 ? `<g transform="translate(${n(cx + 330 + 90)},${n(g - 190 + phoneY * 0.15)})" opacity="${n(0.55 * pressed)}"><circle r="${n(20 + pressed * 90)}" fill="none" stroke="${C.hoodieLight}" stroke-width="6" opacity="${n(1 - pressed)}"/></g>` : ''}
  `;

  return frame(`
    <defs><clipPath id="frameClip"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath></defs>
    ${Camera(room, { zoom, cy: H * 0.58, t })}
    ${Camera(body, { zoom, cy: H * 0.58, t })}
    ${Caption({ t, at: 0.1, out: 2.55, str: 'in one second…', size: 52 })}
    ${Caption({ t, at: 3.5, str: '…and you lost your day.', size: 54 })}
  `);
}

/* ------------------------------- 2. SETUP -------------------------------- */

export function SceneSetup(t: number, dur: number) {
  const g = groundY + 300;
  const cx = W / 2;

  // beats: A) "not a weak personality"  B) the brain's guard  C) the price, later
  const A = 0.2;
  const B = 3.4;
  const CP = 7.4;

  const zoom = kf(t, [
    [0, 1.0],
    [B + 1.6, 1.05],
    [CP, 1.0],
    [dur, 1.06],
  ]);

  const tagOut = 1 - seg(t, B - 0.4, B + 0.1);
  const guardIn = easeOutBack(seg(t, B, B + 0.65), 1.25);
  const guardOut = 1 - seg(t, CP - 0.45, CP + 0.05);
  const shield = ease(seg(t, B + 1.2, B + 1.9));
  const priceIn = clamp01(seg(t, CP, CP + 0.5));

  const spin = Math.pow(seg(t, CP, CP + 2.4), 1.5) * 24 + Math.max(0, t - CP) * 2.0;
  const mood = seg(t, CP + 2.6, CP + 4.0);

  const room = Room({ t, floorY: groundY + 120, light: 0.9, beamOpacity: 0.75 });

  const hero = Character({
    x: cx,
    y: g,
    s: 1.18,
    face: t < CP ? (t < B ? 'worried' : 'flat') : mood > 0.45 ? 'annoyed' : 'sad',
    look: t < CP ? 'up' : 'down',
    armL: { a: 9 },
    armR: { a: 11 + shield * 6 },
    breathing: t,
    hood: 0.55,
    bob: Math.sin(t * 1.3) * 1.6,
  });

  /* --- A: the label that gets crossed out --- */
  const tag = `
    <g opacity="${n(clamp01(seg(t, A, A + 0.45)) * tagOut)}">
      <g transform="translate(${W / 2},${n(560)}) rotate(-1.5)">
        <path d="${roundRect(-352, -84, 704, 168, 34)}" fill="#241733" opacity="0.82"/>
        <path d="${roundRect(-352, -84, 704, 168, 34)}" fill="none" stroke="#4A3560" stroke-width="3" opacity="0.7"/>
        ${text(0, 24, 'a  weak  personality', { size: 62, weight: 500, fill: '#EFDFCB' })}
        <g transform="scale(${n((easeOut(seg(t, A + 0.7, A + 1.35)) * 100) / 100)},1)">
          <rect x="-330" y="-5" width="660" height="10" rx="5" fill="${C.red}"/>
        </g>
      </g>
      ${text(W / 2, 740, 'no.', { size: 46, weight: 600, fill: C.goldSoft, opacity: clamp01(seg(t, A + 1.4, A + 1.8)) })}
    </g>`;

  /* --- B: the brain's little guard, inside one dark card --- */
  const guardCard = `
    <g transform="translate(${W / 2},${n(880)}) scale(${n((0.92 + guardIn * 0.08) * 1000) / 1000})" opacity="${n(guardIn * guardOut)}">
      <path d="${roundRect(-390, -230, 780, 460, 64)}" fill="#241733" opacity="0.96" filter="url(#softShadow)"/>
      <path d="${roundRect(-390, -230, 780, 460, 64)}" fill="none" stroke="#4A3560" stroke-width="3" opacity="0.65"/>
      <ellipse cx="0" cy="-10" rx="330" ry="180" fill="#2E1B40" opacity="0.85"/>
      ${Character({
        x: -10,
        y: 150,
        s: 0.56,
        face: 'flat',
        look: 'right',
        armR: { a: 14 + shield * 80, b: -18, hand: 'flat' },
        armL: { a: 8 },
        hood: 0.35,
        breathing: t,
      })}
      ${(() => {
        if (shield < 0.02) return '';
        return `<g transform="translate(132,${n(20 - shield * 150)}) rotate(${n(-12 * shield)})" opacity="${n(shield)}">
          <path d="M0,-96 q76,26 76,26 l-8,96 q-34,44 -68,44 q-34,0 -68,-44 l-8,-96 q76,-26 76,-26 Z" fill="${C.goldSoft}"/>
          <path d="M0,-96 q76,26 76,26 l-8,96 q-34,44 -68,44 q-34,0 -68,-44 l-8,-96 q76,-26 76,-26 Z" fill="none" stroke="#C9924E" stroke-width="5" opacity="0.8"/>
          <path d="M-34,-40 q34,20 68,0 l-4,60 q-30,26 -60,0 Z" fill="#C9924E" opacity="0.28"/>
        </g>`;
      })()}
      ${text(0, 196, 'YOUR  BRAIN  ·  ON  GUARD', { size: 26, weight: 600, fill: '#A98BBD', letter: 5 })}
    </g>`;

  /* --- C: the price shows up later — clock + tiny operator --- */
  const pw = 820;
  const ph = 480;
  const clockCard = `
    <g transform="translate(${W / 2},${n(880)}) scale(${n((0.94 + priceIn * 0.06) * 1000) / 1000})" opacity="${n(clamp01(seg(t, CP - 0.1, CP + 0.35)))}">
      <path d="${roundRect(-pw / 2, -ph / 2, pw, ph, 62)}" fill="#241733" opacity="0.96" filter="url(#softShadow)"/>
      <path d="${roundRect(-pw / 2, -ph / 2, pw, ph, 62)}" fill="none" stroke="#4A3560" stroke-width="3" opacity="0.65"/>
      ${Clock({ x: -206, y: -10, r: 148, time: spin, p: mood * 0.9, opacity: 1 })}
      <g transform="translate(168,${n(46)})">
        ${Character({
          x: 0,
          y: 0,
          s: 0.62,
          face: mood > 0.5 ? 'annoyed' : 'happy',
          look: 'center',
          armL: { a: 10 },
          armR: { a: 12, b: lerp(0, 40, 1 - mood) },
          breathing: t,
          hood: 0.4,
        })}
        <path d="${roundRect(-96, 26, 192, 66, 33)}" fill="${mood > 0.5 ? '#5A3A74' : '#3E2A52'}" stroke="#1D1129" stroke-width="4"/>
        ${text(0, 70, 'ACCEPT', { size: 30, weight: 600, fill: mood > 0.5 ? '#C9B2DA' : '#8FD3AE', letter: 2 })}
      </g>
      ${text(0, 206, 'the moment  ·  the price', { size: 25, weight: 500, fill: '#A98BBD', letter: 4 })}
    </g>`;

  const priceLines = `
    <g opacity="${n(clamp01(seg(t, CP + 1.4, CP + 1.9)))}">
      <rect x="0" y="1660" width="${W}" height="260" fill="#1B1028" opacity="0.45"/>
      ${text(W / 2, 1762, 'the price shows up later…', { size: 46, weight: 400, fill: '#EDD9C1' })}
      ${text(W / 2, 1852, 'as silent resentment.', { size: 56, weight: 600, fill: C.red, opacity: clamp01(seg(t, CP + 2.4, CP + 3.0)) })}
    </g>`;

  return frame(`
    <defs><clipPath id="frameClip"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath></defs>
    ${Camera(room, { zoom, cy: H * 0.56, t })}
    ${Camera(hero, { zoom, cy: H * 0.56, t })}
    ${Camera(tag, { zoom, cy: H * 0.56, t })}
    ${Camera(guardCard, { zoom, cy: H * 0.56, t })}
    ${Camera(clockCard, { zoom, cy: H * 0.56, t })}
    ${Camera(priceLines, { zoom: 1, cy: H * 0.56, t })}
  `);
}

/* ------------------------------ 3. REQUEST ------------------------------- */

export function SceneRequest(t: number, dur: number) {
  const g = groundY + 190;
  const cx = 330;

  const walk = ease(seg(t, 0, 1.6));
  const loom = ease(seg(t, 1.9, 3.4));
  const lean = ease(seg(t, 6.2, 8.4));
  const shrink = ease(seg(t, 7.4, 10.2));
  const bubbleIn = easeOutBack(seg(t, 4.0, 4.7), 1.3);

  const zoom = kf(t, [
    [0, 1.02],
    [3.2, 1.0],
    [6.2, 1.03],
    [10.2, 1.1],
    [dur, 1.12],
  ]);
  const shake = 2.2 * seg(t, 2.0, 3.2) * (1 - seg(t, 3.8, 4.4)) + 1.1 * seg(t, 7.2, 8.0) * (1 - seg(t, 9.0, 9.8));

  const doorOpen = 0.12 + 0.06 * Math.sin(t * 0.7);
  const room = Room({ t, floorY: g + 30, light: 0.3, beamOpacity: 0.3, dust: 0.7, warm: 0.5 });

  const heroS = 1.06 * (1 - shrink * 0.22);
  const hero = `
    ${wallShadow(cx + 60, g + 4, 0.95 + lean * 0.4, 0.22 + loom * 0.4)}
    ${Character({
      x: cx + walk * 70,
      y: g,
      s: heroS,
      face: t < 4 ? 'worried' : 'sad',
      look: 'right',
      tilt: -3,
      armL: { a: 6 },
      armR: { a: 8 },
      breathing: t,
      hood: 0.7,
      lean: -1 - shrink * 3,
      bob: Math.sin(t * 1.4) * 1.2,
    })}
    ${LoomingFigure({
      x: cx + 330 + lean * 60,
      y: g + 10,
      s: 0.86 + lean * 0.16,
      opacity: 0.45 + loom * 0.42,
      sway: 0.9 * Math.sin(t * 0.6),
    })}
  `;

  const bubble = SpeechBubble({
    x: 470,
    y: 700,
    text: '“if I say no,\nI’ll be alone.”',
    size: 52,
    weight: 600,
    tail: 'bl',
    opacity: clamp01(seg(t, 3.95, 4.3)),
    s: 0.9 + bubbleIn * 0.1,
    w: 640,
    padY: 40,
  });

  const closer = text(W / 2, 1735, '“if you refuse… they’ll hate you.”', {
    size: 44,
    weight: 500,
    fill: '#F0DAC0',
    opacity: clamp01(seg(t, 8.2, 8.8)) * 0.96,
  });

  return frame(`
    <defs><clipPath id="frameClip"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath></defs>
    ${Camera(room, { zoom, cy: H * 0.56, t, shake })}
    ${Camera(hero, { zoom, cy: H * 0.56, t, shake })}
    ${Camera(Door({ x: 800, y: g + 10, w: 280, h: 540, open: doorOpen, light: 0.3 }), { zoom, cy: H * 0.56, t, shake })}
    ${Camera(bubble, { zoom: 1 + (zoom - 1) * 0.5, cy: H * 0.56, t })}
    ${Camera(closer, { zoom: 1, cy: H * 0.56, t })}
  `);
}

/* ------------------------------- 4. AFTER -------------------------------- */

export function SceneAfter(t: number, dur: number) {
  const g = groundY + 70;

  const marks = Math.round(seg(t, 1.4, 5.6) * 22);
  const carry = ease(seg(t, 6.0, 7.6));
  const walkPhase = Math.max(0, t - 6.4);
  const stepFwd = ease(seg(t, 6.2, 11.4));
  const zoom = kf(t, [
    [0, 1.02],
    [2.4, 1.12],
    [6.0, 1.0],
    [dur, 1.05],
  ]);

  const room = Room({ t, floorY: g + 20, light: 0.5, beamOpacity: 0.45, warm: 0.8 });

  const quickYes = `
    <g opacity="${n(Math.min(seg(t, 0.1, 0.5), 1 - seg(t, 1.15, 1.5)))}">
      <g transform="translate(${W / 2},${n(g - 420)}) scale(${n(kf(t, [[0, 0.62], [2, 0.86]]))})">
        ${Phone({
          x: 0,
          y: 0,
          s: 1,
          rot: kf(t, [[0, -6], [1.6, 2]]),
          sender: 'Sam',
          messages: [
            { side: 'in', txt: 'Can you help me?', at: 0.05, t },
            { side: 'out', txt: 'yes', at: 0.55, t },
          ],
        })}
      </g>
      ${text(W / 2, 640, 'the moment disappears…', { size: 62, weight: 600, fill: '#F3E2CC', opacity: Math.min(seg(t, 0.8, 1.2), 1 - seg(t, 2.1, 2.5)) })}
    </g>`;

  const calendar = `
    <g opacity="${n(Math.min(seg(t, 1.7, 2.2), 1 - seg(t, 5.7, 6.1)))}">
      <g transform="translate(${W / 2},${n(940)}) rotate(${n(-2 + Math.sin(t * 0.9) * 0.6)})">
        ${Calendar({ x: 0, y: 0, w: 620, h: 470, marks })}
      </g>
      ${text(W / 2, 1330, 'the lost time remains.', { size: 56, weight: 500, fill: '#F0DDC6', opacity: clamp01(seg(t, 3.0, 3.5)) })}
      ${text(W / 2, 560, 'hours later', { size: 40, weight: 400, fill: C.goldSoft, opacity: clamp01(seg(t, 4.0, 4.5)) })}
    </g>`;

  const heroCarry = `
    <g opacity="${n(clamp01(seg(t, 6.0, 6.4)))}">
      ${Character({
        x: W / 2 + 30 - stepFwd * 70,
        y: g,
        s: 1.12,
        face: t < 8 ? 'sad' : 'annoyed',
        look: 'down',
        lean: -4 - 2 * Math.sin(walkPhase * 1.6),
        tilt: 8,
        squash: 0.96,
        bob: Math.abs(Math.sin(walkPhase * 3.1)) * -5,
        armL: { a: 58, b: 16, hand: 'open' },
        armR: { a: 58, b: 16, hand: 'open' },
        breathing: t,
        hood: 0.8,
      })}
      ${Box({
        x: W / 2 + 30 - stepFwd * 70,
        y: g - 104,
        s: 0.92,
        rot: -4 + Math.sin(walkPhase * 3.1) * 1.5,
        label: 'promises',
      })}
      ${text(W / 2, 1640, '“why did I agree?”', { size: 62, weight: 600, fill: C.goldSoft, opacity: clamp01(seg(t, 7.4, 7.9)) })}
    </g>`;

  return frame(`
    <defs><clipPath id="frameClip"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath></defs>
    ${Camera(room, { zoom, cy: H * 0.56, t })}
    ${Camera(quickYes, { zoom: 1 + (zoom - 1) * 0.6, cy: H * 0.56, t })}
    ${Camera(calendar, { zoom, cy: H * 0.56, t })}
    ${Camera(heroCarry, { zoom, cy: H * 0.56, t })}
  `);
}
