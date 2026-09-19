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

M36 therefore now coordinates its two genuine inputs without serial WebDriver round trips:

- attacker pointer-down and defender W3C dodge sequence are dispatched concurrently;
- the defender sequence itself carries a 70 ms WebDriver pause before `KeyS + Space`;
- this places dodge start inside the existing 135 ms windup while the 118 ms authoritative iframe overlaps attack activation;
- no browser-state polling occurs during the critical resolution window;
- the existing three-attempt fail-closed behavior and clean-vitals/parry guards remain unchanged.

This is harness timing only. Dodge duration, iframe duration, attack windup/active/recovery, movement, hit detection, and acceptance criteria are unchanged.

### M53 post-hit retry correction

CI #198 validated the new concurrent M36 timing and the M52 death-first convergence fix, then exposed inherited M53 retry amplification: once #1 had already landed the authoritative 34 HP hit on #2, the harness could continue attacking while waiting for the complete focus-HUD state and eventually kill #2.

An initial interpretation attributed the remaining focus mismatch to post-hit knockback. Fresh CI #199 disproved that hypothesis: after the first 34 HP hit, #2 still correctly reported NEAREST #1, while #1 and #3 both reported damaged #2 at 66 HP. The product focus selector was already correct.

The final acceptance correction therefore keeps the original M53 focus expectation and changes only retry control:

- #2 remains expected to focus #1 after the first hit;
- #1 and #3 still must focus damaged #2 at 66 HP;
- if the complete focus state has not converged yet, the harness checks the authoritative three-player HP state;
- once #2 = 66 HP is proven with both other fighters healthy, it stops issuing attacks and waits separately for focus-HUD convergence.

No focus algorithm, knockback, damage, movement, or gameplay state is changed. The correction prevents a UI-convergence delay from generating extra combat.
