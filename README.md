# Agent — 3D render: Minecraft flat world with red rays

A fully procedural 3D shot, built and rendered entirely from the terminal with
**Blender 5.0** driven by its Python API (`bpy`), then encoded to MP4 with FFmpeg.

**[▶ Watch the video: `renders/minecraft_flat_world.mp4`](renders/minecraft_flat_world.mp4)**

## What's in the scene

| Element | How it is made |
| --- | --- |
| Completely flat world | 3000×3000 plane, `grass_block_top` texture repeating exactly once per world unit (1 unit = 1 Minecraft block) |
| Red rays | 16 glowing cylinders stabbing down from a dusk sky, with fresnel core/glow shading, a red point light + glow blob where each one hits the ground; every ray pulses and sways on its own phase |
| Player model | Rigged Minecraft player built from scratch: 12 skin-pixel cuboids (base + overlay layer), UV-mapped straight onto the skin PNG, bound to a 7-bone armature |
| Steve skin | Real 64×64 skin downloaded from GitHub, with the hat/jacket/sleeve/pant overlay layer included |
| Alex skin | Second character, same rig, walking on a parallel lane |
| Motion | Hand-written walk cycle — 46° leg swing, 38° arm swing, body lean, head sway, vertical bob, and forward travel matched to the stride so the feet don't slide |
| Camera | One continuous 4.5 s move: a descent from the sky, an orbit around the hero, closing into a low wide shot. The camera aims at an animated empty through a `TRACK_TO` constraint, so the pan is perfectly smooth |
| Render | Cycles, CPU, 14 samples + OpenImageDenoise, AgX view transform |

## Run it

```bash
# one-off sanity render of a single moment (t = 0..1 through the shot)
./tools/run_blender.sh scene/build_scene.py --still 0.72 --samples 32

# the movie: 108 frames @ 24 fps, PNG frames then an H.264 MP4
./tools/run_blender.sh scene/build_scene.py \
    --frames 108 --width 576 --height 324 --samples 14 \
    --out renders/frames --video renders/minecraft_flat_world.mp4
```

## How Blender runs in this sandbox

The box has no package-manager network, and a Blender build needs a pile of X11
and GPU libraries that aren't installed. So:

1. `pip install bpy` pulls the whole Blender 5.0 binary as a Python wheel.
2. `tools/gen_xstubs.py` works out which symbols the bundle needs (via
   `tools/collect_syms.py`) and compiles tiny stub `.so` files with `gcc` so the
   dynamic loader is satisfied. Headless Cycles rendering never calls into them.
3. `tools/run_blender.sh` puts those stubs on `LD_LIBRARY_PATH` and runs a
   script.

## Files

```
assets/           steve.png, alex.png and the block textures (all from GitHub)
scene/mc_skin.py  the 64x64 skin layout: every face of every body part + overlay
scene/mc_model.py builds the rigged mesh from a skin, plus the walk cycle
scene/build_scene.py  the world, the rays, the lighting and the camera move
scene/test_model.py   four-view sanity check of the model
tools/            stub-library generator + launcher
renders/          output frames and the finished MP4
```

## Credits

* Skins and block textures: extracted Minecraft assets via the
  [`misode/mcmeta`](https://github.com/misode/mcmeta) and
  [`InventivetalentDev/minecraft-assets`](https://github.com/InventivetalentDev/minecraft-assets)
  GitHub mirrors. Minecraft assets are © Mojang — used here for a technical
  demo only.
