#!/usr/bin/env python3
"""Blood & Iron A2.3: offline alpha roof/base render study from A2.2.

This is NOT a game renderer/atlas integration. It only outputs two fixed-camera,
1120x720 RGBA PNG layers for a later independent, measurable WebP encode.
Blender 4.5 LTS/Cycles CPU. No original Blender or GLB file modifications.

blender --background --factory-startup \
    --python tools/art/render_greyhaven_a23_layers.py -- \
    --base /path/blood_iron_greyhaven_a22.blend --out-dir /path/a23 --samples 4
"""
import argparse
import json
import sys
from pathlib import Path
import bpy

params=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
p=argparse.ArgumentParser()
p.add_argument("--base", type=Path, required=True)
p.add_argument("--out-dir",type=Path,required=True)
p.add_argument("--samples",type=int,default=4)
args=p.parse_args(params)
assert args.base.is_file()
args.out_dir.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(args.base.resolve()))
scene=bpy.context.scene
scene.render.engine="CYCLES"
scene.cycles.device="CPU"
scene.cycles.samples=max(4,min(16,args.samples))
scene.render.resolution_x=1120
scene.render.resolution_y=720
scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.render.image_settings.file_format="PNG"
scene.render.image_settings.color_mode="RGBA"
scene.render.image_settings.color_depth="8"

camera=bpy.data.objects.get("A2 / street review / 3-4 angle")
assert camera is not None and camera.type=="CAMERA"
assert camera.data.type=="ORTHO"
scene.camera=camera
assert scene.render.resolution_x==1120 and scene.render.resolution_y==720

ROOF_SUFFIXES=("/ roof occlusion"," / laid roof courses")
ROOF_PREFIXES=("Red Lion / roof_", "Red Lion A2.1 / batched individually coloured clay roof tiles")
ROOF_A22=" A2.2 / batched "
HOUSES=("Gable Merchant","Tanner's Cottage","Stone Weaver","Blacksmith")

def is_actual_roof(ob):
    if ob.type!="MESH":
        return False
    n=ob.name
    if n.startswith(ROOF_PREFIXES):
        return True
    if any(n.startswith(house) and n.endswith(ROOF_SUFFIXES) for house in HOUSES):
        return True
    if any(n.startswith(house) and ROOF_A22 in n and n.endswith(" roof") for house in HOUSES):
        return True
    return False

original={o.name:o.hide_render for o in scene.objects if o.type=="MESH"}
roof_names=[o.name for o in scene.objects if is_actual_roof(o)]
base_names=[o.name for o in scene.objects if o.type=="MESH" and not is_actual_roof(o)]
assert len(roof_names)>=10 and len(base_names)>100
assert "Red Lion / gables" in base_names, "gable wall must remain base"
assert "Gable Merchant / plaster walls" in base_names, "merchant walls must remain base"
assert "Gable Merchant / roof occlusion" in roof_names
assert "Red Lion A2.1 / batched individually coloured clay roof tiles" in roof_names
assert "Gable Merchant A2.2 / batched slate roof" in roof_names
assert all(original[name] for name in roof_names
           if "laid roof courses" in name or name=="Red Lion / roof_tile_courses")
assert len([o for o in scene.objects if o.name.startswith("Oak ale barrel /")])==7

results={}
for layer in ("base","roof"):
    for ob in scene.objects:
        if ob.type!="MESH":
            continue
        # Preserve the prior A2.2 hiding choices, including obsolete roof
        # markers; never resurrect superseded geometry for this export.
        ob.hide_render=original[ob.name] or (is_actual_roof(ob) != (layer=="roof"))
    visible=[o.name for o in scene.objects if o.type=="MESH" and not o.hide_render]
    assert visible
    assert all(is_actual_roof(scene.objects[n])==(layer=="roof") for n in visible)
    out=args.out_dir/("greyhaven_a23_"+layer+".png")
    scene.render.filepath=str(out)
    bpy.ops.render.render(write_still=True)
    assert out.is_file() and out.stat().st_size>1000
    results[layer]={"png":out.name,"visibleMeshes":len(visible),
                    "roofMeshes":sum(is_actual_roof(scene.objects[n]) for n in visible),
                    "pngBytes":out.stat().st_size}
# Reset all source object flags in active process, even though no source scene
# is saved. This protects an interactive render-process reuse as well.
for ob in scene.objects:
    if ob.type=="MESH":
        ob.hide_render=original[ob.name]
assert all(scene.objects[n].hide_render==v for n,v in original.items())

report={
 "milestone":"Blood & Iron A2.3 offline fixed-camera alpha layer study",
 "inputScene":args.base.name,
 "camera":camera.name,
 "canvas":[1120,720],
 "projection":"orthographic review camera, not validated against browser",
 "metersPerWorldUnitValidatedInBrowser":False,
 "layers":results,
 "roofObjectsClassified":len(roof_names),
 "baseObjectsClassified":len(base_names),
 "classification":"explicit roof names, never the historic gable substring candidate tag",
 "sourceSceneSaved":False,
 "gameplayChanged":False,
 "A3RollChanged":False,
 "roofOcclusionRuntimeActive":False,
 "lighting": "separate Cycles CPU passes; shadows and alpha compositing not yet runtime validated",
 "productionApproved":False
}
(args.out_dir/"greyhaven_a23_layer_render_report.json").write_text(
    json.dumps(report,sort_keys=True,indent=2)+"\n",encoding="utf8")
print("A23_LAYER_REPORT="+json.dumps(report,sort_keys=True))
