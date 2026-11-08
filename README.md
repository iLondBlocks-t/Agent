# Black Stickman — "Why Do You Say Yes When You Want to Say No?"

Remotion + Three.js video for **Small Traps** series (90–100s, ~240 words). Black stick figures with rim light in moody cinematic sets, deterministic frame-by-frame rendering, no image/video AI.

## Script Beats (from user)
- **0:00–0:10 Hook** — “In one second… you said yes. And you lost your day.” — stickman on phone, message “Can you help me?”, types yes, slumps.
- **0:10–0:25 Setup** — Brain protection “people not liking you”, clock spinning, silent resentment.
- **0:25–1:05 Main Body** — (1) Request as test of belonging + shadow, (2) calendar filling red + heavy “PROMISES” box, (3) solution sentence “Let me check… and I’ll get back to you.” + green/red clock.
- **1:05–1:25 Payoff** — Boundaries as door with handle on your side, “yes” you didn’t mean.
- **1:25–1:40 Outro** — Comment question, subscribe, teaser for “Why do you regret purchases?”

All visuals invented per script, style fixed: pure black ink, rim light, moody value structure, camera drift, letterbox, dust/rain/god-rays.

## Tech — Essentiel.txt Strict Rules

| Rule | Fulfillment |
|------|-------------|
| `<ThreeCanvas>` with explicit width/height | All 3D in `<ThreeCanvas width={1920} height={1080}>` or `220×220` etc. |
| No `useFrame()` — only `useCurrentFrame()` | No `useFrame` import; rotations via `const f=useCurrentFrame(); rot=(f/60)*2π` |
| `ambientLight` + `directionalLight` + visible camera | Each canvas: ambient 0.6–0.7, directional at [5,5,5] intensity 1.1, camera [0,0,6] fov 45 |
| `<Sequence>` inside `<ThreeCanvas>` → `layout="none"` | No Sequence inside ThreeCanvas; all Sequences wrap 2D scenes, 3D inside leaf |
| No `Date.now`, `requestAnimationFrame` | Only `frame` + `interpolate` + `Math.sin(frame*…)` deterministic |
| Simple test scene (rotating cube) no flicker | `TestCube` 150f: yellow cube, ground plane, floating light, deterministic |
| Visual verification loop | `oooh-i-see-it-now` + `npx remotion still` → PNG → `read_file` → fix → re-render before full MP4 |

## Run

```bash
npm install
# Chromium via @sparticuz/chromium (npm, allowed host) — extracts to /tmp/chromium
# ffmpeg via imageio-ffmpeg (pip, allowed host) — /usr/local/bin/ffmpeg

# Quick still (visual verification)
LD_LIBRARY_PATH=/tmp/al2023/lib:/tmp:$LD_LIBRARY_PATH FONTCONFIG_PATH=/tmp/fonts npx remotion still src/index.ts TestCube out/testcube.png --overwrite
LD_LIBRARY_PATH=/tmp/al2023/lib:/tmp:$LD_LIBRARY_PATH FONTCONFIG_PATH=/tmp/fonts npx remotion still src/index.ts Main out/main150.png --frame=150 --overwrite

# Preview (960×540, ~12 min on 2-core, concurrency 1)
LD_LIBRARY_PATH=/tmp/al2023/lib:/tmp:$LD_LIBRARY_PATH FONTCONFIG_PATH=/tmp/fonts npx remotion render src/index.ts Main out/black-stickman-why-yes.mp4 --scale=0.5 --overwrite

# Final (1920×1080, ~45 min)
LD_LIBRARY_PATH=/tmp/al2023/lib:/tmp:$LD_LIBRARY_PATH FONTCONFIG_PATH=/tmp/fonts npx remotion render src/index.ts Main out/black-stickman-why-yes-1080p.mp4 --overwrite
```

## Files

- `src/Root.tsx` — compositions Main (3000f, 30fps, 1920×1080, 100s) + TestCube (150f)
- `src/MainComposition.tsx` — 6 acts with cinematic cards, stickmen, 3D insets
- `src/TestCube.tsx` — deterministic cube test
- `src/components/Stickman.tsx` — black ink figure, rim light, poses, faces, dust
- `src/components/ThreeElements.tsx` — RotatingCube, FloatingDoor, PromiseBox3D (all via useCurrentFrame)
- `remotion.config.ts` — browser `/tmp/chromium`, swangle, jpeg, overwrite
- `VERIFICATION.md` — full before/after still analysis and compliance table
- `out/` — stills and MP4s (gitignored, local)

## Determinism

No random, no wall time, no RAF. Every render identical. 3D via `ThreeCanvas` frameloop `demand` + `invalidate()` per frame. Letterbox, grain, vignette via CSS/overlay.

## Next

Add TTS voiceover: generate 100s narration mp3 (gTTS blocked on this network, fallback to silent + captions) and mux via `ffmpeg -i video_silent.mp4 -i voiceover.mp3 -c:v copy -map 0:v:0 -map 1:a:0 -shortest out.mp4`. Background music via `python audio/music.py` style.
