import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createPagehideTransportFence} from "../src/browser/pagehide-transport-fence.mjs";

function client(){
  const calls=[];
  return {calls,close(reason){calls.push(reason);}};
}

test("fast navigation before asynchronous QUIC admission retires the newly connected client immediately",()=>{
  const fence=createPagehideTransportFence();
  assert.equal(fence.departed,false);
  fence.depart();
  assert.equal(fence.departed,true);
  const connected=client();
  assert.equal(fence.bind(connected),false);
  assert.deepEqual(connected.calls,["pagehide"]);
  fence.depart();
  assert.deepEqual(connected.calls,["pagehide"],"multiple pagehide signals cannot close twice");
});

test("ordinary pagehide after admission closes only the bound gameplay transport",()=>{
  const fence=createPagehideTransportFence();
  const connected=client();
  assert.equal(fence.bind(connected),true);
  assert.deepEqual(connected.calls,[]);
  fence.depart();
  fence.depart();
  assert.deepEqual(connected.calls,["pagehide"]);
  assert.equal(fence.departed,true);
});

test("a reused lifecycle object may not bind a replacement session",()=>{
  const fence=createPagehideTransportFence();
  const old=client(),fresh=client();
  assert.equal(fence.bind(old),true);
  assert.throws(()=>fence.bind(fresh),/already bound/);
  fence.depart();
  assert.deepEqual(old.calls,["pagehide"]);
  assert.deepEqual(fresh.calls,[]);
});

test("separate navigations get independent one-use admission fences",()=>{
  const oldFence=createPagehideTransportFence(),newFence=createPagehideTransportFence();
  oldFence.depart();
  const retired=client(),arriving=client();
  assert.equal(oldFence.bind(retired),false);
  assert.equal(newFence.bind(arriving),true);
  assert.deepEqual(retired.calls,["pagehide"]);
  assert.deepEqual(arriving.calls,[]);
  newFence.depart();
  assert.deepEqual(arriving.calls,["pagehide"]);
});

test("original browser attaches its exact connected client after awaited WebTransport admission",()=>{
  const source=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
  assert.match(source,/import \{ createPagehideTransportFence \} from "\.\.\/src\/browser\/pagehide-transport-fence\.mjs";/);
  assert.match(source,/window\.addEventListener\("pagehide", \(\) => \{\s*pagehideTransportFence\.depart\(\);\s*if \(animationFrameId\) cancelAnimationFrame\(animationFrameId\);\s*animationFrameId = 0;/);
  assert.match(source,/networkClient = await connectAuthoritativeClient\(\{/);
  assert.match(source,/\nconst activeAfterAdmission = pagehideTransportFence\.bind\(networkClient\);/);
  assert.match(source,/if \(event\.persisted\) window\.location\.reload\(\);/);
});

test("a departed page can never start a post-admission gameplay loop",()=>{
  for (const departedBeforeAdmission of [true,false]) {
    const fence=createPagehideTransportFence();
    const connection=client();
    let scheduledFrames=0,inputs=0;
    if (departedBeforeAdmission) fence.depart();
    const activeAfterAdmission=fence.bind(connection);
    if (activeAfterAdmission) scheduledFrames+=1;
    if (!departedBeforeAdmission) fence.depart();
    if (!fence.departed) inputs+=1;
    assert.equal(scheduledFrames,departedBeforeAdmission?0:1);
    assert.equal(inputs,0,"departed session must not submit an input");
    assert.deepEqual(connection.calls,["pagehide"]);
  }
});

test("original online game gates RAF, visibility wake and sendInput against departed admission",()=>{
  const source=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
  assert.match(source,/if \(activeAfterAdmission\) \{\s*render\(\);\s*frameBudget\.reset\(performance\.now\(\)\);\s*animationFrameId = requestAnimationFrame\(frame\);\s*\}/);
  assert.match(source,/function frame\(now\) \{\s*if \(pagehideTransportFence\.departed \|\| document\.hidden\)/);
  assert.match(source,/function simulatePrediction\(stepMs\) \{[^}]*if \(pagehideTransportFence\.departed\) return;/);
  assert.match(source,/function handleVisibilityChange\(\) \{\s*releaseInputs\(\);\s*if \(pagehideTransportFence\.departed\) return;/);
});
