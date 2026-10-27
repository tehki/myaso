"""Validate the real publisher Ranger packed ORM for private art review only.

glTF metallicRoughnessTexture uses Green=roughness and Blue=metallicity;
red is often original author occlusion, which has its own separate binding.
This module does not load, transform, redistribute, or alter source images.
"""


def ranger_orm_image_uri(doc: dict, material_index: int) -> str:
    if not isinstance(material_index,int) or isinstance(material_index,bool):
        raise ValueError("Ranger material index must be integer")
    mats=doc.get("materials",[])
    if not 0<=material_index<len(mats):
        raise ValueError("Ranger material index outside source glTF")
    mat=mats[material_index]
    if mat.get("name")!="MI_Ranger":
        raise ValueError("Publisher Ranger ORM may be applied only to MI_Ranger")
    pbr=mat.get("pbrMetallicRoughness",{})
    ref=pbr.get("metallicRoughnessTexture")
    if not isinstance(ref,dict) or not isinstance(ref.get("index"),int):
        raise ValueError("Original Ranger material lacks packed ORM texture")
    t=ref["index"]
    textures=doc.get("textures",[])
    if not 0<=t<len(textures):
        raise ValueError("Source ORM texture index invalid")
    im_idx=textures[t].get("source")
    images=doc.get("images",[])
    if not isinstance(im_idx,int) or not 0<=im_idx<len(images):
        raise ValueError("Source ORM image index invalid")
    uri=images[im_idx].get("uri")
    if uri!="T_Ranger_ORM.png":
        raise ValueError("Unexpected publisher Ranger ORM filename")
    return uri
