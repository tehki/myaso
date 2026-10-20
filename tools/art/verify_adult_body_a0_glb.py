"""A0 roundtrip validation: independently import generated GLBs, do not edit source."""
import bpy,pathlib,json
root=pathlib.Path.cwd()
for body in ("adult-masculine","adult-feminine"):
    source=root/"assets"/"characters"/"adult-body"/(body+".glb")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps=60
    bpy.ops.import_scene.gltf(filepath=str(source))
    rigs=[x for x in bpy.data.objects if x.type=="ARMATURE"]
    meshes=[x for x in bpy.data.objects if x.type=="MESH" and any(m.type=="ARMATURE" for m in x.modifiers)]
    assert len(rigs)==1,(body,len(rigs))
    assert len(rigs[0].data.bones)==22,(body,len(rigs[0].data.bones))
    assert len(meshes)>=1,(body,len(meshes))
    assert len(meshes[0].data.vertices)>8000
    print("A0_GLB_ROUNDTRIP",body,"bones",len(rigs[0].data.bones),
      "meshVertices",len(meshes[0].data.vertices),"actions",len(bpy.data.actions),flush=True)
print("GLB_IMPORT_VERIFIED",flush=True)
