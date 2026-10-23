// QA-only verification of a real, FAILED M155 native World knockdown boundary.
// This verifies evidence integrity and preserves failure; never creates a PASS.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function parse(line) {
  let m = /^M201_AUTH_ACTION tick=(\d+) fighter=(\d+) from=(\d+) to=(\d+)$/.exec(line);
  if (m) return { kind: "action", tick: Number(m[1]), fighter: Number(m[2]),
    from: Number(m[3]), to: Number(m[4]) };
  m = /^M201_AUTH_HIT tick=(\d+) attacker=(\d+) target=(\d+) damage=(\d+) hp=(\d+)$/.exec(line);
  if (m) return { kind: "hit", tick: Number(m[1]), attacker: Number(m[2]),
    target: Number(m[3]), damage: Number(m[4]), hp: Number(m[5]) };
  throw new Error("Unsupported server trace: " + line);
}

export function assessM155Witness(witness) {
  if (!/^[0-9a-f]{40}$/i.test(witness?.candidate_sha)
    || !/^https:\/\/github\.com\/tehki\/myaso\/actions\/runs\/\d+$/.test(witness?.source_run_url)
    || witness.source_step !== "Validate M155 actionable third-party knockdown punish"
    || witness.source_outcome !== "failure")
    throw new Error("Missing failed exact-head protected workflow identity");
  const { kicker, victim, punisher } = witness.roles ?? {};
  if (![kicker, victim, punisher].every(x => Number.isSafeInteger(x) && x > 0)
    || new Set([kicker, victim, punisher]).size !== 3)
    throw new Error("Kick/victim/third-player identities not distinct");
  if (!Array.isArray(witness.authoritative_lines) || witness.authoritative_lines.length < 8)
    throw new Error("Missing original World action/hit lines");
  const events = witness.authoritative_lines.map(parse);
  if (events.some((e,i) => i > 0 && e.tick < events[i-1].tick))
    throw new Error("Original World chronology out of order");
  const actions = (fighter, from, to) => events.filter(e =>
    e.kind === "action" && e.fighter === fighter && e.from === from && e.to === to);
  const kick = actions(kicker, 12, 13);
  const knock = actions(victim, 0, 19);
  const recover = actions(victim, 19, 0);
  const windup = actions(punisher, 9, 1);
  const active = actions(punisher, 1, 2);
  const hits = events.filter(e => e.kind === "hit"
    && e.attacker === punisher && e.target === victim);
  if ([kick, knock, recover, windup, active, hits].some(a => a.length !== 1))
    throw new Error("Expected one server kick, knockdown, recovery, third-player light and hit");
  const [k], [n], [r], [w], [a], [h] = [kick, knock, recover, windup, active, hits];
  if (k.tick !== n.tick || !(n.tick < w.tick && w.tick < a.tick)
    || h.tick !== a.tick || h.damage !== 34 || h.hp !== 66)
    throw new Error("Expected authentic original World 34HP light and kick chronology");
  const observer = witness.native_runner_evidence ?? {};
  if (!Number.isFinite(observer.punisher_w3c_pointerdown_epoch_ms)
    || observer.sampled_light_active_server_tick !== a.tick
    || observer.original_verifier_failure !== "M206 missing same-strike server attack-active edge")
    throw new Error("Native browser/M206 failure evidence missing or mismatched");
  return {
    status: r.tick <= a.tick ? "HOLD" : "NOT QUALIFIED",
    knockdown_tick:n.tick, recovery_tick:r.tick,
    third_player_active_tick:a.tick, real_hit_tick:h.tick,
    real_damage_hp:h.damage, target_hp:h.hp,
    inside_knockdown:a.tick < r.tick,
    reason:r.tick <= a.tick
      ? "True third-player 34HP hit occurs at/after victim recovery; not an inside-knockdown punish"
      : "Potential pre-recovery hit still needs full genuine browser/World acceptance",
    source:witness.source_run_url
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!process.argv[2]) throw new Error("Usage: node scripts/combat4d-m155-proof.mjs <witness.json>");
    const w = JSON.parse(readFileSync(resolve(process.argv[2]), "utf8"));
    const result = assessM155Witness(w);
    console.log(JSON.stringify(result,null,2));
    // Exit success only on verifying an actual historical QA HOLD, never gameplay PASS.
    process.exitCode = result.status === "HOLD" ? 0 : 1;
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
