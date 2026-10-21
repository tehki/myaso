/**
 * Moon Games Graphics 3B P0 — single-source visible sword alpha sampler.
 *
 * Decode ONCE after the original Blender WebP loads. The same alpha bytes
 * drive rendering hit candidates and UI's independent source-pixel validation.
 * This only samples presentation art; it can never approve TryPickup, Combat
 * suppression, item identity, equipment, world occupancy, or server authority.
 */
import {ARMORY_RACK_ART} from "./armory-rack-visual.mjs";

export const ARMORY_SWORD_ALPHA_SPEC = Object.freeze({
  source:ARMORY_RACK_ART.swordSource,
  sha256:ARMORY_RACK_ART.swordSha256,
  width:ARMORY_RACK_ART.swordSize.w,
  height:ARMORY_RACK_ART.swordSize.h,
  hitThreshold:64,
  gameplayAuthority:false,
});

/**
 * Browser-facing pure-once decode. A same-origin loaded and decoded original
 * image is required; a cross-origin/tainted/invalid canvas throws (fail closed).
 * The underlying Uint8Array never escapes. This is an alpha projection helper,
 * not a cryptographic verification of network-delivered image bytes.
 */
export function createArmorySwordAlphaSampler(image,{canvasFactory}={}) {
  const {source,width,height}=ARMORY_SWORD_ALPHA_SPEC;
  if(!image || image.complete!==true ||
    image.naturalWidth!==width || image.naturalHeight!==height)
    throw new TypeError("Expected decoded original 42x115 sword image");
  const href=image.currentSrc || image.src;
  if(typeof href!=="string"||!href)
    throw new TypeError("Sword asset URL missing");
  let uri;
  try{uri=new URL(href,typeof location!=="undefined"?location.href:"http://localhost/");}
  catch{throw new TypeError("Invalid original sword asset URL");}
  if(uri.pathname!==source || uri.search || uri.hash ||
    (typeof location!=="undefined" && uri.origin!==location.origin))
    throw new TypeError("Unexpected sword asset source URL");
  const factory=canvasFactory??(()=>document.createElement("canvas"));
  if(typeof factory!=="function")throw new TypeError("Canvas factory unavailable");
  const canvas=factory();
  if(!canvas || typeof canvas.getContext!=="function")
    throw new TypeError("Canvas unavailable");
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  if(!ctx||typeof ctx.drawImage!=="function"||
    typeof ctx.getImageData!=="function")throw new TypeError("RGBA decoder unavailable");
  // Taint/getImageData failures must propagate, NEVER reinterpret as opaque.
  ctx.drawImage(image,0,0);
  const rgba=ctx.getImageData(0,0,width,height).data;
  if(!rgba||rgba.length!==width*height*4)throw new TypeError("Unexpected decoded RGBA size");
  const buffer=new Uint8Array(width*height);
  let visiblePixels=0,clickablePixels=0;
  for(let i=0;i<buffer.length;i++){
    const alpha=rgba[i*4+3];
    buffer[i]=alpha;
    if(alpha>0)visiblePixels++;
    if(alpha>=ARMORY_SWORD_ALPHA_SPEC.hitThreshold)clickablePixels++;
  }
  if(clickablePixels===0 || clickablePixels>=buffer.length)
    throw new TypeError("Sword alpha source empty or fully opaque");
  const sampleAlpha=(asset,x,y)=>{
    if(asset!==source || !Number.isInteger(x)||!Number.isInteger(y)||
      x<0||y<0||x>=width||y>=height)return 0;
    return buffer[y*width+x];
  };
  return Object.freeze({
    asset:source,sourceShaExpected:ARMORY_SWORD_ALPHA_SPEC.sha256,
    width,height,visiblePixels,clickablePixels,
    sampleAlpha,
    presentationOnly:true,
    assetBytesCryptographicallyVerified:false,
    actualServerPickup:false,
    productionApproved:false,
  });
}
