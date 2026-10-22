# Graphics 3A — Original Silver Spartan V3 light, strict three-browser evidence

**Release class:** DRAFT / QA-ONLY / UNAPPROVED VISUAL EXPERIMENT / NOT IN PRE-ALPHA.

This is a child of original source study [PR #801](https://github.com/tehki/myaso/pull/801), applied onto the exact grounded Silver V2 victim source/connected M153 branch [PR #788](https://github.com/tehki/myaso/pull/788). These separate parent branches contain the first-party art, full original Blender source, and authentic baseline native proof.

The new `web/assets/knights/silver_kick_v3_lit.webp` is **byte-exact** to the separate original 22-bone 8×8 Cycles study atlas. The existing V3 kick WebP and approved Silver victim grounded-V2 WebP remain completely unchanged. No new character, mesh or client-created hit is involved.

## Explicit 5-flag visual opt-in

The online game selects the new asset **only** when all flags are explicit:

`?knights=1&knightKickSource=1&knightKickV3=1&knightKickV3Light=1&knightKnockdownSource=1`

Other requests default to the existing V2/original V3 source selection or no Knight sprite. Even with these flags, actual kick and knockdown action frames are driven **solely by the unchanged authenticated server snapshots**. The new renderer filename is never a source of authority. No attack or collision state is synthesized from image frames.

The real Rust M153 acceptance invokes the unchanged Chrome #1 attacker, Firefox #2 real knocked-down victim, Chrome #2 observer. Before any acceptance, it requires these five environment flags:

```shell
MYASO_PVP_SCENARIO=uikickknockdownffa
MYASO_GRAPHICS3A_V3_KNOCKDOWN_FLIGHT=1
MYASO_GRAPHICS3A_ORIGINAL_VICTIM_FLIGHT=1
MYASO_GRAPHICS3A_VICTIM_NATIVE_PNG=1
MYASO_GRAPHICS3A_GROUNDED_V2_FLIGHT=1
MYASO_GRAPHICS3A_V3_LIGHT_NATIVE_FLIGHT=1
node scripts/pvp_browser_flight_runner.mjs
```

The strict original `M153_KICK_KNOCKDOWN_FFA_FOCUS` receipt must pass. The separate original V3 kick inspector defaults to `silver_kick_v3.webp` and does **not** accept the light study unless this independent runner explicitly supplies `expectedSourceFile:"silver_kick_v3_lit.webp"`. Unknown, mixed or substituted source filenames fail. Old original V3 scenarios remain byte-pinned to the original filename by default.

The new `GRAPHICS3A_SPARTAN_V3_LIGHT_REAL_THREE_BROWSER_PNG` success marker must not print until the manifest SHA-256 matches the actual optional asset, the three distinct browser identities and M153 attacker/victim server transitions are proven, and actual unmodified 960×540 PNGs exist with correct source crop and PNG signatures from all three clients. Genuine grounded V2 victim low-pose images are produced independently by the inherited source gate. The PNG manifest records actor IDs, art SHA and explicit evidence limitations. Nothing here validates boot-to-opponent mesh collision or Greyhaven ground contact.

## CI and source-acceptance sequence

Dedicated `graphics3a-original-v3-light-real-three-browser` job runs independently of mandatory protected `quality`, and publishes unmodified native game PNGs as a short-lived artifact on exact-head CI. Local offline negative tests assert the five explicit flags, original source file retention, absent opt-in refusal, exact asset hashes, legitimate M153 server IDs and unchanged knockdown vitals.

**No native/visual approval is claimed before genuine CI succeeds and images are personally inspected.** Even if all CI passes, owner / Graphics Director aesthetic acceptance remains mandatory. Main Orchestrator retains merge/deploy and wider Pre-Alpha release authority. No sound/impact VFX, root displacement, changed hitboxes, artificial damage, tokens, NPC or item assets are in scope.


## Authentic sampled frame versus actual 70ms server phase

An actual Firefox or Chrome2 spectator can receive real server snapshots and draw original V3 windup/recovery frames while skipping active-frame pixels during the short 70ms phase; this does **not** invalidate the genuine M153 authoritative knockdown or license invented action frames. Keep the unchanged authoritative M153 receipt strict: Chrome attacker **must actually draw active**, all clients must draw windup and recovery, and the original V2 victim must be real and independently proven.

The native QA Canvas probe independently snapshots the first **actually painted** kick frame in each observed phase, with original source filename, frame, direction and original draw timestamp. The PNG selector requires Chrome's active source phase; Firefox and Chrome2 truthfully select active if present, otherwise recovery, otherwise windup, and require a matching instrumented \`drawImage\` receipt. The manifest explicitly identifies \`capturedSourcePhase\`, \`capturedSourceFrame\`, \`capturedSourceDirection\`, \`capturedDrawEpochMs\`, \`activeFrameActuallyObserved\`, and \`allClientsCapturedActive\`. No test may mislabel an original spectator recovery image as a collision/contact image; game pixels remain unmodified. Fake source, mismatched phase, substituted filename, absent native screenshot or forged/tampered PNG fail closed. Actual static Canvas crop provenance is not human artistic approval, physical contact validation or Combat hitbox validation.

The independent contract test \`tests/graphics3a-v3-light-capture-truth.test.mjs\` is mandatory in the PR-only native source CI. This is a **screenshot evidence consistency fix**, not a shorter hitbox, new kick timing, extra render frame, synthetic client action, or relaxation of authoritative Rust M153 requirements. The previously archived original six screenshots and manifests are immutable.
