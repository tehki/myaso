# M24 — Cross-browser authoritative dodge

## Objective

Prove that a real browser defender can evade an authoritative attack through the existing dodge i-frame mechanic.

## Scenario

- Chrome and Firefox connect concurrently to one loopback authoritative shard.
- The lower authoritative player ID is the attacker; the other client is the defender.
- Both clients approach through ordinary movement input.
- The attacker starts a normal attack from inside authoritative hit reach.
- The defender reacts only after its browser observes authoritative `AttackWindup`.
- The defender starts ordinary dodge input after a bounded 20 ms observed-windup threshold, with its movement vector rotated perpendicular to the attacker line. At the normal input cadence this prevents same-sample roll overtravel while preserving more delivery margin than the historical 35 ms threshold. Until authoritative `Dodge` is observed (or the attack window ends), the same request may be carried by subsequent normal input samples so a single transport sample cannot decide the proof; no block input is used.

## Acceptance

Both browsers must independently observe:

- two distinct authoritative player identities;
- the defender in `Dodge` while the attacker is `AttackActive`;
- center distance at or below the server hit envelope (94 world units);
- facing delta inside the server attack arc;
- defender HP remaining exactly 100;
- defender guard remaining exactly 100;
- no defender block and no attacker parry stun;
- sustained snapshots, acknowledgements and inputs;
- p95 browser frame interval below 25 ms.

## Acceptance stabilization

CI #169 exact-head retry exposed a transport/timing flake in which the defender eventually entered authoritative `Dodge`, but the single request sample did not overlap `AttackActive` and the first strike landed. The harness carries the already-triggered ordinary dodge request until authoritative Dodge confirmation or the attack window ends.

CI #584 and its bounded exact-head rerun #585 reproduced the inverse Wilds-roll timing failure: delaying the reaction to 60 ms preserved the 94-unit geometry but left too little authoritative delivery margin, so earlier strikes could resolve before the dodge even though a later exchange eventually proved the iframe. M24 stages the pair closer, stopping approach at about 54 world units and allowing attack commitment at 60 units. M125 removed the old 35 ms delay entirely, which exposed the opposite edge on CI #595: a same-sample 690 u/s perpendicular roll could travel outside the unchanged 94-unit hit envelope before `AttackActive`. M126 uses a 20 ms observed-windup threshold, which maps to a later ordinary input sample without restoring the old delivery penalty. Acceptance is not weakened: the proof still requires live `AttackActive`/`Dodge` overlap inside the unchanged 94-unit hit geometry with untouched 100 HP / 100 guard throughout.


## M113 control-schema adaptation

M24 now preserves its original authoritative iframe/geometry proof under the Wilds control schema. The defender commits the dodge primitive with its **facing vector set perpendicular to the incoming strike**, matching the player-facing rule that a wheel-forward roll always travels toward the mouse pointer. The movement vector is deliberately redundant and cannot steer the committed roll.

The acceptance still requires a live in-range attack-active/roll overlap, unchanged defender HP/guard, verified geometry, and no accidental block/parry. A successful forward-roll body collision may legitimately knock the attacker down under the M113 Wilds control schema; that knockdown is orthogonal to the iframe proof, while the rolling defender must not be knocked down.
