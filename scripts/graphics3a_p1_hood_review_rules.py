"""Private-only approved Quaternius Ranger hood source selection for Peasant A/B.

The published free Standard ZIP is kept off GitHub. These pure checks only
choose unambiguous, literal author files; no external URLs or wildcard guesses.
"""
ROOT = "Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Modular Parts/"
HOOD_FILES = {
    "Male_Peasant.gltf": ROOT + "Male_Ranger_Head_Hood.gltf",
    "Female_Peasant.gltf": ROOT + "Female_Ranger_Head_Hood.gltf",
}


def approved_hood_member(target_model_filename: str, archive_names) -> str:
    if target_model_filename not in HOOD_FILES:
        raise ValueError("Only explicitly approved Peasant review models can use Ranger hoods")
    member = HOOD_FILES[target_model_filename]
    if not isinstance(archive_names, (list, tuple)):
        raise ValueError("Approved hood archive member inventory is required")
    count = sum(name == member for name in archive_names)
    if count != 1:
        raise ValueError("Expected exactly one official Standard Ranger hood glTF source member")
    return member


def verified_hood_bind_anchors(source, target, joint_names, tolerance_m: float = .001):
    """Reject absent or misaligned important joints in rest-world coordinates."""
    import math
    if not math.isfinite(tolerance_m) or tolerance_m < 0:
        raise ValueError("Invalid hood bind tolerance")
    result = {}
    for name in joint_names:
        if name not in source or name not in target:
            raise ValueError("Required Ranger hood bone missing from source or target")
        a, b = source[name], target[name]
        if len(a) != 3 or len(b) != 3 or not all(math.isfinite(float(x)) for x in (*a,*b)):
            raise ValueError("Invalid source/target hood bone translation")
        distance = math.sqrt(sum((float(a[i])-float(b[i]))**2 for i in range(3)))
        if distance > tolerance_m:
            raise ValueError(f"Ranger hood bind anchor {name} differs by {distance:.5f}m")
        result[name] = distance
    if not result:
        raise ValueError("No hood/Peasant bone anchors supplied")
    return result
