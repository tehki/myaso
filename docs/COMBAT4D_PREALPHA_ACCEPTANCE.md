# Combat 4D — Pre-Alpha 0.1 P0 Acceptance Matrix

**Project:** myaso.io. **Authority:** independent Combat 4D QA. **Release authority:** Main 0.

**Verified current main (2026-10-23):** 6fa59b649112c272bcbc018b4a32bf963f9a5bba. GitHub compare of this SHA against main returned identical.

**Status: NOT QUALIFIED.** The 45 mandatory requirements are maintained as an executable inventory in [qa/combat4d-prealpha-acceptance.json](../qa/combat4d-prealpha-acceptance.json). Neither the inventory nor passing deterministic tests is a release qualification.

## Run from repository root

~~~bash
node scripts/combat4d-acceptance.mjs --inventory
node --test tests/combat4d-acceptance.test.mjs
node scripts/combat4d-acceptance.mjs --smoke
node scripts/combat4d-acceptance.mjs --gate <EXACT_40_CHARACTER_SHA> <evidence.json>
~~~

Inventory lists requirements without claiming PASS. Smoke runs the existing Node combat/network tests, the QA integrity tests and Rust tests. Gate checks independent exact-head evidence, exits nonzero unless every scenario qualifies, and always sets deploymentAuthorized=false. Evidence JSON is supplied externally by genuine QA runs, not synthesized by this tool.

Example evidence file that correctly yields HOLD or NOT QUALIFIED:

~~~json
{
  "records": {
    "P0-LMB-DOWN": {
      "candidate_sha": "EXACT_40_CHARACTER_SHA",
      "outcome": "FAIL",
      "failure": "Native pointerDOWN did not initiate server-owned World light"
    }
  }
}
~~~

For a real PASS report, each record must provide: candidate_sha, outcome PASS, independent qa_reviewer, verified_at, exact-head run_url, artifact_urls containing immutable trace links, and assertions containing individually evidenced {name, passed: true, evidence} entries. World/network/native/multiplayer cases require server_ticks of {tick, actor_id, event}; native/multiplayer require genuine w3c_events with origin W3C, trusted true and actor_id. Multiplayer requires distinct browser_sessions with actor_id, session_id, browser and same world_id; required minimum is 2, 3 or 4 by case. Human gates require separately operated human_operators; remote-host gate requires independent_host_verified=true. CI requires full_protected=true and conclusion=success. A real reviewer must independently inspect links and chronological traces; JSON shape itself does not prove truth.

## Confirmed baseline discrepancy and historical risks

- Source-proven on main: [src/browser/left-button-charge.mjs](../src/browser/left-button-charge.mjs) declares release-to-strike. For ordinary LMB, press() does not invoke onLight(); release() does. This violates pointerDOWN immediate authoritative light windup (135ms; 34HP). This is confirmed source behavior, not a claim of new real-browser testing.
- Protocol issue [#723](https://github.com/tehki/myaso/issues/723) remains open. Separate v2 experiments are dormant. 4C [#862](https://github.com/tehki/myaso/pull/862) identifies a fail-first KeyE/LMB shared-ACK outbox retirement defect. Preserve independent LMB source0 and KeyE source1, server-timed 320ms READY held until deliberate release, 46HP heavy, one damaging hit per gesture, bounded replay and authenticated actor/boot identity.
- Historical genuine failures requiring exact-candidate regression: [M144 #392](https://github.com/tehki/myaso/issues/392) missing jump attack, [M155 #591](https://github.com/tehki/myaso/issues/591) punish on victim recovery tick, [M156 #531](https://github.com/tehki/myaso/issues/531) very short light classified heavy, [M194 #298](https://github.com/tehki/myaso/issues/298) missed block loses 34HP, [M41 #402](https://github.com/tehki/myaso/issues/402) late parry loses 34HP, and [M171 #245](https://github.com/tehki/myaso/issues/245) failed feint hit. Their old failed runs must not be erased by an unrelated green run.
- Experimental PRs [#841](https://github.com/tehki/myaso/pull/841), [#848](https://github.com/tehki/myaso/pull/848), [#858](https://github.com/tehki/myaso/pull/858), [#860](https://github.com/tehki/myaso/pull/860), [#859](https://github.com/tehki/myaso/pull/859), [#861](https://github.com/tehki/myaso/pull/861) and [#862](https://github.com/tehki/myaso/pull/862) are draft/nonrelease proposals. Isolated tests do not qualify a combined playable exact head.

## Known runnable entry points

~~~bash
node --test tests/combat-model.test.mjs
node --test tests/networking.test.mjs
cargo test --manifest-path server/Cargo.toml
MYASO_PVP_SCENARIO=uijumpattack node scripts/pvp_browser_flight_runner.mjs
~~~

The native runner also supports uirollknockdownffahit, uikickknockdownffahit, uiparry, uiguardbreak, uiheavy and uifeint. Native browser runs require genuine Chrome/Firefox drivers and authoritative server setup. Existing runners do not by themselves prove four distinct human sessions or independent-host reachability. Browser clock origins are independent: use authoritative server ticks for event ordering.

## Failure assignment

| Finding | Owner |
| --- | --- |
| Input missing/misclassified | Combat 4A |
| Incorrect phases, HP, guard, stamina | Combat 4B |
| Gesture admission and real World integration | Combat 4C |
| QUIC ACK, ordering, replay | Core 8A |
| Boot/session/actor authorization | Core 8B and 8C |
| Collision | Physics 6 |
| Combat animation | Graphics 3A |
| HUD, focus | UI 10 |
| Test harness, acceptance evidence | Combat 4D |

### Release rule

PASS requires all mandatory exact-head evidence, including server-owned light, held READY/released heavy, parry/block/kick/knockdown/punish, replay and reconnect negatives, real 2/3/4-session browsers, separately operated human-versus-human tests, independent-host access and protected CI. Do not fake inputs or HP, expand timing windows, suppress intermittent failures, or infer hits from ACKs.

Combat 4D reports PASS / HOLD / NOT QUALIFIED to Combat 4 and Main 0. Main 0 alone may authorize merge, deployment and public PLAYABLE.
