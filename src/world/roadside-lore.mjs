// D13 World & Gameplay: authored, session-only environmental storytelling.
// Reading local lore is never a quest reward, inventory entitlement, XP, gold,
// persistent journal, online action or proof of server position.
import { MAP_IDS } from "./authored-maps.mjs";
import { isAuthoredPreviewWalkable } from "./authored-preview-collision.mjs";

export const ROADSIDE_LORE_VERSION = 1;
export const ROADSIDE_LORE_REACH = 68;

// These are approach points on D2's fixed collision map. Text is authored
// narrative, not replicated loot, NPC dialog, a quest ledger or economy data.
export const MOONVALE_ROADSIDE_LORE = Object.freeze([
  Object.freeze({
    id:"red-lion-charter",mapId:MAP_IDS.overworld,name:"The Red Lion Charter",
    x:4365,y:4150,region:"Greyhaven",clue:"An old brass plaque hangs beside the Red Lion's entrance.",
    passage:"A faded charter speaks of Greyhaven as a refuge where travelers once exchanged news before the city's walls were raised."
  }),
  Object.freeze({
    id:"greyhaven-bell",mapId:MAP_IDS.overworld,name:"The Market Bell",
    x:4450,y:4250,region:"Greyhaven",clue:"A cracked bell records the market's first gathering.",
    passage:"The bell was cast for an annual gathering of farmers, smiths and wandering artisans, long before permanent stalls filled the square."
  }),
  Object.freeze({
    id:"millwright-inscription",mapId:MAP_IDS.overworld,name:"The Millwright's Inscription",
    x:2815,y:4100,region:"Western Road",clue:"Weathered lettering survives beside the Old Mill.",
    passage:"Three generations repaired the mill's wheel through bad harvests and long winters. Their names remain cut into a single stone."
  }),
  Object.freeze({
    id:"bridge-wardens-mark",mapId:MAP_IDS.overworld,name:"The Bridge Warden's Mark",
    x:2010,y:4240,region:"Western River",clue:"Look for a small chiseled mark on the western bridge.",
    passage:"A simple circle carved into the bridge's stone remembers the wardens who kept the King's Road open through the spring floods."
  }),
  Object.freeze({
    id:"fallen-watch-signal",mapId:MAP_IDS.overworld,name:"The Last Watch Signal",
    x:3210,y:2070,region:"Northern Road",clue:"A broken signal plate rests below the fallen watchpost.",
    passage:"The watch once carried beacon fires from the northern hills. Its final recorded signal warned the lowlands of a storm, not an army."
  }),
  Object.freeze({
    id:"stonebrook-mason",mapId:MAP_IDS.overworld,name:"The Mason's Promise",
    x:6565,y:4080,region:"Stonebrook",clue:"A mason's scratched promise remains along Stonebrook's street.",
    passage:"The first builders promised to keep one hearth burning for anyone stranded on the eastern road, whatever the season."
  }),
]);

export function createLocalLoreJournal() { return new Set(); }

export function nearbyLocalLoreSite(mapId,x,y) {
  if(mapId!==MAP_IDS.overworld || !Number.isFinite(x) || !Number.isFinite(y) ||
    !isAuthoredPreviewWalkable(mapId,x,y))return null;
  let closest=null,distance=ROADSIDE_LORE_REACH*ROADSIDE_LORE_REACH;
  for(const site of MOONVALE_ROADSIDE_LORE){
    const dx=site.x-x,dy=site.y-y,d2=dx*dx+dy*dy;
    if(d2<=distance && (closest===null||d2<distance) &&
      isAuthoredPreviewWalkable(mapId,site.x,site.y)){
      closest=site;distance=d2;
    }
  }
  return closest;
}

// Called only after preview's F-key nearest-target arbitration.
// Do not repeat reads or change the resource/expedition state.
export function readLocalLore(journal,mapId,x,y) {
  if(!(journal instanceof Set))return null;
  const site=nearbyLocalLoreSite(mapId,x,y);
  if(!site||journal.has(site.id))return null;
  journal.add(site.id);
  return site;
}

export function localLoreProgress(journal) {
  const documented=journal instanceof Set?
    MOONVALE_ROADSIDE_LORE.reduce((n,s)=>n+Number(journal.has(s.id)),0):0;
  return Object.freeze({documented,total:MOONVALE_ROADSIDE_LORE.length});
}
