/**
 * Contact sheet: render N frames small and tile them into one PNG for review.
 *   node scripts/sheet.mjs 0,60,120,180 [out/sheet.png] [cols]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Resvg } from '@resvg/resvg-js';

const root = path.resolve(import.meta.dirname, '..');
const { renderFrame } = await import('../src/story/render.ts');
const { TOTAL_FRAMES } = await import('../src/story/timeline.ts');

const frames = (process.argv[2] || '0')
  .split(',')
  .map((s) => (s.includes('%') ? Math.round((parseFloat(s) / 100) * TOTAL_FRAMES) : parseInt(s, 10)));
const out = path.resolve(root, process.argv[3] || 'out/sheet.png');
const cols = parseInt(process.argv[4] || '4', 10);
const scale = parseFloat(process.env.SHEET_SCALE || '0.34');

const fontDir = path.join(root, 'public', 'fonts');
const fontFiles = fs.readdirSync(fontDir).filter((f) => f.endsWith('.ttf')).map((f) => path.join(fontDir, f));

const tmp = path.join(root, 'out', 'sheetframes');
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });

frames.forEach((f, i) => {
  const svg = renderFrame(f);
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: Math.round(1080 * scale) },
    font: { loadSystemFonts: false, fontFiles, defaultFontFamily: 'Poppins' },
    background: '#120A1C',
  });
  fs.writeFileSync(path.join(tmp, `${String(i).padStart(3, '0')}.png`), r.render().asPng());
});

const ffmpeg =
  process.env.FFMPEG ||
  path.join(process.env.HOME || '/home/user', '.venv-ff/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2');

const rows = Math.ceil(frames.length / cols);
execFileSync(
  ffmpeg,
  [
    '-y',
    '-framerate', '1',
    '-i', path.join(tmp, '%03d.png'),
    '-vf', `tile=${cols}x${rows}:margin=6:padding=6:color=0x1a1024`,
    '-frames:v', '1',
    out,
  ],
  { stdio: 'inherit' },
);
console.log('sheet ->', out, frames.join(','));
