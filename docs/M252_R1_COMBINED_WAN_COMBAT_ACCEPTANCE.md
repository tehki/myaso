# M252 — R1 combined acceptance candidate, no runtime activation

## Why a separate integration branch
The user-facing R1 version must not ship a render clock that starts at a phantom tick zero. M251 fixed that defect and proved two live clients can connect without hours of visual lag (see #293 and PR #308), but its exact-head full quality #39126569202 reached the unchanged M159 strict four-client simultaneous knockdown punish and failed twice at actual 60Hz server action-active tick 477 / 486 after first knockdown tick 459 / 471. Genuine attack activation exceeded the fixed 260ms overlap in the failing tests. No easing of acceptance or combat balance is allowed.

Two already proposed independently reviewed-by-CI test-input timing changes:
* M246 [#302](https://github.com/tehki/myaso/pull/302): real R1 LMB light commits on genuine **pointerUP**. Reduce the M159 flight's W3C pointerDOWN→UP intentional hold from 40ms to 5ms so the action starts earlier without changing the original 260ms knockdown, 135ms windup or exact 34HP selected-target hit requirements.
* M249 [#305](https://github.com/tehki/myaso/pull/305): remove the obsolete fixed 48ms delay **only** from M194 guard-break browser scheduling, after a challenge-attested trusted native Firefox wheel receipt and before the single genuine Chrome WebDriver click. Exact-head quality #39116120254 PASSED all 159 steps on standalone M249.
* M251 [#308](https://github.com/tehki/myaso/pull/308): ignore pre-snapshot placeholder server tick zero for the render clock, anchor to first nonzero genuine authority, collect bounded optional render-gap diagnostics; no altered post-bootstrap 1.45x rate, netcode or combat.

M252 stages these proven/source-attested independent branches **together**, reusing the strict M246 and M249 contract tests verbatim and the exact R1 clock fix. It is an **integration proof**, not a replacement for separate PR traceability or approval. Parent branch/source M251 is unchanged. This isolated integration PR targets `main`, with the same GitHub governance and mandatory merged-main quality.

## Required proof
- Source and JS tests verify one authentic roller wheel, one authentic punisher W3C down/up, real event.isTrusted defender wheel, exactly one Chrome click; no synthesized input or weaker assertions.
- Genuine server proof for M159 requires both 260ms knockdowns ACTIVE at the time of single 34HP impact, distinct untargeted defenders at 100HP/guard, authentic roll provenance and recovery.
- M194 must retain 5 independent 100HP/-38 guard/zero-parry repeats, M146/M147/M41 must remain strict.
- M251 first real nonzero authoritative tick must reset presentation clock without altering subsequent bounded catch-up or local-player authority.
- Exact-head full Rust/Chrome/Firefox 159+ CI and subsequent merged-main quality, real public native 2–8 participant combat, valid review and branch protection.

No service restarts, network rules, VPS changes, production files or deployment.
