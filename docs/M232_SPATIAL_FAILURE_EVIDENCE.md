# M232 — preserve M145 spatial recovery failure geometry

Parent: [M232 issue #283](https://github.com/tehki/myaso/issues/283).
The exact-head M231 [CI #38908865589 attempt 1](https://github.com/tehki/myaso/actions/runs/38908865589) failed authentic M145 three-browser spatial recovery handoff, despite server-side phase trace: fighter #3 light-recovery ticks 360–376, fighter #1 jump-recovery 366–384. Real Firefox observer logged `PUNISH TARGET #3 → NEAREST #3` but not the required `PUNISH TARGET #1`. Same unchanged M231 head then passed full CI in attempts 2 and 3, and merged at `027e52a`.

## Why new evidence is needed

The existing spatial acceptance harness already installs `armRecoveryHandoffSampler(observer)` in genuine Firefox and reads `#focus-label` changes via native `MutationObserver`, sampling the real canvas ring pixels and centroid on each **observed punish label**. It retrieves `spatialSamples` before enforcing the strict focus sequence, but its earliest failure throws without this independent evidence. A real red therefore could not show whether Firefox actually rendered a hidden/unsampled `PUNISH TARGET #1` label or whether it never appeared at all.

## Diagnostic-only implementation

The strict spatial M145 focus-sequence failure now includes a `spatialFailureEvidence` member, **only on a failed spatial M145 condition**. This contains bounded, normalized and observed-only metadata: total MutationObserver sample count, up to 4096 inspected samples and 24 recent excerpts, count of actual light/jump punish labels seen, first actual sample for each label, and maximum canvas ring pixels seen. It never invents missing samples or promotes a ring proof.

The existing `focusTransitions`, full original `evidence`, server M201 trace, strict three-stage focus order, genuine W3C Space+LMB/LMB timing, 100 HP/guard staging, and spatial geometry acceptance conditions all remain untouched. The non-spatial M144 failure record is unchanged. The normal game server, clients, protocol, WebDriver gesture commands and production runtime are unchanged.

Tests cover observed missing jump ring vs authentic two-ring transition, timestamps/centroids, bounds and invalid samples, and source wiring strictly to the spatial failure. A focused Node CI gate plus the normal complete Rust/JS and genuine Chrome/Firefox/Chrome2 M145 integration suite are mandatory.

## Release gates

Two consecutive full exact-head CI passes, then independently successful merged-main provenance quality. **M232 stays open to track the real intermittent M145 focus problem** until a root cause and verified fix exist; this PR adds evidence, not a gameplay or timing fix. [M229 #277](https://github.com/tehki/myaso/issues/277) remains separate. Do not open/publish the playable build or deploy production.
