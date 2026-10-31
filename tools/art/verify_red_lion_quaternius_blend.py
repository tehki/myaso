#!/usr/bin/env python3
"""Independent native-Blender audit of the saved editable Red Lion scene."""
import argparse,json,sys
from pathlib import Path
import bpy
from mathutils import Vector

def cli():
    argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    p=argparse.ArgumentParser()
    p.add_argument("--blend",required=True,type=Path)
    p.add_argument("--manifest",required=True,type=Path)
    return p.parse_args(argv)

def bounds(objects):
    bpy.context.view_layer.update()
    pts=[o.matrix_world@Vector(c) for o in objects if o.type=="MESH" for c in o.bound_box]
    if not pts:raise ValueError("Expected real editable mesh geometry")
    return {k:[min(v[i] for v in pts),max(v[i] for v in pts)]
            for i,k in enumerate(("x","y","z"))}

def children(root):
    return [root]+list(root.children_recursive)

def run():
    import sys
    args=cli()
    manifest=json.loads(args.manifest.read_text(encoding="utf-8"))
    if (manifest.get("sourceCommit")!="21104b4045261c28fc312360841ed1a7b0ac8782"
        or len(manifest.get("parts",[]))!=33
        or manifest.get("originalA232ModelIncluded") is not False):
        raise ValueError("Pinned source-only Quaternius manifest mismatch")
    bpy.ops.wm.open_mainfile(filepath=str(args.blend.resolve()))
    scene=bpy.context.scene
    if scene.render.engine!="CYCLES":raise ValueError("Saved project is not a Cycles Blender scene")
    roots=[o for o in bpy.data.objects if o.parent is None and o.name.startswith("CC0_Quaternius_")]
    if len(roots)!=33:raise ValueError("Saved blend must retain all 33 original Quaternius source modules")
    if any("A232" in o.name or "Original_Red_Lion" in o.name for o in bpy.data.objects):
        raise ValueError("Rejected A2.32 geometry found in the new Blender scene")
    if any(o.name.startswith("CC0_Quaternius_Prop_Vine2") for o in roots):
        raise ValueError("Old misplaced wall-vine prop remains visible in scene")
    sign=bpy.data.objects.get("RedLion_Tavern_TrueOakSignBoard")
    if sign is None:raise ValueError("Raised 3D tavern sign missing")
    window_roots=[bpy.data.objects.get("CC0_Quaternius_Window_Wide_Round1"),
                  bpy.data.objects.get("CC0_Quaternius_Window_Wide_Round1.001")]
    if any(x is None for x in window_roots):raise ValueError("Original front window modules missing")
    window_bounds=bounds([o for r in window_roots for o in children(r)])
    sign_bounds=bounds([sign])
    sign_gap=sign_bounds["z"][0]-window_bounds["z"][1]
    if sign_gap<.25:raise ValueError("Sign still intersects front window arches")
    crate_root=bpy.data.objects.get("CC0_Quaternius_Prop_Crate")
    roof_root=bpy.data.objects.get("CC0_Quaternius_Roof_RoundTiles_6x8")
    chimney_root=bpy.data.objects.get("CC0_Quaternius_Prop_Chimney")
    if any(x is None for x in (crate_root,roof_root,chimney_root)):
        raise ValueError("Original crate, roof or chimney missing")
    crate_bounds=bounds(children(crate_root))
    roof_bounds=bounds(children(roof_root))
    crate_roof_gap=crate_bounds["x"][0]-roof_bounds["x"][1]
    if crate_roof_gap<.4:raise ValueError("Crate overlaps the roof footprint")
    leaves=[o for o in bpy.data.objects if o.type=="MESH" and o.name.startswith("RedLion_Artist_GroundIvy_Leaf_")]
    if len(leaves)!=9:raise ValueError("Nine separate editable ground ivy leaves are required")
    foliage_bounds=bounds(leaves)
    foliage_roof_gap=foliage_bounds["x"][0]-roof_bounds["x"][1]
    foliage_crate_gap=crate_bounds["y"][0]-foliage_bounds["y"][1]
    if foliage_roof_gap<.4 or foliage_crate_gap<.15:
        raise ValueError("Ground foliage intersects the house or crate")
    if foliage_bounds["z"][0]<0 or foliage_bounds["z"][1]>.2:
        raise ValueError("Ground foliage is not resting on the ground plane")
    smoke=bpy.data.objects.get("RedLion_DuskChimneySmoke_ActualCyclesVolume")
    if smoke is None or smoke.type!="MESH" or smoke.hide_render:
        raise ValueError("Dusk smoke mesh missing or hidden in saved final scene")
    if smoke.get("visible_only_in_dusk") is not True:
        raise ValueError("Dusk-only visibility contract missing")
    smoke_materials=[m for m in smoke.data.materials if m]
    if not smoke_materials or not any(
        n.type=="PRINCIPLED_VOLUME"
        for m in smoke_materials if m.use_nodes
        for n in m.node_tree.nodes
    ):
        raise ValueError("Real Cycles volumetric smoke material missing")
    smoke_bounds=bounds([smoke])
    chimney_bounds=bounds(children(chimney_root))
    if smoke_bounds["z"][0]<chimney_bounds["z"][1]:
        raise ValueError("Smoke does not originate at/above the real chimney outlet")
    if scene.camera is None or scene.camera.data.type!="ORTHO":
        raise ValueError("Original review camera missing")
    print("GRAPHICS3B_SAVED_EDITABLE_BLENDER_SCENE_PASS "+json.dumps({
        "blenderVersion":bpy.app.version_string,"quaterniusModules":len(roots),
        "artistGroundLeaves":len(leaves),"signWindowClearance":sign_gap,
        "crateRoofClearance":crate_roof_gap,"foliageRoofClearance":foliage_roof_gap,
        "foliageCrateGap":foliage_crate_gap,"foliageGroundZ":foliage_bounds["z"],
        "chimneyTopZ":chimney_bounds["z"][1],"smokeBounds":smoke_bounds,
        "duskSmokeOnly":True,"A232Meshes":0},sort_keys=True),flush=True)

if __name__=="__main__":
    import sys
    run()
