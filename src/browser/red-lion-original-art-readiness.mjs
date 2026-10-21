/**
 * Graphics 3B P0: original Red Lion art readiness before World-approved tile
 * placeholder suppression. Visual ONLY; no world, portal or server state.
 *
 * Choose tile-cache mode AFTER every mandatory art image is decoded.
 */
export const RED_LION_SOURCE_DIMENSIONS=Object.freeze({
 day:Object.freeze({width:228,height:297}),
 dusk:Object.freeze({width:228,height:297}),
 roof:Object.freeze({width:238,height:197})
});
const UNAVAILABLE=Object.freeze({
 status:"unavailable",placeholderMustRemain:true,
 replacementAllowed:false,reason:"art-not-ready",
 acceptedForGameplay:false
});
function validImage(image,path,dimension,origin) {
 if(!image || image.complete!==true ||
  image.naturalWidth!==dimension.width ||
  image.naturalHeight!==dimension.height) return false;
 const src=image.currentSrc||image.src;
 if(typeof src!=="string"||src.length<1)return false;
 try{
  const expected=new URL(path,origin),actual=new URL(src,origin);
  return expected.protocol===actual.protocol &&
    actual.origin===new URL(origin).origin &&
    expected.origin===actual.origin &&
    expected.pathname===actual.pathname &&
    expected.search===""&&expected.hash===""&&
    actual.search===""&&actual.hash==="";
 }catch{return false;}
}
export async function prepareRedLionSourceArt({
 paths,loadImage,origin
}={}) {
 if(!paths||typeof paths!=="object"||
   Object.keys(RED_LION_SOURCE_DIMENSIONS).some(n=>
     typeof paths[n]!=="string"||!paths[n])||
   typeof loadImage!=="function"||
   typeof origin!=="string")return UNAVAILABLE;
 const names=Object.keys(RED_LION_SOURCE_DIMENSIONS);
 try{
  const loaded=await Promise.all(names.map(n=>loadImage(paths[n])));
  for(let i=0;i<names.length;i++)
   if(!validImage(loaded[i],paths[names[i]],
      RED_LION_SOURCE_DIMENSIONS[names[i]],origin))
    return UNAVAILABLE;
  return Object.freeze({
   status:"ready",placeholderMustRemain:false,
   replacementAllowed:true,acceptedForGameplay:false,
   day:loaded[0],dusk:loaded[1],roof:loaded[2]
  });
 }catch{return UNAVAILABLE;}
}
/**
 * World9 supplies canonical normalizeWorldBuildingReplacementIds through
 * Graphics3C's worldReplacementValidator injection. Does not mutate source,
 * actor ordering, gameplay or the server.
 * A Canvas failure after construction requires a new full-frame redraw.
 */
export function createRedLionArtGatedWorldPainter({
 art,createRenderer,worldReplacementValidator,options={}
}={}) {
 if(typeof createRenderer!=="function"||
   typeof worldReplacementValidator!=="function"||
   !options||typeof options!=="object"||
   Object.prototype.hasOwnProperty.call(options,"replacedBuildingIds")||
   Object.prototype.hasOwnProperty.call(options,"worldReplacementValidator"))
  throw new TypeError("Canonical World/3C painter injection required");
 const names=Object.keys(RED_LION_SOURCE_DIMENSIONS);
 const enabled=art?.status==="ready"&&
  art?.replacementAllowed===true&&
  art?.placeholderMustRemain===false&&
  names.every(n=>!!art?.[n]);
 const replacedBuildingIds=enabled?["red-lion"]:[];
 const painter=createRenderer({...options,replacedBuildingIds,
   worldReplacementValidator});
 if(!painter||!Array.isArray(painter.replacedBuildingIds)||
  painter.replacedBuildingIds.length!==replacedBuildingIds.length||
  painter.replacedBuildingIds.some((v,i)=>v!==replacedBuildingIds[i]))
  throw new RangeError("Renderer returned incorrect replacement mode");
 return Object.freeze({
  painter,paintFacadeAllowed:enabled,
  fallbackDefaultPlaceholder:!enabled,
  approvedForRelease:false
 });
}
