# Graphics 3A P0 — genuine connected two-player Silver Knight jump + roll acceptance

**Isolated draft child** of [the already-green actual original two-player Silver rendering PR #704](https://github.com/tehki/myaso/pull/704). This experimental QA addition does **not** change the five owner-approved original Silver Knight atlas assets, runtime client, Rust Combat server, authoritative tick protocol, damage, physics, stamina or 350ms roll motion. It never activates the owner-approved *separate* Spartan kick.

## Actual network/game-client proof sought

The existing manual `MYASO_PVP_SCENARIO=uiidentity MYASO_GRAPHICS3A_PREALPHA_SILVER_FLIGHT=1` path already:
- Spawns native Chrome and Firefox as independent real WebDriver browsers connected to the same local Rust server;
- Enforces strict M47 server-assigned unique identities and remote badge-pixel read;
- Observes actual original Silver WebP `drawImage` cells from both local and remote players, same arena, and sees correct walk/sprint motion after real W3C WASD;
- Emits confirmed `GRAPHICS3A_PREALPHA_CONNECTED_TWO_SILVER` and explicitly does not claim 4-player or 0.84 Greyhaven.

Add a second strict opt-in `MYASO_GRAPHICS3A_PREALPHA_MOTION_FLIGHT=1` (requires the first). Now, **only after** that connected two-person proof passes, the test initiates:

1. **Space pressed in real Chrome via W3C keyboard** (90ms genuine keyDown/keyUp). Both Chrome and Firefox must draw nonempty real `silver_jump.webp` source cells (original 6×8 atlas) after the gesture; source cells must preserve 0–5 frame and 0–7 directional crop range.
2. **Wheel-forward (-120) in real Firefox via W3C scroll** on the live game arena, after jump has settled. Both Firefox and Chrome must draw real `silver_roll.webp` source cells (original 8×8 atlas) after this gesture; source cells must preserve 0–7 frame and facing limits.
3. Retain native W3C keyDown/keyUp/wheel-event proof from the unchanged game UI observer, and preserve the server issued player IDs from the already-passed two-person receipt. All observations must derive from real browser Canvas calls, **not** fabricated actions or mock actor snapshots.
4. Produce `GRAPHICS3A_PREALPHA_CONNECTED_ROLL_JUMP` with exact browser frame evidence only after genuine success; otherwise fail the independent Graphics CI job. A pure unit validator exercises negative cases on forged clips, absent native input, impossible source frames/directions, duplicate server identities, missing one browser, missing real face/clock evidence.

Run only on the native self-hosted or GitHub CI preview environment with original Rust game server, ChromeDriver + GeckoDriver, no live release:

```bash
MYASO_PVP_SCENARIO=uiidentity \
MYASO_GRAPHICS3A_PREALPHA_SILVER_FLIGHT=1 \
MYASO_GRAPHICS3A_PREALPHA_MOTION_FLIGHT=1 \
node scripts/pvp_browser_flight_runner.mjs
```

**Exact protection:** the original `quality` job continues mandatory and unchanged; the separate sibling `graphics3a-real-silver-2p` job on this child now requires these true motion steps and their unit contract. No shortcut may label simulated source art as real multiplayer proof. Early failure is appropriate if an action does not become visible in both browsers.

**Boundaries:** Atlas rendering that originates from the real server-driven client does not independently prove exact server action-start ticks, damage, collision, physical foot-sole plant, authored 0.84 Greyhaven world, real human-operated keyboards, full 350ms roll timeline, stun/death transitions, 4 player crowd or actual public deployment. Those remain under Main #695, Graphics #699, Combat #696/#723, Core 8A/8C. Merge/release remains HOLD.
