import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {MAP_IDS} from "../src/world/authored-maps.mjs";
import {MOONVALE_ROADSIDE_LORE, createLocalLoreJournal,readLocalLore} from "../src/world/roadside-lore.mjs";
import {CHRONICLE_THREADS_VERSION,MOONVALE_CHRONICLE_THREADS,
  localChronicleThreadSummaries,localChronicleThreadProgress} from "../src/world/chronicle-threads.mjs";

const records=new Map(MOONVALE_ROADSIDE_LORE.map(site=>[site.id,site]));
const read=(set,id)=>{const s=records.get(id);assert.ok(s,id);return readLocalLore(set,s.mapId,s.x,s.y);};

test("D14 two immutable threads partition exactly six authored D13 lore sites",()=>{
  assert.equal(CHRONICLE_THREADS_VERSION,1);
  assert.equal(MOONVALE_CHRONICLE_THREADS.length,2);
  assert.ok(Object.isFrozen(MOONVALE_CHRONICLE_THREADS));
  const collected=[];
  for(const t of MOONVALE_CHRONICLE_THREADS){
    assert.ok(Object.isFrozen(t));assert.ok(Object.isFrozen(t.siteIds));
    assert.equal(t.siteIds.length,3);
    assert.match(t.id,/^[a-z]+(?:-[a-z]+)*$/);
    assert.ok(t.resolution.length>=120);
    for(const id of t.siteIds){
      assert.ok(records.has(id),id);collected.push(id);
    }
  }
  assert.equal(new Set(collected).size,6);
  assert.deepEqual([...collected].sort(),[...records.keys()].sort());
});

test("D14 unopened threads expose the first authored clue but no narrative resolution",()=>{
  const visitor=createLocalLoreJournal();
  const summaries=localChronicleThreadSummaries(visitor);
  assert.ok(Object.isFrozen(summaries));
  assert.deepEqual(localChronicleThreadProgress(visitor),{completed:0,total:2});
  assert.ok(Object.isFrozen(localChronicleThreadProgress(visitor)));
  assert.equal(summaries.length,2);
  for(let i=0;i<summaries.length;i++){
    const s=summaries[i],thread=MOONVALE_CHRONICLE_THREADS[i];
    assert.ok(Object.isFrozen(s));
    assert.deepEqual([s.read,s.total,s.done],[0,3,false]);
    assert.equal(s.nextName,records.get(thread.siteIds[0]).name);
    assert.equal(s.nextClue,records.get(thread.siteIds[0]).clue);
    assert.equal(Object.hasOwn(s,"resolution"),false);
    assert.equal(Object.hasOwn(s,"reward"),false);
  }
});

test("D14 reading advances linked history without awarding quest stages or leaking conclusion",()=>{
  const journal=createLocalLoreJournal();
  assert.ok(read(journal,"red-lion-charter"));
  const [first,second]=localChronicleThreadSummaries(journal);
  assert.deepEqual([first.read,first.done,first.nextName],
    [1,false,records.get("greyhaven-bell").name]);
  assert.equal(Object.hasOwn(first,"resolution"),false);
  assert.deepEqual([second.read,second.done],[0,false]);
  assert.deepEqual(localChronicleThreadProgress(journal),{completed:0,total:2});
  assert.equal(read(journal,"red-lion-charter"),null);
  assert.equal(localChronicleThreadSummaries(journal)[0].read,1);
});

test("D14 out-of-order reads never lose credit and unlock only their completed thread",()=>{
  const a=createLocalLoreJournal();
  assert.ok(read(a,"stonebrook-mason"));
  assert.ok(read(a,"greyhaven-bell"));
  const partial=localChronicleThreadSummaries(a)[0];
  assert.equal(partial.read,2);
  assert.equal(partial.nextName,records.get("red-lion-charter").name);
  assert.ok(!("resolution" in partial));
  assert.ok(read(a,"red-lion-charter"));
  const [first,second]=localChronicleThreadSummaries(a);
  assert.ok(first.done);
  assert.equal(first.read,3);
  assert.equal(first.resolution,MOONVALE_CHRONICLE_THREADS[0].resolution);
  assert.ok(!("nextClue" in first)&&!("nextName" in first));
  assert.ok(!second.done);
  assert.equal(Object.hasOwn(second,"resolution"),false);
  assert.deepEqual(localChronicleThreadProgress(a),{completed:1,total:2});
});

test("D14 both threads complete only after six unrelated sites actually read",()=>{
  const journal=createLocalLoreJournal(),second=createLocalLoreJournal();
  const all=[...MOONVALE_ROADSIDE_LORE].reverse();
  for(const s of all)assert.equal(read(journal,s.id)?.id,s.id);
  assert.deepEqual(localChronicleThreadProgress(journal),{completed:2,total:2});
  const done=localChronicleThreadSummaries(journal);
  assert.ok(done.every(x=>x.done&&x.read===3&&x.resolution.length>120));
  assert.deepEqual(localChronicleThreadProgress(second),{completed:0,total:2});
  assert.equal(second.size,0);
  assert.ok(!Object.keys(done[0]).some(k=>/wallet|gold|loot|items|xp|entitlement|questCredit/i.test(k)));
});

test("D14 spoofed or malformed lore journals never unlock unknown content",()=>{
  for(const journal of [null,{},new Set(["bogus","fake",99]),new Set(["red-lion-charter","fake"]) ]){
    const s=localChronicleThreadSummaries(journal);
    assert.equal(s.length,2);
    assert.equal(localChronicleThreadProgress(journal).completed,0);
    assert.ok(s.every(x=>!x.done&&!Object.hasOwn(x,"resolution")));
  }
  const forged=new Set([...records.keys(),"fake"]);
  assert.equal(localChronicleThreadProgress(forged).completed,2,
    "only six authored ids may count");
});

test("D14 renderer uses existing F-key journal refresh, not live or per-frame scans",()=>{
  const html=readFileSync(new URL("../web/world-preview.html",import.meta.url),"utf8");
  const script=html.match(/<script type="module">([\s\S]*?)<\/script>/);
  assert.ok(script);
  const syntax=spawnSync(process.execPath,["--check","--input-type=module"],
    {input:script[1],encoding:"utf8",timeout:10000});
  assert.equal(syntax.status,0,syntax.stderr);
  assert.match(html,/id="chronicle-thread-progress"/);
  assert.match(html,/id="chronicle-thread-list"/);
  assert.match(html,/Connected historical chronicles/);
  assert.match(script[1],/for\(const thread of localChronicleThreadSummaries\(loreJournal\)\)/);
  assert.match(script[1],/chronicleThreadProgress.textContent=threads.completed/);
  assert.match(script[1],/const threads=localChronicleThreadProgress\(loreJournal\)/);
  assert.match(script[1],/thread.done\s*\? "Connected history: "\+thread.resolution/);
  const where=script[1].indexOf("function refreshLoreJournal(){");
  const next=script[1].indexOf("refreshLoreJournal();",where);
  assert.ok(where>=0&&next>where);
  assert.ok(script[1].slice(where,next).includes("localChronicleThreadSummaries"));
  assert.doesNotMatch(script[1],/fetch\(|WebSocket|WebTransport|localStorage|sessionStorage/);
  for(const p of ["../server/src/main.rs","../server/src/simulation.rs","../web/online-game.mjs"]){
    assert.doesNotMatch(readFileSync(new URL(p,import.meta.url),"utf8"),
      /chronicle-threads|localChronicleThreadSummaries|chronicle-thread-list/);
  }
});
