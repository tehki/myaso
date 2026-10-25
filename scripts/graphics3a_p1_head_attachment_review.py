#!/usr/bin/env python3
"""Quaternius free P1 outfit+head lookdev: original rig, private source, no game export."""
from pathlib import Path
from zipfile import ZipFile
import io, json, math, sys
import numpy as np
from PIL import Image
import os
os.environ.setdefault("PYOPENGL_PLATFORM", "egl")
os.environ.setdefault("LIBGL_ALWAYS_SOFTWARE", "1")
import trimesh, pyrender
from graphics3a_p1_head_attach_rules import (archive_uri,head_cut_from_mesh_top,remap_joint_indices,choose_head_faces,validate_upper_anchors)
from graphics3a_p1_cpu_skin_retarget import (
 load_gltf, load_glb_from_zip, world_matrices, joint_map, accessor_values, skin_matrices,
 sample_clip, retarget_pose, safe_local_path, normalized_base_color_factor,
 validate_skeleton_pair, sha256,
)

def mat_for(doc,buffers,archive,prefix,mi,cache):
 if mi in cache:return cache[mi]
 m=doc.get('materials',[])[mi] if mi is not None else {}
 pbr=m.get('pbrMetallicRoughness',{})
 tex=None; info=pbr.get('baseColorTexture')
 if info is not None:
  imidx=doc['textures'][info['index']]['source']; im=doc['images'][imidx]
  if 'uri' in im:
   with ZipFile(archive) as z: data=z.read(archive_uri(prefix,im['uri']))
   tex=Image.open(io.BytesIO(data)).convert('RGBA').copy()
  elif 'bufferView' in im:
   view=doc['bufferViews'][im['bufferView']]; b=buffers[view.get('buffer',0)]
   tex=Image.open(io.BytesIO(b[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']])).convert('RGBA').copy()
 mat=pyrender.MetallicRoughnessMaterial(
  baseColorTexture=tex,baseColorFactor=normalized_base_color_factor(pbr),
  metallicFactor=float(pbr.get('metallicFactor',1.0)),roughnessFactor=float(pbr.get('roughnessFactor',1.0)),
  alphaMode=m.get('alphaMode','OPAQUE'),alphaCutoff=float(m.get('alphaCutoff',0.5)),
  doubleSided=bool(m.get('doubleSided',False)))
 cache[mi]=mat;return mat
def read_base(archive,suffix):
 with ZipFile(archive) as z:
  names=[n for n in z.namelist() if n.endswith(suffix)]
  if len(names)!=1: raise ValueError('Base model suffix is not unique')
  member=names[0];doc=json.loads(z.read(member));prefix=member.rsplit('/',1)[0]+'/'
  buffers=[z.read(archive_uri(prefix,b['uri'])) for b in doc.get('buffers',[])]
 return doc,buffers,prefix
def make_parts(base,bbuf,bworld,barchive,prefix,target,tbuf,tworld,target_node,cut_y,target_top):
 base_joints=base['skins'][base['nodes'][next(i for i,n in enumerate(base['nodes']) if 'mesh' in n and 'skin' in n)]['skin']]['joints']
 target_skin=target['skins'][target['nodes'][target_node]['skin']]
 bnames=[base['nodes'][i]['name'] for i in base_joints]
 tnames=[target['nodes'][i]['name'] for i in target_skin['joints']]
 assert set(bnames)==set(tnames)
 remap=np.asarray(remap_joint_indices(bnames,tnames),dtype=int)
 xform=np.linalg.inv(tworld[target_node])
 parts=[]; materials={}
 for ni,node in enumerate(base['nodes']):
  if 'mesh' not in node or 'skin' not in node: continue
  if node.get('name') not in ('Eyebrows','Eyes','SuperHero_Male','Superhero_Female'):
   raise ValueError(f"Unexpected source mesh node in Base Character: {node.get('name')}")
  mesh=base['meshes'][node['mesh']]
  for pi,prim in enumerate(mesh.get('primitives',[])):
   if prim.get('mode',4)!=4:continue
   a=prim['attributes']
   req=('POSITION','NORMAL','JOINTS_0','WEIGHTS_0','TEXCOORD_0')
   if any(k not in a for k in req):continue
   pos=np.asarray(accessor_values(base,bbuf,a['POSITION']),float)
   norm=np.asarray(accessor_values(base,bbuf,a['NORMAL']),float)
   joints=np.asarray(accessor_values(base,bbuf,a['JOINTS_0']),int)
   weights=np.asarray(accessor_values(base,bbuf,a['WEIGHTS_0']),float)
   uv=np.asarray(accessor_values(base,bbuf,a['TEXCOORD_0']),float)
   faces=np.asarray(accessor_values(base,bbuf,prim['indices']),int).reshape(-1,3) if 'indices' in prim else np.arange(len(pos)).reshape(-1,3)
   if node.get('name','').lower().startswith('superhero_'):
    world_h=(bworld[ni]@np.c_[pos,np.ones(len(pos))].T).T
    cent=world_h[faces,1].mean(axis=1)
    # Only the head/neck region above the collar line; reject torso/shoulder faces.
    faces=faces[choose_head_faces(cent,cut_y)]
   else:
    # Separate eyes and eyebrows are already head-only meshes.
    pass
   if not len(faces):continue
   used=np.unique(faces.reshape(-1)); remap_vertex=np.full(len(pos),-1,dtype=int);remap_vertex[used]=np.arange(len(used))
   faces=remap_vertex[faces]
   pos=pos[used];norm=norm[used];joints=remap[joints[used]];weights=weights[used];uv=uv[used]
   world_from_base=bworld[ni]
   transform=xform@world_from_base
   pos=(transform@np.c_[pos,np.ones(len(pos))].T).T[:,:3]
   normal_matrix=np.linalg.inv(transform[:3,:3]).T
   norm=(normal_matrix@norm.T).T;norm/=np.maximum(np.linalg.norm(norm,axis=1)[:,None],1e-12)
   weights/=np.maximum(weights.sum(axis=1)[:,None],1e-12)
   material=mat_for(base,bbuf,barchive,prefix,prim.get('material'),materials)
   parts.append({'node':target_node,'name':node.get('name',str(ni)),'positions':pos,'normals':norm,
                 'joints':joints,'weights':weights,'uv':uv,'faces':faces,'material':material})
   print('HEAD_PART',node.get('name'),len(pos),'vertices',len(faces),'faces','material',prim.get('material'),flush=True)
 return parts
def target_parts(target,tbuf,path):
 import pyrender
 parts=[];cache={};imgs={}
 for ni,node in enumerate(target['nodes']):
  if 'mesh' not in node or 'skin' not in node:continue
  for prim in target['meshes'][node['mesh']].get('primitives',[]):
   a=prim['attributes'];pos=np.asarray(accessor_values(target,tbuf,a['POSITION']),float)
   norm=np.asarray(accessor_values(target,tbuf,a['NORMAL']),float)
   joints=np.asarray(accessor_values(target,tbuf,a['JOINTS_0']),int)
   weights=np.asarray(accessor_values(target,tbuf,a['WEIGHTS_0']),float)
   uv=np.asarray(accessor_values(target,tbuf,a['TEXCOORD_0']),float)
   faces=np.asarray(accessor_values(target,tbuf,prim['indices']),int).reshape(-1,3) if 'indices' in prim else np.arange(len(pos)).reshape(-1,3)
   mi=prim.get('material')
   if mi not in cache:
    m=target.get('materials',[])[mi] if mi is not None else {};pbr=m.get('pbrMetallicRoughness',{});tex=None;info=pbr.get('baseColorTexture')
    if info is not None:
     image_index=target['textures'][info['index']]['source']
     if image_index not in imgs:
      im=target['images'][image_index]
      if 'uri' in im: imgs[image_index]=Image.open(safe_local_path(path.parent,im['uri'])).convert('RGBA').copy()
      else:
       view=target['bufferViews'][im['bufferView']];imgs[image_index]=Image.open(io.BytesIO(tbuf[view.get('buffer',0)][view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']])).convert('RGBA').copy()
     tex=imgs[image_index]
    cache[mi]=pyrender.MetallicRoughnessMaterial(baseColorTexture=tex,baseColorFactor=normalized_base_color_factor(pbr),
      metallicFactor=float(pbr.get('metallicFactor',1.0)),roughnessFactor=float(pbr.get('roughnessFactor',1.0)),
      alphaMode=m.get('alphaMode','OPAQUE'),alphaCutoff=float(m.get('alphaCutoff',.5)),doubleSided=bool(m.get('doubleSided',False)))
   weights/=np.maximum(weights.sum(axis=1)[:,None],1e-12)
   parts.append({'node':ni,'name':node.get('name',str(ni)),'positions':pos,'normals':norm,'joints':joints,
    'weights':weights,'uv':uv,'faces':faces,'material':cache[mi]})
 return parts
def render(target_path,base_archive,suffix,animation_archive,animation_suffix,cut_y,out,clip_name,fraction):
 target,tbuf=load_gltf(target_path)
 base,bbuf,prefix=read_base(base_archive,suffix)
 target_node=next(i for i,n in enumerate(target['nodes']) if 'mesh' in n and 'skin' in n)
 target_world=world_matrices(target,{},np);base_world=world_matrices(base,{},np)
 source_archive=animation_archive
 source,sbuf,_=load_glb_from_zip(source_archive,animation_suffix)
 validate_skeleton_pair(source,target)
 validate_skeleton_pair(base,target)
 sampled,sample_time,duration=sample_clip(source,sbuf,clip_name,fraction)
 sj=joint_map(source);tj=joint_map(target)
 sh=max(float(world_matrices(source,{},np)[i][1,3]) for i in sj.values())-min(float(world_matrices(source,{},np)[i][1,3]) for i in sj.values())
 th=max(float(target_world[i][1,3]) for i in tj.values())-min(float(target_world[i][1,3]) for i in tj.values())
 height_ratio=th/sh
 pose=retarget_pose(source,target,sampled,height_ratio)
 print('ANIMATION',clip_name,'fraction',fraction,'sample_time',sample_time,'duration',duration,'height_ratio',height_ratio,flush=True)
 # Confirm upper anchors match; head placement is not guessed if the skeletons drift.
 bjm,tjm=joint_map(base),joint_map(target)
 names=('neck_01','Head','spine_03','clavicle_l','clavicle_r')
 bp={name:base_world[bjm[name]][:3,3].tolist() for name in names}
 tp={name:target_world[tjm[name]][:3,3].tolist() for name in names}
 validate_upper_anchors(bp,tp,names)
 # Bind-pose matrix check before composing.
 bmesh=next(i for i,n in enumerate(base['nodes']) if 'mesh' in n and 'skin' in n)
 tmesh=target_node
 be=max(float(np.max(np.abs(skin_matrices(base,bbuf,base_world,i,np)-np.eye(4))))
        for i,n in enumerate(base['nodes']) if 'mesh' in n and 'skin' in n)
 te=max(float(np.max(np.abs(skin_matrices(target,tbuf,target_world,i,np)-np.eye(4))))
        for i,n in enumerate(target['nodes']) if 'mesh' in n and 'skin' in n)
 print('BIND_ERRORS',be,te,'UPPER_ANCHORS_OK',flush=True)
 if be>5e-4 or te>5e-4:raise ValueError('Base or outfit bind matrices are not identity')
 parts=target_parts(target,tbuf,target_path)
 target_rest_vertices=[]
 for part in parts:
  w=target_world[part['node']]
  target_rest_vertices.append((w@np.c_[part['positions'],np.ones(len(part['positions']))].T).T[:,:3])
 outfit_top=max(float(v[:,1].max()) for v in target_rest_vertices)
 if cut_y is None: cut_y=head_cut_from_mesh_top(outfit_top)
 head=make_parts(base,bbuf,base_world,base_archive,prefix,target,tbuf,target_world,target_node,cut_y,outfit_top)
 if not head: raise ValueError("No safe head meshes qualified")
 parts.extend(head)
 # bounds from combined parts in rest pose
 verts=[]
 for part in parts:
  w=target_world[part['node']]
  verts.append((w@np.c_[part['positions'],np.ones(len(part['positions']))].T).T[:,:3])
 allv=np.concatenate(verts);lo=allv.min(axis=0);hi=allv.max(axis=0);center=(lo+hi)/2;h=hi[1]-lo[1];span=max(h*1.2,1.8)
 print('COMBINED_BOUNDS',lo.tolist(),hi.tolist(),'height',h,'head_top',float(max(v[:,1].max() for v in verts[len(target_parts(target,tbuf,target_path)): ])),flush=True)
 def look_at(eye,aim):
  up=np.array([0.,1.,0.]);z=eye-aim;z/=np.linalg.norm(z);x=np.cross(up,z);x/=np.linalg.norm(x);y=np.cross(z,x);m=np.eye(4);m[:3,:3]=np.stack((x,y,z),axis=1);m[:3,3]=eye;return m
 cam=pyrender.OrthographicCamera(xmag=span*.61,ymag=span*.61,znear=.02,zfar=50)
 cp=look_at(center+np.array([0.,h*.13,max(h*2.8,3.5)]),center)
 output=Path(out);output.mkdir(parents=True,exist_ok=True)
 renderer=pyrender.OffscreenRenderer(viewport_width=256,viewport_height=256,point_size=1)
 sheet=Image.new('RGBA',(8*256,256),(35,38,49,255))
 try:
  for direction in range(8):
   angle=direction*math.pi/4;c,s=math.cos(angle),math.sin(angle);yaw=np.eye(4);yaw[:3,:3]=[[c,0,s],[0,1,0],[-s,0,c]]
   tc=np.eye(4);tc[:3,3]=center;fc=np.eye(4);fc[:3,3]=-center;turn=tc@yaw@fc
   scene=pyrender.Scene(bg_color=[.11,.13,.16,0.],ambient_light=[.38,.38,.40])
   worlds=world_matrices(target,pose,np)
   for part in parts:
    palette=skin_matrices(target,tbuf,worlds,part['node'],np)
    pos=part['positions'];ph=np.c_[pos,np.ones(len(pos))]
    selected=palette[part['joints']]
    transformed=np.einsum('nkij,nj->nki',selected,ph)[:,:,:3]
    skinned=np.sum(transformed*part['weights'][:,:,None],axis=1)
    normal_palette=np.transpose(np.linalg.inv(palette[:,:3,:3]),(0,2,1))
    normals=np.einsum('nkij,nj->nki',normal_palette[part['joints']],part['normals'])
    normals=np.sum(normals*part['weights'][:,:,None],axis=1);normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-12)
    tm=trimesh.Trimesh(vertices=skinned,faces=part['faces'],vertex_normals=normals,
      visual=trimesh.visual.texture.TextureVisuals(uv=part['uv']),process=False)
    scene.add(pyrender.Mesh.from_trimesh(tm,material=part['material'],smooth=True),pose=turn@worlds[part['node']])
   scene.add(cam,pose=cp)
   scene.add(pyrender.DirectionalLight(color=np.ones(3),intensity=2.5),pose=look_at(center+np.array([3.,5.,4.]),center))
   scene.add(pyrender.DirectionalLight(color=np.array([.65,.75,1.]),intensity=1.),pose=look_at(center+np.array([-3.,2.,-2.]),center))
   rgba,_=renderer.render(scene,flags=pyrender.RenderFlags.RGBA)
   if int((rgba[:,:,3]>127).sum())<500:raise ValueError('Blank composite')
   im=Image.fromarray(rgba,'RGBA');im.save(output/f'facing_{direction*45:03d}.png');sheet.paste(im,(direction*256,0),im)
 finally:renderer.delete()
 sheet.save(output/'head_attach_eight_view_contact_sheet.png')
 sheet_path=output/'head_attach_eight_view_contact_sheet.png'
 result={'status':'HOLD_OFFLINE_HEAD_ATTACHMENT_VISUAL_REVIEW',
         'base_archive_sha256':sha256(base_archive.read_bytes()),
         'animation_archive_sha256':sha256(animation_archive.read_bytes()),
         'outfit_sha256':sha256(target_path.read_bytes()),
         'source_clip':clip_name,
         'clip_fraction':fraction,
         'cut_y_m':cut_y,
         'outfit_top_m':outfit_top,
         'head_meshes':[{'name':part['name'],'vertex_count':len(part['positions']),'face_count':len(part['faces'])} for part in head],
         'contact_sheet_sha256':sha256(sheet_path.read_bytes()),
         'view_count':8,
         'limitations':'Eight private offline views only; no game export, Art Director acceptance, ground contact, or native multiplayer validation'}
 (output/'head-attachment-review.json').write_text(json.dumps(result,indent=2)+'\n')
 print('SAVED',sheet_path,'STATUS',result['status'],'SHA256',result['contact_sheet_sha256'],flush=True)

def main():
 import argparse
 p=argparse.ArgumentParser(description="P1 PRIVATE head attachment review; no playable asset exported")
 p.add_argument('--target-model',type=Path,required=True)
 p.add_argument('--base-archive',type=Path,required=True)
 p.add_argument('--base-model-suffix',required=True)
 p.add_argument('--animation-archive',type=Path,required=True)
 p.add_argument('--animation-model-suffix',default='Unreal-Godot/UAL1_Standard.glb')
 p.add_argument('--output',type=Path,required=True)
 p.add_argument('--clip',default='Walk_Loop')
 p.add_argument('--fraction',type=float,default=0.5)
 p.add_argument('--head-cut-y',type=float,default=None)
 a=p.parse_args()
 for file in [a.target_model,a.base_archive,a.animation_archive]:
  if not file.is_file(): raise FileNotFoundError(file)
 if not 0 <= a.fraction <= 1: raise ValueError("Clip fraction must be 0..1")
 repo=Path(__file__).resolve().parents[1]
 if a.output.resolve().is_relative_to(repo):
  raise ValueError("No generated vendor images may be written inside the repository")
 render(a.target_model,a.base_archive,a.base_model_suffix,a.animation_archive,a.animation_model_suffix,
        a.head_cut_y,a.output,a.clip,a.fraction)

if __name__=='__main__':
 main()