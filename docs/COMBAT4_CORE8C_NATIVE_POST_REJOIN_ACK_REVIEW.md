# Combat 4 × Core 8C — protected 165/165 green; genuine four-browser ACK-gate follow-up

**DRAFT / reviewed QA-only cross-owner integration.** Original Combat4 source [#767](https://github.com/tehki/myaso/pull/767) exact `14af8caeba132edd97c5025ead583ba5bc281baa` already passed its [full protected quality 165/165](https://github.com/tehki/myaso/actions/runs/39776356383), and Core8C original actor lease [10/10](https://github.com/tehki/myaso/actions/runs/39776356396). Its **separate** original four real browser ghost-removal gate [#39776356457](https://github.com/tehki/myaso/actions/runs/39776356457) was genuinely RED after actor retirement/Canvas ghost removal. Do not hide the separate RED behind overall quality GREEN.

## Native red, exact real evidence

Four native W3C clients (Chrome, Firefox, Chrome, Chrome) joined original cert-pinned Rust server original 4-seat max, actor IDs 1/2/3/4; all four made honest W3C WASD inputs with live original v1 ACK precondition. Browser #2 Firefox quit; voluntary abrupt browser QUIC idle timeout delayed free seat ~35.292s. A real new Chrome #5 then connected on attempt 3 and genuine three surviving canvases and HUDs rendered only #1/#3/#4/#5, **zero #2 ghost**, 8+ real recent frames apiece. Thus four-client admission, old actor removal and Canvas ghost-rejoin **succeeded** in that failed workflow.

The test's *last separate* post-departure input health assertion timed out on surviving Chrome #1. Its DOM `#event-text` still displayed **"Online - player #1 - server tick 2676"**, the same value from initial precondition, even after roster had advanced to show #5. The original HUD text is updated in `web/online-game.mjs` only by initial connection/onAck reconciliation, and `web/authoritative-client.mjs` specifically defers `onAck` until an adequately fresh authoritative own-player snapshot via `createOwnSnapshotAckGate()`. Transport `onProcessedAck` is independent of this and does not prove a Combat HIT. Diagnostics reported `Stale-own ACKs 1667, Deferred reconciles 3350`, evidence of an ACK-to-own-position alignment backlog, **not** proof that the actor session had died. Prior movement used `W` and could bring actors against north boundary; repeating `W` there does not guarantee a different own-position snapshot for the ACK gate.

## Source-owner resolution reused without test waiver

Original Core8C head [#733](https://github.com/tehki/myaso/pull/733) `8dd4d5a17ccf36e343f2bf2900aab591ba0d96b1` contains 3 newer, original owner-authored commits (7d86efb, 33ddf51, 8dd4d5a). Cherry-picked exactly onto Combat4's protected-green #767 head without conflicts or production changes:
- Native test helper `realWasdAndAck(sid,label,moveKey="w")` still delivers **real W3C keyDown/Up** for 330ms and demands a strictly later server-owned input/own-position tick.
- The post-departure input must use **`S`**, moving genuinely opposite from possible north-wall saturation, without bypassing the actual ACK alignment, server-issued current actor ID, Canvas ghost checks or the original 35s abrupt close.
- Added Core8C's genuine native alternate Firefox-survivor variant (Chrome #2 disconnect) in owner CI matrix and owner's original evidence memo.
- Core8C's **own exact-head original real native CI #39775557399 SUCCESS**, and independent Core8A/8C focused checks passed at its SHA, though original Core8C full protected quality was a separate FAIL at an unrelated Combat gate and is NOT transferred.

## Local joined-source checks and next release gates

This new child on Serj Linux passed **591/591 complete Node**, all locked original Rust including actual 4×real QUIC actor leave+new ID and genuine WebTransport, strict `cargo clippy --all-targets -- -D warnings`, `cargo fmt --check`, original Core8C native script `node --check` and exact parent-to-new-head whitespace. No production changes, new port or public listener.

The **new exact-head** original native Core8C Chrome/Firefox matrix and full protected `quality` must both pass independently; parent #767 quality green and Core8C #733 native green cannot be inherited. This is still original legacy **v1** actor lifecycle QA, not real v2 online Combat.

Core [#723](https://github.com/tehki/myaso/issues/723) one canonical authenticated 0x11 EVENT/0x12 ACK and source-separated E/LMB must be approved by Main. Core8A/8C need authenticated negotiated lease, same World turn/epoch, reliable press/release and death/reset fences. Combat4 must show actual 135ms pointerDOWN 34HP light and held 320ms READY intentional 46HP release. UI10 must own actual live DOM switch with Space+LMB, no 30Hz short-click loss. Strict original 2–4 independent *human hosts*, Silver/R4/C1-default-OFF, integrated protected CI, stage/rollback and Main/owner GO remain. **No merge/main, deploy, stage, restart, release or CI waiver.**
