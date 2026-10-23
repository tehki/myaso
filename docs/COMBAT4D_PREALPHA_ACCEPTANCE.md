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

Inventory lists requirements without claiming PASS. Smoke runs the existing Node combat/network tests, the QA integrity tests and Rust tests. Gate is a **structural preflight, not an independent evidence verifier**: it always exits nonzero unless an independently verifiable acceptance mechanism is implemented and reviewed. Valid-looking self-submitted reports are marked **REVIEW REQUIRED / HOLD**, never PASS; deploymentAuthorized is always false. Evidence JSON may be supplied externally, but its claimed GitHub runs, actor traces, humans and host independence cannot be trusted without independent verification.

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

For a structurally complete report awaiting independent verification, each record must provide: candidate_sha, outcome PASS, independent qa_reviewer, verified_at, exact-head run_url, artifact_urls containing immutable trace links, and assertions containing individually evidenced {name, passed: true, evidence} entries. World/network/native/multiplayer cases require server_ticks of {tick, actor_id, event}; native/multiplayer require genuine w3c_events with origin W3C, trusted true and actor_id. Multiplayer requires distinct browser_sessions with actor_id, session_id, browser and same world_id; required minimum is 2, 3 or 4 by case. Human gates require separately operated human_operators; remote-host gate requires independent_host_verified=true. CI requires full_protected=true and conclusion=success. **Security boundary:** the script cannot authenticate GitHub run SHA/result, immutable artifacts, W3C origin, original server ticks, human identities or independent hosts. The offline CLI must not grant PASS even if all 45 records claim success. Independent QA must inspect actual source records and coordinate any final acceptance with Main 0 outside this untrusted manifest checker.

## Confirmed baseline discrepancy and historical risks

- Source-proven on main: [src/browser/left-button-charge.mjs](../src/browser/left-button-charge.mjs) declares release-to-strike. For ordinary LMB, press() does not invoke onLight(); release() does. This violates pointerDOWN immediate authoritative light windup (135ms; 34HP). This is confirmed source behavior, not a claim of new real-browser testing.
- Protocol issue [#723](https://github.com/tehki/myaso/issues/723) remains open. Separate v2 experiments are dormant. 4C [#862](https://github.com/tehki/myaso/pull/862) identifies a fail-first KeyE/LMB shared-ACK outbox retirement defect. Preserve independent LMB source0 and KeyE source1, server-timed 320ms READY held until deliberate release, 46HP heavy, one damaging hit per gesture, bounded replay and authenticated actor/boot identity.
- Historical genuine failures requiring exact-candidate regression: [M144 #392](https://github.com/tehki/myaso/issues/392) missing jump attack, [M155 #591](https://github.com/tehki/myaso/issues/591) punish on victim recovery tick, [M156 #531](https://github.com/tehki/myaso/issues/531) very short light classified heavy, [M194 #298](https://github.com/tehki/myaso/issues/298) missed block loses 34HP, [M41 #402](https://github.com/tehki/myaso/issues/402) late parry loses 34HP, and [M171 #245](https://github.com/tehki/myaso/issues/245) failed feint hit. Their old failed runs must not be erased by an unrelated green run.
- Experimental PRs [#841](https://github.com/tehki/myaso/pull/841), [#848](https://github.com/tehki/myaso/pull/848), [#858](https://github.com/tehki/myaso/pull/858), [#860](https://github.com/tehki/myaso/pull/860), [#859](https://github.com/tehki/myaso/pull/859), [#861](https://github.com/tehki/myaso/pull/861) and [#862](https://github.com/tehki/myaso/pull/862) are draft/nonrelease proposals. Isolated tests do not qualify a combined playable exact head.

## Independent native M107 failure captured on 2026-10-23

On isolated QA PR #865 at `1d4c165ee10d68509edb9d80f07e138f4f009d89`, exact-head protected [CI #39930443888](https://github.com/tehki/myaso/actions/runs/39930443888) **FAILED** at step 20, `Validate M107 real heavy counterplay`. Original real native Chrome/Firefox evidence from job `120337091363`:

- Rust original World: fighter2 HeavyWindup tick 261; HeavyActive and **46HP contact tick 280** against fighter1, defender HP 100→54.
- Fighter1 starts Dodge only **tick 282**, two authoritative ticks after the hit; Dodge recovery tick 292.
- Chrome defender's same-client feedback chronology: `Hit taken - 46 HP.` then `Dodge! Strike avoided.`; final HP 54, stamina 72.
- Thus the dodge was too late **and** readability incorrectly suggested success after an actual committed hit. It is not a missing frontend redraw, a synthetic client action, or a proven packet loss. Do not infer root cause solely from this run.

The exact transcribed source lines, GitHub job ID and native client observations are retained in [qa/evidence/m107-run-39930443888.json](../qa/evidence/m107-run-39930443888.json). `node scripts/combat4d-m107-proof.mjs qa/evidence/m107-run-39930443888.json` verifies log/field consistency and emits **HOLD**. Tests also reject missing trusted input, falsified event records, unsorted server ticks and retrospective success. This evidence integrity check itself can pass while gameplay M107 legitimately stays red.

**Routing:** 4A/Core8A own physical wheel admission/30Hz scheduling investigation; UI10/Combat4 own post-contact dodge-success suppression; 4B/Physics6 verify original World action/timing only if further evidence implicates them. Draft [#851](https://github.com/tehki/myaso/pull/851) proposes truthful contact feedback; [#854](https://github.com/tehki/myaso/pull/854) proposes immediate physical-wheel admission. Neither experimental proposal qualifies this separate exact candidate or the full Pre-Alpha.

## Protected M155 native regression — 2026-10-23

The previous 4D exact-head candidate `91ab5c107cb88431c652329f760a7b68bfc35715` failed original protected [quality #39931321731](https://github.com/tehki/myaso/actions/runs/39931321731) at step `Validate M155 actionable third-party knockdown punish`, native job `120340072943`.

- Real kicker fighter1 KickWindup tick348 → KickActive tick353. Victim fighter2 enters Knockdown19 **tick353**.
- Third-player fighter3 transitions HeavyCharge9 tick359 → LightWindup1 tick367; its native pointerDOWN was recorded at epoch 1792747886333.
- **Victim recovers Knockdown19→Idle0 tick375. On the same server tick375, third-player light becomes Active2 and commits one genuine 34HP hit, victim HP100→66.**
- Original strict M206 rejects this as `M206 missing same-strike server attack-active edge` **inside knockdown**. A normal hit at recovery tick cannot count as a knockdown punish; no server constant should be changed to hide native delivery/scheduling problems.
- Exact source lines are in [qa/evidence/m155-run-39931321731.json](../qa/evidence/m155-run-39931321731.json). `node scripts/combat4d-m155-proof.mjs qa/evidence/m155-run-39931321731.json` verifies chronology and prints **HOLD**. Dedicated QA tests refuse fabricated hits, misidentified actors, or reordered ticks. The QA evidence check passing does NOT qualify M155 gameplay.
- Related [Combat 4B #864](https://github.com/tehki/myaso/pull/864) adds correct World-only positive/negative recovery boundary tests. It does not demonstrate real Chrome/Firefox knockdown punish success. Input/transport and W3C action scheduling need separate owner investigation.

Do not reinterpret a later rerun as erasure of this real failure. Independent exact-integrated-candidate Chrome/Firefox/Chrome2/4-human acceptance remains mandatory.

## Exact native M205 → M193 guard-break regression (2026-10-23)

On the **experimental nonrelease** Combat4C [#870](https://github.com/tehki/myaso/pull/870) exact `488467b87d13c51d5bfc2e657ff7714772a8a3d3`, protected [quality #39935435948](https://github.com/tehki/myaso/actions/runs/39935435948) job `120353730262` **FAILED step 91 `Validate M205 repeated M201 server-tick FFA punish proof`**. The inner real-browser M193 guard-break sequence is the precise blocker.

- Genuine attacker Chrome player1 / defender Firefox player2 / third Chrome player3 are admitted by original World. First exchange: fighter2 Block6 tick324, genuine attack ACTIVE2 and server BLOCK tick332, guard 100→62 (exact -38), HP100. This is legitimate block after **8 server ticks**.
- Second exchange: attacker LightWindup1 tick359, defender Block6 tick361, server **PARRY tick367**, attacker ParryStun7. The defender's guard remains 62/HP100. Six 60Hz ticks (~100ms) of Block6 is inside the unchanged **125ms parry** and must never be relabeled as a block-only -38 guard pressure.
- Genuine native W3C Chrome pointerDOWN/UP epoch `1792749876749→1792749876768` and genuine Firefox wheel epoch `1792749876762` appear in the original runner log; the logged wheel lead parameter is `0ms`, and Firefox wheel→impact-or-parry local observation is `221ms`. Original server-tick chronology is dispositive; don't subtract non-synchronized browser clocks to invent packet-latency facts.
- The original strict runner rejected `M193 guard-break exchange 2 resolved as parry instead of -38 guard`. Consequently M205 FFA punish setup was invalid; this is **not** evidence that #870's default-OFF experimental typed source path caused a v1 browser regression.
- [qa/evidence/m193-run-39935435948.json](../qa/evidence/m193-run-39935435948.json) captures both source exchanges. `node scripts/combat4d-m193-proof.mjs qa/evidence/m193-run-39935435948.json` verifies original log chronology and returns **HOLD**. The checks intentionally pass as evidence integrity while the original gameplay test remains failed. No change to 125ms parry, -38 guard, 34HP light, browser W3C test, or original server rules.

**Routing:** 4A native physical ingress/harness ordering, 4B original Block age/World, 4C/Core8 transport only when causality is demonstrated, 4D independent adversarial proof and repeatability. No retrospective green after a later successful retry.

## Original native M121 LEFT SWEEP semantic failure — 2026-10-23

Strict full [PR #869 quality #39938139017](https://github.com/tehki/myaso/actions/runs/39938139017) on the QA-only acceptance hardening head `2eb2a677faf972d5bcd1a11725a6118a0ad1e48b` **FAILED** at `Validate M121 real directional light`, job `120362881111`. Its new 45-fabricated-manifest safeguard passed; that did not substitute for native acceptance.

The genuine Firefox defender #2 received `Hit taken - 34 HP.`, HP100→66, guard100. W3C original online-page observer saw `FROM LEFT` bearing, but the visible threat phases were **HEAVY WINDUP → WINDUP → STRIKE** and visible recovery `attack-recovery / Attack recovery`; there was **no LEFT WINDUP / LEFT SWEEP phase and no directional-attack-recovery / Sweep recovery**. Both unchanged source predicates in `scripts/pvp_browser_flight_runner.mjs:1640–1646` remain unsatisfied. The server dealt damage; the required directional presentation and committed lane are **not proven**. The Firefox observer also logged a shutdown-side `recordThreat` script timeout; this is not sufficient to assign root cause to Firefox, server lane coalescing, or packet loss.

This is the same historical native signature documented under [#311](https://github.com/tehki/myaso/issues/311), previously associated with genuine neutral-input/coalesced directional lane context and W3C held-strafe ordering investigations. Correlation is not proof this exact run has the same code-level cause. Do not alter damage, windup, native HUD assertion, or restore an unverified lane by relabeling an ordinary attack.

Recorded exact runner error / browser transitions: [qa/evidence/m121-run-39938139017.json](../qa/evidence/m121-run-39938139017.json). `node scripts/combat4d-m121-proof.mjs qa/evidence/m121-run-39938139017.json` checks the event transcription and prints **HOLD**. Tests reject fabricated LEFT SWEEP, discarded recovery states, and changed damage/identity/protected outcome. That local fixture is **not independently authenticated solely by JSON**; match its head/conclusion/original logs against GitHub before accepting its provenance. CLI integrity success is never gameplay PASS.

**Routing:** 4A/8A compare true W3C held-strafe and LMB submission lifetime with original World input/attack state; UI10 validates HUD and recovery cues from original server lane; 4B checks server action and coalescing, 4D independently retains red and reenacts only as unwaived exact-head QA.

## Exact native M172/M173 stamina-confirmation race — 2026-10-23

Latest test-only Combat4D #865 exact head `f4b7016214ce7ca4d2808a248426451abbdaa7b7` protected [quality #39942285919](https://github.com/tehki/myaso/actions/runs/39942285919) job `120376453404` **FAILED** at step `Validate M173 confirmed jump-attack chord denial`, within the original **M172 confirmed airborne jump-attack denial** subphase. Its original 4D evidence-integrity step passed and does **not** override the protected native red result.

**Actual original online Chrome + Firefox evidence:** prior first actor real Space+LMB executed original jump attack 16→17→18 and exactly one 42HP hit. In the follow-up low-stamina phase, the original fighter1 ordinary Jump15 began **server tick570**; authoritative stamina had reached 10 after the genuine 14-stamina jump expenditure. The W3C LMB at Chrome epoch `1792753704940` produced a **queued** `jump-attack` at stamina10, then **submitted** client tick346 at epoch `1792753704954`. The eventual original server-acknowledged snapshot at processed client tick361, server tick594, had **stamina12** after ordinary regeneration and `authoritativeAction:0`; the original client correctly staged `confirmed-not-stamina`, **not** `confirmed-rejected`, and no required `Low stamina — jump attack needs 12.` display occurred. No false 42HP airborne conversion is asserted. Native M172 timed out, exactly as [existing issue #604](https://github.com/tehki/myaso/issues/604) describes.

This records a real *test setup / confirmation window timing sensitivity*, **not** proof of an original server bug, fake or lost ACK, or reason to change 14/12 stamina costs, 135ms combat window, or relax denied-feedback lifecycle. To qualify, Combat4A/4B/UI10 must establish genuine W3C jump-only stamina setup and confirm sub-cost authority at the server snapshot; 4D must retain the original queued→submitted→confirmed-rejected→shown chain under real native Chrome/Firefox on an integrated exact head. The original M173 later subphase was **not executed**, because prerequisite M172 failed first. Never report M173's own chord as tested on this run.

Recorded original client trace: [qa/evidence/m172-run-39942285919.json](../qa/evidence/m172-run-39942285919.json). `node scripts/combat4d-m172-proof.mjs qa/evidence/m172-run-39942285919.json` checks the original 10→12 and 346→361 acknowledgement timeline and intentionally prints **HOLD**. Its seven negative tests refuse a fabricated low-stamina outcome, wrong actor, W3C gestures, original server ticks, and a fake successful protected job. Offline fixture integrity PASS is never true game certification and does not authenticate GitHub by itself; independently verify the exact source run and immutable logs.

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
