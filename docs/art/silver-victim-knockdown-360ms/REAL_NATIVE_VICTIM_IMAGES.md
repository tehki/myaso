# Graphics 3A — real 3-player original Silver victim low-pose screenshot acceptance

**Draft QA only; child of authentic source #774 and verified server-state renderer #779.**

The [real authoritative M153 original Silver victim test #779](https://github.com/tehki/myaso/pull/779) succeeded with **Chrome #1 (attacker) / Firefox #2 (victim) / Chrome #2 #3 (observer)**. Each browser drew **all 8 original Blender `silver_knockdown.webp` frames** after the actual Rust server victim #2 `knockdown` action, while the authentic Spartan V3 kick and M153 non-damaging knockdown remained proven.

The existing receipt is precise Canvas source crop evidence but not an inspectable picture of the actual arena during the fall. This independently isolated QA branch adds ONLY a passive test-harness **`MYASO_GRAPHICS3A_VICTIM_NATIVE_PNG=1`** gate with the existing strict real FFA victim flag. It captures the **actual browser game Canvas PNG** on the first genuine Silver victim low-pose frame **3 or 4** (`silver_knockdown.webp`, 160px cells) via `queueMicrotask` after the current synchronous game-render callback. This preserves both characters and the HUD, rather than sampling halfway through a single sprite's paint.

The original real M153 Rust server test and strict three-native-browser original art source receipt must pass **BEFORE** any PNG is accepted. Capture rejects missing/invalid PNG bytes, incorrect source crop, missing server actor identity or fewer than three real clients. Exact original Chrome, Firefox, Chrome2 game Canvas bytes are saved with a SHA-256 provenance manifest; the CI job uploads them to GitHub as a temporary one-day artifact. No synthetic sprites, screenshots of standalone Blender previews, generated artwork, actor-state injection, new Combat mechanics or UI overlay forgery.

Reproduce on a native Rust + ChromeDriver + Firefox/GeckoDriver QA runner:

```bash
cargo build --locked --manifest-path server/Cargo.toml --bin myaso-server
MYASO_PVP_SCENARIO=uikickknockdownffa \
MYASO_GRAPHICS3A_V3_KNOCKDOWN_FLIGHT=1 \
MYASO_GRAPHICS3A_ORIGINAL_VICTIM_FLIGHT=1 \
MYASO_GRAPHICS3A_VICTIM_NATIVE_PNG=1 \
node scripts/pvp_browser_flight_runner.mjs
```

Output `.graphics3a-original-victim-native-png/` with `original_silver_real_knockdown_{chrome,firefox,chrome2}.png` and `original_silver_victim_native_manifest.json`. All source 360ms values and actor-root physics unchanged.

**Strict limits:** Native screenshots can demonstrate game presentation, not realistic physical head-ground or boot-sole contact, a server collision point, damage (this knockdown does no HP damage), full eight-frame causal tick consistency, 0.84 Greyhaven world, an independent human-operated playtest, or artistic signoff. The art source can **look airborne** when no in-game ground IK applies, so actual screenshot inspection and owner/Graphics Director review are mandatory. Not in Pre-Alpha; full protected quality remains independent. **NO merge/deploy.**
