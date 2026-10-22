/**
 * Graphics 3B QA ONLY: stage the entire original World+3C/3B frame in an
 * offscreen canvas before replacing any visible pixels. This distinguishes
 * the previously tested HTTP/decode failure from a later Canvas drawing
 * failure after the three original images were successfully decoded.
 *
 * This is NOT used by the live game. The commit operation itself can still
 * fail; no browser Canvas transaction / GPU presentation guarantee exists.
 */
export function paintRedLionFrameInScratch({
  destinationCanvas,makeScratch,paintPlaceholder,paintDetailed,preferDetailed,
}={}) {
  const width=destinationCanvas?.width,height=destinationCanvas?.height;
  if(!Number.isInteger(width)||!Number.isInteger(height)||
     width<1||height<1||width>2048||height>2048||
     typeof makeScratch!=="function"||
     typeof paintPlaceholder!=="function"||
     typeof paintDetailed!=="function"||
     typeof destinationCanvas?.getContext!=="function"||
     typeof preferDetailed!=="boolean")
    throw new TypeError("Bounded original full-frame Canvas QA injection required");

  const newScratch=()=>{
    const scratch=makeScratch(width,height);
    if(!scratch||scratch===destinationCanvas||
       scratch.width!==width||scratch.height!==height||
       typeof scratch.getContext!=="function"||
       !scratch.getContext("2d"))
      throw new TypeError("Original-size isolated scratch Canvas required");
    return scratch;
  };
  let staged,usedDetailed=false,detailedDrawFailed=false;
  if(preferDetailed) {
    const tentative=newScratch();
    try{
      paintDetailed(tentative);
      staged=tentative;
      usedDetailed=true;
    }catch{
      // Never present a partial roof or missing Red Lion: discard the entire
      // detailed scratch image, then paint the original World placeholder
      // on a FRESH scratch Canvas. The fallback itself must not be swallowed.
      detailedDrawFailed=true;
    }
  }
  if(!staged){
    staged=newScratch();
    paintPlaceholder(staged);
  }
  const ctx=destinationCanvas.getContext("2d");
  if(!ctx||typeof ctx.save!=="function"||
     typeof ctx.restore!=="function"||
     typeof ctx.setTransform!=="function"||
     typeof ctx.drawImage!=="function")
    throw new TypeError("Original destination Canvas 2D context required");
  ctx.save();
  try{
    ctx.setTransform(1,0,0,1,0,0);
    ctx.globalCompositeOperation="copy";
    ctx.drawImage(staged,0,0);
  }finally{
    ctx.restore();
  }
  return Object.freeze({
    detailedDrawn:usedDetailed,
    placeholderDrawn:!usedDetailed,
    recoveredLateDetailedFailure:detailedDrawFailed,
    liveGameIntegrated:false,
    transactionalGpuPresentGuaranteed:false,
  });
}
