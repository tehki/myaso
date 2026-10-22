# Graphics 3A P0 — four real connected original Silver Knight browser players

**DRAFT / genuine server acceptance, not public release.** This is a Graphics-only independent acceptance extension stacked on #738, which already independently proves original 6/6 jump and 8/8 roll frames in two real Rust-server Chrome/Firefox sessions.

## Four-player acceptance target

Run the existing local authoritative Rust game server with **four independently joined native WebDriver browser clients**: Chrome, Firefox, Chrome #2, Chrome #3. Each session must be assigned a different positive server player ID and positive authoritative server tick. The original real FFA four-human **scoreboard must converge on the same four IDs in every browser**, with four rows and zero kills before performing any action.

Enable original first-party Silver Knight renderer in these QA clients using the existing `?knights=1` test-only opt-in. A read-only `CanvasRenderingContext2D.drawImage` observer records authentic original 160px source atlas clip, source-frame, 8-way facing, transform, and actual browser timestamp. For each of the four real joined browser sessions, the independent receipt requires:

- At least 24 genuine original Silver sprite drawing samples (idle/walk/sprint/roll/jump; no NPC/Sentinel or invented clip).
- At least THREE independent 120ms time windows with **four separate screen positions** rendered simultaneously in that client's actual combat-arena canvas. Reject duplicated one-actor art or fewer human avatars.
- A real W3C keyboard 'd' movement gesture sent to player #1's Chrome browser, with at least one genuine Silver walk or sprint source frame subsequently visible in **each of the other three browsers as well**.
- Four distinct actual server identities and the exact authoritative 4-player roster on each browser. Screens cannot certify four people operating keyboards; sessions are automated real network clients.

Only after genuine success print `GRAPHICS3A_PREALPHA_CONNECTED_FOUR_SILVER` with `realAuthoritativeFourBrowserSilver:true` and `fourIndependentHumanOperators:false`. The existing strict M47 two-player test, the existing M159 4-player hit test and all full protected Combat assertions remain UNCHANGED with this flag absent.

## Manual reproduction

```bash
cargo build --locked --manifest-path server/Cargo.toml --bin myaso-server
MYASO_PVP_SCENARIO=uiidentity \
MYASO_GRAPHICS3A_PREALPHA_SILVER_FLIGHT=1 \
MYASO_GRAPHICS3A_PREALPHA_FOUR_FLIGHT=1 \
node scripts/pvp_browser_flight_runner.mjs
```

The dedicated **parallel exact-head `graphics3a-real-silver-4p` protected CI job** executes this flight, but the separate full `quality` job remains a **mandatory independent release gate**. A successful four-client art test cannot bypass a failed Combat test.

## Strict limits

This proves simultaneous original Silver identity and movement over a real 4-client network game. It does **not** prove four independent human operators, all 4-way roll/jump sequences, camera-readability signoff, opponent collision/damage, server input/hit authority, ground contact, World 9/Greyhaven, death/respawn/reconnect, Pre-Alpha 0.1 deployment or owner GO. Those remain with Main #695, Graphics #699, Combat #696, Core 8A/8C, UI10. Owner-approved Spartan kick PR #611/#617 remains OUT of narrow Pre-Alpha. Source first-party Silver atlases, Rust server, live web client and exact combat timing are untouched.
