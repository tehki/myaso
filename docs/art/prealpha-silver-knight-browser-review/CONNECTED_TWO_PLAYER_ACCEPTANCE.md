# Graphics 3A — Pre-Alpha 0.1 REAL two-client Silver Knight acceptance

## Execution path

The existing strict **M47 authoritative online identity** Chrome/Firefox browser flight now has a separate **explicit** Graphics 3A real-source audit. It is OFF for all existing browser tests and every default game client. Its only activation is:

```bash
MYASO_PVP_SCENARIO=uiidentity \
MYASO_GRAPHICS3A_PREALPHA_SILVER_FLIGHT=1 \
node scripts/pvp_browser_flight_runner.mjs
```

The protected `.github/workflows/ci.yml` quality workflow also runs this exact case as a dedicated step immediately after the existing M47 pass. This is a genuine Rust server + native Chrome/Firefox WebDriver test; it cannot be satisfied by the isolated source sheet screenshots in PR #704.

The harness first joins two separate real browser players to the self-hosted Rust server and requires M47's actual server-issued player IDs, HUD vitals and physical remote-player identity badge. The new test sets `?knights=1` **only in the acceptance-client test URL** (the actual release lobby separately sets the Silver default). A read-only Canvas `drawImage` observer records the five SHA-verified original Silver source atlases, exact directional atlas crop, genuine browser clock and screen-transform coordinates. No simulated actor setter, fake network packet, item action or renderer override is used. Both actual connected clients then see a real W3C `d` movement key press/release. A strict receipt requires:

- Two **different** nonzero server-issued player IDs and positive server tick evidence, one from native Chrome and one from native Firefox.
- Each browser draws **at least 12** actual `silver_idle/walk/sprint/roll/jump` source cells with valid 160px source frame/facing geometry; no Sentinel/NPC, fake sixth clip or atlas out-of-range frame.
- At least **three** observed browser 90ms buckets with **two spatially distinct Knight body draws**, showing local and remote humans simultaneously in the existing combat arena (no false 'two players' from a duplicated single atlas).
- After actual W3C-keyboard movement, both clients must observe at least one original walk or sprint source cell.
- Error/absence fails the dedicated protected CI step before later Combat flights. Offline local unit tests deliberately fabricate data **only to test rejection conditions**; they are not connected PvP evidence.

Pass log marker: `GRAPHICS3A_PREALPHA_CONNECTED_TWO_SILVER`. The receipt marks `authoritativeConnectedTwoPlayerSilver:true` **only if** the actual two-WebDriver Rust server flight succeeds. It always sets `fourPlayerProven:false`, `arenaFloorContactProven:false`, `actualGreyhavenCityProven:false`, `combatHitReceiptProven:false`, `ownerSpartanKickIncluded:false`, `productionReleaseApproved:false`.

## Strict unchanged scope and other release gates

Graphics 3A does not change server binary, damage/hitboxes, live client/renderer, Knight art, input semantics, original 350ms roll, real camera, login, networking, or the public website. The W3C test's extra `knights=1` flag does **not** activate the separate owner-approved Spartan kick. Existing M47 remains unchanged with the flag absent. The role for all human fighters remains player, only five actual Silver assets, and unsupported actions fall back to truthful Combat circle/telegraph.

**A green two-human Silver test is necessary but not sufficient for Pre-Alpha:** user-required genuine four-player combat, roll/jump/recovery with correct visual phase, separate Combat #696 pointerDOWN light and held-heavy fix, all protected Rust/browser/CI and Main Orchestrator signoff remain HOLD. The issue [#699](https://github.com/tehki/myaso/issues/699) and master [#695](https://github.com/tehki/myaso/issues/695) govern.
