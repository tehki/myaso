// M344: source-contract checks; only genuine Chrome/Firefox native acceptance
// can prove actual QUIC packets, World actions and original 34 HP damage.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rust = readFileSync(new URL("../server/src/main.rs", import.meta.url), "utf8");
const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
const browser = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");

test("M344 is explicitly off-by-default, exact-flag parsed, and denied off loopback",()=>{
  assert.match(rust,/MYASO_FLIGHT_INPUT_ADMISSION_TRACE/);
  assert.match(rust,/MYASO_FLIGHT_INPUT_ADMISSION_TRACE must be 0 or 1/);
  assert.match(rust,/let flight_input_admission_trace = env::var/);
  assert.match(rust,/\.unwrap_or\(false\);/);
  assert.match(rust,/\|\| flight_input_admission_trace\)\s*&& !bind\.ip\(\)\.is_loopback\(\)/);
  assert.match(rust,/if game\.flight_input_admission_trace && m344_inspect/);
  assert.match(runner,/MYASO_BIND: "127\.0\.0\.1:0"/);
  assert.match(runner,/MYASO_FLIGHT_INPUT_ADMISSION_TRACE:\s*scenario === "uirollknockdownffahit" \? "1" : "0"/);
});

test("genuine v1 packet gets decoded, ingested and selected before original World input",()=>{
  assert.match(rust,/decode_input_packet\(datagram\.as_ref\(\)\)/);
  assert.match(rust,/M344_V1_RX actor=\{player_id\}/);
  assert.match(rust,/M344_V1_INGRESS actor=\{player_id\}/);
  assert.match(rust,/M344_V1_WORLD_SET actor=\{player_id\}/);
  assert.match(rust,/let accepted = ingress\.ingest\(&packet\);/);
  assert.match(rust,/coalesce_accepted_input_batch\(accepted\.as_slice\(\)\)/);
  assert.match(rust,/let m344_selected = if game\.flight_input_admission_trace && m344_inspect/);
  assert.match(rust,/apply_coalesced_input_and_read_tick\(/);
  assert.match(rust,/state\.world\.set_input\(player_id, input\);/);
  assert.match(rust,/let mut m344_followup_datagrams = 0_u8;/);
  assert.match(rust,/m344_followup_datagrams = 4;/);
  assert.match(rust,/m344_followup_datagrams -= 1;/);
  assert.ok(rust.indexOf("let accepted = ingress.ingest(&packet);") <
    rust.indexOf("M344_V1_INGRESS actor="));
  assert.ok(rust.indexOf("M344_V1_INGRESS actor=") <
    rust.indexOf("let m344_selected = if"));
});

test("M156 Rust loopback adds original 60Hz Combat action witness; other cases unaffected",()=>{
  assert.match(runner,/MYASO_FLIGHT_ACTION_PROOF: \(scenario === "uiguardbreakpunishffahit"[\s\S]*?\|\| scenario === "uirollknockdownffahit"/,
    "M206 protected original prefix stays adjacent; M156 adds only read-only World proof");
  assert.match(rust,/M201_AUTH_ACTION tick=/);
  assert.match(rust,/M201_AUTH_HIT tick=/);
  assert.match(rust,/M344_V1_RX/);
  assert.match(rust,/M344_V1_INGRESS/);
  assert.match(rust,/M344_V1_WORLD_SET/);
  assert.match(runner,/runOnlineUiRollKnockdownFfaHitFlight\(sessions\)/);
  assert.match(runner,/did not land exactly one 34 HP third-party light/);
});

test("source change adds no second sender, no client-defined actor, no approved v2 gameplay",()=>{
  assert.equal((browser.match(/networkClient\.sendInput\(\{ tick: outgoingTick, \.\.\.currentInput \}\);/g) ?? []).length,1);
  assert.doesNotMatch(rust,/M344_[A-Z]+_HIT/);
  assert.doesNotMatch(runner,/MYASO_PVP_SCENARIO.*(?:synthetic|waive)/);
  assert.match(rust,/encode_input_ack\(client_tick, server_tick, player_id\)/);
  // Receive, dedup and coalesced set are independently observable.
  // Processed highwater remains a receipt, never proof of a particular hit.
});
