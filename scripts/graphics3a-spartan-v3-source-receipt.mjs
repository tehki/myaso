import {summarizeSpartanConnectedKickFlight} from "./graphics3a-spartan-connected-receipt.mjs";

// Opt-in V3 inherits ALL older real authoritative M133 and Canvas criteria.
// The new original Blender atlas is never accepted merely because a windup
// happened or because the browser loaded a static PNG.
export function summarizeSpartanV3ConnectedKickFlight(input) {
  const old=summarizeSpartanConnectedKickFlight(input);
  const clients=input?.clients;
  if(!Array.isArray(clients)||clients.length!==2
    ||new Set(clients.map(x=>x.engine)).size!==2
    ||!clients.some(x=>x.engine==="chrome")
    ||!clients.some(x=>x.engine==="firefox"))
    throw Error("Graphics3A V3 requires distinct real Chrome and Firefox clients");
  for(const client of clients){
    if(!client.draws.every(x=>x.sourceFile==="silver_kick_v3.webp"))
      throw Error("Graphics3A V3 rejected V2/unknown source WebP in "+client.engine);
    if(!client.draws.some(x=>x.frame>=3&&x.frame<=4)
      && !clients.some(x=>x.draws.some(y=>y.frame>=3&&y.frame<=4)))
      throw Error("Graphics3A V3 neither real client saw source contact pixels");
  }
  return {...old,
    authenticOriginalSilverV3AtlasBothBrowsers:true,
    threeExplicitPreviewFlagsRequired:true,
    sourceVersion:"contact-recoil-v3",
    actualServerHitReceiptValidated:false,
    inPreAlpha:false,
    reviewedWorldSoleContact:false,
    fourIndependentHumanOperators:false,
    ownerApprovedGameplay:false,
    productionReleaseApproved:false};
}
