# M233 — real Firefox replicated-state → HUD recovery focus evidence

Parent: [M145 investigation #283](https://github.com/tehki/myaso/issues/283).
Base: M232 independently gated main commit `6480b3e`.

## Evidence gap

M232 captures Firefox's real `MutationObserver` focus-label mutations and gold ring pixels on a **failed** M145 handoff. A red with `PUNISH TARGET #3 → NEAREST #3` and no `PUNISH TARGET #1` still cannot tell whether Firefox ever received #1's recovery, whether the selection logic chose it, or whether the next HUD frame painted it.

Native server ticks prove that #1 was in recovery at the server, but are **not proof of replicated state or rendered UI**. Do not infer root cause from green reruns.

## Acceptance-only changes

- In the `uimultirecoveryspatial` scenario only, `recordAcceptanceState` records **actual state observed at the client** when combat state is delivered (`source: ingress`).
- `updateHud` independently records **actual focus decisions on rendered HUD frames** (`source: hud`), after invoking the unchanged `setFocusTarget`.
- Each snapshot includes original client server tick, local epoch, chosen net ID/mode, other fighters' replicated action and recovery eligibility, and squared world distance. Append only when the observed action/eligibility/focus changes; retain at most 96 events, and emit a summary of only the last 20.
- A genuine strict M145 RED includes `m233FailureEvidence` alongside the unchanged M232 ring evidence, real W3C gesture, action transitions, 100 HP and guard checks and 3-stage focus assertion. The report distinguishes presence of #1 jump recovery at client state ingress, presence during a HUD frame, and actual #1 selection by the HUD. Missing observations remain missing.
- Deterministic tests verify successful handoff, missing HUD selection despite ingress, bounded deduplication, and source wiring. The existing full Rust/JS, real Chrome/Firefox/Chrome2 and 512-player gates still apply.

## Investigation decision table

| Replicated jump recovery | HUD frame jump recovery | HUD chooses jump target | Next investigation |
| --- | --- | --- | --- |
| No | No | No | State delivery/retention, remote action expiry, input-to-server update timeline |
| Yes | No | No | Frame cadence/interpolation across brief recovery window |
| Yes | Yes | No | Actual competing priority: guard-break, parry, knockdown, and nearest recovery selection; spatial eligibility |
| Yes | Yes | Yes | DOM focus-label application, observer scheduling, and actual ring pixel render order |

This is **diagnostic-only**. It does not introduce artificial controls, synthetic focus labels, retries, recovery-time extensions, gameplay behavior, server protocol changes, or playable deployment. A root-cause fix will require a **separate proven failure** and two complete consecutive passing full CI runs on the same head, followed by an independent merged-main quality pass. Keep #283 and #277 open until actual causes are fixed.
