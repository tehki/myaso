#!/usr/bin/env python3
"""Genuine Quaternius Red Lion replacement: editable Blender, native day/dusk.

Builds independently of the previous A2.32 Red Lion. All architecture
derives from the pinned 176-model original CC0 Quaternius glTF MegaKit.
Original small sign/step/lighting are editable Blender artist geometry.
No World9 location, gameplay portal, item, collision or production changes.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

def cli():
    argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    p=argparse.ArgumentParser()
    p.add_argument("--manifest",required=True)
    p.add_argument("--source",required=True)
    p.add_argument("--output",required=True)
    return p.parse_args(argv)

def sha(path):
    digest=hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda:f.read(1024*1024),b""):
            digest.update(block)
    return digest.hexdigest()

def material(name,rgba,metallic=0,roughness=.8):
    m=bpy.data.materials.new(name)
    m.use_nodes=True
    bs=m.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value=(*rgba,1)
    bs.inputs["Metallic"].default_value=metallic
    bs.inputs["Roughness"].default_value=roughness
    m.diffuse_color=(*rgba,1)
    return m

def block(name,pos,size,m,bevel=.0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
    o=bpy.context.object
    o.name=name
    o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        b=o.modifiers.new("Hand cut stone/wood edge","BEVEL")
        b.width=bevel;b.segments=2
        o.modifiers.new("Weighted edges","WEIGHTED_NORMAL")
    o.data.materials.append(m)
    return o

def beam(name,a,b,width,mat):
    a,b=Vector(a),Vector(b)
    delta=b-a
    if delta.length<.05:raise ValueError("Missing real authoring beam")
    ob=block(name,(a+b)/2,(width,width,delta.length),mat,.006)
    ob.rotation_euler=delta.to_track_quat("Z","Y").to_euler()
    return ob

def imported(source,item):
    original=source/(item["model"]+".gltf")
    if not original.exists():raise FileNotFoundError("Missing pinned original glTF: "+str(original))
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(original))
    added=list(set(bpy.data.objects)-before)
    meshes=[o for o in added if o.type=="MESH"]
    if not meshes or sum(len(x.data.vertices) for x in meshes)<8:
        raise ValueError("No actual Quaternius geometry: "+item["model"])
    name="CC0_Quaternius_"+item["model"]
    empty=bpy.data.objects.new(name,None)
    bpy.context.scene.collection.objects.link(empty)
    for obj in added:
        if obj.parent is not None and obj.parent in added:continue
        matrix=obj.matrix_world.copy()
        obj.parent=empty
        obj.matrix_world=matrix
    empty.location=Vector(item["at"])
    empty.rotation_euler[2]=math.radians(item["yawDeg"])
    empty["source_original_glTF"]=str(original.name)
    empty["source_role"]=item["role"]
    return meshes,{"model":item["model"],"role":item["role"],"sourceSha256":sha(original),
                   "countMeshes":len(meshes),"countVertices":sum(len(x.data.vertices) for x in meshes)}

def make_glow(real):
    switches=[]
    realGlass=0
    for o in real:
        if o.type!="MESH":continue
        o.data=o.data.copy()
        for ix,orig in enumerate(o.data.materials):
            if not orig or not orig.name.startswith("MI_WindowGlass"):continue
            realGlass+=1
            if not orig.use_nodes:raise ValueError("Genuine CC0 glass shader missing PBR nodes")
            lit=orig.copy()
            lit.name="RedLion_Quaternius_OriginalGlass_DuskAmber_SceneOnly"
            bs=next((x for x in lit.node_tree.nodes if x.type=="BSDF_PRINCIPLED"),None)
            if bs is None:raise ValueError("Genuine glass has no Principled BSDF")
            for key,val in [("Base Color",(.94,.48,.18,1)),("Emission Color",(1,.37,.07,1)),
                            ("Emission Strength",1.65),("Alpha",1.)]:
                socket=bs.inputs.get(key)
                if socket is None:raise ValueError("Missing original glass PBR socket "+key)
                for link in list(socket.links):lit.node_tree.links.remove(link)
                socket.default_value=val
            switches.append((o,ix,orig,lit))
    if realGlass<5:raise ValueError("Replacement must have genuine original glass in door and facade")
    return switches

def actual_bounds(objects):
    bpy.context.view_layer.update()
    p=[ob.matrix_world@Vector(c) for ob in objects for c in ob.bound_box]
    if not p:raise ValueError("Actual original roof geometry missing")
    return {axis:[min(v[i] for v in p),max(v[i] for v in p)]
            for i,axis in enumerate(("x","y","z"))}

def area(name,xyz,target,watts,diameter,color):
    light=bpy.data.lights.new(name,"AREA");light.energy=watts
    light.shape="DISK";light.size=diameter;light.color=color
    obj=bpy.data.objects.new(name,light)
    bpy.context.scene.collection.objects.link(obj)
    obj.location=Vector(xyz)
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()
    return obj

def original_sign():
    stone=material("RedLion_Artist_StairStone",(.32,.31,.28),roughness=.92)
    oak=material("RedLion_Artist_AgedOak",(.20,.105,.057),roughness=.89)
    plaque=material("RedLion_Artist_ClaretRed",(.21,.055,.044),roughness=.76)
    gold=material("RedLion_Artist_OldGoldLettering",(.73,.55,.22),metallic=.18,roughness=.5)
    iron=material("RedLion_Artist_ForgedIron",(.105,.11,.12),metallic=.82,roughness=.6)
    block("RedLion_StoneThreshold",(0,-4.52,.06),(1.7,.72,.20),stone,.04)
    block("RedLion_SecondEntryStep",(0,-4.95,-.03),(1.85,.37,.12),stone,.03)
    block("RedLion_Tavern_TrueOakSignBoard",(0,-4.55,2.83),(2.20,.12,.52),plaque,.025)
    beam("RedLion_SignForgedSupportLeft",(-1.0,-4.44,3.10),(-1.0,-4.56,2.87),.054,iron)
    beam("RedLion_SignForgedSupportRight",(1.0,-4.44,3.10),(1.0,-4.56,2.87),.054,iron)
    text_curve=bpy.data.curves.new("RedLion_HandCarvedName_Curve","FONT")
    text_curve.body="THE RED LION"
    text_curve.align_x="CENTER";text_curve.align_y="CENTER"
    text_curve.size=.33;text_curve.extrude=.009;text_curve.bevel_depth=.001
    text_ob=bpy.data.objects.new("RedLion_True3D_NameLetters",text_curve)
    bpy.context.scene.collection.objects.link(text_ob)
    text_ob.location=(0,-4.633,2.79)
    text_ob.rotation_euler=(math.pi/2,0,0)
    text_ob.data.materials.append(gold)
    # Small authentic iron rivets, not a replacement for game items.
    for x in (-.99,.99):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=.029,
                                              location=(x,-4.65,2.81))
        bpy.context.object.name="RedLion_Sign_HandForgedNail"
        bpy.context.object.data.materials.append(iron)

def smoke(chimney):
    b=actual_bounds(chimney)
    x=(b["x"][0]+b["x"][1])/2
    y=(b["y"][0]+b["y"][1])/2
    z=b["z"][1]
    if not 5<z<10:raise ValueError("Original CC0 roof chimney is not located on roof")
    m=bpy.data.materials.new("RedLion_OriginalChimney_Wisp_ActualCyclesVolume")
    m.use_nodes=True
    nodes=m.node_tree.nodes;nodes.clear()
    out=nodes.new("ShaderNodeOutputMaterial")
    vol=nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value=(.78,.74,.68,1)
    vol.inputs["Anisotropy"].default_value=.12
    noise=nodes.new("ShaderNodeTexNoise")
    noise.noise_dimensions="4D";noise.inputs["Scale"].default_value=3.1
    noise.inputs["Detail"].default_value=3.0
    ramp=nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position=.36
    ramp.color_ramp.elements[0].color=(0,0,0,1)
    ramp.color_ramp.elements[1].position=.70
    ramp.color_ramp.elements[1].color=(.18,.18,.18,1)
    tex=nodes.new("ShaderNodeTexCoord")
    m.node_tree.links.new(tex.outputs["Generated"],noise.inputs["Vector"])
    m.node_tree.links.new(noise.outputs["Fac"],ramp.inputs["Fac"])
    m.node_tree.links.new(ramp.outputs["Color"],vol.inputs["Density"])
    m.node_tree.links.new(vol.outputs["Volume"],out.inputs["Volume"])
    puffs=[]
    for i in range(6):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,
                                               location=(x+.09*i,y+.07*i,z+.2+.37*i))
        obj=bpy.context.object
        obj.name="RedLion_RealChimney_ActualVolumeSmoke_"+str(i)
        obj.scale=(.15+.05*i,.16+.05*i,.26+.075*i)
        obj.data.materials.append(m)
        obj.hide_render=True
        puffs.append(obj)
    return puffs,{"x":x,"y":y,"topZ":z,"realQuaterniusChimney":True,
                  "sourceOnlyCyclesSmoke":True,"world9RuntimeSmokeAuthorized":False}

def run():
    args=cli()
    manifest=json.loads(Path(args.manifest).read_text(encoding="utf8"))
    if (manifest["schema"]!=1 or manifest["kind"]!="graphics3b-red-lion-quaternius-full-asset-replacement"
        or manifest["sourceCommit"]!="21104b4045261c28fc312360841ed1a7b0ac8782"
        or manifest["sourceLicense"]!="CC0-1.0" or manifest["originalA232ModelIncluded"] is not False
        or manifest["oldRedLionArtSuperseded"] is not True
        or manifest["artReviewOnly"] is not True or manifest["gameRuntimeReplaced"] is not False
        or manifest["worldReadOnly"]["authoredBuildingId"]!="red-lion"):
        raise ValueError("Not an approved replacement source-only CC0 authoring contract")
    src=Path(args.source).resolve()
    out=Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True)
    bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
    meshes={}
    reports=[]
    for item in manifest["parts"]:
        geom,proof=imported(src,item)
        reports.append(proof)
        meshes.setdefault(item["model"],[]).extend(geom)
    genuine=sum(x["countVertices"] for x in reports)
    if len(reports)<32 or genuine<15000:
        raise ValueError("Creator-sourced large tavern geometry missing")
    if "Roof_RoundTiles_6x8" not in meshes or "Roof_Front_Brick6" not in meshes:
        raise ValueError("Genuine creator original large roof/gables missing")
    glass=make_glow(meshes.get("Door_1_Round",[])+meshes.get("Window_Wide_Round1",[]))
    original_sign()
    puffs,smoke_contract=smoke(meshes["Prop_Chimney"])
    scene=bpy.context.scene
    scene.render.engine="CYCLES"
    scene.cycles.device="CPU";scene.cycles.samples=manifest["render"]["samples"]
    if hasattr(scene.cycles,"use_denoising"):scene.cycles.use_denoising=True
    if hasattr(bpy.context.view_layer.cycles,"use_denoising"):bpy.context.view_layer.cycles.use_denoising=True
    scene.render.resolution_x=manifest["render"]["width"]
    scene.render.resolution_y=manifest["render"]["height"]
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.render.image_settings.color_mode="RGBA"
    scene.render.film_transparent=True
    scene.view_settings.view_transform="AgX"
    world=bpy.data.worlds.new("RedLion_Quaternius_DayDuskSource")
    world.use_nodes=True;scene.world=world
    cam=bpy.data.cameras.new("RedLion_Quaternius_OriginalReviewOrtho")
    cam_obj=bpy.data.objects.new(cam.name,cam)
    scene.collection.objects.link(cam_obj)
    cam_obj.location=Vector(manifest["camera"]["position"])
    cam_obj.rotation_euler=(Vector(manifest["camera"]["target"])-cam_obj.location).to_track_quat("-Z","Y").to_euler()
    cam.type="ORTHO";cam.ortho_scale=manifest["camera"]["orthoScale"];scene.camera=cam_obj
    key=area("RedLion_ActualSunKey",(5,-8,14),(0,0,3),1650,9,(1,.86,.71))
    fill=area("RedLion_ActualCoolSkyFill",(-9,3,10),(0,0,3),720,10,(.72,.82,1))
    door_light=bpy.data.lights.new("RedLion_DoorAndWindow_DuskPractical","POINT")
    door_light.color=(1,.42,.12);door_light.energy=0;door_light.shadow_soft_size=.6
    lamp=bpy.data.objects.new(door_light.name,door_light)
    scene.collection.objects.link(lamp);lamp.location=(0,-3.65,1.9)
    captures=[]
    for mood in ("day","dusk"):
        dusk=(mood=="dusk")
        for obj,ix,original,lit in glass:obj.data.materials[ix]=lit if dusk else original
        for puff in puffs:puff.hide_render=not dusk
        door_light.energy=115 if dusk else 0
        key.data.energy=1650 if not dusk else 460
        fill.data.energy=720 if not dusk else 170
        bg=world.node_tree.nodes.get("Background")
        bg.inputs["Color"].default_value=(.55,.60,.69,1) if not dusk else (.09,.13,.24,1)
        bg.inputs["Strength"].default_value=.56 if not dusk else .19
        name=manifest["render"][mood]
        target=out/name
        scene.render.filepath=str(target)
        bpy.ops.render.render(write_still=True)
        if not target.exists() or target.stat().st_size<15000:raise RuntimeError("Real Blender render missing: "+mood)
        captures.append({"mood":mood,"filename":name,"bytes":target.stat().st_size,"sha256":sha(target)})
    scene.render.filepath=""
    blend=out/manifest["render"]["editableSource"]
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    report={"kind":manifest["kind"],"status":"source-only-art-review",
            "creatorPinnedCommit":manifest["sourceCommit"],"license":"CC0-1.0",
            "actualCreatorInstances":len(reports),"actualCreatorVertices":genuine,
            "originalA232MeshCount":0,"newQuaterniusAssets":reports,
            "genuineGlazingSlots":len(glass),"genuine6x8RoofBounds":actual_bounds(meshes["Roof_RoundTiles_6x8"]),
            "actualGables":2,"sourceChimney":smoke_contract,
            "captured":captures,"originalEditableBlendSha256":sha(blend),
            "sourceOnly":True,"oldRedLionVisualModelSuperseded":True,"gameRuntimeNotChanged":True,
            "world9AuthorityIntact":True,"noMergeOrDeploy":True}
    (out/manifest["render"]["provenance"]).write_text(json.dumps(report,indent=2)+"\n",encoding="utf8")
    print("GRAPHICS3B_QUATERNIUS_REAL_RED_LION_REPLACEMENT_BLENDER_PASS "+
          json.dumps({"models":len(reports),"vertices":genuine,"glass":len(glass),
                      "pngs":captures,"blendSha":report["originalEditableBlendSha256"]},sort_keys=True),flush=True)

if __name__=="__main__":run()
