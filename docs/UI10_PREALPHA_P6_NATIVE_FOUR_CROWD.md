# Moon Games UI 10 x Physics 6 — real native four-player crowd integration

**TEST-ONLY DRAFT** direct child of Main Orchestrator's Physics6 Pre-Alpha source [#744](https://github.com/tehki/myaso/pull/744) at `7d9f80a332fa9efd8d56335e6583f67de7e39a80`. The only new files are one original-game native Chrome/Firefox browser acceptance script, this document, and a dedicated CI workflow. **Absolutely no live game HTML/CSS, server, Physics 6, Combat, Chat, Sound or Silver Knight artwork source changes.** Other UI Pre-Alpha source (short responsive view) lives in separate protected-green [#729](https://github.com/tehki/myaso/pull/729), not introduced into this Physics candidate.

## Why this test is useful

The Physics6 Rust server [#732](https://github.com/tehki/myaso/pull/732) enforces radius 18, minimum center separation 36 world units across 4+ fighters using a bounded iterative solver. Static unit tests do not prove what the four **actual** WebTransport player sessions display when walking into one crowd. The existing source has four positive server-owned players spawn at X 42,138,234,330 and Y42. This test uses **genuine native W3C WASD keyboardDown and keyboardUp events** in **four independent Chrome/Firefox/Chrome/Chrome authenticated clients** driving those bodies toward approximately the same original arena X~180. No direct location mutation, synthetic actor, privileged spawn, test-only fake snapshot or fabricated server packet.

During real original game animation frames, a passive wrapper around `CanvasRenderingContext2D.drawImage` reads the current **original real browser canvas transform** at each original Silver WebP draw. It records four source-art origin points from the **same genuine `requestAnimationFrame`** callback. After actual native player convergence, the test requires recent steady four-body frames in **each observer** to remain visibly distinct (minimum 26 CSS-canvas pixels, versus true nominal 36 world units times 0.84 presentation zoom = 30.24 CSS-canvas pixels with interpolation tolerance), *and* to represent a genuine crowd (maximum center-to-center pair separation <=135 canvas pixels) instead of leaving four fighters at spawn. Failure from any browser is a real red acceptance.

The same test preserves real authoritative Rust/WebTransport and pinned localhost TLS, original real four-player scoreboard, four genuine Silver WebP paints per client, actual server Chat C1 authoritative ACK/proximity and 240-byte/HTML safety, genuine Enter/Escape focus, native W and progressing INPUT_ACK/server ticks. All on one CI host, **not** four human operators on separate hosts.

### Limitations / mandatory hold

Visual origin spacing from browser Canvas is **not proof of raw authoritative World collider metrics**; local prediction, remote interpolation and presentation zoom may differ from server exact coordinates. Cross-check server Physics6 Rust tests and release-relevant reconciliation before any declaration that body penetration is fixed. This test does not establish actual world crowd near walls (would require real wall-convergence by actual player input), gameplay HIT/HP, instant pointerDOWN light / server 320ms READY heavy, physical swords, public Chat C1, four independent human PCs, immutable package, rollback or owner/Main GO. Keep protected Combat M38/M41/M144/M151/M155/M156 and all other strict quality gates. Production Chat C1 remains default OFF; this uses only ephemeral local test flag. No `main` merge, deployment, service restart or stage activation.

## 2026-10-22 Main follow-up collision-cost cap

This replacement acceptance is stacked on Main's latest Physics integration commit 7d9f80a332fa9efd8d56335e6583f67de7e39a80, which bounds additional collision passes to at most 8192 pair checks per tick while retaining the base sweep and up to 64 passes for four players. The previous [UI #747](https://github.com/tehki/myaso/pull/747) exact-head native acceptance passed at 2aafba8a55c6f72207c6f3b3ecb76f5b98b118af, but full protected quality #39762547604 failed strict M121 left-sweep readability. Main's prior Physics branch #744 failed M16 under 512 occupants and has been updated for that, but this child and updated Main need their own full exact-head quality; none of those failures is waived. No game code is modified here. The browser script reuses the last passing QA from #747 with the original chat-near/far test performed BEFORE actual-player crowd movement.


## P6 actual unquantized World audit (test-only, later child)
The original browser-painted Silver positions are presentation/interpolation;
the existing authentic QUIC snapshot codec v7 rounds positions to a compact
2-unit world grid. For example two genuine radius18-separated fighters
(100,100) and (132.4,116) have distance 36.135301, yet identical v7
encoded/decoded browser positions (100,100) and (132,116) measure only
35.777088. **Never use this replica distance alone to fail/pass 36-unit
authoritative collider clearance.** The added real codec regression pins this.

The dedicated test-only Cargo `p6-native-audit` feature is disabled in all
default/release builds; only the ephemeral localhost four-browser test builds
it and opts in with `MYASO_P6_NATIVE_AUDIT=1`. Nonloopback attempts fail
closed. It reads actual post-step four-fighter Rust World positions once every
three server ticks and writes bounded stdout only (no player/environment
mutations, privileged browser packet, extra network service, live feature or
production route). The native driver asserts 8-12 distinct *crowded* World
snapshots from the same actual browser-operated Rust server, with every
raw pair distance >=35.99 of diameter36 and maximum crowd diameter <=160.

Isolated Serj Chromium×4 source trial: 12 distinct recent authoritative
crowd ticks 1350..1383, min raw distance exactly 36, max 69.156342,
real C1 sender/radius+UTF8/ACK and Silver WebP visual acceptance all PASS.
That local trial reported an unusually high gameplay-ACK p95 of 2819ms;
do not claim latency or multi-host performance qualification from it.
Full new exact-head protected Chrome/Firefox and main CI remain required.
This is **not** P0 instant-light/heavy-release proof or a live game release.
