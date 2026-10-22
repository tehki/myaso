# Graphics 3A — authentic Silver Spartan V3 lighting: three active-frame game screenshots

Original CI source: [PR #811](https://github.com/tehki/myaso/pull/811), SHA `1f10e80a2e9b3cbbfa032931fd4f47e6ac7c6f5c`, [Actions #39814381212](https://github.com/tehki/myaso/actions/runs/39814381212).

This archive contains only **unmodified 960×540 native multiplayer game Canvas images**, copied from original Actions artifact `graphics3a-original-v3-light-native-arena` (ID **12441277352**). All six screenshot byte lengths and SHA-256s were independently verified on authorized X230i. The dedicated real Rust-server M153 three-native-browser job passed.

## Original V3 lit kick — active frame genuinely observed in all three clients

- [Chrome attacker #1, active kick](original_silver_spartan_v3_lit_chrome.png)
- [Firefox knocked-down victim #2, active kick observed](original_silver_spartan_v3_lit_firefox.png)
- [Chrome #2 bystander #3, active kick observed](original_silver_spartan_v3_lit_chrome2.png)
- [Original manifest: each real source phase, frame, direction, draw clock, authenticated ID and file SHA-256](original_v3_light_native_manifest.json)

For **this** original CI execution, all three game clients actually painted kick-active source frame 3, as recorded by `capturedSourcePhase=active`, `capturedSourceFrame=3`, `allClientsCapturedActive=true`. This is not imposed on future spectator runs: the 70ms active action can legitimately be skipped by a remote renderer, in which case only genuinely observed recovery or windup frames may be captured and explicitly labeled. The Chrome attacker **must** actually paint active. No synthesized images, client-created kicks, modified HUD or fabricated source phase.

The real original Silver 22-bone Cycles V3 lighting sprite SHA-256 is `3522f093a095a616dedf6f859c954553dd4832f8c1cbf655b644207faf239a79`. The native W3C three-client test proved actual Rust-authoritative non-damaging M153 server kick and real knockdown; it did not prove mesh-accurate foot contact.

## Same real server knockdown — owner-approved Silver V2 victim artwork remains unchanged

- [Chrome victim reaction](victim-v2/original_silver_real_knockdown_chrome.png)
- [Firefox victim reaction](victim-v2/original_silver_real_knockdown_firefox.png)
- [Chrome #2 victim reaction](victim-v2/original_silver_real_knockdown_chrome2.png)
- [Original V2 victim screenshot SHA and server ID manifest](victim-v2/original_silver_victim_native_manifest.json)

The grounded victim V2 artwork was previously visually approved by the owner in [PR #788](https://github.com/tehki/myaso/pull/788). This approval does **not** apply to the V3 lighting experiment.

## Holds and boundaries

**PASS:** dedicated native three-browser M153 and screenshot-integrity check. **FAIL:** mandatory independent `quality` job on [the same exact-head CI run](https://github.com/tehki/myaso/actions/runs/39814381212) failed strict Combat M158 simultaneous FFA knockdown focus handoff (#2 to still-downed #3). Escalated separately to Combat; full protected acceptance is **NOT green**.

**ART HOLD:** genuine 960×540 arena sprites still look small/dark and the golden attack telegraph can dominate the source kick. V3 light is **not** human-approved, default-integrated, merged, Pre-Alpha or deployed. No claim of Greyhaven ground contact, hitbox collision, human-operated playtest or damage receipt.

**Only evidence files added:** no GLB, original V3 atlas, original V2 victim atlas, game renderer, authoritative Combat/Physics, Items, sound, CI requirements or Pre-Alpha scope changed. Main Orchestrator exclusively owns release integration. [Strict source-phase acceptance contract](../REAL_THREE_BROWSER_V3_LIGHT_QA.md).
