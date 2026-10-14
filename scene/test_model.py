"""Quick sanity check: render the player model from four sides."""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mc_model  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = "/tmp/model_test"

for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)

player, rig = mc_model.build_player(os.path.join(ROOT, "assets", "steve.png"))

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 24
scene.render.resolution_x = 480
scene.render.resolution_y = 640
scene.render.image_settings.file_format = "PNG"
scene.view_settings.view_transform = "Standard"

# flat, bright world so the texture reads clearly
world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.7, 0.7, 0.75, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.4

cam_data = bpy.data.cameras.new("Cam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = 2.4
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

scene.render.filepath = OUT
for name, angle in [("front", 0), ("right", 90), ("back", 180), ("left", 270)]:
    a = math.radians(angle)
    dist = 8.0
    cam.location = (math.sin(a) * dist, -math.cos(a) * dist, 1.05)
    cam.rotation_euler = (math.radians(90), 0, a)
    scene.render.filepath = f"{OUT}_{name}.png"
    bpy.ops.render.render(write_still=True)
    print("wrote", scene.render.filepath)
