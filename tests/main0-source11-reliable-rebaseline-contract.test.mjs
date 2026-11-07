import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const server=readFileSync(new URL("../server/src/main.rs",import.meta.url),"utf8");
const native=readFileSync(new URL("../client/playcanvas/scripts/main0-chrome-chat-c1-native.mjs",import.meta.url),"utf8");

test("Source11 authoritative World renewal queues exactly one original reliable FULL snapshot after its root hint",()=>{
  const start=server.indexOf('let mut notified_incarnation = 0_u64;');
  const end=server.indexOf('let mut legacy_combat_seen = false;',start);
  const section=server.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.match(section,/let mut pending_source11_rebaseline = false/);
  assert.match(server,/Ok\(true\) => \{\s*notified_incarnation = incarnation;\s*pending_source11_rebaseline = true;/);
  assert.match(server,/pending_source11_rebaseline \|\| !realtime_ready/);
  assert.match(server,/pending_source11_rebaseline\s*\|\| server_tick\.wrapping_sub\(last_reliable_background_tick\)/);
  assert.match(server,/pending_source11_rebaseline\s*\|\| reliable_deltas_since_checkpoint >= RELIABLE_DELTA_CHECKPOINT_INTERVAL/);
  assert.match(server,/let reliable_ack = if force_full_checkpoint \{\s*u16::MAX/);
  assert.match(server,/reliable_snapshots\.build_from_frame\(\s*reliable_ack,\s*player_id,\s*&frame,\s*MAX_RELIABLE_SNAPSHOT_BYTES/);
  assert.match(server,/if pending_source11_rebaseline \{\s*if !full \{\s*bail!\("Source11 original World renewal must enqueue a full baseline"\);\s*\}\s*pending_source11_rebaseline = false;/);
});

test("Source11 checkpoint preserves bounded backpressure, kill-event priority and original wire",()=>{
  const start=server.indexOf('let mut kill_event_queued = false;');
  const end=server.indexOf('let safe_input_ack',start);
  assert.ok(start>=0);
  assert.match(server.slice(start,start+3300),/let mut kill_event_queued = false/);
  const section=server.slice(start,start+7600);
  assert.match(section,/if !kill_event_queued/);
  assert.match(section,/match try_enqueue_reliable\(&reliable_tx,\s*\|\|/);
  assert.match(section,/ReliablePayload::Bytes\(snapshot\.bytes\)/);
  assert.match(section,/Ok\(false\) => \{/);
  assert.doesNotMatch(section,/on.*server.*grant.*client/);
  assert.match(native,/source11Renewal=1/);
  assert.match(native,/real Rust HP100 respawn snapshot after trusted wheel/);
  assert.match(native,/v\.ownedInputTick>grant\.ownedInputTick/);
  assert.match(native,/v\.processedClientTick>grant\.processedClientTick/);
  assert.match(native,/source11-three-lives-first-red\.json/);
});

test("Source11 renewal captures actor incarnation and a fresh HP baseline from ONE World lock",()=>{
  const start=server.indexOf('_ = snapshot_interval.tick() => {');
  const end=server.indexOf('let safe_input_ack = take_safe_input_ack',start);
  assert.ok(start>=0&&end>start);
  const section=server.slice(start,end);
  assert.equal([...section.matchAll(/game\.state\.lock\(\)\.await/g)].length,1);
  assert.match(section,/let \(frame, pending_kill_event, incarnation\) = \{/);
  assert.match(section,/let renewal_due = incarnation/);
  assert.match(section,/source11_replication_frame\(&state, renewal_due\)/);
  assert.match(section,/if let Some\(incarnation\) = incarnation/);
  assert.match(server,/fn source11_replication_frame\(state: &GameState, renewal_due: bool\)/);
  assert.match(server,/Arc::new\(ReplicationFrame::from_fighters\(\s*state\.world\.tick,\s*state\.world\.fighters\(\)/);
  assert.match(server,/fn source11_renewed_world_hp_uses_fresh_authoritative_frame_not_old_hp0_cache\(/);
  assert.match(server,/if pending_source11_rebaseline \{\s*if !full/);
});
