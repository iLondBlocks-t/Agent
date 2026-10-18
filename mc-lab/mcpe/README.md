# Minecraft Pocket Edition 0.14.3 on PC

A port of **Ninecraft** that adds support for Minecraft Pocket Edition **0.14.3**,
together with a lightly modified build of **NostalgiaLauncher Desktop** to launch it.

Ninecraft runs the original Android game library on the desktop through a
compatibility layer, so this is the real 0.14.3 client rather than a
reimplementation. Everything below describes what that took and where it
currently stands.

> **This project is in a testing phase.** It is playable end to end, but it has
> rough edges and it has not been through many hands yet. Bug reports are
> genuinely useful.

---

## What you need

| | |
|---|---|
| Operating system | Windows |
| Java | 8 or newer (the launcher only) |
| Graphics | See the note on integrated GPUs below |
| Game files | `PE-a0.14.3-1-x86.apk` — you must supply this yourself |

The APK is **not** included and never will be. It is Mojang's property. You need
the **x86** build; the ARM builds (`-gingerbread`, `armeabi`) will not work,
because the compatibility layer runs x86 code natively rather than emulating it.

## What is in this folder

| File | |
|---|---|
| `NostalgiaLauncher-P3G.jar` | The launcher. Start here. |
| `ninecraft.exe` | The loader, built with 0.14.3 support |
| `vcruntime140.dll` | Microsoft C runtime, kept beside the loader so nothing has to be installed |
| `licenses/` | Licences of the projects this is built on |

**Keep these files together.** The launcher looks for `ninecraft.exe` next to
itself and uses it automatically — there is no setting to change. Moving the
folder is fine; splitting it up is not, because without the bundled loader the
launcher falls back to downloading the stock one, which does not know about
0.14.3.

## Installing

1. Install Java if you do not have it.
2. Unpack this folder anywhere and run `NostalgiaLauncher-P3G.jar`.
3. Add `0.14.3` as a custom version pointing at your copy of the x86 APK.
4. Select it and press **Launch**.

The launcher unpacks the APK and runs the game through Ninecraft. Older versions
(0.11.1 and earlier) run through the same loader, so nothing needs changing
between them.

---

## What works

Everything in this list has been played, not merely compiled.

- **Rendering** — world, blocks, entities, GUI, all textures
- **Mouse look** — pointer locked to the centre, speed follows the game's own
  sensitivity slider in Options
- **Movement** — WASD, jump, sneak, sprint
- **Building** — left click breaks, right click places
- **Inventory** — `E`, with the mouse
- **Chat** — `T` to open, typing, backspace, `Enter` to send
- **Hotbar** — mouse wheel cycles slots during play
- **Sound** — block, mob, step, ambient, all of it
- **Multiplayer** — LAN discovery and external servers

## Known issues

- **Visual distortion on low-end and integrated graphics.** The game renders
  correctly on discrete GPUs. On some integrated chips surfaces warp and
  flicker. The build asks the driver for the discrete GPU where one exists, but
  it cannot fix the integrated path.
- **Versions between 0.11.1 and 0.14.3 are untested.** 0.11.1 and earlier work
  through stock Ninecraft; 0.14.3 works through this port. 0.12 and 0.13 sit in
  between and have had no attention at all.
- **The mouse wheel does not scroll menus.** Drag with the left button held
  instead, the way the lists are meant to be scrolled. An earlier attempt to map
  the wheel to a synthetic drag turned out to register as a click and could
  activate whatever was under the pointer, so it was removed.
- **Some menu buttons need two clicks.** The first click is consumed setting the
  interface's idea of where the pointer is.
- **No music.** Mojang never shipped the music files inside the APK, so there is
  nothing to play. The `cannot open .../music/...` lines at startup are expected.
- **Xbox Live features are unavailable.** That layer is not implemented.

---

## Controls

| Key | Action |
|---|---|
| `W` `A` `S` `D` | Move |
| `Space` | Jump |
| `Shift` | Sneak |
| `E` | Inventory |
| `T` | Chat |
| `Esc` | Pause / back |
| `Mouse wheel` | Hotbar slot |
| `Left click` | Break |
| `Right click` | Place |
| `F11` | Fullscreen |

The pointer is captured during play and released whenever a screen is open, so
the cursor is there when you need it and gone when you do not.

---

## Notes on the port

Short summaries of the parts that were not obvious, in case they save someone
else the search.

**Platform interface.** `AppPlatform` grew from 61 virtual slots in 0.11.1 to 85
in 0.14.3. The whole table had to be laid out again from the library's own
symbols before anything would render.

**Java.** From 0.12 onward the game expects a JVM. A stub is handed to it that
answers everything with zero, which is enough for it to start. Leaving a
`JVMAttacher` unattached is what crashed the game on leaving a server, so the
stub is substituted there too.

**Audio.** 0.14.3 drives sound through FMOD, whose Android build only outputs via
a Java helper class that cannot exist here. Rather than satisfy it, FMOD is
replaced: the game imports exactly one symbol by name and reaches the rest
through 26 C++ methods, all of which are answered directly and fed into
Ninecraft's own mixer.

The banks are `.fsb`, FMOD's own container, and the codec inside them is FADPCM.
Getting that decoder right was the bulk of the work — the residual is scaled by
a *right* shift derived from the value stored per sub-frame, so a larger stored
value means a larger step. Reading it the other way round produces audio that is
recognisably audio but muffled, which is a hard bug to see and an easy one to
hear.

**Networking.** Two things kept it off. The platform reported networking as
unavailable, and `getBroadcastAddresses` returned `0.0.0.0` — an address nothing
can be sent to, so the "who is hosting?" pings went nowhere and the game printed
`sendto failed` once a second. Real interface broadcast addresses are now
computed per adapter.

**Input.** 0.14.3 believes it is a touch device and never asks for the pointer,
so the capture is driven from the game's own screen state instead. It also
speaks Windows virtual key codes rather than Android key codes, which is why
keys appeared to be bound to the wrong actions before that was corrected.

---

## Credits

- **[Ninecraft](https://github.com/MCPI-Revival/Ninecraft)** — MCPI-Revival. The
  loader and compatibility layer this is built on.
- **[NostalgiaLauncher Desktop](https://github.com/NLauncher/NostalgiaLauncherDesktop)** —
  eqozqq. The launcher, used here with small additions.
- **0.14.3 support and this build** — P3G.

Not affiliated with Mojang, Microsoft, or any other entity. Minecraft is the
property of Mojang Studios. This project ships no game content.
