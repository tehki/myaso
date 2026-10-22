// Original Canvas pixel provenance selection, separate from mandatory
// authenticated M153 and source-asset hash receipts. NEVER synthesize frames.
const sourceFile="silver_kick_v3_lit.webp";
const phases=Object.freeze(["windup","active","recovery"]);
export function selectAuthenticV3LightCapture({browser,draws,captures}={}){
 if(!["chrome","firefox","chrome2"].includes(browser))
  throw Error("Unknown genuine native browser for V3 study capture");
 if(!Array.isArray(draws)||!captures||typeof captures!=="object")
  throw Error("Missing original native Canvas draw evidence");
 const order=browser==="chrome"?["active"]:["active","recovery","windup"];
 for(const phase of order){
  const c=captures[phase];
  if(!c)continue;
  const {png,frame,direction,epochMs}=c;
  if(typeof png!=="string"||!png.startsWith("data:image/png;base64,")
    || !Number.isInteger(frame)||frame<0||frame>7
    || !Number.isInteger(direction)||direction<0||direction>7
    || !Number.isFinite(epochMs)||epochMs<=0
    || (frame<=2?"windup":frame<=4?"active":"recovery")!==phase)
    throw Error("Original Canvas capture phase/PNG/frame invalid in "+browser);
  if(!draws.some(x=>x.sourceFile===sourceFile&&x.frame===frame
    &&x.direction===direction&&Number.isFinite(x.epochMs)
    &&Math.abs(x.epochMs-epochMs)<=100))
    throw Error("Capture frame is not supported by genuine source draw evidence: "+browser);
  return {png,phase,frame,direction,epochMs};
 }
 throw Error(browser==="chrome"
   ?"Attacker must capture an actual server-confirmed active kick frame"
   :"Native spectator lacks observed original V3 source-phase screenshot: "+browser);
}
