# Graphics 3A — real-authoritative two-client Spartan Kick acceptance gate

**DRAFT / not production-ready / not yet executed successfully on a real server.**

This additional manual self-hosted-only gate is an extension of the existing **M133 real recovery kick buffer** Chrome/Firefox scenario, not a replacement for its strict authoritative Combat criteria. It does not weaken a single old check.

## Run only on an authorized self-hosted QA machine with a local Rust game server, working Chromium/ChromeDriver and Firefox/GeckoDriver

```bash
MYASO_PVP_SCENARIO=uikickbuffer \
MYASO_GRAPHICS3A_SPARTAN_FLIGHT=1 \
node scripts/pvp_browser_flight_runner.mjs
```

This deliberately does **not** run in normal gameplay or normal protected M133 CI, and must not be mistaken for a successful genuine-server test until the actual self-hosted command completes with strict green evidence.

What the harness does:

- Opens two **actual** browser clients via their existing WebDriver sessions and joins the original local authoritative Rust server. The existing M133 flight checks server-assigned identities, performs a genuine W3C mouse click, verifies one authoritative late-recovery short-RMB kick, action timing and attacker/defender replicated transitions; no synthetic fighter state can satisfy M133.
- Adds **both** existing manual preview URL flags (`knights=1&knightKickSource=1`) only for the opt-in acceptance, leaving the default game unchanged.
- Wraps browser Canvas `drawImage` only during the real QA session, recording the **actual** approved `silver_kick.webp` crop coordinates and browser timestamps, bound to the original source asset. The hook is installed after login and before actual input, is never shipped into the default game renderer, and does not alter Combat physics, state, hitboxes, authority, phase durations, output to opponents, game server or networking.
- A separate deterministic receipt validator enforces **two different server net IDs**, positive authoritative server ticks, real nonempty source draws in **both** browsers, ordered server-replicated windup/active/recovery transitions and true windup and recovery frame ranges, a contact frame in at least one, no impossible atlas cells or facings, and the pre-existing M133 attacker and defender action-transition receipts. If the short 70ms active pose is unobserved because of 20Hz snapshots or browser frame pacing, the gate must FAIL, not invent a hit.
- Outputs `GRAPHICS3A_SPARTAN_CONNECTED_KICK_FLIGHT` only after all these checks pass. This validates real **two-client arena kick rendering** only; **not Greyhaven city, four players, planted boot sole / COM, exact tick-to-frame alignment, server-confirmed successful damage, opponent recoil, or natural VFX and sound**.

## Current engineering status and blockers

Local Node deterministic receipt tests and the original focused Silver Knight suite are the first gates. Native prior Chrome+Firefox two-actor **simulated** source QA remains recorded in PR #617, but it cannot count as this real-server flight.

The connected Windows desktop used for original Blender graphics currently lacks a usable local Rust game server and WebDriver binaries; the available Linux QA host has Chromium and a cached server binary but **no confirmed Firefox/GeckoDriver** and GitHub checkout fetch blocked during this work. Therefore do not mark the genuine two-browser runtime command as PASS until a suitable authorized local QA host executes it and logs the server-authorized transitions and genuine painted atlas frames. Do not swap Firefox out and mislabel Chrome as Firefox.

Main Orchestrator #360 and Core 8A/Combat own network-ready execution, while Graphics 3A owns art crop/readability validation. Owner-approved #611 remains unchanged, #617 remains an optional draft. New real-flight gate must complete before any main merge/deploy; no bypass or auto release.
