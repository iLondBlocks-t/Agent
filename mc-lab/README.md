# Minecraft-in-a-sandbox: attempt, exact limitations, and what actually ran

Date: 2026-10-18 · Host: Debian 12 (bookworm) container · Branch: `arena/37048818-agent`

## 1. Environment survey

| Item | Value |
|---|---|
| OS | Debian GNU/Linux 12 (bookworm), kernel 6.1.158, x86_64 |
| CPU | 2 vCPU (Intel Xeon @ 2.60 GHz) |
| RAM | 3.8 GiB total (~3.6 GiB available) |
| Disk | 21 GiB, ~19 GiB free |
| Graphical desktop | **None.** No `$DISPLAY`, no Wayland, no `/dev/dri`, no GPU |
| X server / Xvfb | **None installed, none installable** (see §2) |
| Preinstalled tooling | python3.11, pip, node, npm, git, gh, gcc/g++/make, wget/curl |
| Missing tooling | java, ffmpeg, X, Xvfb, xdotool, cmake, apt packages |
| Privileges | `sudo` available (passwordless), but useless: apt mirror unreachable |

## 2. Why real Minecraft Java Edition 1.0.0 is impossible here (exact limitations)

Every failure below was actually probed, not assumed:

1. **Mojang/Microsoft hosts are unreachable.** The sandbox only allows
   `github.com`, `codeload.github.com`, `api.github.com`, `registry.npmjs.org`,
   `pypi.org`, `files.pythonhosted.org`. `piston-meta.mojang.com` and
   `launcher.mojang.com` return connection failures, so the version manifest,
   the 1.0.0 client jar and the LWJGL natives cannot be downloaded from any
   legitimate source. (Mirrored jars on third-party sites would also be
   unlicensed redistribution, which this task forbids.)
2. **Authentication is unreachable and must not be bypassed.** Playing the
   client requires a session with Mojang/Microsoft login servers (also
   blocked), plus a licensed account. Bypassing that (offline-mode cracks) is
   explicitly out of scope.
3. **No package mirror.** `apt-get update` fails: `deb.debian.org` is not
   allowlisted. Therefore `ffmpeg`, `xvfb`, `openjdk-*`, `xdotool`,
   `mesa`/OpenGL are not installable, and no `.deb` cache exists locally.
4. **GitHub release binaries are blocked.** Asset downloads 302-redirect to
   `objects.githubusercontent.com`, which is not allowlisted (verified: HTTP
   302, 0 bytes). Only git sources (clone/tarball) work.
5. **No X server exists on any allowed channel.** No Xvfb/Xorg binary on PyPI
   (grep of the full 183,610-project simple index) or npm (only wrappers that
   spawn a system `Xvfb`). The pure-Java X server **WeirdX** (precompiled jar
   found in git) renders its windows *into a host AWT window*, so it needs a
   display itself — it cannot be the root display. ⇒ **No virtual display is
   possible in this environment.**
6. **The available JDK is a JRE.** `jdk4py` (PyPI) ships Temurin 25 **without
   `jdk.compiler`**, so no Java source can be compiled; and any AWT/Swing GUI
   (e.g. Notch's original Minicraft) would need the missing X server anyway.

**Verdict:** real Minecraft 1.0.0 cannot be downloaded, authenticated, or
displayed here. Claiming otherwise would be false.

## 3. Practical alternative that DID run (and was recorded)

A real, published, open-source game of the Minecraft family, run as a real
process and recorded with real FFmpeg:

* **Game:** *Minicraft "Potato Edition"* (`TheBigEye/minicraft-py`, GPL-3.0,
  5,736 LOC, pygame-ce) — a faithful remake of **Notch's Minicraft**, the
  Ludum Dare 22 game Minecraft evolved from. Chosen over `2DMC` because 2DMC
  ships Mojang's copyrighted Minecraft textures; this one does not.
* **Display backend:** SDL2 `dummy` video driver (the game's normal,
  unmodified render path into an in-memory framebuffer).
* **Recorder:** FFmpeg 7.0.2 (`imageio-ffmpeg`, libx264) fed raw RGB24 frames
  captured at present-time by wrapping `pygame.display.flip()`.
* **Input automation:** an external client (`automate.py`) talks to the game
  process over a unix socket; the harness injects input into **SDL2's real
  device state** (`SDL_GetKeyboardState` array writes, `SDL_WarpMouseInWindow`,
  posted `KEYDOWN/KEYUP/TEXTINPUT/MOUSE*` events) — the same layer where OS
  input would land, since `xdotool` needs the impossible X server. The game
  reads input through its own unmodified code.
* **Java** (Temurin 25 via `jdk4py`) was installed during the investigation and
  works, but the Java/WeirdX/X11 route was abandoned for the reasons in §2.

## 4. Verification (all measured, nothing assumed)

* Harness scancode self-test: every injected scancode is visible through
  `pygame.key.get_pressed()` → `ALL PASS`.
* Video: `output/gameplay.mp4` — 60.63 s, 960×540, H.264/yuv420p, 32 fps,
  1,940 frames (matches the harness's own `recorded_frames: 1940`);
  `output/gameplay-final.mp4` — same session with the pre-automation idle
  trimmed (40.0 s).
* Not a slideshow: consecutive-frame luma-delta analysis shows continuous
  motion through the gameplay segment (peak mean|Δ| 63.9); menu segments are
  static by nature (blinking cursor only).
* Not simulated: the game's own F3 overlay is visible on the recording
  (engine name, live X/Y coords, ticks, chunks, light, seed), and the game's
  own state confirms the automation landed: menus traversed
  (`TitleMenu → SeedMenu → world`), typed seed `ARENA-2`, world generated
  (48→56 chunks streamed), player walked a verified path
  (e.g. 562.16→567.86, −2.91 tiles), 14+ attack swings, mobs spawned with
  Shift+G and seen wandering, furniture placed with Shift+H, trees visibly
  chopped (stump tiles in later frames), mouse moved through 32 distinct
  sampled positions.
* Game process exited cleanly (exit code 0); render times logged by the game
  itself: 7–11 ms/frame.
* Stills for every phase: `output/stills/01..10-*.png`.
  Logs: `output/harness.log`, `output/automation.log`, `output/ffmpeg.log`.

## 5. Resource usage

* Peak RAM during recording: ~0.5 GiB of the 3.8 GiB; 2 vCPU fully sufficient
  (game 7–11 ms/frame + x264 `ultrafast` kept up: capture 30.5–31.1 fps vs 32 target).
* Disk: `.venv` 307 MB (JDK 35 MB + FFmpeg 29 MB + pygame-ce ~14 MB + Pillow),
  `output/` 21 MB, sources 8 MB.
* Installed: `pygame-ce==2.5.3`, `imageio-ffmpeg`, `jdk4py`, `pillow` only.
  (`vncdotool`/`twisted` were installed for a VNC route that became moot and
  were uninstalled again.)

## 6. Reproduce

```bash
cd mc-lab
python3 -m venv .venv && ./.venv/bin/pip install pygame-ce==2.5.3 imageio-ffmpeg jdk4py pillow
ln -sfn "$PWD/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2" ffmpeg-bin/ffmpeg
./.venv/bin/python harness.py output/gameplay.mp4 &        # game + recorder + control socket
./.venv/bin/python automate.py                              # external keyboard/mouse automation
```
