import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../tools/art/main0_v2_knights_combat_four_native.mjs", import.meta.url), "utf8");

test("Source11 native mode must keep same physical actor and QUIC session after real respawn", () => {
  assert.match(source, /"four-combat-respawn-same-session"/);
  const start = source.indexOf('if(physicalMode==="four-combat-respawn-same-session"){');
  const end = source.indexOf("// The original native page still owns the pre-death negotiated lease.", start);
  assert.ok(start >= 0 && end > start);
  const positive = source.slice(start, end);
  assert.match(positive, /originalSessionId=old\.s\.id/);
  assert.match(positive, /originalActorId=old\.actor\.id/);
  assert.match(positive, /resumedRound=await round\(\[\[2,3\]\]\)/);
  assert.match(positive, /afterFresh\.ownPlayerNetId,originalActorId/);
  assert.match(positive, /afterFresh\.closed,false/);
  assert.match(positive, /afterFresh\.failed,false/);
  assert.match(positive, /resumedRound\.presses/);
  assert.match(positive, /resumedRound\.hits/);
  assert.match(positive, /COMBAT4_RESPAWN_SAME_SESSION_FIRST_RED/);
  assert.doesNotMatch(positive, /startW3C\(|DELETE","\/session\/|actor:\{id:5\}/);
});

test("Source11 acceptance cannot displace original first-red stale-generation isolation", () => {
  assert.match(source, /if\(physicalMode==="four-combat-lifecycle"\|\|physicalMode==="four-combat-respawn-same-session"/);
  assert.match(source, /dead-generation physical gesture cannot receive accepted authority/);
  assert.match(source, /old-generation source edge never gains accepted World admission/);
  assert.match(source, /real retired native actor cannot damage another player/);
  assert.match(source, /fresh native QUIC connection owns new server actor and lease/);
  assert.match(source, /nativeChatRound\("After same-session death and renewed physical Combat"\)/);
  assert.match(source, /original World 34HP HIT after respawn/);
});
