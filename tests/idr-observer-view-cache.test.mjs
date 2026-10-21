import test from "node:test";
import assert from "node:assert/strict";
import { createIdrObserverViewCache } from "../src/browser/idr-observer-view-cache.mjs";
import { IDR_UNKNOWN, idrLabelFromProjection } from "../src/browser/identity-visibility.mjs";

// These are synthetic UI fixtures, NOT authenticated Core8A wire evidence.
const viewer=(name="viewer-a",generation=11)=>({
  viewerRef:name,sessionRef:"authenticated-lease-"+name,sessionEpoch:generation,
});
const observation=(overrides={})=>({
  ...viewer(),actorRef:"canonical-subject-rack-independent-128",
  revision:1,appearanceEpoch:1,certainty:"claimed",label:"Aldric",
  ...overrides,
});

test("UI10 always marks raw claimed introductions as unverified",()=>{
  assert.equal(idrLabelFromProjection({certainty:"claimed",label:"Aldric"}),"Calls themselves Aldric");
  assert.equal(idrLabelFromProjection({certainty:"claimed",label:"Calls themselves Aldric"}),"Calls themselves Aldric");
  assert.equal(idrLabelFromProjection({certainty:"verified",label:"Aldric"}),"Aldric");
  assert.equal(idrLabelFromProjection({certainty:"unknown",label:"Aldric"}),IDR_UNKNOWN);
  assert.equal(idrLabelFromProjection({certainty:"claimed",label:" Bad\nName "}),IDR_UNKNOWN);
});
test("UI10 fail-closed before an authenticated viewer session is installed",()=>{
  const c=createIdrObserverViewCache();
  assert.equal(c.ingest(observation()),false);
  assert.deepEqual(c.read(observation().actorRef),
    {certainty:"unknown",label:IDR_UNKNOWN});
  assert.equal(c.beginSession({...viewer(),sessionEpoch:-1}),false);
  assert.equal(c.beginSession(viewer()),true);
  assert.equal(c.ingest(observation()),true);
  assert.deepEqual(c.read(observation().actorRef),
    {certainty:"claimed",label:"Calls themselves Aldric"});
});
test("different observers can see Unknown vs claimed for same actor",()=>{
  const a=createIdrObserverViewCache(),b=createIdrObserverViewCache();
  a.beginSession(viewer("viewer-a"));b.beginSession(viewer("viewer-b"));
  assert.equal(a.ingest(observation()),true);
  assert.equal(b.ingest(observation({...viewer("viewer-b"),certainty:"unknown",label:undefined})),true);
  assert.equal(a.read(observation().actorRef).label,"Calls themselves Aldric");
  assert.deepEqual(b.read(observation().actorRef),{certainty:"unknown",label:IDR_UNKNOWN});
  assert.equal(b.ingest(observation()),false,"wrong recipient cannot leak A's alias to B");
});
test("stale and conflicting evidence cannot replace a verified name",()=>{
  const c=createIdrObserverViewCache();c.beginSession(viewer());
  const known=observation({revision:4,appearanceEpoch:2,certainty:"verified",label:"Lady Mira"});
  assert.equal(c.ingest(known),true);
  assert.equal(c.ingest({...known,label:"Impostor"}),false);
  assert.equal(c.ingest(known),true,"same observation is idempotent");
  assert.equal(c.ingest({...known,revision:3,label:"Former Alias"}),false);
  assert.equal(c.ingest({...known,revision:5,appearanceEpoch:1}),false);
  assert.deepEqual(c.read(known.actorRef),{certainty:"verified",label:"Lady Mira"});
});
test("new disguise epoch is observer-specific and old recognition is not carried automatically",()=>{
  const witness=createIdrObserverViewCache(),stranger=createIdrObserverViewCache();
  witness.beginSession(viewer("viewer-a"));stranger.beginSession(viewer("viewer-b"));
  const a=observation({revision:10,appearanceEpoch:5,certainty:"verified",label:"Captain Mira"});
  assert.equal(witness.ingest(a),true);
  assert.equal(stranger.ingest({...a,...viewer("viewer-b"),certainty:"unknown",label:undefined}),true);
  // Core-owned trusted witness may receive a newly verified projection.
  assert.equal(witness.ingest({...a,revision:11,appearanceEpoch:6}),true);
  // The nonwitness is explicitly Unknown after appearance change.
  assert.equal(stranger.ingest({...a,...viewer("viewer-b"),
    revision:11,appearanceEpoch:6,certainty:"unknown",label:undefined}),true);
  assert.equal(witness.read(a.actorRef).label,"Captain Mira");
  assert.equal(stranger.read(a.actorRef).label,IDR_UNKNOWN);
  assert.equal(stranger.ingest({...a,...viewer("viewer-b"),revision:10}),false);
});
test("reconnect and lease substitution invalidate all historical UI recognition",()=>{
  const c=createIdrObserverViewCache();c.beginSession(viewer());
  assert.equal(c.ingest(observation({certainty:"verified",label:"Mira"})),true);
  assert.equal(c.ingest(observation({...viewer("viewer-b")})),false);
  assert.equal(c.beginSession(viewer("viewer-a",12)),true);
  assert.equal(c.read(observation().actorRef).label,IDR_UNKNOWN);
  assert.equal(c.ingest(observation({certainty:"verified",label:"Mira"})),false,
    "past session generation cannot relabel after reconnect");
  const fresh=observation({...viewer("viewer-a",12),revision:12,
    appearanceEpoch:2,certainty:"unknown",label:undefined});
  assert.equal(c.ingest(fresh),true);
  assert.equal(c.read(fresh.actorRef).label,IDR_UNKNOWN);
  c.reset();assert.equal(c.size,0);
  assert.equal(c.ingest(fresh),false);
});
test("authenticated despawn tombstone denies old actor resurrection in current session",()=>{
  const c=createIdrObserverViewCache();c.beginSession(viewer());
  const e=observation({revision:12,certainty:"verified",label:"Mira"});
  c.ingest(e);
  assert.equal(c.retire({...e,revision:13}),true);
  assert.deepEqual(c.read(e.actorRef),{certainty:"unknown",label:IDR_UNKNOWN});
  assert.equal(c.ingest(e),false);
  assert.equal(c.ingest({...e,revision:14,label:"New person in reused slot"}),false);
  assert.equal(c.retire({...e,revision:14}),false);
});
test("source projections with true name/controller leak fields and spoofed verified bits are denied",()=>{
  const c=createIdrObserverViewCache();c.beginSession(viewer());
  const base=observation();
  for(const bad of [
    {...base,trueName:"Hidden"}, {...base,controllerKind:"Human"},
    {...base,isNpc:false}, {...base,isHuman:true},
    {...base,revision:NaN}, {...base,actorRef:"bad\nactor"},
    {...base,label:"\u202eFake"}, {...base,certainty:"unknown",label:"secret"},
    {...base,certainty:"verified",label:""},
  ])assert.equal(c.ingest(bad),false);
  assert.equal(c.size,0);
});
test("bounded cache refuses oversized actor lists and never evicts a known observer secretly",()=>{
  assert.throws(()=>createIdrObserverViewCache({maxActors:0}),RangeError);
  assert.throws(()=>createIdrObserverViewCache({maxActors:257}),RangeError);
  const c=createIdrObserverViewCache({maxActors:2});c.beginSession(viewer());
  assert.equal(c.ingest(observation({actorRef:"actor-A"})),true);
  assert.equal(c.ingest(observation({actorRef:"actor-B",certainty:"unknown",label:undefined})),true);
  assert.equal(c.ingest(observation({actorRef:"actor-C"})),false);
  assert.equal(c.size,2);
  assert.equal(c.read("actor-A").label,"Calls themselves Aldric");
});
