/**
 * Graphics 3B P0 — test-only native browser content-viewport normalization.
 * W3C window rect is an OUTER window size, while gameplay visibility is
 * measured against the INNER CSS viewport. Never silently equate the two.
 * No DOM scroll, zoom, game camera, world/server movement or item mutation.
 */
export const P0_CONTENT_VIEWPORT=Object.freeze({width:1280,height:720});
const integer=n=>Number.isSafeInteger(n);
export function nativeContentViewportMatches(measured,target=P0_CONTENT_VIEWPORT){
 if(!measured||!target)return false;
 return integer(measured.innerWidth)&&integer(measured.innerHeight)&&
  integer(target.width)&&integer(target.height)&&
  measured.innerWidth===target.width&&measured.innerHeight===target.height;
}
export function nextNativeW3cWindowRect(measured,target=P0_CONTENT_VIEWPORT){
 if(!measured||!target||
    ![measured.innerWidth,measured.innerHeight,measured.outerWidth,measured.outerHeight,target.width,target.height]
      .every(integer)||
    measured.innerWidth<320||measured.innerHeight<200||
    measured.outerWidth<measured.innerWidth||measured.outerHeight<measured.innerHeight||
    target.width<800||target.width>1920||target.height<540||target.height>1080)
  throw new RangeError("Real browser inner/outer dimensions required for bounded native viewport parity");
 const width=measured.outerWidth+target.width-measured.innerWidth;
 const height=measured.outerHeight+target.height-measured.innerHeight;
 if(width<800||width>2400||height<540||height>1500)
  throw new RangeError("Proposed native W3C outer rect outside safe testing bounds");
 return Object.freeze({width,height});
}
