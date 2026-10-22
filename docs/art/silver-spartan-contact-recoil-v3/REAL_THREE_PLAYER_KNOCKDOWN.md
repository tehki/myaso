# Graphics 3A — genuine three-player V3 Spartan kick + server knockdown

**DRAFT QA-only.** Extends the existing successful Rust-authoritative `M153_KICK_KNOCKDOWN_FFA_FOCUS` scenario without changing Combat, server, hitboxes, knockback, damage, animation timing, mouse controls, original art or normal Pre-Alpha.

A separate explicit environment flag `MYASO_GRAPHICS3A_V3_KNOCKDOWN_FLIGHT=1` is accepted **only** for the existing `uikickknockdownffa` scenario. It refuses combination with the independent `uikickbuffer`/contact screenshot flags. This QA flag alone sets the three actual game query opt-ins: `?knights=1&knightKickSource=1&knightKickV3=1`. It installs a passive Canvas original WebP crop observer in *all three real W3C native browsers* before unchanged genuine M153 mouse input.

The standard M153 three-player scenario first has to succeed independently: Chrome attacks with a real short-RMB recovery-buffered kick, Firefox server fighter is knocked down, a third Chrome browser player observes; original attacker focus and remote-only punish cue appear, full recovery clears and **all players retain 100 HP and guard**. The M153 result is then separately validated with the V3 artwork source crop provenance.

Fail-closed after actual server acceptance: three distinct positive server IDs/ticks, ordered attacker server windup→active→recovery, victim own genuine server knockdown action, correct original attacker knockdown focus, no altered HP/guard, genuine connected Canvas atlas draws from `silver_kick_v3.webp` in **all three browsers**, each with windup and recovery cells, plus **at least one actual Chrome kicker original V3 active/contact crop**. No substitution with V2 sprite, no invented source frame, no accepted proof if native Firefox/spectator omitted. If a 70ms active server phase isn't rendered due transport/browser pacing the test FAILS; do not counterfeit a cell.

### Native reproducibility

```bash
cargo build --locked --manifest-path server/Cargo.toml --bin myaso-server
MYASO_PVP_SCENARIO=uikickknockdownffa \
MYASO_GRAPHICS3A_V3_KNOCKDOWN_FLIGHT=1 \
MYASO_PVP_FLIGHT_DURATION_MS=11000 \
node scripts/pvp_browser_flight_runner.mjs
```

The exact-head independent protected job `graphics3a-native-v3-real-knockdown` must end with **both** authentic `M153_KICK_KNOCKDOWN_FFA_FOCUS` and `GRAPHICS3A_SPARTAN_V3_REAL_KNOCKDOWN` receipts; offline negative tests are NOT multiplayer evidence. The separate full protected `quality` job remains mandatory and independent.

**Honest scope:** A real non-damaging server knockdown from a Spartan kick, if proven, is stronger than an isolated active pose or V3 Canvas screenshot. But it still does **not** prove world-space boot sole contact, exact collision point, a damage receipt (M153 deliberately deals no HP damage), opponent reaction animation source, Greyhaven city camera 0.84, impact audio/VFX timing, owner human visual signoff, or 2–4 humans playing. The V3 source PR #754, real two-browser source #760, original screenshot PR #762 remain draft. Pre-Alpha #695 deliberately excludes this feature. No independent merge or deployment.
