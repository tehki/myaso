# Graphics 3A — real multiplayer Silver Spartan Kick V3 acceptance (strict QA-only)

**DRAFT, isolated child of the older V2 strict connected kick gate #634 and actual original Blender V3 artwork #754.** This branch does not change Rust server/authoritative Combat, hitboxes, stamina, movement physics, inputs, impact feedback, sound, original 5 Silver Pre-Alpha atlases or 140ms dash. The V3 art isn't switched on in Pre-Alpha or production.

## Original-source identity

The opt-in asset `web/assets/knights/silver_kick_v3.webp` is byte-identical (SHA-256 `a6001a61c9cd48aa5b34ff7a7ecccb071bd6a3c6465ec5fd0cabffb4d3d1d747`) to the original 22-bone Blender Cycles `docs/art/silver-spartan-contact-recoil-v3/silver_spartan_contact_recoil_v3_p0.webp` created and independently validated by Graphics 3A. The V2 `silver_kick.webp` remains untouched, and default `knights=1` has **no source kick** until opt-in. All V3 source and review materials are included as a traceable direct artwork cherry-pick on the strict game-gate baseline.

The literal **triple opt-in** for QA-only real game presentation is:

`?knights=1&knightKickSource=1&knightKickV3=1`

A missing `knights=1` means no Knight renderer. A missing `knightKickSource=1` with `knightKickV3=1` is refused, never silently promoted into gameplay. Missing `knightKickV3=1` keeps the previous V2 preview. Existing normal client defaults are untouched.

## Server-authenticated presentation only

With actual Rust authoritative fighter snapshots, `web/knight-sprites.mjs` selects the new source file for `silver_kick` only after authenticated kickWindup/kickActive/kickRecovery snapshots. It maps the same source-frame partitions 0–2, 3–4, 5–7 to the same 90/70/220ms budget; a client timer **cannot** promote windup into an active strike or cause damage/stun/knockback. The V3 real-client strict receipt inherits and repeats the existing #634 checks: native Chrome+Firefox distinct original server player IDs, ordered authenticated kick windup→active→recovery observed in BOTH browser acceptance histories, real WebDriver canvas draws and genuine right mouse short-release action, at least one real native contact crop. The additional V3 validator fails if **any** rendered sample came from V2/fake WebP. An absent active/server phase remains a FAIL, not a substitute proof.

Manual genuine flight (requires native ChromeDriver+GeckoDriver, Firefox+Chrome, original Rust server):

```bash
cargo build --locked --manifest-path server/Cargo.toml --bin myaso-server
MYASO_PVP_SCENARIO=uikickbuffer \
MYASO_GRAPHICS3A_SPARTAN_FLIGHT=1 \
MYASO_GRAPHICS3A_SPARTAN_V3_FLIGHT=1 \
node scripts/pvp_browser_flight_runner.mjs
```

Successful actual connected reception must print `GRAPHICS3A_SPARTAN_V3_CONNECTED_KICK_FLIGHT` with `authenticOriginalSilverV3AtlasBothBrowsers:true`. This is required on the **exact PR head**, not implied by the older V2-only source review or deterministic mocked fixtures. Dedicated parallel `graphics3a-native-connected-spartan-v3` CI job checks both pure fail-closed tests and the real browser/server flight, but **cannot replace the full protected `quality` job**, which remains mandatory.

## Strict release boundaries

Receipt fields explicitly keep `actualServerHitReceiptValidated:false`, `reviewedWorldSoleContact:false`, `fourIndependentHumanOperators:false`, `ownerApprovedGameplay:false` and `productionReleaseApproved:false`. A painted original kick silhouette is not proof of physical boot contact, center of mass stability, actual damage/recoil/impact sound, 0.84 Greyhaven floor or human-operated 2–4 player release smoke. Existing source V3 art PR #754 is a **review candidate**, and no merge/deploy or Pre-Alpha inclusion is approved here. Main Orchestrator #360, Graphics Director #344, Combat and Core own next release gates. Only actual server successful-hit evidence may authorize an impact effect.
