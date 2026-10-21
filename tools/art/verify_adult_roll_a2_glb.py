"""Independently reimport original A2 GLBs in Blender and verify rig/action fidelity.

No saved modifications to exported source. This is a source-level acceptance
and not proof of Ground collision or multiplayer gameplay.
"""
import bpy,pathlib,json
root=pathlib.Path.cwd()
for body in ("adult-masculine","adult-feminine"):
 source=root/"assets"/"characters"/"adult-body-a2"/(body+"-roll-a2.glb")
 assert source.is_file(),source
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.context.scene.render.fps=60
 bpy.ops.import_scene.gltf(filepath=str(source))
 rig=next(x for x in bpy.data.objects if x.type=="ARMATURE")
 meshes=[x for x in bpy.data.objects if x.type=="MESH" and any(m.type=="ARMATURE" for m in x.modifiers)]
 actions={x.name:x for x in bpy.data.actions}
 assert len(rig.data.bones)==22,len(rig.data.bones)
 assert len(meshes)==1,len(meshes)
 assert len(meshes[0].data.vertices)>8000,len(meshes[0].data.vertices)
 assert set(actions)=={"idle","walk","run","roll"},set(actions)
 act=actions["roll"]
 assert act.slots,body
 rig.animation_data.action=act
 rig.animation_data.action_slot=act.slots[0]
 for tr in rig.animation_data.nla_tracks:tr.mute=True
 poses=[]
 for frame in (1,7,9,22):
  bpy.context.scene.frame_set(frame)
  hip=rig.pose.bones["Hips"]
  poses.append({"frame":frame,"hipQuaternion":[round(x,4) for x in hip.rotation_quaternion],
   "hipLocation":[round(x,4) for x in hip.location]})
 assert poses[0]["hipQuaternion"]!=poses[2]["hipQuaternion"],poses
 assert poses[0]["hipLocation"]!=poses[2]["hipLocation"],poses
 print("A2_GLB_IMPORT_OK",json.dumps({"body":body,"bones":len(rig.data.bones),
  "meshVertices":len(meshes[0].data.vertices),"actions":sorted(actions),"rollKeyPoses":poses}),flush=True)
print("A2_GLB_ROUNDTRIP_PASS",flush=True)
