# Combat: preserve buffered Space+LMB on the selected typed route

Base: #1115, `a0677354b3af708f72fd9eb6cc227c0919fb442b`.

## Reproduction and correction

After a genuine short Light, a source0 JumpAttack intent inside the original
final90ms Light recovery had no receipt: the reducer rejected the new chord
while its previous released Light still owned the lifecycle. The adapter then
withheld the receipt as if a preceding PRESS was missing. The original World
supports this buffered chord, so its loss is a source defect. The failing
World/session/codec test is retained in
`combat-convergence-recovery-jump-first-red.log`.

World now supplies a server-owned admission context: actual Jump, Idle, or the
existing final90ms Light recovery window, with original priorities and genuine
Jump stamina. It does not manufacture a Jump or grant stamina. The existing
sampled Space input must still commit the original World Jump and its14-point
debit before the authenticated intent can request the original12-point
JumpAttack. The typed16-byte event/ACK wire is unchanged.

A valid new chord retires the previous released reducer owner on the proposed
clone, keeps the bounded pending-Jump fence, and replaces any older released
Light slot. Busy, outside-window and exhausted chords receive ordered
no-combat admission with physical/replay fences. They cannot adopt a later
Space jump, and a duplicate cannot promote a no-combat admission to an attack.
A denied exhausted Jump preserves an earlier valid Light buffer, matching the
original World priority rule. Early UP does not erase the accepted chord;
CANCEL removes its uncommitted attack intent.

No gameplay damage, recovery duration, stamina cost, movement, or defensive
timing changes. Original Light recovery remains255ms. Owner-approved
JumpAttack recovery remains450ms. All actual attacks belong to original World.

## Validation

Six original World/session/codec regressions cover a buffered chord, replacement
of a released Light slot, sampled Space ingress after typed intent and early
UP, cancellation, outside-window admission/replay/fresh-input health, and
low-stamina preservation of an earlier Light. A positive case checks the
actual original14+12 debit to74 stamina.

Full Linux Node1017, Rust444 and private-feature451 tests, formatting and strict
all-target Clippy passed before the final additional replay assertions; the
focused chord suite is repeated for those assertions.

Native `recovery-jump` acceptance runs four original independent browser
processes with Chat C1. It stages real players, performs one genuine Light tap,
then native Space DOWN and a short LMB tap inside original recovery. It requires
the typed chord admitted recovery3→3, original recovery3→JumpAttack16 after the
full16 ticks, exact34+42HP against one intended actor,100→74 stamina, and no
collateral or double Light/Heavy. It also requires the full27 authoritative
ticks of JumpAttack recovery (450ms). Chat runs before and after the sequence.
Both Chrome-led and Firefox-led mixed-four cases are added to CI; all previous
cases remain. Pre-commit native runs passed both engines with34+42HP and74
stamina. Exact-commit confirmation follows publication.

The preceding #1115 CI had66 successful checks and a separate W3C POST/session
bootstrap timeout before any Combat or browser artifact. Its first-red log is
preserved: https://github.com/tehki/myaso/actions/runs/40959069333/job/123746755249 .
The harness now captures the actual engine, seat, stage, unchanged startup
deadline and bounded16KB original driver output on that failure. It does not
retry or infer gameplay success from a bootstrap failure.

```sh
cargo test --manifest-path server/Cargo.toml --test combat4_recovery_jump_chord
MYASO_LIVE_GESTURE_NATIVE_BROWSERS=chrome,firefox,chrome,firefox \
MYASO_LIVE_GESTURE_PHYSICAL_MODE=recovery-jump \
MYASO_LIVE_GESTURE_CHAT_C1=1 MYASO_LIVE_GESTURE_INSTANT_LMB=1 \
node tools/art/main0_v2_knights_combat_four_native.mjs
```

Reverse the engine order for Firefox-led physical input. These are local-host
native/QUIC results, not independent human-host/WAN qualification. Main0 still
owns deployment and config activation; independent4D approval is not assumed.
