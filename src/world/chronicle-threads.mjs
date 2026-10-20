// D14: read-only story threads linking the six D13 Moonvale inscriptions.
// This is offline narrative presentation, not a quest system, route authority,
// player movement, economic reward, achievement or persistence contract.
import { MOONVALE_ROADSIDE_LORE } from "./roadside-lore.mjs";

export const CHRONICLE_THREADS_VERSION = 1;

// Every entry is already a fixed D13 walkable site. The story resolution is
// shown in the UI only after all three of its related accounts were read.
// The manifest exists in the client bundle; this is UX reveal, NOT encryption.
export const MOONVALE_CHRONICLE_THREADS = Object.freeze([
  Object.freeze({
    id: "hearths-and-bells",
    title: "Of Hearths and Bells",
    subtitle: "What once bound the lowland settlements together?",
    siteIds: Object.freeze(["red-lion-charter", "greyhaven-bell", "stonebrook-mason"]),
    resolution: "The charter, the bell and the mason's promise tell one story: Moonvale's communities grew around a shared duty to shelter travelers, not around a crown or a conquest.",
  }),
  Object.freeze({
    id: "wardens-of-the-road",
    title: "Wardens of the Road",
    subtitle: "Who kept the western and northern roads open?",
    siteIds: Object.freeze(["millwright-inscription", "bridge-wardens-mark", "fallen-watch-signal"]),
    resolution: "The millwrights, bridge wardens and northern watch served the same purpose in different places: preserve the roads through cold winters, floods and dangerous storms.",
  }),
]);

const BY_ID = new Map(MOONVALE_ROADSIDE_LORE.map(site=>[site.id,site]));

// Pure projection of the D13 local Set. No writes to visited state, no
// authoritative quest credit, XP, collectibles, server data or persistence.
// Read order is free; each thread suggests the earliest remaining clue.
export function localChronicleThreadSummaries(journal) {
  const visited = journal instanceof Set ? journal : null;
  const result = MOONVALE_CHRONICLE_THREADS.map(thread => {
    let read=0, next=null;
    for(const id of thread.siteIds){
      const site=BY_ID.get(id);
      if(visited?.has(id))read++;
      else if(!next)next=site;
    }
    const done=read===thread.siteIds.length;
    const summary={
      id:thread.id,
      title:thread.title,
      subtitle:thread.subtitle,
      read,
      total:thread.siteIds.length,
      done,
    };
    if(done)summary.resolution=thread.resolution;
    else {
      summary.nextName=next.name;
      summary.nextClue=next.clue;
    }
    return Object.freeze(summary);
  });
  return Object.freeze(result);
}

export function localChronicleThreadProgress(journal) {
  const summaries=localChronicleThreadSummaries(journal);
  return Object.freeze({
    completed:summaries.reduce((n,s)=>n+Number(s.done),0),
    total:summaries.length,
  });
}
