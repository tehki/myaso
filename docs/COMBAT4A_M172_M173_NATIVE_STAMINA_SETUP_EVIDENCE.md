# Combat 4A × Combat 4D — M172/M173 authenticated stamina feedback native setup

**Branch role:** review-only, test-harness input setup; stacked on [draft Combat4A #882](https://github.com/tehki/myaso/pull/882) which itself builds on protected-green [#861](https://github.com/tehki/myaso/pull/861). Not a Combat, World, original game client, v1 or v2 protocol runtime edit. Main #723 alone selects release integration and GO/HOLD.

## Immutable original RED evidence

- [Combat4A #882 exact source quality #39945045073](https://github.com/tehki/myaso/actions/runs/39945045073) genuinely **failed** the `Validate M173 confirmed jump-attack chord denial` quality step; the actual nested first failure was mandatory **M172**, so **M173 did not run**.
- True Chrome/Firefox browser and original Rust World first performed a genuine Space+LMB **42 HP** successful jump attack.
- The second ordinary Jump at World tick561 began with authoritative player stamina24, spent unchanged **14** to reach **10**, and the real airborne LMB pointer went DOWN at epochMs1792754621116/UP at 1792754621157. Original client queued denial at authoritative stamina10 and submitted its real input at clientTick355.
- The first fresh-own authoritative processed-client-tick confirmation showed `processedClientTick365`, action **Idle0**, own World stamina **12**, server tick582. Original `confirmStaminaDenial()` correctly marked `confirmed-not-stamina` instead of showing an unsound below12 rejection cue. This is documented as a separate pre-existing scenario setup race in [issue #604](https://github.com/tehki/myaso/issues/604), including similar prior protected red in a branch without Combat runtime edits. No causality to #882's MMB-only pointer handling established.
- The initial parent failure remains **RED**; this child does not reinterpret it as a test flake, claim automatic pass, or weaken any normative assertion.

## Narrow test setup change, not a waiver

Both existing `runM172AirborneDenialPhase` and `runM173JumpAttackChordDenialPhase` originally accepted an actor with authority stamina anywhere from about **14 to 24/25**, including 24 before the M172 jump. A physical jump at 24 leaves 10, where ordinary authoritative regeneration during input→processed ACK→fresh-own snapshot can legally reach the **12** cost and suppress a denied-feedback cue by the original M167 rule.

Only the accepted *physical pre-action setup window* is narrowed to `COMBAT.jump.staminaCost + 2` through `COMBAT.jump.staminaCost + 5`: **16–19 authoritative stamina** on an actor verified Idle. For original 14-point jump, this leaves **2–5** immediately afterward. The narrower margin offers room for ordinary snapshot/ACK delay while still staying below the extra **12** cost; only the unchanged genuine native CI can verify that it suffices. The existing original held-RMB running/draining, low-stamina regeneration, real Space then genuine airborne pointer LMB / real same-tick Space+LMB, 900/1000ms strict cue timeouts, genuine server processedClientTick and authoritative snapshot, original state transitions, exact 42HP earlier contact, zero phantom hit, and fully strict M167/M172/M173 expectations stay unchanged.

A new additive Node source-regression tests this source-bound setup and its original acceptance requirements; one new CI step runs it without replacing any browser test. **This source test does not establish any real Chrome/Firefox success or authorize release**.

## Acceptance / integration

The child must pass its own exact SHA full native protected suite, including **both** M172 and M173 and all later original M-series, M8 and whitespace. Compare with original RED logs. If the narrower physically achieved pre-jump stamina window still fails, inspect original processed input tick and server snapshot instead of forging a client cue or relaxing the sub-cost check. Preserve previous green #861. The future release-only KeyE/LMB source0+1 authenticated `0x11`/`0x12` stream belongs to Core8A/UI10/Combat4C/8C, not this test-only scenario. No merge into main, deployment, public enablement, restart, stage or GO.
