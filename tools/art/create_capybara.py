"""Build an original, skinned capybara with looping walk and idle GLB clips.

Run: blender --background --python tools/art/create_capybara.py
All dimensions are metres. Blender's -Y forward becomes glTF +Z forward.
No third-party mesh or animation data is used.
"""

import json
import math
import random
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "public" / "models" / "capybara.glb"
WALK_SECONDS = 1.2
WALK_FRAMES = 49
WALK_DISTANCE = 0.42
STANCE = 0.65
LENGTH_SCALE = 0.78

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.render.resolution_x = 640
scene.render.resolution_y = 520
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = True
scene.frame_start = 0
scene.frame_end = WALK_FRAMES - 1
scene.render.fps = 40
scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.render.resolution_percentage = 100
scene.eevee.taa_render_samples = 16
scene.world = bpy.data.worlds.new("Studio ambient")
scene.world.color = (0.25, 0.3, 0.3)


def material(name, color, roughness=0.85, metallic=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    shader = m.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return m


fur = material("Warm tawny fur", (0.34, 0.12, 0.041), 0.9)
ear_fur = material("Tiny tawny ears", (0.31, 0.112, 0.052), 0.94)
inner_ear = material("Inner ear umber", (0.17, 0.072, 0.048), 0.95)
eye_rim = material("Soft eyelid", (0.19, 0.09, 0.052), 0.88)
eye_black = material("Wet black eyes", (0.014, 0.009, 0.006), 0.14)
eye_glint = material("Eye catchlight", (0.86, 0.81, 0.65), 0.1)
nose_mat = material("Soft charcoal nose", (0.073, 0.049, 0.038), 0.59)
toe_mat = material("Earth brown claws", (0.19, 0.11, 0.073), 0.65)


def ellipsoid(name, loc, scale, mat=None, segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings,
                                        location=(loc[0], loc[1] * LENGTH_SCALE, loc[2]))
    ob = bpy.context.object
    ob.name = name
    ob.scale = (scale[0], scale[1] * LENGTH_SCALE, scale[2])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        ob.data.materials.append(mat)
    for polygon in ob.data.polygons:
        polygon.use_smooth = True
    return ob


def rounded_box(name, loc, half_size, bevel=0.102):
    bpy.ops.mesh.primitive_cube_add(location=(loc[0], loc[1] * LENGTH_SCALE, loc[2]))
    ob = bpy.context.object
    ob.name = name
    ob.scale = (half_size[0], half_size[1] * LENGTH_SCALE, half_size[2])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    edge = ob.modifiers.new("Soft squared muzzle", "BEVEL")
    edge.width = bevel
    edge.segments = 5
    bpy.ops.object.modifier_apply(modifier=edge.name)
    for face in ob.data.polygons:
        face.use_smooth = True
    return ob


# Sculpt-like overlapping ellipsoids are voxel-unioned into a single continuous
# skin, rather than leaving four disconnected primitive legs on a sphere body.
volumes = [
    ("barrel", (0, 0.025, 0.402), (0.274, 0.535, 0.21)),
    ("rump", (0, 0.31, 0.395), (0.27, 0.25, 0.207)),
    ("chest", (0, -0.304, 0.41), (0.261, 0.27, 0.206)),
    ("neck", (0, -0.49, 0.468), (0.207, 0.23, 0.172)),
    ("cranium", (0, -0.641, 0.51), (0.183, 0.249, 0.157)),
    ("brow into snout", (0, -0.775, 0.492), (0.168, 0.197, 0.101)),
    ("left cheek", (-0.131, -0.717, 0.454), (0.074, 0.127, 0.096)),
    ("right cheek", (0.131, -0.717, 0.454), (0.074, 0.127, 0.096)),
]
for side in (-1, 1):
    x = side * 0.209
    for label, y, shoulder, upper_r in (
        ("front", -0.315, 0.282, (0.072, 0.102, 0.159)),
        ("rear", 0.313, 0.295, (0.095, 0.118, 0.166)),
    ):
        volumes.extend([
            (f"{label} haunch {side}", (x, y, shoulder), upper_r),
            (f"{label} shank {side}", (x, y + (0.012 if label == "rear" else -0.01), 0.15), (0.051, 0.063, 0.134)),
            (f"{label} paw {side}", (x, y - 0.049, 0.055), (0.065, 0.098, 0.04)),
        ])

pieces = [ellipsoid(name, loc, scale, segments=24, rings=16) for name, loc, scale in volumes]
pieces.append(rounded_box("Wide blunt capybara muzzle", (0, -0.859, 0.449), (0.18, 0.19, 0.126)))
bpy.ops.object.select_all(action="DESELECT")
for item in pieces:
    item.select_set(True)
bpy.context.view_layer.objects.active = pieces[0]
bpy.ops.object.join()
skin = bpy.context.object
skin.name = "Capybara · continuous skin"
skin.data.remesh_voxel_size = 0.012
bpy.ops.object.voxel_remesh()
smooth = skin.modifiers.new("Anatomical surface smoothing", "SMOOTH")
smooth.factor = 1.0
smooth.iterations = 12
bpy.ops.object.modifier_apply(modifier=smooth.name)
decimate = skin.modifiers.new("Mobile topology", "DECIMATE")
decimate.ratio = 0.58
bpy.ops.object.modifier_apply(modifier=decimate.name)
for face in skin.data.polygons:
    face.use_smooth = True
skin.data.materials.append(fur)


# Per-vertex colour gives the broad russet-to-golden fur variation without
# shipping a huge texture. Micro-variation remains deterministic on rebuild.
colors = skin.data.color_attributes.new(name="Fur colour", type="FLOAT_COLOR", domain="CORNER")
rng = random.Random(91713)
vertex_tones = []
for vert in skin.data.vertices:
    x, y, z = vert.co
    n = 0.012 * math.sin(77 * x + 29 * y) * math.sin(91 * z - 14 * y)
    n += 0.007 * math.sin(204 * x + 142 * z) + rng.uniform(-0.004, 0.004)
    back_gold = max(0, min(1, (z - 0.28) / 0.32))
    face_gold = max(0, min(1, (-y - 0.55 * LENGTH_SCALE) / (0.34 * LENGTH_SCALE)))
    belly_dark = max(0, min(1, (0.21 - z) / 0.18))
    r = 0.30 + 0.082 * back_gold + 0.042 * face_gold - 0.058 * belly_dark + n
    g = 0.101 + 0.053 * back_gold + 0.025 * face_gold - 0.02 * belly_dark + n * 0.61
    b = 0.033 + 0.018 * back_gold + 0.011 * face_gold - 0.007 * belly_dark + n * 0.25
    vertex_tones.append((max(0.02, r), max(0.02, g), max(0.02, b), 1))
for loop in skin.data.loops:
    colors.data[loop.index].color = vertex_tones[loop.vertex_index]
attribute = fur.node_tree.nodes.new("ShaderNodeVertexColor")
attribute.layer_name = "Fur colour"
fur.node_tree.links.new(attribute.outputs["Color"], fur.node_tree.nodes.get("Principled BSDF").inputs["Base Color"])


def bone(arm, name, head, tail, parent=None):
    b = arm.edit_bones.new(name)
    b.head = (head[0], head[1] * LENGTH_SCALE, head[2])
    b.tail = (tail[0], tail[1] * LENGTH_SCALE, tail[2])
    if parent:
        b.parent = arm.edit_bones[parent]
        b.use_connect = False
    return b


arm_data = bpy.data.armatures.new("Capybara skeleton")
arm = bpy.data.objects.new("Capybara rig", arm_data)
scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
bone(arm_data, "Root", (0, 0.11, 0.41), (0, -0.06, 0.41))
bone(arm_data, "Body", (0, 0.15, 0.43), (0, -0.43, 0.45), "Root")
bone(arm_data, "Head", (0, -0.43, 0.49), (0, -0.86, 0.46), "Body")
for side, suffix in ((-1, "L"), (1, "R")):
    x = side * 0.208
    for label, y in (("Front", -0.315), ("Hind", 0.313)):
        knee_y = y + (-0.115 if label == "Hind" else 0.115)
        bone(arm_data, f"{label}Upper.{suffix}", (x, y, 0.375), (x, knee_y, 0.224), "Body")
        bone(arm_data, f"{label}Lower.{suffix}", (x, knee_y, 0.224), (x, y, 0.083), f"{label}Upper.{suffix}")
        bone(arm_data, f"{label}Foot.{suffix}", (x, y, 0.083), (x, y - 0.102, 0.064), f"{label}Lower.{suffix}")
bpy.ops.object.mode_set(mode="OBJECT")
arm.show_in_front = False


# A continuous mesh is painted analytically: feet follow their own joints,
# shanks blend into haunches, and the large torso remains stable.
groups = {b.name: skin.vertex_groups.new(name=b.name) for b in arm_data.bones}
for vert in skin.data.vertices:
    x, y, z = vert.co
    weights = {"Body": 1.0}
    if y < -0.42 * LENGTH_SCALE and z > 0.34:
        head_factor = min(1, max(0, (-y - 0.42 * LENGTH_SCALE) / (0.28 * LENGTH_SCALE)))
        weights = {"Body": 1 - head_factor, "Head": head_factor}
    for side, suffix in ((-1, "L"), (1, "R")):
        for label, ly in (("Front", -0.315), ("Hind", 0.313)):
            dx = abs(x - side * 0.208)
            dy = abs(y - ly * LENGTH_SCALE)
            radial = max(0, 1 - (dx / 0.125) ** 2 - (dy / (0.145 * LENGTH_SCALE)) ** 2)
            lower_envelope = max(0, min(1, (0.405 - z) / 0.23))
            strength = radial * lower_envelope
            if strength < 0.005:
                continue
            for key in list(weights):
                weights[key] *= 1 - strength
            upper = max(0, min(1, (z - 0.09) / 0.21))
            foot = max(0, min(1, (0.125 - z) / 0.075)) * strength
            weights[f"{label}Upper.{suffix}"] = weights.get(f"{label}Upper.{suffix}", 0) + strength * upper * (1 - foot)
            weights[f"{label}Lower.{suffix}"] = weights.get(f"{label}Lower.{suffix}", 0) + strength * (1 - upper) * (1 - foot)
            weights[f"{label}Foot.{suffix}"] = weights.get(f"{label}Foot.{suffix}", 0) + foot
    total = sum(weights.values())
    for name, value in weights.items():
        if value > 0.001:
            groups[name].add([vert.index], value / total, "REPLACE")

arm_modifier = skin.modifiers.new("Smooth skeletal deformation", "ARMATURE")
arm_modifier.object = arm
skin.parent = arm


def head_detail(name, location, scale, mat, bone_name="Head"):
    obj = ellipsoid(name, location, scale, mat, 20, 12)
    world_matrix = obj.matrix_world.copy()
    obj.parent = arm
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = world_matrix
    return obj


for side, suffix in ((-1, "L"), (1, "R")):
    sx = side * 0.158
    head_detail(f"Rounded ear.{suffix}", (sx, -0.51, 0.66), (0.039, 0.029, 0.046), ear_fur)
    head_detail(f"Ear velvet.{suffix}", (sx * 1.035, -0.531, 0.672), (0.021, 0.01, 0.025), inner_ear)
    head_detail(f"Eyelid.{suffix}", (side * 0.171, -0.633, 0.578), (0.02, 0.026, 0.02), eye_rim)
    head_detail(f"Eye.{suffix}", (side * 0.184, -0.642, 0.582), (0.012, 0.016, 0.013), eye_black)
    head_detail(f"Eye sparkle.{suffix}", (side * 0.195, -0.651, 0.587), (0.003, 0.004, 0.004), eye_glint)
    head_detail(f"Nostril.{suffix}", (side * 0.053, -1.063, 0.483), (0.014, 0.009, 0.011), nose_mat)
for side, suffix in ((-1, "L"), (1, "R")):
    for toe in range(3):
        x = side * (0.16 + toe * 0.04)
        for label, y in (("Front", -0.416), ("Hind", 0.209)):
            # Toenails are tiny and stay with the deforming foot via bone parent.
            obj = ellipsoid(f"{label} nail {suffix}{toe}", (x, y - 0.018, 0.043), (0.014, 0.026, 0.012), toe_mat, 12, 8)
            world_matrix = obj.matrix_world.copy()
            obj.parent = arm
            obj.parent_type = "BONE"
            obj.parent_bone = f"{label}Foot.{suffix}"
            obj.matrix_world = world_matrix


# Walk is authored using animated paw targets and Blender's two-bone IK. IK is
# baked into the deform bones before export; the engine needs no live solver.
targets = {}
for side, suffix in ((-1, "L"), (1, "R")):
    x = side * 0.208
    for label, y in (("Front", -0.315), ("Hind", 0.313)):
        empty = bpy.data.objects.new(f"IK target {label}.{suffix}", None)
        scene.collection.objects.link(empty)
        empty.location = (x, y, 0.085)
        targets[f"{label}.{suffix}"] = empty
        con = arm.pose.bones[f"{label}Lower.{suffix}"].constraints.new("IK")
        con.target = empty
        con.chain_count = 2
        con.use_stretch = False


arm.animation_data_create()
walk = bpy.data.actions.new("Walk")
arm.animation_data.action = walk
phase_offset = {"Front.L": 0, "Hind.R": 0.25, "Front.R": 0.5, "Hind.L": 0.75}
for frame in range(WALK_FRAMES):
    phase = frame / (WALK_FRAMES - 1)
    for key, target in targets.items():
        local_phase = (phase + phase_offset[key]) % 1
        if local_phase < STANCE:
            p = local_phase / STANCE
            advance = WALK_DISTANCE * STANCE * (p - 0.5)
            lift = 0
        else:
            p = (local_phase - STANCE) / (1 - STANCE)
            advance = -WALK_DISTANCE * STANCE * (p - 0.5)
            lift = 0.075 * math.sin(math.pi * p) ** 1.3
        side = -1 if key.endswith(".L") else 1
        y = -0.315 if key.startswith("Front") else 0.313
        target.location = (side * 0.208, y * LENGTH_SCALE + advance, 0.085 + lift)
        target.keyframe_insert("location", frame=frame)
    torso = arm.pose.bones["Body"]
    torso.location = (0, 0, 0.006 * math.sin(phase * math.tau * 2))
    torso.rotation_mode = "XYZ"
    torso.rotation_euler = (0.008 * math.sin(phase * math.tau), 0, 0.012 * math.sin(phase * math.tau))
    torso.keyframe_insert("location", frame=frame, group="Body")
    torso.keyframe_insert("rotation_euler", frame=frame, group="Body")
    head = arm.pose.bones["Head"]
    head.rotation_mode = "XYZ"
    head.rotation_euler = (0.013 * math.sin(phase * math.tau + 0.5), 0, 0)
    head.keyframe_insert("rotation_euler", frame=frame, group="Head")

bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
for pose_bone in arm.pose.bones:
    pose_bone.bone.select = True
bpy.ops.nla.bake(frame_start=0, frame_end=WALK_FRAMES - 1, step=1, only_selected=True,
                 visual_keying=True, clear_constraints=True, use_current_action=True,
                 clean_curves=False, bake_types={"POSE"})
bpy.ops.object.mode_set(mode="OBJECT")
walk = arm.animation_data.action
walk.name = "Walk"
for target in targets.values():
    bpy.data.objects.remove(target, do_unlink=True)


# A separate, genuinely still-footed idle: breathing, small ear/head motion,
# no limb bob. It is safe to blend with Walk in the engine.
idle = bpy.data.actions.new("Idle")
arm.animation_data.action = idle
for frame in range(WALK_FRAMES):
    phase = frame / (WALK_FRAMES - 1)
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.scale = (1, 1, 1)
    torso = arm.pose.bones["Body"]
    torso.location = (0, 0, 0.006 * math.sin(phase * math.tau))
    torso.keyframe_insert("location", frame=frame, group="Body")
    head = arm.pose.bones["Head"]
    head.rotation_mode = "XYZ"
    head.rotation_euler = (0.009 * math.sin(phase * math.tau + 0.2), 0, 0)
    head.keyframe_insert("rotation_euler", frame=frame, group="Head")
    for pb in arm.pose.bones:
        if pb.name not in ("Body", "Head"):
            pb.keyframe_insert("location", frame=frame, group=pb.name)
            pb.keyframe_insert("rotation_quaternion", frame=frame, group=pb.name)
arm.animation_data.action = idle


OUTPUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True)
skin.select_set(True)
for obj in bpy.data.objects:
    if obj.parent == arm and obj != skin:
        obj.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=str(OUTPUT), export_format="GLB", use_selection=True,
                          export_animations=True, export_animation_mode="ACTIONS",
                          export_frame_range=False, export_apply=False)

metadata = {
    "name": "Livs Dyreø original capybara",
    "license": "Original work for this repository",
    "up": "+Y",
    "forward": "+Z",
    "groundY": 0,
    "nominalLengthMetres": 1.25,
    "nominalShoulderHeightMetres": 0.61,
    "clips": {"Walk": {"durationSeconds": WALK_SECONDS, "cycleDistanceMetres": WALK_DISTANCE,
                       "stanceTravelMetres": WALK_DISTANCE * STANCE,
                       "rootSpeedMetresPerSecond": WALK_DISTANCE / WALK_SECONDS},
              "Idle": {"durationSeconds": WALK_SECONDS}},
    "source": "tools/art/create_capybara.py",
}
(OUTPUT.parent / "capybara.json").write_text(json.dumps(metadata, indent=2) + "\n")


def render_preview(frame, suffix, viewpoint):
    scene.frame_set(frame)
    light_data = bpy.data.lights.new("Warm key light", "AREA")
    light = bpy.data.objects.new("Warm key light", light_data)
    scene.collection.objects.link(light)
    light.location = (2.5, -3, 4)
    light_data.energy = 450
    light_data.shape = "DISK"
    light_data.size = 4
    camera_data = bpy.data.cameras.new("QA camera")
    camera = bpy.data.objects.new("QA camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = viewpoint
    target = Vector((0, -0.05, 0.34))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 1.72
    scene.camera = camera
    scene.render.filepath = f"/tmp/livs-capy-original-{suffix}.png"
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(camera, do_unlink=True)
    bpy.data.objects.remove(light, do_unlink=True)


arm.animation_data.action = walk
render_preview(7, "side", (2.1, -2.15, 1.1))
render_preview(24, "threequarter", (1.8, -2.45, 1.15))
render_preview(40, "front", (0.25, -2.8, 0.95))
print("Wrote", OUTPUT)
