# Combat 4 / UI 10 — M193/M205 genuine server-tick parry vs block contract

**DRAFT REVIEW-ONLY** based on [Combat4 directional source fix #749](https://github.com/tehki/myaso/pull/749). No live protocol/server/browser code, game rule, timing constant, W3C test or acceptance assertion changed here. For [M193 owner issue #214](https://github.com/tehki/myaso/issues/214), [M194 #217](https://github.com/tehki/myaso/issues/217), [Main Pre-Alpha #695](https://github.com/tehki/myaso/issues/695), and [Combat #696](https://github.com/tehki/myaso/issues/696).

## Real native CI failure — precise authoritative clock

At unchanged PR #749 `0b84181083fca763db11ac7b31e304af93ede059`, protected [quality #39762276583](https://github.com/tehki/myaso/actions/runs/39762276583) **FINISHED FAILURE** on step `Validate M205 repeated M201 server-tick FFA punish proof`, during **nested real M193 third guard-break exchange**. Earlier strict genuine Chrome+Firefox native **M121_REAL_DIRECTIONAL_LIGHT `ok:true`** on this same SHA: original one 34HP hit, player opponent100→66, UI genuine `Left sweep committed` and directional recovery. So M121 fix has meaningful native evidence but whole CI still red.

This M205 trial `2/3`, third exchange's original Rust action logs:
- First: defender `Block` enters server tick **279**, attacker active `tick288` → guard -38, guard 100→62 (earlier `HeavyAttackWindup` ticks278–280 until `AttackWindup`).
- Second: defender `Block` tick **314**, attacker active `tick322` → guard -38, guard 62→24.
- Third: defender `Block` tick **350**, attacker attack becomes active at **tick356** → real `M201_AUTH_PARRY tick356`, attacker stunned, guard stays24, hp100. Original 125ms early parry window correctly activates. Chrome real LMB down/up, trusted Firefox wheel prior to Chrome release all recorded; a valid wheel-to-release ordering is NOT sufficient to guarantee server contact happens after the parry expires.

These are differences of **9, 8, and 6 tick indices**. At genuine 60Hz, server action's *elapsed* time also includes the tick on which Block begins; never claim that cross-browser JavaScript Date.now timestamps are this clock. Native earlier #740 M205 had the same third-exchange signature (defender Block tick422 → PARRY tick428). The exact mismatch is reliable enough to route to UI 10's real input/W3C schedule and Core8A's admitted input timing; it is NOT proof of a mechanical bug or flaky disconnected mock.

## New source-owned action contract

Added `server/tests/prealpha_m193_server_parry_boundary.rs`, invoking **only original `World::set_input`, actual 60Hz `World.step()`, and original `CombatEvent::{Parry,Block,GuardBreak}`**. No fabricated receipt or fighter guard/HP modification.

- If current defender's real Block begins two ticks AFTER original attacker light windup began, block-start-to-hit indices differ by **6** ticks; its actual `action_elapsed_ms` is still inside 125ms. Authoritative Combat correctly parries, stun attacker, leaves guard100 and HP100.
- If Block begins on original attacker press tick, block-start-to-hit difference is **8** ticks: actual Block elapsed exceeds 125ms, so the genuine light deals **-38 guard**, no parry/HP, guard100→62.
- Three independent real light actions, each with a correctly already-aging original Block, reproduce **100→62→24→0** and the original real `GuardBreak`, no parry, no HP damage and no hand-edited guard.

**Result:** new three Rust actual World tests PASS, full inherited source regression verification required. This is evidence that original mechanics are enforcing their defined windows; it does not prove that the browser's separate W3C wheel and press/release will always hit them. Any attempt to modify original 125ms parry, 240ms short block, -38 guard, or required three genuine exchanges instead of coordinating input timing is outside this PR and violates the strict release gate.

## UI 10 / Core 8A handoff (not a code change)

Follow current server-owned `M320_GUARD_BREAK_AUTH_TRACE` for same-clock `Block` start, `AttackWindup` start and hit/parry tick; add read-only **server ingress receive tick** for authoritative admitted Firefox wheel-action and Chrome LMB-release **if technically feasible**. For each actual native exchange, prove Block action elapsed at contact is **strictly beyond 125ms and before Block expires**. Do NOT use WebDriver ACK as proof of mouse/wheel delivery, pad browser telemetry artificially, retry failed exchanges inside one test, or fabricate a screen cue. The M193/194 issue owners should coordinate genuine timing with UI 10 and Core 8A, preserving the existing mandatory M193/M194/M205 test assertions.

**Still HOLD:** Main's canonical single v2 0x11/0x12 schema #723 and fully authenticated real v2 input, Core8C actor lifecycle, actual Chrome+Firefox/two–four independent hosts, Pre-Alpha assembled Silver/R4/Chat default-OFF acceptance, exact-head full protected green, immutable stage+rollback and explicit owner/Main GO. NO main merge/production v2/deploy/restart.
