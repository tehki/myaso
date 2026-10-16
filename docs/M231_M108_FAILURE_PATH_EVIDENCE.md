# M231 — preserve server-side M108 evidence on a failed genuine browser flight

Tracking: [#281](https://github.com/tehki/myaso/issues/281), parent unsolved [#277](https://github.com/tehki/myaso/issues/277). Baseline is certified [M230 `0e917b9`](https://github.com/tehki/myaso/commit/0e917b9f0c4abafc422e1b136a3c9a94f6b1abed) and independent [150/150 main CI](https://github.com/tehki/myaso/actions/runs/38890709961).

## The lost-red problem

M230's same-session/same-original-action-tick proof runs only **after** the real Chrome/Firefox strict heavy-hit acceptance returns successfully. Previously a genuine M108 failure (real W3C `KeyE` press/release, intentionally discarded first datagram, but no 46 HP hit) would throw *before* any M229/M230 diagnostic summary was emitted, leaving follow-up investigators to infer failure from a large log.

M231 adds exactly one **failure-only** evidence report around the existing strict real-browser acceptance. The original `runOnlineUiHeavyStrikeFlight` is still called once and retains exact authoritative HP and message requirements; an error is rethrown **by identity**. No retries, synthetic input or softer success path.

## Output and meaning

When M108 itself throws, the already-captured loopback server stdout is inspected for genuine M63 dropped action and M229 accepted heavy lines. The bounded `M231_M108_FAILURE_PATH_EVIDENCE` record classifies:

- `no-drop-or-acceptance-observed`: neither marker present; the real flight may have failed before any action and no network cause can be inferred
- `first-drop-without-observed-heavy-acceptance`: exactly one action drop, no server accepted heavy line; possible lost replay **or missing logging**, not by itself proof of three lost datagrams
- `acceptance-without-observed-original-drop`: accepted heavy with no corresponding deliberate initial drop log
- `original-heavy-accepted-but-browser-flight-failed`: M230 strict matching confirmed the same session + original heavy action tick and three-copy replay window, yet the strict browser proof still failed (simulation or observer remains to be investigated)
- `original-drop-and-acceptance-not-correlated`: one of each, but original tick/session/window/order do not match
- `ambiguous-multiple-server-events`: duplicate/multiple drop or accepted records cannot be paired uniquely
- `server-diagnostic-unavailable`: reading or parsing already-captured server logs failed

Diagnostics **never** report a passing result, don't claim an inferred root cause and never affect the original failure. If report output fails, M108 still raises its original exception. On a fully successful M108 flight there is no failure report and the existing M229/M230 evidence and 46HP logic are unchanged.

## Tests / release gates

The pure Node tests verify missing, recovered, mismatched, reversed, duplicated, and cross-session ingress; one strictly preserved original error with no rerun; reporting/output errors that cannot hide the real red; success that does not trigger diagnostics; and static guards for unchanged authentic browser hit acceptance. Dedicated plus full CI gates run the tests.

Require two complete full exact-head quality successes, then independent post-merge `main` provenance/capacity quality. Keep [#277](https://github.com/tehki/myaso/issues/277) open until a genuine root-cause fix is demonstrated.

**No gameplay, damage, movement, timing, network wire protocol, input resend logic, Rust server, browser events or production runtime changed. No playable publication or deployment.**
