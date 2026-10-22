# Authentic Silver Spartan Kick V3 — real multiplayer contact-frame PNGs (QA-only)

**Isolated child of draft PR #760**, whose native [CI #39772080750](https://github.com/tehki/myaso/actions/runs/39772080750) independently **passed** with original first-party Blender Silver V3 kick visible in two different connected real Rust game clients. Chrome server player #1 and Firefox #2 each rendered 27 true `silver_kick_v3.webp` cells (6 windup, 6 active/contact, 15 recovery), under authenticated server kickWindup→kickActive→kickRecovery phases. The original artwork source SHA is `a6001a61c9cd48aa5b34ff7a7ecccb071bd6a3c6465ec5fd0cabffb4d3d1d747`.

The original connected proof was exact authoritative renderer evidence, **not an actual viewable multiplayer screenshot**. This independent QA addition captures two **actual original game canvas PNGs**, one per native Chrome/Firefox browser, during a real server-reported V3 active/contact source cell (original atlas frame 3 or 4). Only under new explicit environment `MYASO_GRAPHICS3A_V3_CONTACT_PNG=1` with both earlier strict server-flight flags, a temporary, read-only-in-game `CanvasRenderingContext2D.drawImage` observer captures `this.canvas.toDataURL('image/png')` immediately **after the real V3 source atlas cell is drawn**. It does not ask for a cosmetic animation screenshot in an isolated preview, import an illustration, programmatically fake fighter action or trigger a combat hit. It can represent a **partly painted game frame** before later HUD layers; the screenshot provenance explicitly disclaims full-frame end-of-render acceptance.

The source pixels are retained **only after** the unchanged M133 real authoritative Rust-server W3C Chrome/Firefox acceptance AND exact V3 WebP/phase receipt succeed. If either PNG is missing, malformed, too small, fails actual PNG signature/size or one browser has no contact draw, CI fails. No graceful fallback to a V2 source, screenshot of the source-art browser review, fake frame or synthetic actor state.

The strict sibling CI `graphics3a-real-connected-v3-contact-png` prebuilds the same authoritative server, invokes real browsers with triple game-query opt-in and strict source receipt, then uploads two original PNGs and SHA-256 manifest as a **one-day GitHub artifact**. Upload failure is a failure; hidden evidence directory must be included. Exact branch named QA, no V3 active in normal renderer. Review actual images before subjective art signoff.

### Reproduction

```bash
cargo build --locked --manifest-path server/Cargo.toml --bin myaso-server
MYASO_PVP_SCENARIO=uikickbuffer \
MYASO_GRAPHICS3A_SPARTAN_FLIGHT=1 \
MYASO_GRAPHICS3A_SPARTAN_V3_FLIGHT=1 \
MYASO_GRAPHICS3A_V3_CONTACT_PNG=1 \
node scripts/pvp_browser_flight_runner.mjs
```

Expected if full genuine acceptance succeeds: directory `.graphics3a-v3-native-contact-png`, `actual_connected_silver_spartan_v3_contact_chrome.png`, `actual_connected_silver_spartan_v3_contact_firefox.png`, and `native_v3_contact_manifest.json` with exact browser/server ID/bytes/SHA.

### Unverified, not bypassed

Even a genuine in-game contact-pose image does NOT by itself certify ground/boot sole, collision, knockdown/hit receipt, VFX/SFX, 0.84 Greyhaven camera, exact server action-start tick, 2–4 actual humans, or final visual signoff. The separate mandatory full protected `quality` job, Graphics Director #344, Kick owner #542 and Main Orchestrator #360 must approve before merging or gameplay activation. Pre-Alpha #695 continues excluding the Spartan kick. **No merge or deploy.**
