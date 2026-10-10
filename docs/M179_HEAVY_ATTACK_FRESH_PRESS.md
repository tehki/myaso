# M179 — Heavy-Attack Fresh-Press Commitment

## Goal

Make heavy attacks require a new key press after each committed heavy action, matching existing edge-triggered light, kick, roll and jump behavior.

## Contract

- A fresh heavy key press from Idle starts one unchanged 320 ms windup, 100 ms active phase and 420 ms recovery.
- Holding E through that entire sequence cannot trigger another heavy automatically.
- A new heavy press during existing heavy recovery is consumed rather than queued as a new attack.
- Releasing and pressing E again after recovery starts the next heavy normally.
- A quick heavy press-and-release delivered before an authoritative server tick is still latched and executed once (existing pending-heavy input semantics).
- Same combat damage (46), guard pressure (64), stamina behavior, feint windows, input formats, packet/snapshot layouts and damage geometry.
- Death, respawn and match reset clear the heavy-key edge latch, matching existing light attack reset behavior.

## Acceptance

JavaScript and authoritative Rust regressions exercise held-heavy repetition and heavy pressed during recovery; the existing Rust sub-tick heavy-edge test remains intact.

The existing headless Chrome/Firefox heavy attack counterplay, committed-windup, guard-break and recovery acceptance tests must remain green. No browser key timing values are changed.

The playable build remains intentionally closed.