"""Structural QA for the capybara GLB; no Blender or rendering dependencies.

Run from any directory with ``python tests/animation_asset.py``. This checks
machine-readable skin/clip contracts, not visual fidelity or actual foot contact.
"""

from __future__ import annotations

import argparse
import bisect
import json
import math
import struct
from pathlib import Path


COMPONENTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
FORMATS = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}
SIZES = {key: struct.calcsize("<" + fmt) for key, fmt in FORMATS.items()}


def check(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


class GLB:
    def __init__(self, path: Path):
        data = path.read_bytes()
        check(len(data) >= 20, "GLB header is missing")
        magic, version, length = struct.unpack_from("<4sII", data)
        check(magic == b"glTF" and version == 2, "Expected a glTF 2.0 binary")
        check(length == len(data), "GLB declared length does not match file")
        offset = 12
        chunks = {}
        while offset < len(data):
            check(offset + 8 <= len(data), "Truncated chunk header")
            size, kind = struct.unpack_from("<I4s", data, offset)
            offset += 8
            check(offset + size <= len(data), "Truncated chunk body")
            check(kind not in chunks, "Duplicate GLB chunk")
            chunks[kind] = memoryview(data)[offset : offset + size]
            offset += size
        check(b"JSON" in chunks and b"BIN\x00" in chunks, "Missing JSON/BIN chunk")
        self.doc = json.loads(chunks[b"JSON"].tobytes())
        self.binary = chunks[b"BIN\x00"]
        check(self.doc.get("asset", {}).get("version") == "2.0", "Not glTF 2.0")
        check(len(self.doc.get("buffers", [])) == 1, "Expected one embedded buffer")
        check(self.doc["buffers"][0]["byteLength"] <= len(self.binary), "Short BIN chunk")

    def accessor(self, index: int) -> list[tuple[float | int, ...]]:
        accessor = self.doc["accessors"][index]
        check("sparse" not in accessor, f"Sparse accessor {index} is not supported")
        view = self.doc["bufferViews"][accessor["bufferView"]]
        check(view.get("buffer", 0) == 0, "Accessor does not use embedded buffer")
        component_type = accessor["componentType"]
        check(component_type in FORMATS, f"Unknown component type {component_type}")
        components = COMPONENTS[accessor["type"]]
        component_size = SIZES[component_type]
        item_size = components * component_size
        stride = view.get("byteStride", item_size)
        check(stride >= item_size, f"Invalid accessor stride {index}")
        start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        end = start + (accessor["count"] - 1) * stride + item_size
        check(end <= view.get("byteOffset", 0) + view["byteLength"], f"Accessor {index} exceeds bufferView")
        unpack = struct.Struct("<" + FORMATS[component_type] * components).unpack_from
        values = [unpack(self.binary, start + i * stride) for i in range(accessor["count"])]
        if accessor.get("normalized", False) and component_type != 5126:
            if component_type in (5120, 5122):
                max_positive = float((1 << (8 * component_size - 1)) - 1)
                return [tuple(max(-1.0, number / max_positive) for number in row) for row in values]
            max_value = float((1 << (8 * component_size)) - 1)
            return [tuple(number / max_value for number in row) for row in values]
        return values


def verify_skin(glb: GLB) -> dict:
    doc = glb.doc
    skins = doc.get("skins", [])
    check(skins, "No skeleton skin")
    nodes = doc.get("nodes", [])
    required_bones = {f"{limb}{part}.{side}" for limb in ("Front", "Hind")
                      for part in ("Upper", "Lower", "Foot") for side in ("L", "R")}
    joint_counts = []
    for skin in skins:
        joints = skin["joints"]
        check(len(joints) >= 12 and len(joints) == len(set(joints)), "Missing or duplicate leg joints")
        check(all(0 <= joint < len(nodes) for joint in joints), "Joint index outside node table")
        names = {nodes[joint].get("name", "") for joint in joints}
        check(required_bones <= names, f"Missing quadruped bones: {sorted(required_bones - names)}")
        if "inverseBindMatrices" in skin:
            matrices = glb.accessor(skin["inverseBindMatrices"])
            check(len(matrices) == len(joints), "Inverse bind matrix count does not match joints")
            check(all(math.isfinite(value) for row in matrices for value in row), "Non-finite inverse bind matrix")
        joint_counts.append(len(joints))

    skinned_nodes = [(node, doc["meshes"][node["mesh"]], skins[node["skin"]])
                     for node in nodes if "mesh" in node and "skin" in node]
    check(skinned_nodes, "No mesh node is attached to a skin")
    vertex_count = 0
    min_y = math.inf
    max_y = -math.inf
    maximum_weight_error = 0.0
    for _, mesh, skin in skinned_nodes:
        for primitive in mesh["primitives"]:
            attributes = primitive["attributes"]
            check("POSITION" in attributes and "JOINTS_0" in attributes and "WEIGHTS_0" in attributes,
                  "Skinned primitive missing POSITION/JOINTS_0/WEIGHTS_0")
            positions = glb.accessor(attributes["POSITION"])
            joint_sets = [glb.accessor(attributes[f"JOINTS_{slot}"]) for slot in (0, 1)
                          if f"JOINTS_{slot}" in attributes]
            weight_sets = [glb.accessor(attributes[f"WEIGHTS_{slot}"]) for slot in (0, 1)
                           if f"WEIGHTS_{slot}" in attributes]
            check(len(joint_sets) == len(weight_sets), "JOINTS/WEIGHTS sets mismatch")
            check(all(len(values) == len(positions) for values in joint_sets + weight_sets),
                  "Skin attributes have different vertex counts")
            for vertex in range(len(positions)):
                weights = [weight for weights_at_vertex in weight_sets for weight in weights_at_vertex[vertex]]
                joints = [joint for joints_at_vertex in joint_sets for joint in joints_at_vertex[vertex]]
                check(all(math.isfinite(weight) and weight >= -1e-6 for weight in weights),
                      f"Invalid skin weight at vertex {vertex}")
                check(all(0 <= joint < len(skin["joints"]) for joint in joints),
                      f"Invalid joint index at vertex {vertex}")
                error = abs(sum(weights) - 1.0)
                maximum_weight_error = max(maximum_weight_error, error)
                check(error <= 0.02, f"Skin weights at vertex {vertex} sum to {sum(weights):.4f}")
            min_y = min(min_y, *(row[1] for row in positions))
            max_y = max(max_y, *(row[1] for row in positions))
            vertex_count += len(positions)
    check(vertex_count >= 100, "Skinned mesh is unexpectedly sparse")
    check(-0.05 <= min_y <= 0.12, f"Skinned mesh local ground is implausible: {min_y:.3f} m")
    check(0.4 <= max_y - min_y <= 2.0, "Skinned mesh height is implausible")
    return {"joints_per_skin": joint_counts, "skinned_vertices": vertex_count,
            "local_skin_y_bounds_metres": [round(min_y, 4), round(max_y, 4)],
            "maximum_weight_sum_error": round(maximum_weight_error, 6)}


def gap(first: tuple, last: tuple, path: str) -> float:
    check(len(first) == len(last), "Animation keyframe dimensions differ")
    difference = math.sqrt(sum((a - b) ** 2 for a, b in zip(first, last)))
    if path == "rotation":
        negated = math.sqrt(sum((a + b) ** 2 for a, b in zip(first, last)))
        difference = min(difference, negated)
    return difference


def verify_animations(glb: GLB) -> dict:
    doc = glb.doc
    animations = {clip.get("name"): clip for clip in doc.get("animations", [])}
    check({"Walk", "Idle"} <= animations.keys(), "Walk and Idle clips are required")
    joint_nodes = {node for skin in doc["skins"] for node in skin["joints"]}
    report = {}
    for clip_name in ("Walk", "Idle"):
        clip = animations[clip_name]
        check(clip.get("channels"), f"{clip_name} clip has no channels")
        duration = 0.0
        first_key = math.inf
        last_key = 0.0
        worst_gap = 0.0
        animated_joints = set()
        root_translation_sweep = 0.0
        for channel in clip["channels"]:
            target = channel["target"]
            node = target["node"]
            path = target["path"]
            check(node in joint_nodes, f"{clip_name} animates non-skin node {node}")
            check(path in ("translation", "rotation", "scale"), f"Unexpected animation path {path}")
            animated_joints.add(node)
            sampler = clip["samplers"][channel["sampler"]]
            times = [row[0] for row in glb.accessor(sampler["input"])]
            check(len(times) >= 2 and all(math.isfinite(t) for t in times),
                  f"{clip_name} has invalid key times")
            check(all(b > a for a, b in zip(times, times[1:])), f"{clip_name} keys are not increasing")
            check(abs(times[0]) <= 1e-3, f"{clip_name} channel must start at zero: {times[0]:.3f} s")
            first_key = min(first_key, times[0])
            last_key = max(last_key, times[-1])
            duration = max(duration, times[-1] - times[0])
            outputs = glb.accessor(sampler["output"])
            if sampler.get("interpolation") == "CUBICSPLINE":
                check(len(outputs) == len(times) * 3, "Cubic keyframe count mismatch")
                values = outputs[1::3]
            else:
                check(len(outputs) == len(times), "Keyframe count mismatch")
                values = outputs
            check(all(math.isfinite(value) for row in values for value in row),
                  f"{clip_name} has non-finite animation values")
            loop_gap = gap(values[0], values[-1], path)
            worst_gap = max(worst_gap, loop_gap)
            tolerance = 0.08 if path != "rotation" else 0.13
            check(loop_gap <= tolerance,
                  f"{clip_name} {doc['nodes'][node].get('name', node)} {path} loop gap {loop_gap:.4f}")
            if path == "translation" and doc["nodes"][node].get("name") == "Root":
                root_translation_sweep = max(root_translation_sweep,
                                             max(gap(values[0], value, path) for value in values))
        check(0.2 <= duration <= 4.0, f"{clip_name} duration implausible: {duration:.3f} s")
        check(len(animated_joints) >= 12, f"{clip_name} does not animate all four legs")
        check(root_translation_sweep <= 0.05,
              f"{clip_name} contains {root_translation_sweep:.3f} m root translation (double movement risk)")
        report[clip_name] = {"cycle_seconds": round(duration, 4),
                             "first_key_seconds": round(first_key, 4),
                             "last_key_seconds": round(last_key, 4),
                             "animated_joints": len(animated_joints),
                             "largest_first_last_key_gap": round(worst_gap, 5),
                             "root_translation_sweep_metres": round(root_translation_sweep, 5)}
    return report


def rotate(quaternion: tuple, point: tuple) -> tuple:
    """Rotate a vector with a glTF xyzw quaternion."""
    x, y, z, w = quaternion
    vx, vy, vz = point
    tx, ty, tz = 2 * (y * vz - z * vy), 2 * (z * vx - x * vz), 2 * (x * vy - y * vx)
    return (vx + w * tx + y * tz - z * ty,
            vy + w * ty + z * tx - x * tz,
            vz + w * tz + x * ty - y * tx)


def multiply_quaternions(a: tuple, b: tuple) -> tuple:
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return (aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw,
            aw * bw - ax * bx - ay * by - az * bz)


def sample_curve(curve: tuple, time: float, path: str) -> tuple:
    times, values, interpolation = curve
    index = bisect.bisect_right(times, time) - 1
    if index < 0:
        return values[0]
    if index >= len(times) - 1 or interpolation == "STEP":
        return values[index]
    amount = (time - times[index]) / (times[index + 1] - times[index])
    first, second = values[index], values[index + 1]
    if path == "rotation" and sum(a * b for a, b in zip(first, second)) < 0:
        second = tuple(-value for value in second)
    result = tuple(a + (b - a) * amount for a, b in zip(first, second))
    if path == "rotation":
        length = math.sqrt(sum(value * value for value in result))
        return tuple(value / length for value in result)
    return result


def foot_trajectory(glb: GLB) -> dict:
    """Measure animated foot-joint origins, not actual deforming paw contact."""
    doc = glb.doc
    nodes = doc["nodes"]
    parent = {}
    for index, node in enumerate(nodes):
        for child in node.get("children", []):
            check(child not in parent, "Node has multiple parents")
            parent[child] = index
    walk = next(clip for clip in doc["animations"] if clip.get("name") == "Walk")
    curves = {}
    for channel in walk["channels"]:
        sampler = walk["samplers"][channel["sampler"]]
        times = [row[0] for row in glb.accessor(sampler["input"])]
        values = glb.accessor(sampler["output"])
        check(sampler.get("interpolation") != "CUBICSPLINE", "Foot sampling needs linear or step keys")
        curves[(channel["target"]["node"], channel["target"]["path"])] = (
            times, values, sampler.get("interpolation", "LINEAR"))
    longest = max(curves.values(), key=lambda curve: len(curve[0]))[0]
    names = {node.get("name"): index for index, node in enumerate(nodes)}

    def world_origin(index: int, time: float, cache: dict) -> tuple:
        if index in cache:
            return cache[index]
        node = nodes[index]
        check("matrix" not in node, "Foot evaluation needs node TRS, not matrix")
        def local(path: str, default: tuple) -> tuple:
            curve = curves.get((index, path))
            return sample_curve(curve, time, path) if curve else tuple(node.get(path, default))
        translation = local("translation", (0, 0, 0))
        rotation = local("rotation", (0, 0, 0, 1))
        scale = local("scale", (1, 1, 1))
        if index not in parent:
            value = (translation, rotation, scale)
        else:
            p_translation, p_rotation, p_scale = world_origin(parent[index], time, cache)
            shifted = rotate(p_rotation, tuple(a * b for a, b in zip(p_scale, translation)))
            value = (tuple(a + b for a, b in zip(p_translation, shifted)),
                     multiply_quaternions(p_rotation, rotation),
                     tuple(a * b for a, b in zip(p_scale, scale)))
        cache[index] = value
        return value

    # The model faces +Z. A world-moving root at 0.42 m / 1.2 s should cancel
    # local -Z paw travel during each stance. This uses bone origins as a proxy:
    # skin deformation/toe contact still require a renderer-level visual check.
    cycle_seconds = longest[-1] - longest[0]
    check(1.15 <= cycle_seconds <= 1.25, "Walk timing no longer matches the 1.2 s gait")
    speed = 0.42 / cycle_seconds
    stance_fraction = 0.65
    offsets = {"FrontFoot.L": 0.0, "HindFoot.R": 0.25,
               "FrontFoot.R": 0.5, "HindFoot.L": 0.75}
    metrics = {}
    for name, offset in offsets.items():
        check(name in names, f"Missing foot bone {name}")
        positions = [world_origin(names[name], time, {})[0] for time in longest]
        stance_deltas = []
        stance_heights = []
        for index in range(len(longest) - 1):
            phase_a = ((longest[index] - longest[0]) / cycle_seconds + offset) % 1
            phase_b = ((longest[index + 1] - longest[0]) / cycle_seconds + offset) % 1
            if phase_a < stance_fraction and phase_b < stance_fraction and phase_b > phase_a:
                dt = longest[index + 1] - longest[index]
                dz = positions[index + 1][2] - positions[index][2]
                stance_deltas.append((dz / dt, (dz / dt) + speed))
                stance_heights.append(positions[index][1])
        check(stance_deltas, f"No stance samples for {name}")
        local_speeds = [pair[0] for pair in stance_deltas]
        residuals = [pair[1] for pair in stance_deltas]
        check(sum(local_speeds) / len(local_speeds) < -0.25,
              f"{name} does not counter-move against +Z root travel")
        check(abs(sum(residuals) / len(residuals)) <= 0.025 and max(map(abs, residuals)) <= 0.08,
              f"{name} slides excessively during stance")
        check(0.04 <= min(stance_heights) <= 0.13 and max(stance_heights) - min(stance_heights) <= 0.02,
              f"{name} foot joint height is unstable or implausible")
        metrics[name] = {"stance_local_z_speed_mean": round(sum(local_speeds) / len(local_speeds), 4),
                         "stance_world_z_speed_residual_mean": round(sum(residuals) / len(residuals), 4),
                         "stance_world_z_speed_residual_max_abs": round(max(map(abs, residuals)), 4),
                         "stance_foot_joint_y_range": [round(min(stance_heights), 4),
                                                       round(max(stance_heights), 4)]}
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("asset", nargs="?", type=Path,
                        default=Path(__file__).resolve().parents[1] / "public/models/capybara.glb")
    args = parser.parse_args()
    glb = GLB(args.asset)
    metrics = {"asset": str(args.asset), "skin": verify_skin(glb),
               "clips": verify_animations(glb),
               "foot_joint_motion": foot_trajectory(glb),
               "foot_contact": "Not verified: joint origins are only proxies for deforming paw/toe contact."}
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
