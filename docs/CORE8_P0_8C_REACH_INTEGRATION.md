# 🌕⚡️🚀 Core 8C with Four-Browser Greyhaven — Source Integration

DRAFT only. No main merge, deployment, network exposure or CI bypass.

## Exact sources

- First parent: [Core #664](https://github.com/tehki/myaso/pull/664), SHA 86b4d0ec2c17c10d97debe6a989b2792eb61b982, merging real four native browser movement to the original Blacksmith EMPTY rack, authored Greyhaven rendering and HUD.
- Second parent: [Core 8C #666](https://github.com/tehki/myaso/pull/666), SHA b604820341e64db069bcd1e92cc4d21833a0b3d5, all real QUIC four-player combat, kill/respawn and old-input replay acceptance tests.
- Merge-base 4f27a4a133148cd518a93e971fa9149b67d89c1d. Read-only git merge-tree completed CLEAN with tree 945e0f5632a40e3af8f8003104760f6323d5a58c. Actual separate two-parent merge 26bbc9dbd4adc50b0ef10ca2cfe0cc80a47cd8aa, not merged to main.

## Actual combined-source mismatch identified and fixed in test

Original 8C staging acceptance placed newly resurrected fighter #5 at x4232 while opponent #1 was approximately x4116. That **116-world-unit separation** was permissible for the old isolated test assumption of 130-unit heavy reach. The integrated authored/browser source, however, correctly specifies current server **82-unit HEAVY_ATTACK_REACH**. The first actual merged-head QUIC run detected the valid committed heavy action but no hit (10/11 suite). This was an honest test/runtime mismatch, not a reason to change combat or loosen damage expectations.

The integration-only test now drives #5 **west using ordinary original gameplay movement** after the two valid network old-input rejection fences. Its own server snapshot and all three other genuine pinned-QUIC peers must independently confirm #5 at x in 4160–4188, y approximately 4160, inside the *unchanged 82-unit* melee reach of #1 at x approximately 4116. The test neutrally releases movement, then sends a fresh normal west-facing heavy input. No privileged position override, shortened collision, client-predicted position, synthetic health or changed damage value is allowed.

Corrected merged scenario proved four independent live QUIC observers saw server-authored committed heavy action by #5 and opponent #1 HP 100→54 from exactly 46 server damage, observed at tick 780. Earlier genuine death, reliable kill event sequence0/1, original spawn respawn, post-death input protection, late join and both stale Dead-input replay variants stayed intact.

## Original CI still mandatory on this exact integrated head

- Full Rust server regression, 11 real-QUIC acceptance tests, strict all-target Clippy and rustfmt.
- Original authored Greyhaven static parity: exactly 23 fixed solids and pinned SHA256 9bb023c95d86821f219113d71b6e480789a72df064f083790e746d79423b3f43.
- All existing browser-source contract tests and original protected quality gates.
- The four-real-rendered-native-Blacksmith-walk workflow now watches this Core8C integration test and this evidence document, *solely to force an original unmodified four-browser flight on this exact integrated PR*. No browser acceptance assertion is removed, mocked, bypassed or softened. Prior #664 CI is not sufficient to qualify this merged head.
- Native browser Combat M36, M143, M156 and any later strict protected quality failures remain blockers, not waivers.

## Explicit P0 release HOLD

The first-party Blacksmith rack is STILL EMPTY. This source join does not create clickable physical signed four-sword inventory, one canonical MYTX/Items writer, durable equipped MainHand state, sword-vs-fist PvP, complete dynamic authored World/Physics LOS or account crash recovery. Even actual four Chrome/Firefox browsers on a single loopback CI host are not four human users on TWO independent hosts with separately approved private staging. Static reviewed collision remains default OFF and 127.0.0.1-only in the isolated staging acceptance. Main Orchestrator #360 exclusively controls release and exact integration acceptance; First Playable #480 remains HOLD.
