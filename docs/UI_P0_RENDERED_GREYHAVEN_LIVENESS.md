# Moon Games UI 10 — P0 rendered Greyhaven liveness attribution

Status: **diagnostic-only draft**, based on Core 8A rendered-world PR #578. No production, Combat, authority, networking or CI threshold changes.

## Reproduced problem and uncertainty

The source-authentic four-browser native rendered-city run has admitted four real Rust QUIC players and painted the original authored Greyhaven in Chrome and Firefox, but the later *visible server tick* can stop advancing. A screenshot/DOM tick is not itself evidence of a stopped authoritative snapshot stream. The original strict visual/HUD liveness test remains unchanged.

## Opt-in instrumentation

Only on `http://localhost`, `http://127.0.0.1` or HTTP loopback IPv6, with `?world=1&uiLivenessProbe=1` and **without** `scenario`, expose a read-only local UI observation surface through `window.__MYASO_WORLD_LIVENESS__.snapshot(Date.now())`. No background timers, network calls, input changes, persistence or synthetic advancement.

Measured independently:

- **Incoming authoritative snapshot callbacks:** count, original `latestServerTick`, wall-clock age.
- **Completed animation frames:** counter, age; these are counted only *after* the original frame returns.
- **Authored world tile paint:** paint start and completion age, duration, running max, existing renderer's visible and created tile counts; a hung paint is not recorded as completed.
- **Actual rendered status changes:** original DOM string's parsed `server tick`, count and age; never substituted for network tick.

Values are sampled only when received/painted. Invalid or missing samples are not fabricated. Feature probe stays absent on public origins, production defaults, and scenario-driven Combat acceptance.

## Native acceptance usage

The original strict `scripts/alpha_p0_four_native_rendered_greyhaven.mjs` now passes only the preview flag on its loopback URL and prints `ALPHA_P0_WORLD_LIVENESS_BEFORE`, `AFTER`, and upon failure `FAILURE` with separate per-browser snapshot/RAF/tile/status evidence. The original exact 4-player roster, true authored green pixels, native gesture and fresh **on-screen** server tick must **still** all pass. This instrumentation is not a bypass for stale HUD or a false PASS for a fast network when the renderer is frozen.

Interpretation: increasing server snapshots with static completed RAFs indicates main-thread/render blockage; increasing RAFs with static status indicates UI status/ACK presentation lag; static snapshots and RAFs together require WebTransport/main-thread investigation; a long pending tile paint plus Firefox SWGL timeout points to Graphics 3C tile performance. These are diagnostic hypotheses, not yet confirmed outcomes.

**Not a release gate substitute:** Four separately operated computers, actual visible player Knights, physical click-to-pickup four rack swords, authoritative MainHand and unarmed/sword PvP remain unverified.


## Actual four-Chrome reproduced result and minimal HUD correction

A single-machine four-genuine-Chrome run of a **scratch Chrome×4 copy** of the unmodified original native browser flight reproduced the failure with the **exact original PR #587 Rust/client source** before the status correction:

- Server-owned Greyhaven admissions: four real players [1,2,3,4], original green map painted successfully, static swept solids enabled.
- Player 4 on-screen HUD `server tick 351` stopped changing while the actual network callback advanced through `snapshotTick 1224`, `snapshots 293`, and world drawing completed `759` RAF frames / `756` map paints. Reported last paint ~0ms, max ~33ms and snapshot age ~50ms. Players 2 and 3 showed the same independent status-vs-snapshot discrepancy.
- The unchanged strict **visible-status** acceptance failed, as it must. This proves the local four-Chrome case had a client HUD status refresh gap, **not** an authoritative WebTransport stream stop or a frozen renderer. Original Firefox SWGL timeout remains a separately observed possible problem and is not disproven.

Source inspection found `onSnapshot` updated `networkStatus` only during initial Connecting, while `onAck` updated it during gameplay. The minimal correction is to refresh `networkStatus` from the **actual `networkClient.latestServerTick` on every valid own-entity snapshot**, preserving current Combat-message/hint priority. Pure `authoritativeOnlineStatus` only formats a valid uint32 server tick and player ID; there is no timer, prediction/extrapolation, replacement HUD value, new network writer, or Combat/Physics/World server mutation. Missing authority is rejected. A separate test proves formatting using genuinely supplied 351 -> 1224 ticks and invalid input rejection.

The committed native rendered-city gate still requires **the real four-browser full roster, physical painted city pixels, actual W3C gesture, and a newer visible HUD tick**—no acceptance relaxation. The reproduced four-Chrome failure and post-fix CI qualification must be judged separately from the exact-source integrated Chat C1 Grehaven staging tests; those tests previously used the legacy arena painter. The corrected branch still needs native Chrome and Firefox exact-head requalification and review by Core 8A, Graphics 3C, Main Orchestrator and Combat.
