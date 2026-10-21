/**
 * Graphics 3B P0 — independent, report-only/strict browser-PAGE visibility gate.
 * Consumes REAL four-client WebDriver/Rust rack-walk evidence, never renders,
 * scrolls, creates item records, rewrites positions or changes gameplay.
 * Its "pass" is ONLY all four replicated fighter CENTERS and the original
 * rack inside browser windows; full Silver silhouettes/DOM occlusion remain
 * subject to human screenshot review and UI10 ownership.
 */
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";

const browsers=Object.freeze(["chrome-1","firefox-2","chrome-3","firefox-4"]);
const ids=Object.freeze([1,2,3,4]);
const finite=n=>typeof n==="number"&&Number.isFinite(n);
function exactIds(rows){
 if(!Array.isArray(rows)||rows.length!==4)return false;
 const values=rows.map(r=>r?.netId);
 return values.every(Number.isSafeInteger)&&
   ids.every(id=>values.filter(v=>v===id).length===1);
}
function validPositions(rows){
 return exactIds(rows)&&rows.every(r=>finite(r.x)&&finite(r.y));
}
function validProjections(rows){
 return exactIds(rows)&&rows.every(r=>
   finite(r.pageCenterX)&&finite(r.pageCenterY)&&
   typeof r.centerInsideBrowserViewport==="boolean");
}
function clampNumber(v){return finite(v)&&v>=0&&v<=1;}
export function assessOriginalRackBrowserPageEvidence(report){
 if(!report||typeof report!=="object"||!Array.isArray(report.peerViews))
  throw new TypeError("Expected genuine four-peer rack-walk report");
 const views=report.peerViews;
 const uniqueBrowsers=new Set(views.map(v=>v?.browser));
 const exactPeerRoster=views.length===4&&uniqueBrowsers.size===4&&
   browsers.every(n=>uniqueBrowsers.has(n));
 const genuineSource=report.realFourW3cQuicClients===true&&
   report.genuineRustReplicatedFourPeerPositions===true&&
   report.originalWorldFourSockets===true;
 const perBrowser=browsers.map(browser=>{
  const view=views.find(v=>v?.browser===browser),page=view?.browserPageVisibility;
  const failures=[];
  if(!view)failures.push("missing-real-browser");
  if(!page||page.measuredFromRealDOM!==true)
    failures.push("missing-real-DOM-measurement");
  const positions=view?.actualPlayerPositions;
  if(!validPositions(positions))failures.push("invalid-real-replicated-roster");
  if(!validProjections(page?.actors))failures.push("invalid-page-actor-projections");
  if(page&&!Number.isInteger(page.actorCentersTotal))
    failures.push("invalid-page-actor-count");
  if(page&&!Number.isInteger(page.actorCentersInsideBrowser))
    failures.push("invalid-inside-count");
  if(page&&!clampNumber(page.canvasVisibleFraction))
    failures.push("invalid-canvas-visible-fraction");
  if(page&&!clampNumber(page.rackVisibleFraction))
    failures.push("invalid-rack-visible-fraction");
  if(page?.rackFullyInBrowserViewport!==true||
     page?.rackVisibleFraction!==1)
    failures.push("rack-not-fully-in-page");
  const projected=validProjections(page?.actors)
    ?page.actors.filter(a=>a.centerInsideBrowserViewport).length:0;
  const countConsistent=page?.actorCentersTotal===4&&
    page?.actorCentersInsideBrowser===projected;
  if(!countConsistent)failures.push("inconsistent-real-player-center-count");
  if(projected!==4)failures.push("player-centers-below-or-outside-page");
  if(validPositions(positions)&&validProjections(page?.actors)&&
     !ids.every(id=>positions.some(a=>a.netId===id)&&
                    page.actors.some(a=>a.netId===id)))
    failures.push("real-player-projection-id-mismatch");
  return Object.freeze({browser,pass:failures.length===0,
    actualCentersInsidePage:projected,expectedCenters:4,
    rackVisibleFraction:clampNumber(page?.rackVisibleFraction)?
      page.rackVisibleFraction:null,
    canvasVisibleFraction:clampNumber(page?.canvasVisibleFraction)?
      page.canvasVisibleFraction:null,
    failures:Object.freeze(failures)});
 });
 const pass=exactPeerRoster&&genuineSource&&perBrowser.every(v=>v.pass);
 return Object.freeze({
  pass,exactFourNativeBrowserRoster:exactPeerRoster,
  genuineFourPlayerSource:genuineSource,
  owner:"UI 10 responsive gameplay viewport; Graphics 3B reports evidence",
  claim:"real rack and all four replicated fighter centers inside browser page only",
  fullSilverSilhouetteVisibilityCertified:false,
  DOMOcclusionCertified:false,
  sourceAssetOrServerMutation:false,
  browsers:Object.freeze(perBrowser),
  blockers:Object.freeze([
   ...(!exactPeerRoster?["wrong-four-native-browser-roster"]:[]),
   ...(!genuineSource?["missing-real-Rust-four-peer-source"]:[]),
   ...perBrowser.filter(v=>!v.pass).map(v=>v.browser)
  ])
 });
}
async function cli(){
 const args=process.argv.slice(2);
 const strict=args.includes("--strict");
 const input=args.find(a=>!a.startsWith("--"))||
   "alpha-p0-real-greyhaven-rack-approach-evidence/rack-approaches-report.json";
 const raw=JSON.parse(await readFile(resolve(input),"utf8"));
 const result=assessOriginalRackBrowserPageEvidence(raw);
 console.log((result.pass?"GRAPHICS3B_P0_PAGE_CENTERS_AND_RACK_PASS ":
   "GRAPHICS3B_P0_PAGE_CENTERS_AND_RACK_BLOCKED ")+JSON.stringify(result));
 if(strict&&!result.pass)process.exitCode=1;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)
 cli().catch(error=>{console.error("GRAPHICS3B_P0_PAGE_METRICS_INVALID "+String(error));process.exitCode=1;});
