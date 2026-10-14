"""Build the "flat world + red rays" Minecraft scene and render it to video.

Scene
-----
* an endless flat grass plain (the block texture repeats once per world unit)
* red laser rays sweeping down out of a dusk sky
* rigged Minecraft players (Steve + Alex) walk-cycled across the plain
* a continuous descending orbit camera move
"""
import argparse
import math
import os
import random
import sys

import bpy
from mathutils import Euler, Quaternion, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import mc_model  # noqa: E402

ASSETS = os.path.join(ROOT, "assets")
FPS = 24

#: how far one walk-cycle carries the character, in blocks (1 unit == 1 block)
CYCLE_DISTANCE = 1.0
WALK_SPEED = 1.75            # blocks / second


# --------------------------------------------------------------------------- #
# small helpers
# --------------------------------------------------------------------------- #
def clear_scene():
    for coll in (bpy.data.objects, bpy.data.meshes, bpy.data.materials,
                 bpy.data.lights, bpy.data.cameras, bpy.data.images,
                 bpy.data.armatures, bpy.data.actions, bpy.data.worlds):
        for item in list(coll):
            try:
                coll.remove(item, do_unlink=True)
            except Exception:
                pass


def lerp(a, b, t):
    return a + (b - a) * t


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def seg(t, t0, t1, v0, v1, ease="smooth"):
    """Value of ``v0 -> v1`` for t inside [t0, t1], clamped outside."""
    if t <= t0:
        return v0
    if t >= t1:
        return v1
    u = (t - t0) / (t1 - t0)
    return lerp(v0, v1, smooth(u) if ease == "smooth" else u)


def chain(t, stops):
    """Piecewise interpolation through ``stops`` = [(t, value), ...]."""
    if t <= stops[0][0]:
        return stops[0][1]
    for (t0, v0), (t1, v1) in zip(stops, stops[1:]):
        if t <= t1:
            u = smooth((t - t0) / (t1 - t0)) if t1 > t0 else 1.0
            return lerp(v0, v1, u)
    return stops[-1][1]


def look_at(cam, target):
    direction = Vector(target) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def action_fcurves(action):
    """F-curves of an action, old API (<=4.4) or slotted actions (5.x)."""
    if action is None:
        return []
    if hasattr(action, "fcurves"):
        return list(action.fcurves)
    out = []
    for layer in action.layers:
        for strip in layer.strips:
            for bag in getattr(strip, "channelbags", []):
                out.extend(bag.fcurves)
    return out


GRASS_TINT = (0.36, 0.58, 0.24)      # the green Minecraft tints grass with


def tint_chain(nt, tex_out, tint, bsdf, strength=1.0):
    """Multiply a (greyscale) block texture by a Minecraft biome tint."""
    mul = nt.nodes.new("ShaderNodeVectorMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = (tint[0] * strength, tint[1] * strength,
                                   tint[2] * strength)
    nt.links.new(tex_out, mul.inputs[0])
    nt.links.new(mul.outputs["Vector"], bsdf.inputs["Base Color"])
    return mul


def load_tex(path):
    img = bpy.data.images.load(os.path.abspath(path), check_existing=True)
    img.colorspace_settings.name = "sRGB"
    return img


# --------------------------------------------------------------------------- #
# the flat world
# --------------------------------------------------------------------------- #
def build_ground(size=3000.0):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, 0))
    ground = bpy.context.active_object
    ground.name = "Ground"

    mat = bpy.data.materials.new("grass_ground")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.95
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.08
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = load_tex(os.path.join(ASSETS, "grass_top.png"))
    tex.interpolation = "Linear"
    tex.extension = "REPEAT"
    tint_chain(nt, tex.outputs["Color"], GRASS_TINT, bsdf)
    ground.data.materials.append(mat)

    # UVs in world units -> the texture repeats once per 1x1 block
    uv = ground.data.uv_layers.new(name="UVMap")
    verts = ground.data.vertices
    for poly in ground.data.polygons:
        for li in poly.loop_indices:
            co = verts[ground.data.loops[li].vertex_index].co
            uv.data[li].uv = (co.x, co.y)
    return ground


def build_blocks(avoid=(), clearance=3.4, seed=11, count=14):
    """Scattered blocks that never block the camera or stand in the walk path."""
    rng = random.Random(seed)
    kinds = {
        "grass": dict(top="grass_top.png", side="grass_side.png", bottom="dirt.png"),
        "dirt": dict(top="dirt.png", side="dirt.png", bottom="dirt.png"),
        "stone": dict(top="stone.png", side="stone.png", bottom="stone.png"),
    }

    placements = []
    tries = 0
    while len(placements) < count and tries < 4000:
        tries += 1
        kind = ("grass", "dirt", "stone")[len(placements) % 3]
        r = rng.uniform(4.0, 17.0)
        a = rng.uniform(0, math.tau)
        x, y = math.cos(a) * r, math.sin(a) * r
        pos = Vector((x, y, 0.0))
        if any((pos - Vector(p[:2] + (0.0,))).length < clearance for p in avoid):
            continue
        # keep the area around the origin (the hero shot) clear as well
        if pos.length < 3.6:
            continue
        placements.append((kind, x, y, 0.5))

    verts = [(x - 0.5, y - 0.5, z - 0.5) for z in (0, 1) for y in (0, 1) for x in (0, 1)]
    faces = [(0, 1, 3, 2), (4, 5, 7, 6), (0, 1, 5, 4), (2, 3, 7, 6),
             (0, 2, 6, 4), (1, 3, 7, 5)]

    out = []
    for i, (kind, x, y, z) in enumerate(placements):
        spec = kinds[kind]
        mesh = bpy.data.meshes.new(f"block_{i}")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        for slot in ("top", "bottom", "side"):
            mat = bpy.data.materials.new(f"blk_{kind}_{slot}_{i}")
            mat.use_nodes = True
            b = mat.node_tree.nodes["Principled BSDF"]
            b.inputs["Roughness"].default_value = 0.95
            if "Specular IOR Level" in b.inputs:
                b.inputs["Specular IOR Level"].default_value = 0.08
            t = mat.node_tree.nodes.new("ShaderNodeTexImage")
            t.image = load_tex(os.path.join(ASSETS, spec[slot]))
            t.interpolation = "Closest"
            if kind == "grass":
                tint_chain(mat.node_tree, t.outputs["Color"],
                           GRASS_TINT, b, 1.15 if slot == "top" else 1.0)
            else:
                mat.node_tree.links.new(t.outputs["Color"], b.inputs["Base Color"])
            mesh.materials.append(mat)
        uv = mesh.uv_layers.new(name="UVMap")
        for poly in mesh.polygons:
            poly.material_index = {0: 1, 1: 0}.get(poly.index, 2)
            for k, li in enumerate(poly.loop_indices):
                uv.data[li].uv = [(0, 0), (1, 0), (1, 1), (0, 1)][k % 4]
        obj = bpy.data.objects.new(f"block_{i}", mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.location = (x, y, z)
        out.append(obj)
    return out


# --------------------------------------------------------------------------- #
# red rays
# --------------------------------------------------------------------------- #
def build_beams(count=16, seed=5, avoid=(), clearance=2.0):
    """Diagonal red laser rays stabbing down from the sky."""
    rng = random.Random(seed)
    beams = []
    for i in range(count):
        for _ in range(60):
            ang = rng.uniform(0, math.tau)
            radius = rng.uniform(5.0, 44.0)
            impact = Vector((math.cos(ang) * radius, math.sin(ang) * radius, 0.0))
            if not any((impact - Vector(p[:2] + (0.0,))).length < clearance
                       for p in avoid):
                break
        tilt = Vector((rng.uniform(-0.75, 0.75), rng.uniform(-0.75, 0.75), 1.0))
        tilt.normalize()
        start = impact + tilt * rng.uniform(26.0, 48.0)
        thickness = rng.uniform(0.045, 0.11) * (1.0 + radius * 0.03)

        direction = (impact - start).normalized()
        length = (start - impact).length
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=14, radius=thickness, depth=length,
            location=(start + impact) / 2)
        beam = bpy.context.active_object
        beam.name = f"beam_{i}"
        beam.rotation_mode = "QUATERNION"
        beam.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction)
        base_quat = beam.rotation_quaternion.copy()

        mat = bpy.data.materials.new(f"beam_mat_{i}")
        mat.use_nodes = True
        nt = mat.node_tree
        nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        mix = nt.nodes.new("ShaderNodeMixShader")
        outer = nt.nodes.new("ShaderNodeEmission")
        outer.inputs["Color"].default_value = (1.0, 0.035, 0.02, 1.0)
        outer.inputs["Strength"].default_value = 5.5
        core = nt.nodes.new("ShaderNodeEmission")
        core.inputs["Color"].default_value = (1.0, 0.30, 0.22, 1.0)
        core.inputs["Strength"].default_value = 18.0
        fres = nt.nodes.new("ShaderNodeFresnel")
        fres.inputs["IOR"].default_value = 1.3
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.02
        ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
        ramp.color_ramp.elements[1].position = 0.55
        ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
        nt.links.new(fres.outputs["Fac"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], mix.inputs["Fac"])
        nt.links.new(outer.outputs["Emission"], mix.inputs[1])
        nt.links.new(core.outputs["Emission"], mix.inputs[2])
        nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
        beam.data.materials.append(mat)

        # glow ball + red light where the ray hits the ground
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=thickness * rng.uniform(1.6, 2.4), segments=16, ring_count=8,
            location=impact + Vector((0, 0, thickness * 1.1)))
        glow = bpy.context.active_object
        glow.name = f"beam_glow_{i}"
        gmat = bpy.data.materials.new(f"beam_glow_mat_{i}")
        gmat.use_nodes = True
        gnt = gmat.node_tree
        gnt.nodes.clear()
        gout = gnt.nodes.new("ShaderNodeOutputMaterial")
        gemis = gnt.nodes.new("ShaderNodeEmission")
        gemis.inputs["Color"].default_value = (1.0, 0.10, 0.05, 1.0)
        gemis.inputs["Strength"].default_value = 4.5
        gnt.links.new(gemis.outputs["Emission"], gout.inputs["Surface"])
        glow.data.materials.append(gmat)

        lamp = bpy.data.lights.new(f"beam_light_{i}", type="POINT")
        lamp.energy = rng.uniform(220.0, 520.0)
        lamp.color = (1.0, 0.10, 0.06)
        lamp.shadow_soft_size = 0.5
        lamp_obj = bpy.data.objects.new(f"beam_light_{i}", lamp)
        bpy.context.scene.collection.objects.link(lamp_obj)
        lamp_obj.location = impact + Vector((0, 0, 0.8))

        beams.append(dict(
            beam=beam, glow=glow, lamp=lamp_obj, mat=mat,
            outer=outer, core=core, gemis=gemis,
            base_quat=base_quat, phase=rng.uniform(0, math.tau),
            rate=rng.uniform(0.35, 0.9), sway=rng.uniform(2.0, 6.0),
            sway_axis=Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)).normalized(),
            base=(outer.inputs["Strength"].default_value,
                  core.inputs["Strength"].default_value,
                  gemis.inputs["Strength"].default_value,
                  lamp.energy),
        ))
    return beams


def animate_beams(beams, frames):
    """Pulse every ray and let it sway slightly."""
    for b in beams:
        beam, glow, lamp = b["beam"], b["glow"], b["lamp"]
        ob, cb, gb, lb = b["base"]
        for f in range(1, frames + 1):
            t = (f - 1) / FPS
            pulse = 0.72 + 0.42 * math.sin(b["phase"] + t * b["rate"] * math.tau)
            b["outer"].inputs["Strength"].default_value = ob * pulse
            b["outer"].inputs["Strength"].keyframe_insert("default_value", frame=f)
            b["core"].inputs["Strength"].default_value = cb * pulse
            b["core"].inputs["Strength"].keyframe_insert("default_value", frame=f)
            b["gemis"].inputs["Strength"].default_value = gb * pulse
            b["gemis"].inputs["Strength"].keyframe_insert("default_value", frame=f)
            lamp.data.energy = lb * pulse
            lamp.data.keyframe_insert("energy", frame=f)

            ang = math.radians(b["sway"]) * math.sin(b["phase"] * 0.7 + t * 0.55)
            beam.rotation_quaternion = (Quaternion(b["sway_axis"], ang) @ b["base_quat"])
            beam.keyframe_insert("rotation_quaternion", frame=f)
            glow.scale = (pulse * 0.95, pulse * 0.95, pulse * 0.35)
            glow.keyframe_insert("scale", frame=f)


# --------------------------------------------------------------------------- #
# sky + key/fill lights
# --------------------------------------------------------------------------- #
def build_sky():
    world = bpy.data.worlds.new("dusk")
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    mapn = nt.nodes.new("ShaderNodeMapRange")
    mapn.inputs["From Min"].default_value = -0.15
    mapn.inputs["From Max"].default_value = 0.85
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.elements[0].position = 0.0
    cr.elements[0].color = (0.16, 0.05, 0.035, 1)   # matches the hazy ground
    cr.elements[1].position = 1.0
    cr.elements[1].color = (0.015, 0.02, 0.07, 1)   # deep night blue
    e = cr.elements.new(0.12)
    e.color = (0.95, 0.14, 0.05, 1)                 # hot band just above the horizon
    e2 = cr.elements.new(0.34)
    e2.color = (0.30, 0.05, 0.14, 1)                # purple dusk band
    nt.links.new(coord.outputs["Generated"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["Z"], mapn.inputs["Value"])
    nt.links.new(mapn.outputs["Result"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 0.38
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])

    key = bpy.data.lights.new("key", type="SUN")
    key.energy = 1.5
    key.angle = math.radians(4.0)
    key.color = (1.0, 0.62, 0.44)
    key_obj = bpy.data.objects.new("key", key)
    bpy.context.scene.collection.objects.link(key_obj)
    key_obj.rotation_euler = Euler((math.radians(78), 0, math.radians(-118)))

    fill = bpy.data.lights.new("fill", type="SUN")
    fill.energy = 0.10
    fill.color = (0.58, 0.64, 0.92)
    fill.angle = math.radians(15.0)
    fill_obj = bpy.data.objects.new("fill", fill)
    bpy.context.scene.collection.objects.link(fill_obj)
    fill_obj.rotation_euler = Euler((math.radians(62), 0, math.radians(52)))
    return key_obj, fill_obj


# --------------------------------------------------------------------------- #
# characters, animation, camera
# --------------------------------------------------------------------------- #
def player_position(t_norm, t_seconds, lane_x, start_y, speed=WALK_SPEED, total=None):
    """Smooth curved path: the character generally walks along -Y."""
    travel = speed * (total if total else t_seconds / max(t_norm, 1e-6))
    y = start_y - travel * t_norm
    x = lane_x + 0.9 * math.sin(t_norm * math.pi * 1.4)
    return Vector((x, y, 0.0))


def animate_walk(rig, frames, phase_offset=0.0, speed=WALK_SPEED, name="walk"):
    """Skeletal walk cycle + matching forward locomotion (no foot sliding)."""
    action = bpy.data.actions.new(name)
    rig.animation_data_create()
    rig.animation_data.action = action

    leg_swing, arm_swing = 46.0, 38.0
    bob = 0.045
    for f in range(1, frames + 1):
        t = (f - 1) / FPS
        phase = phase_offset + t * speed * 2 * math.pi / CYCLE_DISTANCE
        s = math.sin(phase)
        c = math.cos(phase)

        def rot(bone, x, y, z):
            pb = rig.pose.bones[bone]
            pb.rotation_euler = (math.radians(x), math.radians(y), math.radians(z))
            pb.keyframe_insert("rotation_euler", frame=f)

        rot("right_leg", s * leg_swing, 0, 0)
        rot("left_leg", -s * leg_swing, 0, 0)
        rot("right_arm", -s * arm_swing, 0, 4)
        rot("left_arm", s * arm_swing, 0, -4)
        rot("body", 3.5, 0, s * 2.0)
        rot("head", -2.0 + math.sin(2 * phase) * 1.6, 0, s * 5.0)

        # the root bone points straight up, so its local Y is world height:
        # vertical bob only, horizontal travel is driven by the rig object
        pb = rig.pose.bones["root"]
        pb.location = (0.0, -abs(c) * bob, 0.0)
        pb.keyframe_insert("location", frame=f)

    for fc in action_fcurves(action):
        fc.extrapolation = "LINEAR"
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
    return action


def camera_pose(t):
    """Continuous descending orbit; returns (position, target_offset)."""
    az = math.radians(chain(t, [(0.0, -34.0), (0.40, 6.0), (0.70, 44.0), (1.0, 86.0)]))
    radius = chain(t, [(0.0, 12.0), (0.35, 7.8), (0.62, 6.0), (0.86, 5.3),
                       (1.0, 5.05)])
    height = chain(t, [(0.0, 8.6), (0.35, 4.7), (0.62, 2.55), (0.86, 1.95),
                       (1.0, 1.8)])
    return az, radius, height


def lookahead_frames(t, frames):
    """Frames the camera aims ahead of the hero; tightens as the shot closes in."""
    return max(1, int(round((0.24 - 0.20 * t) * FPS)))


def camera_path_point(t, positions, frames):
    az, radius, height = camera_pose(t)
    lead = min(frames - 1, (int(round(t * (frames - 1))) + lookahead_frames(t, frames)))
    focus = positions[lead] + Vector((0, 0, 0.95))
    return focus + Vector((math.sin(az) * radius, -math.cos(az) * radius,
                           height - 0.95))


def build(skin="steve.png", extra_skin="alex.png", frames=120):
    clear_scene()
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start = 1
    scene.frame_end = frames

    duration = frames / FPS
    positions = [player_position((f - 1) / (frames - 1), (f - 1) / FPS, 0.0, 2.5)
                 for f in range(1, frames + 1)]
    cam_path = [camera_path_point(t, positions, frames)
                for t in [(f - 1) / (frames - 1) for f in range(1, frames + 1)]]

    build_ground()
    build_blocks(avoid=[tuple(p) for p in positions + cam_path])
    build_sky()
    beams = build_beams(avoid=[tuple(p) for p in positions + cam_path])
    animate_beams(beams, frames)

    # ---- characters ----------------------------------------------------- #
    cast = []
    specs = [dict(skin=skin, name="Steve", lane=0.0, lead=0.0, phase=0.0)]
    if extra_skin:
        specs.append(dict(skin=extra_skin, name="Alex", lane=6.5, lead=3.2,
                          phase=1.7))
    for spec in specs:
        obj, rig = mc_model.build_player(os.path.join(ASSETS, spec["skin"]),
                                         name=spec["name"])
        rig.location = (0.0, 0.0, 0.0)
        animate_walk(rig, frames, phase_offset=spec["phase"],
                     name=spec["name"] + "_walk")
        cast.append(dict(obj=obj, rig=rig, **spec))

    for c in cast:
        for f in range(1, frames + 1):
            t = (f - 1) / (frames - 1)
            c["rig"].location = player_position(t, (f - 1) / FPS, c["lane"],
                                                2.5 + c["lead"])
            c["rig"].keyframe_insert("location", frame=f)

    # ---- camera ---------------------------------------------------------- #
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = 30.0
    cam = bpy.data.objects.new("Cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    # an animated empty is what the camera looks at; a TRACK_TO constraint then
    # aims the camera at it, which stays rock solid between keyframes
    target = bpy.data.objects.new("CamTarget", None)
    target.empty_display_size = 0.3
    scene.collection.objects.link(target)
    con = cam.constraints.new("TRACK_TO")
    con.target = target
    con.track_axis = "TRACK_NEGATIVE_Z"
    con.up_axis = "UP_Y"

    # keeps the hero's face lit no matter which way the camera swings
    char_key = bpy.data.lights.new("hero_key", type="SUN")
    char_key.energy = 1.30
    char_key.angle = math.radians(7.0)
    char_key.color = (1.0, 0.93, 0.90)
    char_key_obj = bpy.data.objects.new("hero_key", char_key)
    scene.collection.objects.link(char_key_obj)

    char_fill = bpy.data.lights.new("hero_fill", type="SUN")
    char_fill.energy = 0.30
    char_fill.angle = math.radians(18.0)
    char_fill.color = (0.80, 0.86, 1.0)
    char_fill_obj = bpy.data.objects.new("hero_fill", char_fill)
    scene.collection.objects.link(char_fill_obj)

    for f in range(1, frames + 1):
        t = (f - 1) / (frames - 1)
        az, radius, height = camera_pose(t)
        lead_index = min(frames - 1, (f - 1) + lookahead_frames(t, frames))
        focus = positions[lead_index] + Vector((0, 0, 0.92))
        cam.location = focus + Vector((math.sin(az) * radius,
                                       -math.cos(az) * radius,
                                       height - 0.92))
        cam.keyframe_insert("location", frame=f)
        target.location = focus + Vector((0, 0, 0.12))
        target.keyframe_insert("location", frame=f)

        aim = (focus - cam.location).normalized()
        char_key_obj.rotation_euler = aim.to_track_quat("-Z", "Y").to_euler()
        char_key_obj.keyframe_insert("rotation_euler", frame=f)
        side = aim.cross(Vector((0, 0, 1))).normalized()
        char_fill_obj.rotation_euler = (aim * 0.55 + side * 0.8).normalized() \
            .to_track_quat("-Z", "Y").to_euler()
        char_fill_obj.keyframe_insert("rotation_euler", frame=f)
    for obj in (cam, target):
        for fc in action_fcurves(obj.animation_data.action):
            fc.extrapolation = "LINEAR"

    return dict(scene=scene, cam=cam, cast=cast, beams=beams, frames=frames)


# --------------------------------------------------------------------------- #
# rendering
# --------------------------------------------------------------------------- #
def configure_render(scene, width, height, samples, engine="CYCLES"):
    import addon_utils
    addon_utils.enable("cycles", default_set=True, persistent=True)
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.05
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.cycles.max_bounces = 1
    scene.cycles.diffuse_bounces = 1
    scene.cycles.glossy_bounces = 2
    scene.cycles.transmission_bounces = 2
    scene.cycles.transparent_max_bounces = 4
    scene.cycles.use_fast_gi = False
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    names = [v.name for v in
             scene.view_settings.bl_rna.properties["view_transform"].enum_items]
    scene.view_settings.view_transform = "AgX" if "AgX" in names else "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.10
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.compression = 60


def render_animation(build_result, out_dir, width, height, samples):
    scene = build_result["scene"]
    configure_render(scene, width, height, samples)
    os.makedirs(out_dir, exist_ok=True)
    scene.render.filepath = os.path.join(out_dir, "frame_")
    bpy.ops.render.render(animation=True)
    return out_dir


def encode_video(frames_dir, out_path, frames, fps=FPS, ffmpeg=None, quality=20):
    """Encode the PNG sequence with FFmpeg into an H.264 MP4."""
    import subprocess
    if ffmpeg is None:
        import imageio_ffmpeg
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-framerate", str(fps),
        "-start_number", "1",
        "-i", os.path.join(frames_dir, "frame_%04d.png"),
        "-frames:v", str(frames),
        "-c:v", "libx264", "-preset", "slow", "-crf", str(quality),
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        "-r", str(fps),
        out_path,
    ]
    subprocess.run(cmd, check=True)
    return out_path


# --------------------------------------------------------------------------- #
if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--skin", default="steve.png")
    ap.add_argument("--extra-skin", default="alex.png")
    ap.add_argument("--frames", type=int, default=108)
    ap.add_argument("--width", type=int, default=576)
    ap.add_argument("--height", type=int, default=324)
    ap.add_argument("--samples", type=int, default=14)
    ap.add_argument("--out", default=os.path.join(ROOT, "renders", "frames"))
    ap.add_argument("--video", default=os.path.join(ROOT, "renders",
                                                    "minecraft_flat_world.mp4"))
    ap.add_argument("--still", type=float, default=None,
                    help="render a single frame at this t (0..1) instead of the movie")
    args = ap.parse_args()

    result = build(skin=args.skin, extra_skin=args.extra_skin or None,
                   frames=args.frames)

    if args.still is not None:
        scene = result["scene"]
        configure_render(scene, args.width, args.height, args.samples)
        scene.render.image_settings.file_format = "PNG"
        scene.frame_set(max(1, int(args.still * (args.frames - 1)) + 1))
        scene.render.filepath = "/tmp/still_%.2f.png" % args.still
        bpy.ops.render.render(write_still=True)
        print("still ->", scene.render.filepath)
    else:
        render_animation(result, args.out, args.width, args.height, args.samples)
        encode_video(args.out, args.video, args.frames)
        print("video ->", args.video)
