# Combat: preserve the original Light recovery input buffer

Candidate base: #1114, `163c25c305d23618e894dadb5d2161e05daa3659`.
The Instant LMB profile and deployment remain separately controlled by Main 0.

## Reproduced source defect

The release-profile three-native M152 flight admitted source0 PRESS and RELEASE
inside the original final 90ms of Light recovery but never started the next
Light. The original trace had PRESS tick413, RELEASE tick414, recovery exit415,
and no next attack. A real World/session/codec integration test reproduced the
same failure: expected AttackWindup, observed Idle. The original failing logs
are retained, including `combat-convergence-recovery-buffer-first-red.log`.

## Authoritative correction

One session-owned pending intent preserves the original single-slot Light
buffer. World captures its actor incarnation, World instance, original recovery
action, bounded expiry and original input direction. No client timestamp is
used. Only AttackRecovery and directional Light recoveries qualify, within the
existing 90ms window. Heavy and JumpAttack recovery are not extended.

The original World FSM completes the entire 255ms Light recovery before the
session may start a new original Light windup. A queued held upgrade is deferred;
the actual new World action starts its own attack clock. Recovery time cannot
contribute to Light activation or Heavy READY320. Early UP resolves to one
normal Light; held Heavy still requires physical UP to land its one 46HP hit.

A recovery-input revision records which accepted original input most recently
owns the buffer. Later valid Block/dodge/jump/kick/Light input supersedes a queued
intent using the existing input priorities. Original action timings, damage,
stamina costs and input-priority decisions are unchanged. A denied exhausted
input does not erase an earlier accepted buffer.

CANCEL, session retirement/drop, actor replacement, World replacement and expiry
cannot leave an autonomous World buffer. Discarded intent terminals remain
admitted no-combat with their existing physical and replay fences. Previous
gesture retirement now happens on the proposed reducer clone: a forged newer
gesture with a stale sequence cannot destroy a valid queued tap.

## Native acceptance and proof

`scripts/native-recovery-buffer.mjs` adds an original four-browser acceptance
mode, `recovery-buffer`. It stages real players using WASD, sends exactly two
genuine short pointer DOWN/UP pairs, and observes the second PRESS admitted
from recovery3 to recovery3. It requires an original recovery3 to windup1 edge
at least16 authoritative ticks after recovery entry and exactly two original
34HP hits on the intended actor (100→66→32). All four real replicas must agree;
the other actors retain100HP. Native Chat runs before and after the sequence.
Both Chrome-led and Firefox-led mixed-engine cases are included in CI.

The existing loopback-only read-only phase output additionally reports Light
recovery3; it neither steps nor edits World. M201 proof parsing strictly accepts
the already existing canonical typed-admission record as a separate `gesture`
row. It never treats an admission or ACK as a World action or HIT. Tests reject
malformed admission fields, invalid bounds, unordered records, and replacement
of a mandatory World-active edge with an admission. All existing exact victim,
damage, active-phase, stun-window and no-collateral assertions remain required.

The first native M152 after the source correction produced the actual34HP hit
but failed because the older parser rejected typed-admission records. That
first failure is retained separately from the passing strict-parser result.

Previous candidate #1114 had66 successful checks and one failing Quality job:
M110 now waits for original World phases, but its runner omitted that scenario
from the loopback proof flag. This candidate enables the existing read-only
proof for M110; the genuine two-wheel Heavy guard-break case passes locally.
CI failure: https://github.com/tehki/myaso/actions/runs/40955149319/job/123733202590

## Reproduce

Development validation: full Linux Node1016/1016, Rust438/438,
private-feature Rust445/445, formatting and strict all-target Clippy passed.
All13 new World/session regression tests passed. Pre-commit genuine native
M152 and legacy M110 passed, and both Chrome-led and Firefox-led four-browser
buffer cases produced exactly34+34HP with the original16-tick recovery.
The initial four-browser runs checked Chat before Combat; the final harness
also checks one-message-per-Enter and restored arena focus after buffered Combat.

```sh
cargo test --manifest-path server/Cargo.toml --test combat4_typed_recovery_buffer
node --test tests/m201-authoritative-phase-proof.test.mjs
MYASO_PVP_INSTANT_LMB=1 MYASO_PVP_SCENARIO=uiguardbreakpunishffahit node scripts/pvp_browser_flight_runner.mjs
MYASO_PVP_SCENARIO=uiheavyguardbreak node scripts/pvp_browser_flight_runner.mjs
MYASO_LIVE_GESTURE_NATIVE_BROWSERS=chrome,firefox,chrome,firefox \
MYASO_LIVE_GESTURE_PHYSICAL_MODE=recovery-buffer \
MYASO_LIVE_GESTURE_CHAT_C1=1 MYASO_LIVE_GESTURE_INSTANT_LMB=1 \
node tools/art/main0_v2_knights_combat_four_native.mjs
```

Reverse the browser list to `firefox,chrome,firefox,chrome` for Firefox-led input.
Native evidence is same-machine original-browser/QUIC evidence, not independent
human-host or WAN qualification. Independent4D assessment and Main0 release
decisions remain separate from development validation.
