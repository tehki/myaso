// Chromium WebDriver execute/async source inspection.
// It observes the actual first-party sprite WebP decoded by the native browser;
// it neither injects actors nor changes Combat, inputs, rendering or world state.
const done = arguments[arguments.length-1];
try {
  const image = new Image();
  image.onload = () => {
    try {
      if (image.naturalWidth !== 1280 || image.naturalHeight !== 1280) {
        throw new Error("Original eight-by-eight Dash atlas is not 1280 × 1280");
      }
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 160;
      const ctx = canvas.getContext("2d", {willReadFrequently:true});
      const rows = [];
      const firstHashes = [];
      for (let direction = 0; direction < 8; direction++) {
        const fingerprints = [];
        let leastAlpha = 999999;
        let highestFoot = 0;
        for (let frame = 0; frame < 8; frame++) {
          ctx.clearRect(0,0,160,160);
          ctx.drawImage(image, frame*160,direction*160,160,160,0,0,160,160);
          const rgba = ctx.getImageData(0,0,160,160).data;
          let hash = 2166136261;
          let count = 0;
          let foot = 0;
          for (let i=0; i<rgba.length; i+=4) {
            const alpha=rgba[i+3];
            if (alpha >= 64) {
              count++;
              foot=Math.max(foot,Math.floor(i/4/160)+1);
            }
            for (let k=0;k<4;k++) hash=Math.imul(hash ^ rgba[i+k],16777619) >>> 0;
          }
          if (count <= 100 || foot <= 0) throw new Error("Empty source: dir "+direction+" frame "+frame);
          leastAlpha=Math.min(leastAlpha,count);
          highestFoot=Math.max(highestFoot,foot);
          fingerprints.push(hash.toString(16).padStart(8,"0"));
        }
        const distinctFrames = new Set(fingerprints).size;
        if (distinctFrames < 7) throw new Error("Frozen/missing original Dash source frames in row "+direction+": "+distinctFrames);
        firstHashes.push(fingerprints[0]);
        rows.push({direction,frames:8,distinctFrames,minimumOpaquePixels:leastAlpha,maxFootPixel:highestFoot,firstSourceFrameHash:fingerprints[0]});
      }
      if (new Set(firstHashes).size !== 8) throw new Error("Duplicated Dash facing rows");
      done({ok:true,source:"silver_dash_traction_p0.webp",dimensions:[image.naturalWidth,image.naturalHeight],facingRows:rows});
    } catch (error) {
      done({ok:false,error:String(error)});
    }
  };
  image.onerror=()=>done({ok:false,error:"Original Blender source WebP could not be loaded"});
  image.src = new URL("./assets/knights/review/silver_dash_traction_p0.webp",location.href).href;
} catch(error) {
  done({ok:false,error:String(error)});
}
