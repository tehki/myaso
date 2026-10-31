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
    rotation=item.get("rotationDeg",[0,0,item["yawDeg"]])
    empty.rotation_euler=tuple(math.radians(v) for v in rotation)
    empty.scale=Vector(item.get("scale",[1,1,1]))
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

def original_sign(corrections):
    stone=material("RedLion_Artist_StairStone",(.32,.31,.28),roughness=.92)
    plaque=material("RedLion_Artist_ClaretRed",(.21,.055,.044),roughness=.76)
    gold=material("RedLion_Artist_OldGoldLettering",(.73,.55,.22),metallic=.18,roughness=.5)
    iron=material("RedLion_Artist_ForgedIron",(.105,.11,.12),metallic=.82,roughness=.6)
    block("RedLion_StoneThreshold",(0,-4.52,.06),(1.7,.72,.20),stone,.04)
    block("RedLion_SecondEntryStep",(0,-4.95,-.03),(1.85,.37,.12),stone,.03)
    # Raise the complete sign assembly into the front gable, with a measured
    # clearance above the genuine Quaternius front windows.
    board=block("RedLion_Tavern_TrueOakSignBoard",corrections["board"],
                corrections["boardSize"],plaque,.025)
    beam("RedLion_SignForgedSupportLeft",*corrections["supportLeft"],.054,iron)
    beam("RedLion_SignForgedSupportRight",*corrections["supportRight"],.054,iron)
    text_curve=bpy.data.curves.new("RedLion_HandCarvedName_Curve","FONT")
    text_curve.body="THE RED LION"
    text_curve.align_x="CENTER";text_curve.align_y="CENTER"
    text_curve.size=.33;text_curve.extrude=.009;text_curve.bevel_depth=.001
    text_ob=bpy.data.objects.new("RedLion_True3D_NameLetters",text_curve)
    bpy.context.scene.collection.objects.link(text_ob)
    text_ob.location=corrections["text"]
    text_ob.rotation_euler=(math.pi/2,0,0)
    text_ob.data.materials.append(gold)
    # Small authentic iron rivets, not a replacement for game items.
    for x in (-.99,.99):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=.029,
                                              location=(x,-4.65,corrections["rivetZ"]))
        bpy.context.object.name="RedLion_Sign_HandForgedNail"
        bpy.context.object.data.materials.append(iron)
    return board

def ground_foliage(corrections):
    # Nine separate editable leaf meshes with raised center veins. This replaces
    # the unsuitable upright wall-vine prop with a small ground-level ivy cluster.
    cx,cy,cz=corrections["location"]
    greens=[
        material("RedLion_GroundIvy_DeepLeafGreen",(.075,.22,.035),roughness=.78),
        material("RedLion_GroundIvy_MidLeafGreen",(.12,.32,.055),roughness=.76),
        material("RedLion_GroundIvy_LightLeafGreen",(.19,.40,.075),roughness=.74)]
    vein=material("RedLion_GroundIvy_LeafVein",(.24,.43,.11),roughness=.82)
    leaves=[]
    count=corrections["leafCount"]
    for i in range(count):
        angle=2*math.pi*i/count+math.radians(11)
        dx,dy=math.cos(angle),math.sin(angle)
        px,py=-dy,dx
        length=.34+.05*(i%4)
        width=.11+.012*(i%3)
        base_x=cx+.055*math.cos(angle+.4)
        base_y=cy+.055*math.sin(angle+.4)
        vertices=[]
        faces=[]
        rows=7
        for row in range(rows):
            t=row/(rows-1)
            half_width=width*(math.sin(math.pi*t)**.82)
            for side in (-1,0,1):
                lateral=half_width*side
                x=base_x+dx*length*t+px*lateral
                y=base_y+dy*length*t+py*lateral
                z=cz+.012+.038*math.sin(math.pi*t)+(.009 if side==0 else 0)
                vertices.append((x,y,z))
        for row in range(rows-1):
            for col in range(2):
                a=row*3+col
                faces.append((a,a+1,a+4,a+3))
        mesh=bpy.data.meshes.new("RedLion_GroundIvy_LeafMesh_"+str(i+1))
        mesh.from_pydata(vertices,[],faces)
        mesh.update()
        obj=bpy.data.objects.new("RedLion_Artist_GroundIvy_Leaf_"+str(i+1),mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.data.materials.append(greens[i%len(greens)])
        for poly in mesh.polygons:poly.use_smooth=True
        solid=obj.modifiers.new("Thin natural leaf body","SOLIDIFY")
        solid.thickness=.012
        solid.offset=0
        obj["artist_authored_editable_leaf"]=True
        leaves.append(obj)
        # Fine raised midrib, also editable as a curve object.
        curve=bpy.data.curves.new("RedLion_GroundIvy_LeafVeinCurve_"+str(i+1),"CURVE")
        curve.dimensions="3D"
        curve.resolution_u=2
        curve.bevel_depth=.003
        curve.bevel_resolution=2
        spline=curve.splines.new("POLY")
        spline.points.add(2)
        for j,t in enumerate((.06,.48,.94)):
            spline.points[j].co=(base_x+dx*length*t,
                                 base_y+dy*length*t,
                                 cz+.024+.038*math.sin(math.pi*t),1)
        vein_obj=bpy.data.objects.new("RedLion_Artist_GroundIvy_LeafVein_"+str(i+1),curve)
        bpy.context.scene.collection.objects.link(vein_obj)
        vein_obj.data.materials.append(vein)
    return leaves

def smoke(chimney,plume_height=1.8):
    # Anchor the plume to the measured world-space bounds of the genuine
    # Quaternius chimney. One closed, irregular mesh avoids six visible
    # disconnected smoke bubbles and gives Cycles a continuous volume.
    b=actual_bounds(chimney)
    x=(b["x"][0]+b["x"][1])/2
    y=(b["y"][0]+b["y"][1])/2
    z=b["z"][1]
    if not 5<z<10:raise ValueError("Original CC0 roof chimney is not located on roof")
    rings=10
    segments=20
    vertices=[]
    faces=[]
    for i in range(rings):
        t=i/(rings-1)
        center_x=x+.055*math.sin(t*4.4)+.12*t
        center_y=y+.04*math.cos(t*3.2+.5)+.07*t
        radius=(.23+.32*t)*(1+.08*math.sin(i*1.65))
        center_z=z+.12+plume_height*t
        for j in range(segments):
            angle=2*math.pi*j/segments
            waviness=1+.08*math.sin(j*2.1+i*.9)+.045*math.cos(j*1.7-i*.65)
            rx=radius*waviness
            ry=radius*.88*waviness
            vertices.append((center_x+rx*math.cos(angle),
                             center_y+ry*math.sin(angle),
                             center_z+.035*math.sin(j*1.25+i*.5)))
    for i in range(rings-1):
        for j in range(segments):
            a=i*segments+j
            b=i*segments+(j+1)%segments
            c=(i+1)*segments+(j+1)%segments
            d=(i+1)*segments+j
            faces.append((a,b,c,d))
    faces.append(tuple(reversed(range(segments))))
    faces.append(tuple((rings-1)*segments+j for j in range(segments)))
    mesh=bpy.data.meshes.new("RedLion_DuskSmoke_ContinuousVolumeMesh")
    mesh.from_pydata(vertices,[],faces)
    mesh.update()
    for poly in mesh.polygons:poly.use_smooth=True
    obj=bpy.data.objects.new("RedLion_DuskChimneySmoke_ActualCyclesVolume",mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj["source_anchor"]="CC0_Quaternius_Prop_Chimney"
    obj["chimney_top_z"]=z
    obj["plume_height"]=plume_height
    obj["continuous_closed_volume_mesh"]=True
    obj["visible_only_in_dusk"]=True
    m=bpy.data.materials.new("RedLion_DuskSmoke_ProceduralSoftVolumetricMaterial")
    m.use_nodes=True
    nodes=m.node_tree.nodes
    nodes.clear()
    out=nodes.new("ShaderNodeOutputMaterial")
    vol=nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value=(.69,.72,.77,1)
    vol.inputs["Anisotropy"].default_value=.25
    noise=nodes.new("ShaderNodeTexNoise")
    noise.noise_dimensions="4D"
    noise.inputs["Scale"].default_value=2.1
    noise.inputs["Detail"].default_value=3.0
    noise.inputs["Roughness"].default_value=.66
    noise.inputs["Distortion"].default_value=.28
    noise.inputs["W"].default_value=.73
    ramp=nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position=.10
    ramp.color_ramp.elements[0].color=(.18,.18,.18,1)
    ramp.color_ramp.elements[1].position=.90
    ramp.color_ramp.elements[1].color=(.46,.46,.46,1)
    tex=nodes.new("ShaderNodeTexCoord")
    m.node_tree.links.new(tex.outputs["Generated"],noise.inputs["Vector"])
    m.node_tree.links.new(noise.outputs["Fac"],ramp.inputs["Fac"])
    m.node_tree.links.new(ramp.outputs["Color"],vol.inputs["Density"])
    m.node_tree.links.new(vol.outputs["Volume"],out.inputs["Volume"])
    obj.data.materials.append(m)
    obj.hide_render=True
    return [obj],{"x":x,"y":y,"topZ":z,"plumeHeight":plume_height,
                  "realQuaterniusChimney":True,"continuousClosedVolumeMesh":True,
                  "actualCyclesVolumeMaterial":True,"dayVisible":False,"duskVisible":True,
                  "world9RuntimeSmokeAuthorized":False}

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
    corrections=manifest["artCorrections"]
    sign_board=original_sign(corrections["sign"])
    puffs,smoke_contract=smoke(meshes["Prop_Chimney"],
                               corrections["chimneySmoke"]["plumeHeight"])
    # Fail closed on the four owner-requested visual corrections. These are
    # measured from final world-space mesh bounds, not assumed from origins.
    sign_bounds=actual_bounds([sign_board])
    front_window_bounds=actual_bounds(meshes["Window_Wide_Round1"][:2])
    sign_window_clearance=sign_bounds["z"][0]-front_window_bounds["z"][1]
    crate_root=bpy.data.objects["CC0_Quaternius_Prop_Crate"]
    crate_bounds=actual_bounds([crate_root]+list(crate_root.children_recursive))
    foliage_objects=ground_foliage(corrections["foliage"])
    foliage_bounds=actual_bounds(foliage_objects)
    roof_bounds=actual_bounds(meshes["Roof_RoundTiles_6x8"])
    crate_roof_clearance=crate_bounds["x"][0]-roof_bounds["x"][1]
    foliage_roof_clearance=foliage_bounds["x"][0]-roof_bounds["x"][1]
    foliage_crate_gap=crate_bounds["y"][0]-foliage_bounds["y"][1]
    if sign_window_clearance<corrections["sign"]["minimumWindowClearance"]:
        raise ValueError("Raised sign still clips front window arches")
    if crate_roof_clearance<corrections["crate"]["minimumRoofXClearance"]:
        raise ValueError("Crate still intersects the house roof footprint")
    if foliage_roof_clearance<.4:
        raise ValueError("Ground foliage still intersects the building")
    if foliage_crate_gap<corrections["foliage"]["minimumCrateGroundGap"]:
        raise ValueError("Ground foliage still intersects the relocated crate")
    if foliage_bounds["z"][0]<corrections["foliage"]["groundClearance"][0] or foliage_bounds["z"][1]>corrections["foliage"]["groundClearance"][1]:
        raise ValueError("Ground foliage is not laid flat on the ground plane")
    scene=bpy.context.scene
    scene.render.engine="CYCLES"
    scene.cycles.device="CPU";scene.cycles.samples=manifest["render"]["samples"]
    # Ubuntu's distro Blender 4.0 can be compiled without OpenImageDenoise.
    # Detect real build capability rather than requesting an absent denoiser.
    denoiser_available=bool(getattr(bpy.app.build_options,"openimagedenoise",False))
    if hasattr(scene.cycles,"use_denoising"):scene.cycles.use_denoising=denoiser_available
    if hasattr(bpy.context.view_layer.cycles,"use_denoising"):bpy.context.view_layer.cycles.use_denoising=denoiser_available
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
    smoke_rim=area("RedLion_DuskSmoke_RimLight",
                   (smoke_contract["x"]+1.1,smoke_contract["y"]-1.2,smoke_contract["topZ"]+1.1),
                   (smoke_contract["x"],smoke_contract["y"],smoke_contract["topZ"]+1.0),
                   240,2.4,(.76,.82,1.0))
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
        smoke_rim.data.energy=240 if dusk else 0
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
            "actualGables":2,"actualArtistGroundFoliageLeaves":len(foliage_objects),
            "sourceChimney":smoke_contract,
            "measuredCorrections":{"signBounds":sign_bounds,"frontWindowBounds":front_window_bounds,
                "signClearanceAboveWindows":sign_window_clearance,"crateBounds":crate_bounds,
                "roofBounds":roof_bounds,"crateRoofClearance":crate_roof_clearance,
                "foliageBounds":foliage_bounds,"foliageRoofClearance":foliage_roof_clearance,
                "foliageCrateGap":foliage_crate_gap,"smokeBounds":actual_bounds(puffs)},
            "captured":captures,"originalEditableBlendSha256":sha(blend),
            "sourceOnly":True,"oldRedLionVisualModelSuperseded":True,"gameRuntimeNotChanged":True,
            "world9AuthorityIntact":True,"noMergeOrDeploy":True}
    (out/manifest["render"]["provenance"]).write_text(json.dumps(report,indent=2)+"\n",encoding="utf8")
    print("GRAPHICS3B_QUATERNIUS_REAL_RED_LION_REPLACEMENT_BLENDER_PASS "+
          json.dumps({"models":len(reports),"vertices":genuine,"glass":len(glass),
                      "pngs":captures,"blendSha":report["originalEditableBlendSha256"]},sort_keys=True),flush=True)

if __name__=="__main__":run()
