# Graphics 3A — Pre-Alpha 0.1 original Silver Knight source browser acceptance

**Source-only review of Main Orchestrator draft [PR #698](https://github.com/tehki/myaso/pull/698)** at exact base `7548882d7410e3c8f8f080e85cfbd2909276d7e7`. This Graphics child changes **no production game-server, client renderer, graphics or Combat behavior**.

## Verified source integrity and native browser render

- Original five first-party `silver_idle.webp`, `silver_walk.webp`, `silver_sprint.webp`, `silver_roll.webp` and `silver_jump.webp` independently SHA-256 checked byte-for-byte against `web/assets/knights/README.md`; every hash matches the source manifest. Original 160px-direction atlas assets are unchanged. No NPC/Sentinel, Greyhaven, sword, adult or Spartan Kick source imported.
- **Native Chrome 154.0.8037.99:** all 5 genuine original Silver clips × 8 original directions = **40/40** authentic browser source-cell checks, plus 13/13 unsupported-action truthfulness checks, Sentinel NPC role rejection, five screenshots, no JS/HTTP error.
- **Native Firefox 153.4.0:** same **40/40** source-cell checks, 13/13 fallback checks, no NPC, five screenshots, no errors.
- Existing Main candidate `tests/prealpha-silver-knight.test.mjs` **4/4** passes; new static proof-integrity tests verify both real browser reports, 10 PNG screenshot byte headers and source hashes.

**Actual source-viewer:** `tests/fixtures/prealpha-silver-source-review.html` imports the genuine candidate `createKnightSpriteRenderer` and unchanged WebPs from `web/assets/knights/`. Source runner `tools/art/verify_prealpha_silver_native_browser.mjs` uses installed native Chrome and Firefox with Puppeteer; runs 5 source clips × 8 directions with simulated actor states and takes screenshots. It is NOT a replacement character, Blender redesign, server client, or artificial generation of gameplay.

**See actual first-party browser images:** `prealpha_silver_chrome_{idle,walk,sprint,roll,jump}_8way.png` and corresponding Firefox screenshots in this directory, plus source reports. The original Silver appears relatively dark/small at the approved existing visual scale; final readability must be judged in actual camera/arena, not inferred from source sheets.

## Strict evidence boundary: HOLD

This QA uses deliberately **simulated actor states** in an authentic browser renderer; it does **not** create a Rust server, authenticate real human players, prove real server tick/facing/position, demonstrate human input or two/four-player native combat, ground collision or Pre-Alpha release. Owner-approved Spartan Kick #611 remains separate, opt-in #617 remains unqualified for Pre-Alpha release.

Main Pre-Alpha [#695](https://github.com/tehki/myaso/issues/695), Graphics [#699](https://github.com/tehki/myaso/issues/699), UI 10, Core 8A, and Combat 4 must still test **actual real-game Chrome+Firefox local/remote Silver** during idle, movement, jump, roll and truthful unsupported-action Combat fallback. Separate Combat instant-light/held-heavy [#696](https://github.com/tehki/myaso/issues/696), full exact-head CI and main release approval remain mandatory. No independent merge, deployment, public cutover or source-art redesign.
