import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="960" viewBox="0 0 540 960">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#57306e"/><stop offset="1" stop-color="#3a2450"/></linearGradient>
<radialGradient id="l" cx="0.5" cy="0.4" r="0.6"><stop offset="0" stop-color="#c98a5a" stop-opacity="0.45"/><stop offset="1" stop-color="#c98a5a" stop-opacity="0"/></radialGradient></defs>
<rect width="540" height="960" fill="url(#g)"/>
<polygon points="0,700 540,700 540,960 0,960" fill="#2b1c3c"/>
<ellipse cx="270" cy="520" rx="260" ry="320" fill="url(#l)"/>
<g><circle cx="260" cy="430" r="46" fill="#f7e9d2"/><circle cx="246" cy="424" r="4" fill="#3a2b3f"/><circle cx="274" cy="424" r="4" fill="#3a2b3f"/>
<path d="M246 448 q14 10 28 0" stroke="#3a2b3f" stroke-width="4" fill="none" stroke-linecap="round"/>
<path d="M200 500 q60 -40 120 0 l30 150 q-90 40 -180 0 Z" fill="#f0603f"/></g>
<rect x="90" y="150" width="300" height="90" rx="18" fill="#f6e7d3"/><text x="240" y="207" font-family="Poppins" font-size="30" font-weight="500" fill="#3a2b3f" text-anchor="middle">Can you help me?</text>
</svg>`;
const r = new Resvg(svg, { font: { loadSystemFonts: false, fontFiles: process.argv.slice(2), defaultFontFamily: 'Poppins' }, fitTo: { mode: 'width', value: 1080 } });
const png = r.render().asPng();
fs.writeFileSync('/tmp/spike.png', png);
console.log('ok bytes', png.length);
