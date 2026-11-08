/**
 * Offline renderer.
 *
 *   node scripts/render.mjs                 # full film -> out/small-traps.mp4
 *   node scripts/render.mjs --still 120     # single frame -> out/still-120.png
 *   node scripts/render.mjs --stills 0,90,300
 *   node scripts/render.mjs --range 0 240   # first 240 frames (preview)
 *   node scripts/render.mjs --scale 0.5     # half-res draft
 *
 * No browser: frames are pure SVG, rasterized with resvg, then encoded with
 * ffmpeg (from the python venv's imageio-ffmpeg build) and muxed with the
 * narration tracks laid out by src/story/timeline.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { Resvg } from '@resvg/resvg-js';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? def : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);

const VOID = ['getComputedStyle', 'scrollHeight'];
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });

const { renderFrame } = await import('../src/story/render.ts');
const { TOTAL_FRAMES, TIMELINE, FPS } = await import('../src/story/timeline.ts');

const ffmpeg =
  process.env.FFMPEG ||
  path.join(
    process.env.HOME || '/home/user',
    '.venv-ff/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2',
  );

const fontDir = path.join(root, 'public', 'fonts');
const fontFiles = fs.readdirSync(fontDir).filter((f) => f.endsWith('.ttf')).map((f) => path.join(fontDir, f));

const SCALE = parseFloat(flag('scale', '1'));
const W = Math.round(1080 * SCALE);
const H = Math.round(1920 * SCALE);

function rasterize(svg) {
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: W },
    font: { loadSystemFonts: false, fontFiles, defaultFontFamily: 'Poppins' },
    background: '#120A1C',
  });
  return r.render().asPng();
}

const outDir = path.join(root, 'out');
fs.mkdirSync(outDir, { recursive: true });

/* ------------------------------- stills ---------------------------------- */
if (has('still') || has('stills')) {
  const list = has('still') ? [parseInt(flag('still', '0'), 10)] : flag('stills', '0').split(',').map(Number);
  for (const f of list) {
    const png = rasterize(renderFrame(f));
    const p = path.join(outDir, `still-${f}.png`);
    fs.writeFileSync(p, png);
    console.log('wrote', p, png.length);
  }
  process.exit(0);
}

/* -------------------------------- video ---------------------------------- */
const MUX_ONLY = has('muxonly');
const START = parseInt(flag('start', '0'), 10);
const END = parseInt(flag('end', String(TOTAL_FRAMES)), 10);
const outName = flag('out', has('range') ? 'preview.mp4' : 'small-traps.mp4');
const tmp = path.join(outDir, 'frames');
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });

console.log(`rendering frames ${START}..${END} of ${TOTAL_FRAMES} at ${W}x${H}`);

const ff = spawn(
  ffmpeg,
  [
    '-y',
    '-f', 'image2pipe',
    '-framerate', String(FPS),
    '-i', '-',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '17',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    path.join(outDir, 'video-only.mp4'),
  ],
  { stdio: ['pipe', 'inherit', 'inherit'] },
);

let closed = false;
ff.on('close', (c) => {
  closed = true;
  if (c !== 0) console.error('ffmpeg exited', c);
});
if (MUX_ONLY) ff.stdin.end();

const write = (buf) =>
  new Promise((res) => {
    if (ff.stdin.write(buf)) res();
    else ff.stdin.once('drain', res);
  });

const t0 = Date.now();
for (let f = START; !MUX_ONLY && f < END; f++) {
  const png = rasterize(renderFrame(f));
  await write(png);
  if (f % 30 === 0) {
    const el = (Date.now() - t0) / 1000;
    const done = f - START + 1;
    const eta = (el / done) * (END - START - done);
    console.log(`frame ${f}/${END}  ${(done / el).toFixed(1)} fps  eta ${eta.toFixed(0)}s`);
  }
}
if (!MUX_ONLY) {
  ff.stdin.end();
  await new Promise((res) => (closed ? res() : ff.on('close', res)));
}

/* ------------------------------- audio mix -------------------------------- */
const audioOut = path.join(outDir, 'narration.wav');
const inputs = [];
const filters = [];
let offset = 0;
const totalSec = (END - START) / FPS;

// scene offsets in the full timeline; for range renders we shift/clip
for (const b of TIMELINE) {
  const file = path.join(root, 'public', b.audio);
  if (!fs.existsSync(file)) continue;
  const when = b.start + b.lead;
  if (when + 0.01 < START / FPS || when > (START + totalSec)) {
    offset = when + b.voice;
    continue;
  }
  inputs.push('-i', file);
  const idx = inputs.length / 2 - 1;
  const delay = Math.max(0, Math.round((when - START / FPS) * 1000));
  filters.push(`[${idx}:a]adelay=${delay}|${delay},volume=1.0[a${idx}]`);
}
const mixed =
  filters.length > 0
    ? [...inputs, '-filter_complex', `${filters.join(';')};${filters.map((_, i) => `[a${i}]`).join('')}amix=inputs=${filters.length}:duration=longest:normalize=0,alimiter=limit=0.95,volume=1.6[mix]`, '-map', '[mix]', '-ar', '48000', '-ac', '2', audioOut]
    : [];

if (mixed.length) {
  execFileSync(ffmpeg, ['-y', ...mixed], { stdio: 'inherit' });
}

const finalOut = path.join(outDir, outName);
const muxArgs = ['-y', '-i', path.join(outDir, 'video-only.mp4')];
if (fs.existsSync(audioOut)) muxArgs.push('-i', audioOut, '-c:a', 'aac', '-b:a', '192k', '-shortest');
muxArgs.push('-c:v', 'copy', '-movflags', '+faststart', finalOut);
execFileSync(ffmpeg, muxArgs, { stdio: 'inherit' });
fs.copyFileSync(finalOut, path.join(root, 'public', 'small-traps.mp4'));
console.log('done ->', finalOut);
