# Egypt 3D Cinematic — Remotion

A **3-second cinematic** of an infinite Egyptian world: the three Giza pyramids,
a sphinx colossus, palm-studded dunes, and a **fully rigged human figure**
walking through the scene, rendered with a camera that dollies in with
handheld drift. Output: `out/egypt-cinematic.mp4` (1920×1080, 30 fps, H.264, 90 frames).

## What it renders

- **Infinite world** — a 760-unit procedural dune field (fractal-brownian
  heightmap) with exponential fog that melts the far edge into the horizon.
- **Pyramids** — Khufu/Khafre/Menkaure with limestone shading, casing bases,
  and contact shadows.
- **Sphinx** — a stylized colossus of weathered limestone boxes.
- **Rigged human** — a 20-bone skeleton (spine, shoulders, elbows, hips, knees,
  feet) animated with a forward-kinematics walk cycle: 2 strides across the shot,
  counter-swinging arms, body bob and sway, head turn, nemes headdress.
- **Cinematics** — low golden sun with glow + lens streaks, backlit rim
  lighting, vignette, painter's-algorithm depth sorting and flat shading.

## Rendering

The scene is drawn by a small **software 3D engine on Canvas 2D**
(`src/engine.ts` + `src/egyptScene.ts`): perspective projection, backface
culling, depth sorting, Lambertian shading and fog. It needs no WebGL, which
makes it reliable in headless rendering environments where GPU/WebGL is
unavailable.

```bash
npm install
npm run render            # writes out/egypt-cinematic.mp4
```

`scripts/render.sh` launches Remotion with a headless Chromium
(`@sparticuz/chromium`) and the vendored NSS libraries on `LD_LIBRARY_PATH`
(`~/.local/lib/nss`), required to run that Chromium build on this host.

A still preview of any frame:

```bash
npx remotion still egypt-cinematic out/preview.png --frame=45
```

## Layout

- `src/engine.ts` — camera, projection, quads, shading, fog
- `src/egyptScene.ts` — terrain, pyramids, sphinx, palms, rigged human, camera path
- `src/EgyptCinematic.tsx` — Remotion composition (canvas rendering)
- `out/` — rendered MP4 and still previews (frames 0, 45, 85)
