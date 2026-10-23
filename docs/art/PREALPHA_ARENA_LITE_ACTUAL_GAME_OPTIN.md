# 🌕⚔️🚀 Graphics 3C — optional live Arena Lite terrain, child of PR #806

**STATUS: DRAFT SOURCE INTEGRATION / NEVER DEFAULT / NOT RELEASE-READY.**

## Owner intent and baseline

The owner asked to introduce a **simple yet detailed medieval terrain** for Combat Pre-Alpha 0.1, then signaled continuation. The Main Pre-Alpha master [#695](https://github.com/tehki/myaso/issues/695) still says **graphics upgrades may not block Combat release**. This child explores owner-requested optional visual integration without modifying the default arena or announcing a release GO.

Base PR #806 original source SHA: `8f89ae5064694ff58bafb3300d5b0713fcf68801`. It authored deterministic `src/browser/prealpha-arena-lite-floor.mjs`, 960×540 opaque once-painted packed earth, restrained perimeter cobbles, scuffing and pebbles. Existing original Chrome/Firefox preview-only artifacts are valid for ART SOURCE only, not game camera or PvP validation.

## Minimal actual game opt-in

- `web/online-game.mjs` imports the original floor source and narrow fail-closed `chooseArenaFloorLayer` selector.
- Only explicit URL query `?arenaLite=1` (alongside existing `server` and `cert` values as applicable) selects the candidate. Any other value/default selects the original unmodified 48px technical grid.
- Source floor is rendered **one time** to a separate offscreen opaque 960×540 Canvas, then passed through the game's **existing** `ctx.drawImage(arenaLayer,0,0)` each frame. No new RAF, stage, physics plane, lighting, collision, gameplay geometry or packet family.
- If the opt-in source factory throws, produces null or invalid Canvas, the game immediately returns the identical original grid layer. Failures of the original mandatory renderer are not hidden.
- The original `createArenaLayer()` body and game Canvas/render/input loops, Combat/WebTransport Rust authority, mouse input, HUD, Silver Knight assets, camera 0.84 zoom, frame budgets and Audio are unchanged. No external texture, AI image, service or public feature flag.

## Focused quality gate

`.github/workflows/ci.yml` now explicitly checks JS syntax and both `tests/prealpha-arena-lite-floor.test.mjs` plus `tests/prealpha-arena-lite-optin.test.mjs`. The tests verify deterministic art, canonical dimensions/opacity, default-path untouched, strict opt-in, successful optional layer, unusable/throwing optional source fallback and original grid failure transparency. These are **Node source/pure-function tests**, not live multiplayer visuals.

## Missing mandatory evidence before consideration

1. **Actual game**, not standalone review: same original Rust WebTransport server, two- and four-player first-party Chrome/Firefox, genuine server-assigned #IDs, real original Silver idle/walk/sprint/jump/roll and Combat tell/fallback draws.
2. Actual 960×540 game Canvas pixels for original-grid vs `arenaLite=1` in equivalent gameplay, including correct offscreen #ID marker vs full sprite visibility, simultaneous FFA, instant-light windup and charge-release-heavy once Core/Combat permits.
3. Original combat tell / portrait / HP/guard / Chat / 14 Controls readability in 1280×720 and 1366×682 viewports; owner/art review of genuine game screenshots, no AI/mockup substitutes.
4. Actual Chrome+Firefox p50/p95 frame time and RAF gap comparison; no guessed FPS/latency and no mixing snapshot render-clock debt with canvas draw/present time.
5. Verify invalid floor opt-in failure through actual game with strict fallback pixels, no extra page/network errors, independent full protected exact-head CI and Main/owner **explicit scope approval**, staging rollback and optional/default decision.

**Never make Red Lion, Greyhaven, P52 snapshot research, Blacksmith or new geometry Pre-Alpha requirements.** Source PR stays DRAFT. No merge to main, public Chat/QUIC change, stage, release or service restart. Main #360 / Pre-Alpha #695 retains sole integration GO. Graphics 3A and UI10 review Silver/combat readability, Graphics 3B has zero architectural release dependency.
