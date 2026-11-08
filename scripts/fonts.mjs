/**
 * Convert the woff2 files shipped by @fontsource into .ttf so the offline
 * rasterizer (resvg) can embed them, and copy woff2 into public/fonts for the
 * browser player.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'public', 'fonts');
fs.mkdirSync(outDir, { recursive: true });

const sets = [
  { pkg: 'poppins', faces: [[400, 'n'], [500, 'n'], [600, 'n']] },
  { pkg: 'playfair-display', faces: [[500, 'n'], [600, 'n']] },
];

const py = process.env.PYTHON || 'python3';
const ttfJobs = [];

for (const s of sets) {
  for (const [w, style] of s.faces) {
    const base = `${s.pkg}-latin-${w}-${style === 'n' ? 'normal' : 'italic'}`;
    const src = path.join(root, 'node_modules', '@fontsource', s.pkg, 'files', `${base}.woff2`);
    const ttfWoff = path.join(root, 'node_modules', '@fontsource', s.pkg, 'files', `${base}.woff`);
    if (!fs.existsSync(src)) {
      console.warn('missing font', src);
      continue;
    }
    fs.copyFileSync(src, path.join(outDir, `${base}.woff2`));
    const ttf = path.join(outDir, `${base}.ttf`);
    // fontTools reads woff (zlib) without brotli; woff2 needs brotli.
    const from = fs.existsSync(ttfWoff) ? ttfWoff : src;
    ttfJobs.push({ from, ttf });
    console.log('font', path.basename(from), '->', path.basename(ttf));
  }
}

if (ttfJobs.length) {
  const script = `
import sys, json
from fontTools.ttLib import TTFont
jobs = json.loads(sys.argv[1])
for j in jobs:
    f = TTFont(j["from"], fontNumber=0)
    f.flavor = None
    f.save(j["ttf"])
print("fonts-ok", len(jobs))
`;
  fs.writeFileSync(path.join(root, 'scripts', '_woff2ttf.py'), script);
  const out = execFileSync(py, [path.join(root, 'scripts', '_woff2ttf.py'), JSON.stringify(ttfJobs)], {
    encoding: 'utf8',
  });
  console.log(out.trim());
}
