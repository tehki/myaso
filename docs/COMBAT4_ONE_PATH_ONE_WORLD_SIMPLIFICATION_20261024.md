# Combat 4 — One Path, One World (P0 simplification contract)

**Date:** 2026-10-24  
**Tracking:** [#1011](https://github.com/tehki/myaso/issues/1011), [Pre-Alpha #695](https://github.com/tehki/myaso/issues/695), [Combat P0 #696](https://github.com/tehki/myaso/issues/696), [gesture protocol #723](https://github.com/tehki/myaso/issues/723), [Core #405](https://github.com/tehki/myaso/issues/405)  
**Starting point:** protected `main` `6fa59b649112c272bcbc018b4a32bf963f9a5bba`  
**Status:** DRAFT, review-only. This document does not change gameplay, protocol, CI, release scope, or production behavior.

## Problem to solve

Combat Pre-Alpha has valuable genuine gameplay and 60 Hz Rust World tests, but release qualification is stalled by interacting input and authority failures and by multiple proposed solutions stacked across Combat 4A/B/C/D and Core 8A/B/C. More proposals do not make the played game more reliable. Reduce **active** architecture and converge on the earliest measured faulty layer; retain real-world defensive tests.

The baseline `src/browser/left-button-charge.mjs` explicitly implements *release-to-strike* short LMB; [#695](https://github.com/tehki/myaso/issues/695) instead requires light windup initiated by pointerDOWN and held-LMB deliberate-release heavy. The gap is open, not accepted behavior.

## One execution pipeline

```text
Genuine physical DOM pointer/keyboard/wheel events
  → 4A event-preserving input intent (edges and continuous state separate)
  → Core8A one authenticated QUIC transport / bounded replay
  → Core8B current actor-session-incarnation identity
  → Core8C one admitted input/coalescing decision
  → 4B original single Rust World @ 60 Hz: state, action, damage once
  → Core8 original World event and snapshot replication
  → 4C/UI/Sound only for authorized actor/victim/observers
  → 4D independently verifies native action→World→presentation
```

**Hard invariants:** World steps once; World commits damage once; client elapsed time/ACK cannot authorize damage; actor identity is server-bound; no stale-generation attacks; one LMB gesture at most one HIT; presentation cannot infer HIT ownership from an HP delta. Any non-live HIT proposal stays dormant.

## Concrete ownership / no parallel production services

| Boundary | One owner | Accepts from | Produces | Must not |
| --- | --- | --- | --- | --- |
| DOM capture | Combat 4A | physical events | press/release/cancel + current movement state | invent movement or miss a genuine action due to 30 Hz gaps |
| Authenticated wire | Core 8A/8B | ordered action intent | accepted actor/source-tagged envelope | run competing live v1, `0x11`, `0x52` gesture authorities |
| World admission | Core 8C + Combat 4C | trusted accepted samples | one action-bearing input to World | overwrite attack direction with newer neutral sample |
| Combat mechanics | Combat 4B | admitted World intent | deterministic action transitions + 34/46 HP committed events | second damage path or unsafe release-to-strike fallback |
| HIT/snapshot presentation | Core 8 + Combat 4C | original committed World events | correctly scoped feedback | independently execute damage, invent attacker credit |
| QA/release veto | Combat 4D | original source, native browsers, actual World logs | exact-SHA PASS/HOLD | change expected HP, reach, W3C stimuli, or borrow sibling green |

The proposed `0x11` gesture+`0x12` ACK remains experimental/default-OFF until the one-wire decision in #723 and authorization by Main0. Legacy `0x52` is not an alternative active wire. HIT v1 packet types 5/6 are likewise nonpublic/nonlive pending explicit Main0 authorization; offline lease or receipt success does not imply delivered HIT.

## Preserve approved timings/controls until owner explicitly changes them

| Action | Existing Pre-Alpha approval | Required negative |
| --- | --- | --- |
| LMB quick press | genuine pointerDOWN begins 135 ms server-owned light windup, 34 HP on real hit | never require pointerUP to start light |
| LMB valid sustained hold | only **unlanded** light may upgrade, before light reaches active state; server-measured READY at 320 ms | no light first, heavy second; no client stopwatch damage |
| LMB deliberate release | READY heavy commits 46 HP only on authenticated RELEASE | no auto-heavy merely because 320 ms elapsed |
| CANCEL/focus loss/rejoin | full pending gesture invalidation | no phantom/stale attack |
| KeyE | separate server-scoped heavy input source | do not confuse KeyE with held-LMB release |
| RMB/wheel/Space | kick, parry/roll, jump/jump+LMB semantics retained | no fake DOM events or broadened timing window |

**Timing design tension:** light active after 135ms and heavy charge at 320ms can coexist only when a valid held-gesture upgrade suppresses an *unlanded* light before light active; if network loss or out-of-order input makes that unprovable, fail closed and escalate the exact counterexample under #723. Never silently redefine LMB behavior or shrink the 135/320ms numbers.

## Execute in five narrow integration passes

1. **Capture truth at source (4A + 4D).** For genuine M121 KeyD (~291ms pressed yet client sent neutral), M144 Space+LMB, M156 short-click, and M33 wheel parry, correlate physical timestamp, original 30 Hz sender, QUIC admission, World action/HIT, and browser observation. Fix earliest faulty layer. Preserve original failure evidence.
2. **Converge direction once (4B + 4C + Core8C).** Start design review from ingress-aware [#998](https://github.com/tehki/myaso/pull/998), not a blind merge. Add negative/positive for both separate `World.set_input` calls and RELEASE→NEUTRAL samples **coalesced in one authenticated datagram**. Do not stack competing [#1000](https://github.com/tehki/myaso/pull/1000) latch semantics without proving need.
3. **Converge exactly one LMB gesture authority.** Resolve #723, restore pointerDOWN/upgrade/release/cancel semantics through original World, keep 34/46HP, repeated fast taps, pointer cancel and reconnect proofs. Any protocol switch remains opt-in/authorized.
4. **Deliver original-world HIT without extra simulation (Core8 + 4C).** Review Core [#1008](https://github.com/tehki/myaso/pull/1008) and presenter [#1010](https://github.com/tehki/myaso/pull/1010) on compatible ancestry. Server-verified actor lease + recipient-scoped contiguous bounded reliable delivery; 3-player attacker/victim/spectator and 4-player reconnect negative, not a new HIT service.
5. **One exact-head acceptance (4D + Main0).** Mandatory original M111/M121/M144/M145/M155/M156/M33/M41/M194 and M147, 2/3/4-player real Chrome/Firefox World, full protected CI, independent 4D verdict, then human WAN/staging/rollback gates. Every red remains visible.

## Release slice vs full approved release

For developer iteration, run a **small playable slice first** (two real authenticated browsers in minimal arena, WASD, facing, light/heavy, kick, parry, roll, server damage, death/rejoin, Silver Knight/HUD/sound). Then add the approved dash/sprint/jump/directional/punish and 3–4-player acceptance. **This is an engineering order only, not a release waiver.** #695 stays authoritative for public Pre-Alpha 0.1. Greyhaven/physical sword/items/Magic/economy/NPCs are First Playable Alpha track and cannot delay this arena track.

## Branch and evidence rules

- Inventory active vs dormant vs diagnostic-only vs superseded PRs before any change.
- Select **one** Main-compatible ancestry, one accepted solution per defect, and one exact commit to qualify.
- Publish source SHA, actual failed/passed workflow URLs, original World tick/HIT and native browser evidence; no green inheritance.
- Never weaken CI, test predicates, true physical input, HP, stamina, reach, knockdown, parry, or stun windows to obtain a pass.
- No merge, staging, production deployment, or public wire registration from Combat 4 without Main0 GO. Independent Combat 4D may veto the candidate.

**Done only when:** one source and one World account for legitimate physical action→authenticated ingress→original World action/HIT→right recipient consistently, full protected exact-head quality and strict native acceptance are green, and Main0 approves the release.
