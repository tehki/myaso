# Main 0 standard-path candidate notes

Release status: **HARD HOLD**. This document authorizes no merge, deployment, restart, public experimental protocol, release publication or production configuration change.

## Resulting behavior

The original standard input path now rejects an older or equal whole packet before its samples occupy the existing deduplication window. This prevents a delayed old block, movement or facing state from replacing newer input. A genuine older action sample inside a newer packet still uses the original recovery/coalescing path and can commit exactly once.

The confirmed before-fix regression accepted old sample ticks18/19/20 after newer neutral state and produced an actual original World `Parry { attacker:1, target:2 }`. The corrected regression requires one actual 34HP HIT and no refreshed parry. Additional tests retain old-hole recovery, movement/facing, uint32 wrap, duplicate headers and fresh-connection independence. Final CI must prove GREEN; this description alone is not acceptance.

M156 gameplay and timing assertions are unchanged. Its existing standard-input and original World diagnostics are now enabled only in the bounded loopback native fixture, allowing independent attribution of the intended third-party 34HP conversion. Tests execute the actual wheel and cancellation handlers for positive, negative and zero deltas, timer expiry, blur and hidden pages.

## Post-bfb CI recovery candidate (validation pending)

The standard writer now preserves the original encoded T/T+1/T+2 action datagrams in its existing single flush path. Ordinary movement remains latest-wins. Retention is bounded to eight original packets and 1500ms; overflow/stall retires that connection and reconnect cannot inherit its actions. This addresses the observed M230 recovery at T+3 without weakening its exact three-copy correlator or the server whole-packet freshness guard.

The existing three-sample redundancy retains the genuine classified LMB release (dual-bit hold to light-only or heavy-only) through subsequent neutral samples within its unchanged four-tick limit. A dual-bit hold to neutral cancellation never creates a release. Actual client/codec/stalled-writer regressions reproduced the missing light and long-held heavy release before this correction. The encoder also preserves legitimate previous samples across uint32 rollover using bounded modular age.

M35 now uses the existing M41 current-attempt original World windup observation before its one genuine wheel. Standard M147 waits within its existing bounded deadline for actual selected punisher feedback as well as actual victim HP, rather than qualifying a victim-first update before the punisher browser receives it. Damage, recovery-window, identity, guard and focus assertions remain intact. Read-only standard input/World diagnostics also cover M147 and the M156 physical click classification and exact 30Hz submissions.

Native acceptance now repeats M35, M41, M156, standard M147 and one-packet M230 twice each, alongside the original stale-packet regression. Separate two-packet-loss and full-quality jobs remain required. These source changes and Node regressions are not a native PASS; final immutable workflow heads and independent 4D signoff must qualify the candidate.

## Compatibility and configuration

- Original60Hz World, server damage authority, QUIC/WebTransport, current actor assignment and wire format are preserved.
- Existing three-sample recovery and exact original-action correlation remain required. Whole-packet freshness does not discard older samples carried in a new packet.
- Parry125ms, block240ms, light34HP and heavy46HP are unchanged.
- Positive wheel delta requests parry/block; negative requests roll. E remains reserved for inactive future Use.
- No second World, transport writer, Combat producer, client-owned damage or new public protocol is introduced.
- Standard acceptance URLs omit experimental gesture/HIT laboratory parameters. Release builds use the default empty feature set.
- Existing private code remains dormant outside its separate scope and is not used as proof of standard-path or public acceptance.

## Reproduction and evidence

Run the original World freshness tests with the default feature set:

```sh
cargo test --locked --manifest-path server/Cargo.toml --bin myaso-server core8a_standard_input_freshness_tests -- --nocapture
node --test tests/standard-wheel-controls.test.mjs tests/m156-original-world-trace.test.mjs
MYASO_PVP_SCENARIO=uistun node scripts/pvp_browser_flight_runner.mjs
MYASO_PVP_SCENARIO=uiparrytell node scripts/pvp_browser_flight_runner.mjs
MYASO_PVP_SCENARIO=uirollknockdownffahit node scripts/pvp_browser_flight_runner.mjs
```

The native commands require genuine Chrome/Firefox drivers and the existing authorized build environment. They start isolated standard-protocol processes; they are not cross-host or production commands. The registered Main 0 workflow runs two independent trials of each scenario and preserves source SHA, raw inputs and World logs.

Final evidence is the immutable workflow head, downloaded artifact `REVISION`, complete `SHA256SUMS`, bundle digest and Main 0/Combat 4D GitHub record. Do not transfer a predecessor's green status to a changed source.

## Review package verification

The existing `alpha-package` workflow now permits this canonical review branch. It builds with default features, copies the established public assets and binary, pins `REVISION` to the actual checked-out head and verifies all extracted file checksums. Its review artifact has a distinct name; there is no deployment step.

For a downloaded trusted review artifact, verify its supplied bundle checksum before extracting into a fresh inspection directory, then verify `SHA256SUMS` and `REVISION`. Verification is not release authorization or an operational rollback drill.

## Rollback and external gates

The prescribed previous-version operational drill remains blocked until the authorized operator supplies an isolated target, previous known-good artifact and its digest, actual service identity, reviewed stop/restore/start/health commands and an independent witness. No service names, restore points or deployment commands are invented here. An art-flag toggle or successful archive extraction does not qualify application rollback.

Independent-host candidate/WAN acceptance remains separate from the public Alpha hit/block smoke and runner-local native trials. The latest bounded private peer probe received no packets in either direction; no VPN/firewall settings were disabled. Serj's exact temporary destination rule remains because its noninteractive deletion requires operator sudo authentication. These are explicit outstanding gates, not implied PASS results.
