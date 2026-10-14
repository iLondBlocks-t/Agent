"""Procedurally build a rigged Minecraft player model from a 64x64 skin PNG.

The result is a single mesh (one cuboid per body part, UV-mapped straight onto
the skin texture) plus an armature with the usual Minecraft bones.
"""
import os
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mc_skin  # noqa: E402

PX = 1.0 / 16.0   # one skin pixel == 1/16 block


# --------------------------------------------------------------------------- #
# geometry helpers
# --------------------------------------------------------------------------- #
def _corners(center, size):
    cx, cy, cz = center
    hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
    x0, x1 = cx - hx, cx + hx
    y0, y1 = cy - hy, cy + hy
    z0, z1 = cz - hz, cz + hz
    return {
        0: (x0, y0, z0), 1: (x1, y0, z0), 2: (x1, y1, z0), 3: (x0, y1, z0),
        4: (x0, y0, z1), 5: (x1, y0, z1), 6: (x1, y1, z1), 7: (x0, y1, z1),
    }


#: cuboid face -> loop of corner indices, counter-clockwise seen from outside
LOOPS = {
    "-Y": (0, 1, 5, 4),
    "+Y": (2, 3, 7, 6),
    "+X": (1, 2, 6, 5),
    "-X": (3, 0, 4, 7),
    "+Z": (4, 5, 6, 7),
    "-Z": (0, 3, 2, 1),
}


def _rect_to_uv(rect, skin=64):
    """(x,y,w,h) in image pixels -> (u0, v0, u1, v1) in Blender UV space."""
    x, y, w, h = rect
    u0, u1 = x / skin, (x + w) / skin
    v1 = 1.0 - y / skin                 # texture v grows upwards
    v0 = 1.0 - (y + h) / skin
    return u0, v0, u1, v1


def add_part(bm, uv_layer, part, rects, inflate=0.0):
    """Add one body part cuboid with per-face UVs from ``rects``."""
    size = mc_skin.PART_SIZE[part]
    center = mc_skin.PART_CENTER[part]
    size = (size[0] + inflate, size[1] + inflate, size[2] + inflate)
    verts = {}
    for idx, co in _corners(center, size).items():
        verts[idx] = bm.verts.new(Vector(co) * PX)

    skin_face_of = {v: k for k, v in mc_skin.FACE_OF.items()}
    for face_name, loop in LOOPS.items():
        face = bm.faces.new([verts[i] for i in loop])
        rect = rects[skin_face_of[face_name]]
        u0, v0, u1, v1 = _rect_to_uv(rect)
        pattern = mc_skin.face_uv_pattern(face_name)
        for loop_entry, (uf, vf) in zip(face.loops, pattern):
            loop_entry[uv_layer].uv = (u0 + uf * (u1 - u0), v0 + vf * (v1 - v0))


# --------------------------------------------------------------------------- #
# materials
# --------------------------------------------------------------------------- #
def make_skin_material(name, image, alpha_blend=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.85
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.2
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = image
    tex.interpolation = "Closest"          # crisp pixel-art look
    tex.location = (-420, 240)
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    if alpha_blend:
        nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
        mat.blend_method = "BLEND" if hasattr(mat, "blend_method") else "BLEND"
        if hasattr(mat, "shadow_method"):
            mat.shadow_method = "NONE"
    return mat


# --------------------------------------------------------------------------- #
# main builder
# --------------------------------------------------------------------------- #
def build_player(skin_path, name="Steve", rx=1.0, rz=1.0, with_overlay=True):
    """Create the mesh + armature.  Returns (mesh_object, armature_object)."""
    img = bpy.data.images.load(os.path.abspath(skin_path), check_existing=True)
    img.colorspace_settings.name = "sRGB"

    me = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)

    base_mat = make_skin_material(name + "_skin", img, alpha_blend=False)
    ovl_mat = make_skin_material(name + "_overlay", img, alpha_blend=True)
    me.materials.append(base_mat)
    me.materials.append(ovl_mat)

    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")

    # ---- base layer ----------------------------------------------------- #
    base_faces = []
    for part, rects in mc_skin.BASE.items():
        before = len(bm.faces)
        add_part(bm, uv_layer, part, rects)
        base_faces.extend(range(before, len(bm.faces)))

    # ---- overlay layer (only if the skin actually paints it) ------------ #
    overlay_faces = []
    if with_overlay:
        import numpy as np
        px = np.array(img.pixels[:]).reshape(img.size[1], img.size[0], 4)
        if img.size[0] != 64 or img.size[1] != 64:
            raise ValueError("expected a 64x64 modern skin, got %s" % (img.size,))
        for part in mc_skin.BASE:
            rects = mc_skin.overlay_face_rects(part)
            used = False
            for rect in rects.values():
                x, y, w, h = rect
                # image rows are bottom-up in Blender
                y0, y1 = img.size[1] - (y + h), img.size[1] - y
                if px[y0:y1, x:x + w, 3].max() > 0.05:
                    used = True
                    break
            if used:
                before = len(bm.faces)
                add_part(bm, uv_layer, part, rects, inflate=0.5)
                overlay_faces.extend(range(before, len(bm.faces)))

    bm.normal_update()
    bm.to_mesh(me)
    bm.free()

    for i, poly in enumerate(me.polygons):
        poly.material_index = 1 if i in set(overlay_faces) else 0

    me.update()

    # ---- vertex groups (rigid, one per bone) ---------------------------- #
    groups = {p: obj.vertex_groups.new(name=p) for p in mc_skin.BASE}
    import mathutils
    verts_by_part = {}
    # reconstruct which vertices belong to which part from geometry
    for part in mc_skin.BASE:
        center = Vector(mc_skin.PART_CENTER[part]) * PX
        size = Vector(mc_skin.PART_SIZE[part]) * PX
        for v in me.vertices:
            d = (v.co - center)
            if all(abs(d[i]) <= size[i] / 2 + 0.06 for i in range(3)):
                verts_by_part.setdefault(part, []).append(v.index)
    for part, idxs in verts_by_part.items():
        groups[part].add(idxs, 1.0, "REPLACE")

    # ---- armature ------------------------------------------------------- #
    arm_data = bpy.data.armatures.new(name + "_rig")
    arm_obj = bpy.data.objects.new(name + "_rig", arm_data)
    bpy.context.scene.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="EDIT")
    ebs = {}
    for bone, (head, tail, parent, connect) in mc_skin.BONES.items():
        eb = arm_data.edit_bones.new(bone)
        eb.head = Vector(head) * PX
        eb.tail = Vector(tail) * PX
        ebs[bone] = eb
    for bone, (_, _, parent, connect) in mc_skin.BONES.items():
        if parent:
            ebs[bone].parent = ebs[parent]
            ebs[bone].use_connect = connect
    bpy.ops.object.mode_set(mode="OBJECT")

    for pb in arm_obj.pose.bones:
        pb.rotation_mode = "XYZ"

    # ---- bind ------------------------------------------------------------ #
    obj.parent = arm_obj
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm_obj

    return obj, arm_obj


# --------------------------------------------------------------------------- #
# animation helpers
# --------------------------------------------------------------------------- #
def set_pose(arm_obj, bone, frame, rot=None, loc=None):
    pb = arm_obj.pose.bones[bone]
    if rot is not None:
        pb.rotation_euler = [__import__("math").radians(a) for a in rot]
        pb.keyframe_insert("rotation_euler", frame=frame)
    if loc is not None:
        pb.location = loc
        pb.keyframe_insert("location", frame=frame)


def walk_cycle(arm_obj, action, frames, step_height=0.0, leg_swing=42.0,
               arm_swing=34.0, bob=0.035, head_sway=3.0):
    """Classic stiff Minecraft walk.  ``frames`` = number of frames in one cycle."""
    import math
    for i in range(frames + 1):
        t = i / frames
        a = 2 * math.pi * t
        leg = math.sin(a) * leg_swing
        arm = -math.sin(a) * arm_swing
        bob_z = -abs(math.cos(a)) * bob
        set_pose(arm_obj, "right_leg", i, rot=(leg, 0, 0))
        set_pose(arm_obj, "left_leg", i, rot=(-leg, 0, 0))
        set_pose(arm_obj, "right_arm", i, rot=(arm, 0, 0))
        set_pose(arm_obj, "left_arm", i, rot=(-arm, 0, 0))
        set_pose(arm_obj, "root", i, loc=(0, 0, bob_z))
        set_pose(arm_obj, "head", i, rot=(math.sin(2 * a) * head_sway * 0.4, 0,
                                          math.sin(a) * head_sway))
        set_pose(arm_obj, "body", i, rot=(2.0, 0, math.sin(a) * 1.5))
