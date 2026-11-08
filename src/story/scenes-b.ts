// Scenes 5–7: the one-sentence solution, the door payoff, the outro.
import { C, FONT, H, W, clamp01, ease, easeOut, easeOutBack, kf, lerp, n, roundRect, seg, text } from './lib.ts';
import { Character, LoomingFigure, Stranger } from './character.ts';
import { CaptionBand, Card, Clock, Door, Phone, Room, Scrim, SpeechBubble, Word, mixHex } from './props.ts';
import { Camera, Sparkles, frame, groundY } from './stage.ts';

/* ------------------------------ 5. SOLUTION ------------------------------ */

export function SceneSolution(t: number, dur: number) {
  const g = groundY + 150;
  const cx = W / 2;

  const harsh = ease(seg(t, 0.1, 0.9)) * (1 - seg(t, 2.6, 3.2));
  const lift = easeOut(seg(t, 5.4, 6.6));
  const breathIn = seg(t, 6.6, 7.8);
  const breathe = Math.sin(Math.min(1, breathIn) * Math.PI * 1.2);
  const flip = ease(seg(t, 9.2, 10.6)); // red -> green
  const lineIn = easeOutBack(seg(t, 3.4, 4.3), 1.35);

  const zoom = kf(t, [
    [0, 1.05],
    [3.2, 1.0],
    [6.4, 1.06],
    [9.0, 1.02],
    [dur, 1.1],
  ]);

  const room = Room({ t, floorY: g + 20, light: 0.55 + 0.35 * flip, beamOpacity: 0.6 + 0.4 * flip, warm: 1 });

  const halo = `<g opacity="${n(0.25 + 0.55 * flip)}">
    <ellipse cx="${cx}" cy="${n(g - 300)}" rx="${n(320 + 30 * Math.sin(t * 1.6))}" ry="${n(360)}" fill="#FFD9A8" opacity="${n(0.1 + 0.12 * flip)}" filter="url(#soft)"/>
  </g>`;

  const hero = Character({
    x: cx,
    y: g,
    s: 1.2,
    face: flip > 0.5 ? 'relieved' : lift > 0.3 ? 'worried' : 'flat',
    look: lift > 0.3 ? 'center' : 'right',
    lean: lerp(harsh * 6, 0, lift),
    tilt: lerp(-harsh * 5, 2, lift),
    armR: {
      a: lerp(10, 4, lift),
      b: lerp(0, -6, lift) + lift * 62,
      hand: lift > 0.4 ? ('flat' as const) : ('open' as const),
    },
    armL: { a: 8 + breathe * 3 },
    breathing: t,
    hood: 0.5,
    squash: 1 + breathe * 0.01,
  });

  const sentence = SpeechBubble({
    x: cx,
    y: 830,
    text: '“Let me check…\nand I’ll get back to you.”',
    size: 54,
    weight: 600,
    tail: 'b',
    w: 800,
    padY: 44,
    opacity: clamp01(seg(t, 3.4, 3.7)),
    s: 0.86 + lineIn * 0.14,
  });

  const redGreen = `
    <g opacity="${n(clamp01(seg(t, 6.9, 7.4)))}">
      ${Clock({ x: cx + 372, y: g - 420, r: 104, time: 0.15 + t * 0.02, p: flip, opacity: 1, label: '' })}
      ${text(cx + 372, g - 268, 'one moment.', { size: 38, weight: 500, fill: '#EBD6BE', opacity: 0.95 })}
      ${text(cx + 340, g - 150, flip > 0.6 ? 'one second kept' : 'one second lost', {
        size: 32,
        weight: 500,
        fill: flip > 0.6 ? C.green : C.red,
        opacity: 0.95,
      })}
    </g>`;

  const harshLine = `
    <g opacity="${n(harsh)}">
      ${CaptionBand({ y: 400, str: 'the goal isn’t to become harsh', size: 46, fill: '#F0DCC6' })}
      <g transform="translate(${W / 2},${n(452)})">
        <path d="${roundRect(-370, -66, 740, 132, 26)}" fill="#2A1838" opacity="0.7"/>
        ${text(0, 26, 'rude · cold · distant', { size: 54, weight: 500, fill: '#B79CC8' })}
      </g>
    </g>`;

  const breakText = text(W / 2, 1690, 'that sentence breaks the trap.', {
    size: 50,
    weight: 600,
    fill: C.goldSoft,
    opacity: clamp01(seg(t, 9.4, 9.9)),
  });

  return frame(`
    <defs><clipPath id="frameClip"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath></defs>
    ${Camera(room + halo, { zoom, cy: H * 0.56, t })}
    ${Camera(hero, { zoom, cy: H * 0.56, t })}
    ${Camera(harshLine, { zoom: 1 + (zoom - 1) * 0.3, cy: H * 0.56, t })}
    ${Camera(sentence, { zoom: 1, cy: H * 0.56, t })}
    ${Camera(redGreen, { zoom, cy: H * 0.56, t })}
    ${Camera(breakText, { zoom: 1, cy: H * 0.56, t })}
    ${flip > 0.3 ? Sparkles({ x: cx, y: g - 260, t, r: 420, n: 12, opacity: 0.32 * flip, spread: 1.1 }) : ''}
  `);
}

/* ------------------------------- 6. PAYOFF ------------------------------- */

export function ScenePayoff(t: number, dur: number) {
  const g = groundY + 70;
  const cx = 470;

  const doorOpen = ease(seg(t, 2.6, 4.6));
  const handle = easeOut(seg(t, 0.4, 1.6));
  const lightUp = ease(seg(t, 3.0, 6.0));
  const wordSwap = seg(t, 6.2, 7.8); // "yes" morphs into a door glyph
  const zoom = kf(t, [
    [0, 1.04],
    [3.4, 1.0],
    [6.4, 1.05],
    [dur, 1.12],
  ]);

  const room = Room({ t, floorY: g + 20, light: 0.4 + 0.75 * lightUp, beamOpacity: 0.4 + 0.9 * lightUp, warm: 1 });

  const spill = `<g opacity="${n(lightUp)}">
    <polygon points="${cx + 280},${g - 380} ${cx + 420},${g - 380} ${W + 260},${g + 420} ${cx + 60},${g + 420}" fill="#FFD9A8" opacity="${n(0.16 * lightUp)}" filter="url(#soft)"/>
  </g>`;

  const hero = Character({
    x: cx,
    y: g,
    s: 1.2,
    face: lightUp > 0.4 ? 'relieved' : 'thinking',
    look: 'right',
    lean: -2,
    armR: {
      a: 8,
      b: lerp(0, -10, handle),
      len: 1 + handle * 0.55,
      hand: 'open',
    },
    armL: { a: 8 },
    breathing: t,
    hood: 0.5,
  });

  const words = `
    <g transform="translate(${W / 2},${n(700)})">
      ${Word({ x: 0, y: 0, str: '“no”', size: 190, fill: mixHex(C.cream, '#FFC98F', wordSwap), opacity: 1 - wordSwap, s: 1 + wordSwap * 0.2 })}
      <g opacity="${n(clamp01((wordSwap - 0.22) / 0.78))}" transform="translate(0,${n(-30)}) scale(${n((0.5 + wordSwap * 0.7) * 1000) / 1000})">
        <path d="${roundRect(-132, -180, 264, 372, 22)}" fill="#FFD9A8" opacity="0.3" filter="url(#soft)"/>
        <path d="${roundRect(-112, -162, 224, 348, 16)}" fill="#5B3A72"/>
        <path d="${roundRect(-100, -150, 200, 324, 12)}" fill="#F6E5CE"/>
        <path d="${roundRect(-70, -118, 140, 128, 8)}" fill="none" stroke="#D3AE86" stroke-width="9"/>
        <path d="${roundRect(-70, 34, 140, 108, 8)}" fill="none" stroke="#D3AE86" stroke-width="9"/>
        <circle cx="74" cy="14" r="11" fill="${C.gold}"/>
      </g>
    </g>`;

  const scrim = Scrim({ y: 1470, h: 450, opacity: 0.78 });
  const caption1 = CaptionBand({ y: 470, str: 'boundaries are not a wall.', size: 48, fill: '#F2DFC8', opacity: clamp01(seg(t, 0.2, 0.7)) * (1 - seg(t, 2.6, 3.1)) });
  const caption2 = CaptionBand({ y: 470, str: 'a door — with the handle on your side.', size: 44, weight: 600, fill: C.goldSoft, opacity: clamp01(seg(t, 3.0, 3.5)) * (1 - seg(t, 6.4, 6.9)) });
  const caption3 = text(W / 2, 1700, 'it isn’t a person.', { size: 56, weight: 500, fill: '#EFDAC2', opacity: clamp01(seg(t, 7.2, 7.7)) * (1 - seg(t, 9.0, 9.4)) });
  const caption4 = text(W / 2, 1700, 'it’s a “yes” you didn’t mean.', { size: 60, weight: 600, fill: C.hoodieLight, opacity: clamp01(seg(t, 9.0, 9.5)) });

  return frame(`
    <defs><clipPath id="frameClip"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath></defs>
    ${Camera(room, { zoom, cy: H * 0.56, t })}
    ${Camera(Door({ x: cx + 300, y: g + 10, w: 320, h: 600, open: doorOpen, light: lightUp }), { zoom, cy: H * 0.56, t })}
    ${Camera(spill, { zoom, cy: H * 0.56, t })}
    ${Camera(hero, { zoom, cy: H * 0.56, t })}
    ${Camera(words, { zoom: 1 + (zoom - 1) * 0.5, cy: H * 0.56, t })}
    ${clamp01(seg(t, 7.0, 7.5)) > 0.01 ? scrim : ''}
    ${Camera(`${caption1}${caption2}${caption3}${caption4}`, { zoom: 1, cy: H * 0.56, t })}
    ${lightUp > 0.2 ? Sparkles({ x: cx + 300, y: g - 320, t, r: 320, n: 10, opacity: 0.28 * lightUp, spread: 0.9 }) : ''}
  `);
}

/* -------------------------------- 7. OUTRO ------------------------------- */

export function SceneOutro(t: number, dur: number) {
  const g = groundY + 190;
  const cx = W / 2;

  const typing = clamp01(seg(t, 1.3, 1.6)) * (1 - seg(t, 3.2, 3.5));
  const sub = easeOutBack(seg(t, 4.3, 5.2), 1.15);
  const nextIn = ease(seg(t, 6.6, 7.5));
  const endFade = 1 - seg(t, dur - 1.0, dur);

  const zoom = kf(t, [
    [0, 1.05],
    [3.8, 1.0],
    [6.4, 1.03],
    [dur, 1.0],
  ]);

  const room = Room({ t, floorY: g + 20, light: 0.7, beamOpacity: 0.62 });

  const hero = Character({
    x: 300,
    y: g,
    s: 1.12,
    face: 'relieved',
    look: 'right',
    armL: { a: 10 },
    armR: { a: 30, b: 26, hand: 'open' },
    breathing: t,
    hood: 0.5,
  });

  const phone = Phone({
    x: 764,
    y: g - 500,
    s: 0.78,
    rot: -5,
    sender: 'you',
    messages: [
      { side: 'in', txt: 'Can you help me?', at: 0.3, t },
      { side: 'out', txt: 'let me check…', at: 2.0, t },
    ],
    typing,
  });

  const question = text(cx, 620, 'when did you last say “yes”\nand mean “no”?', {
    size: 58,
    weight: 600,
    fill: '#F6E6D2',
    opacity: clamp01(seg(t, 0.2, 0.7)),
  });

  const subBtn = `<g transform="translate(${n(700)},${n(1330)}) scale(${n((0.72 + sub * 0.28) * 1000) / 1000})" opacity="${n(clamp01(seg(t, 4.3, 4.6)))}">
    <path d="${roundRect(-236, -58, 472, 116, 58)}" fill="${C.red}" filter="url(#softShadow)"/>
    <path d="${roundRect(-236, -58, 472, 116, 58)}" fill="none" stroke="#FFB29A" stroke-width="3" opacity="0.5"/>
    ${text(0, 18, 'SUBSCRIBE', { size: 48, weight: 600, fill: '#FFF1E2', letter: 4 })}
  </g>`;

  const nextCard = `<g opacity="${n(nextIn)}" transform="translate(${cx},${n(1700)})">
    <g transform="translate(0,${n((1 - nextIn) * 40)})">
      ${Card({ x: 0, y: 0, w: 700, h: 180, s: 1, rot: -1.2, inner: `
        ${text(-300, -16, 'NEXT EPISODE', { size: 24, weight: 600, fill: '#9A7A62', anchor: 'start', letter: 4 })}
        ${text(-300, 46, 'why do you regret purchases?', { size: 38, weight: 600, fill: C.ink, anchor: 'start' })}
        ${text(258, 42, '?', { size: 96, weight: 600, fill: C.red, opacity: 0.5 })}
      ` })}
    </g>
  </g>`;

  const logo = `<g opacity="${n(clamp01(seg(t, dur - 2.4, dur - 1.7)) * endFade)}" transform="translate(${cx},${n(330)})">
    ${text(0, 0, 'SMALL TRAPS', { size: 42, weight: 600, fill: '#E4C9AA', letter: 9 })}
    ${text(0, 58, 'ep. 01', { size: 30, weight: 400, fill: '#B79CC8', letter: 3 })}
  </g>`;

  return frame(`
    <defs><clipPath id="frameClip"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath></defs>
    ${Camera(room, { zoom, cy: H * 0.56, t })}
    ${Camera(hero + phone, { zoom, cy: H * 0.56, t })}
    ${Camera(question, { zoom: 1, cy: H * 0.56, t })}
    ${Camera(subBtn, { zoom: 1, cy: H * 0.56, t })}
    ${Camera(nextCard, { zoom: 1, cy: H * 0.56, t })}
    ${Camera(logo, { zoom: 1, cy: H * 0.56, t })}
    ${endFade < 0.999 ? `<rect x="0" y="0" width="${W}" height="${H}" fill="#120A1C" opacity="${n(1 - endFade)}"/>` : ''}
  `);
}
