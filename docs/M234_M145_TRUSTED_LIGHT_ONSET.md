# M234 — anchor genuine M145 spatial choreography to trusted browser light onset

Parent: [M145 root-cause investigation #283](https://github.com/tehki/myaso/issues/283).
Base: M233 merged-main commit `0f13dfc54240660f0dd47319dfc0f76ca74970b7`.

## Evidence and hypothesis

M231 full [quality #38908865589](https://github.com/tehki/myaso/actions/runs/38908865589) once observed real Firefox `PUNISH TARGET #3 → NEAREST #3`, without the required `PUNISH TARGET #1`, despite Rust authoritative #1 jump recovery from tick 366 to 384. M232 and M233 added honest, read-only client/render diagnostics but have not proven a root cause.

One *separately falsifiable* source of fixture skew exists: `runOnlineUiMultiRecoveryFfaFocusFlight` used a trusted Chrome2 pointerdown receipt for **M144 only**, while **M145** started its 100 ms light-to-jump pause concurrently with sending independent WebDriver commands. On a busy runner, the genuine first Chrome2 `pointerdown` can occur later than the command-start clock. That can move the real measured light-to-jump separation away from the intended overlap, possibly shortening the time Firefox has to select the remaining punishable fighter. This is a hypothesis, **not a confirmed explanation** for the original red.

## Exact scope

- Arm the existing M227 loopback-only single-use challenge for both M144 and M145 before launching the single genuine W3C light attack.
- Only after the real Chrome2 browser fires a **trusted left-button pointerdown** and the existing local receiver validates the challenge may the M145 path begin its original **100 ms** pause and issue **one** genuine Space+LMB jump chord to the other browser.
- M144 continues to use the original **25 ms** pause; M145 retains the original **70–150 ms** *measured actual-input* window. Rejection remains strict if real W3C scheduling pushes it outside that window.
- Missing/untrusted/stale receipts fail closed; never launch a backup chord, simulate a DOM event, retry the attack, or shift the server's combat action durations.
- The actual Firefox DOM/ring sampling, M233 replica-to-HUD trace, strict `#3 punish → #1 punish → ordinary #3`, authoritative 60Hz phase checks, 100HP/guard, and 512-player CI capacity are unchanged.
- Four M234 deterministic tests cover trusted receipt, timeout without fallback, exact fixture wiring/lead windows, and unchanged M145 focus/pixel/authority assertions. A dedicated CI gate and the normal full quality suite run.

## Qualification and release

Mark draft until two complete **consecutive** exact-head quality runs succeed, then merge only with the expected head SHA and independently verify merged-main quality (including provenance). Keep [#283](https://github.com/tehki/myaso/issues/283) and [#277](https://github.com/tehki/myaso/issues/277) open until the original intermittent root causes are reproducibly diagnosed and fixed. A green M145 run is not evidence that the intermittent failure is solved. No playable publication, production rollout, synthetic browser input or gameplay behavior change.
