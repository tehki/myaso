# M54 - FFA Incoming Threat Awareness

## Objective

Answer the FFA readability question: **who is attacking me right now?**

M53 made the top-right HUD meaningful in multiplayer by focusing the nearest living rival. M54 adds a separate short-lived incoming-threat cue so the player does not have to infer whether a remote attack tell is actually aimed at them.

## Threat rule

Threat detection is browser presentation derived only from authoritative replicated fighter state.

A remote fighter threatens the local fighter only when all of the following are true:

1. the remote fighter is in authoritative `AttackWindup` or `AttackActive`;
2. both fighter positions and the attacker's facing are finite;
3. local fighter center is within `attack.reach + fighterRadius`;
4. the local fighter lies inside the attacker's authoritative attack arc;
5. the local fighter is alive.

When multiple fighters threaten simultaneously, selection is deterministic:

1. active strike before windup;
2. nearest attacker;
3. lower authoritative network ID.

The selector returns a primitive network ID and allocates no presentation object on the render hot path.

## UI

The arena shows a centered warning only while the authoritative threat exists:

- `THREAT #<netId> · WINDUP`
- `THREAT #<netId> · STRIKE`

The cue clears when the attacker leaves windup/active state, leaves reach/arc, or the local fighter dies.

This cue is independent from M53 nearest-rival focus. A fighter can be the nearest rival without threatening the player, and a threatening fighter can temporarily take threat priority without changing the focused HUD target.

## Authority boundary

M54 does not:

- choose an attack target for the server;
- modify hit detection;
- modify attack reach, arc, damage, timing, movement, or facing;
- inject combat state;
- change score or match lifecycle;
- change replication, snapshots, or protocol fields.

Combat remains fully server-authoritative.

## Deterministic coverage

JavaScript coverage proves:

- active attack beats windup when both threaten;
- attacker must face the local fighter;
- attacker must be inside authoritative reach;
- equal-priority/equal-distance threats tie-break by lower network ID;
- dead local fighters expose no threat.

## Real-browser acceptance

The M54 `uithreat` flight starts three real clients:

- Chrome as fighter #1;
- Firefox as fighter #2;
- isolated second Chrome as fighter #3.

At deterministic spawn spacing, #1 moves right using genuine keyboard input and attacks #2 with a genuine left-mouse pointer sequence.

Acceptance requires:

- #2 records `THREAT #1 · WINDUP`;
- #2 records `THREAT #1 · STRIKE`;
- #1 never receives a self-threat cue;
- distant #3 never receives a threat cue from #1;
- the same exchange resolves to the ordinary authoritative 34 HP hit on #2;
- #1 and #3 remain at 100 HP;
- real pointer provenance is preserved.

The UI observer records DOM threat transitions; it does not extend combat windows or poll the critical attack state into existence.

## Performance

The browser computes threat from the existing authoritative state `Map` with scalar math and returns one primitive net ID. DOM text is changed only when threat identity or phase changes.

## Scope / risk

Base is M53 frozen exact head `d4099ff65f33ae4796b25a20ef0275e3aacd0210`, validated by FULL quality CI #195 / run `35435924914`.

M54 changes browser presentation, deterministic JS coverage, real-browser acceptance, CI, and documentation only. It does not change server simulation, combat rules, match rules, networking protocol, snapshot size, persistence, deployment, public bind, or runtime activation.

## Inherited acceptance stabilization

M54 CI #196 first attempt stopped at inherited M36. Firefox delivered the genuine `KeyS + Space` sequence, but no authoritative dodge action occurred and the ordinary 34 HP strike landed. One exact-head rerun cleared M36 without any code change, confirming the established headless-input timing class.

That same rerun then exposed an inherited M52 acceptance issue under slower reliable/UI convergence. The intended first kill (#1 -> #2) completed. During the second-killer phase, #3 killed #2, but the harness continued issuing attacks while waiting for the two-row kill feed and 1-0-1 scoreboard to converge. That allowed #3 to kill the respawned #2 again, reach the M49 two-kill target, and trigger match-over/reset. The reset correctly cleared the kill feed, so the acceptance eventually failed with empty rows.

The M54 branch stabilizes only that acceptance control flow:

- capture the target's authoritative `DEFEATED` transition count before each kill stage;
- stop issuing attacks immediately when HP reaches 0 or a new `DEFEATED` transition appears;
- after death is proven, wait separately for reliable kill-feed and score convergence;
- allow the target to respawn while waiting for reliable evidence, because the death itself was already captured;
- retain the strict expected killer/victim rows, consecutive event sequence check, 1-0-1 score state, local identity markers, and no-match-overlay requirement.

No kill, score, HP, death, feed row, or event is injected. Combat damage, movement, action timing, respawn timing, reliable transport, match rules, and acceptance thresholds are unchanged.

### M36 cross-driver timing correction

Fresh CI #197 on corrected M54 head `bee62357c4a092447d002a3536480068221d98a4` failed inherited M36 again before reaching M52/M54. Unlike the earlier one-off miss, the third retry still delivered all three real Firefox `KeyS + Space` sequences but the final authoritative strike landed for 34 HP. The same job also logged a Firefox render-script timeout, confirming that serial cross-driver command latency can consume the 135 ms attack windup even when input provenance is correct.

M36 first moved to concurrent cross-driver dispatch, but CI #200 and its same-head rerun showed that a 70 ms pause inside Firefox's W3C action sequence still inherited Firefox command-start jitter. Both failures preserved genuine KeyS + Space provenance while the ordinary 34 HP strike landed.

CI #202 showed that the 50 ms Node-side stagger still left too little margin when Firefox command startup was slow: the exact real KeyS + Space events were delivered, but the strike resolved for 34 HP before authoritative Dodge.

The current M36 choreography therefore maximizes the real-input scheduling margin:

- dispatch Chrome's genuine pointer-down request and Firefox's genuine W3C KeyS + Space sequence concurrently;
- keep only a 20 ms driver-side pause before the Firefox Dodge keys;
- keep the critical iframe/strike window free of browser-state polling;
- retain the existing three-attempt fail-closed behavior and clean-vitals/parry guards.

Fresh CI #203 on exact head f812fee18598b2c07330a4a2265d766d49d17ae7 passed M36 with this choreography. This is harness timing only. Dodge duration, 118 ms iframe duration, 135 ms attack windup, attack active/recovery, movement, hit detection, and acceptance criteria are unchanged.

### M53 post-hit convergence correction

CI #198/#199 exposed inherited M53 retry amplification: after #1 had already landed the authoritative 34 HP hit on #2, the harness could continue attacking while waiting for one exact focus label and eventually kill #2.

Fresh CI #201 showed why that label was unstable: after the same authoritative hit, #2 could legitimately report NEAREST #3 while #1 and #3 both reported damaged #2 at 66 HP. The nearest selector remains deterministic for every snapshot, but the exact post-hit victim focus can settle on either healthy rival as replicated movement/knockback geometry advances.

The final M53 acceptance checks the stable product invariant:

- initial spawn remains strict: #1 -> #2, #2 -> #1 by lower-ID tie-break, #3 -> #2;
- after damage, #1 and #3 must both focus damaged #2 at 66 HP;
- #2 must focus either healthy non-self rival (#1 or #3) at 100 HP;
- if complete HUD evidence lags, the harness stops issuing attacks as soon as authoritative #2 = 66 HP is proven and waits separately for convergence.

No focus algorithm, tie-break rule, knockback, damage, movement, or gameplay state is changed. Deterministic selector unit coverage remains strict; only the browser acceptance stops assuming one transient post-hit snapshot ordering.
