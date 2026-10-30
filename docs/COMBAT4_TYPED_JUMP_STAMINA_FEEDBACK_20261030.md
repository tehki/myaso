# Combat: confirmed stamina feedback for the selected JumpAttack owner

Base: Draft #1119, `dc9671f6c05f78c831cfd1405fd29cfc90ba5435`.

## Reproduced defect

Real Chrome and Firefox on the instant-LMB preview correctly spent14 for Jump
and declined JumpAttack when the original World budget was21.1998 or24.3997.
Neither produced an attack or HIT. Both failed to display the established
low-stamina message: the selected typed owner bypasses legacy `onLight`, which
queues the old original-input confirmation. First-red native evidence is kept
separately from subsequent corrections and regression results.

The legacy pointer-first M136 fixture is unchanged. The selected contract uses
Space-before-LMB; late Space cancels an existing LMB gesture. A new native mode
tests that approved physical order without weakening the legacy direct-action
fixture, the60ms chord requirement, or the actual42HP positive tests.

## Presentation correction

An optional read-only accepted-press callback reports the genuine gate's gesture,
sequence, pointer and physical timestamp after it authored its existing edge.
It sends no input; a presentation exception cannot discard the gameplay edge.
The original physical Space sender records its already-sent original client
tick. One bounded UI attempt then waits for the same lease/actor's typed receipt
and actual World snapshot, including processing of that original input for a
new chord. An ACK alone never proves gameplay or a denial.

A fresh held-Space chord below26 can show its existing26-cost presentation only
after a real Jump with less than12 left, or processed original input remaining
Idle below14. An already airborne attempt uses the existing12-cost message.
Original server `flush_jump_under_world_lock` attempts conversion once and
clears pending ownership even when stamina is insufficient; an ACK does not
schedule a later retry after regeneration. Successful World attack phases
discard the UI attempt. No damage, input or resource state is changed.

One Space context labels at most one accepted LMB. SpaceUP and another rapid
press preserve the airborne12-cost meaning. Focus/visibility, pointer cancel,
newer press, dead/different actor, retired lease and bounded expiry discard the
UI state. Duplicate receipts cannot replay a displayed cue. Existing legacy
feedback and the selected profile's default-OFF activation remain intact.

## Validation

Unit coverage includes real first-red resource values, missing/wrong/duplicate
receipts, old World/input ticks, tick wrap, affordable conversion, successful
attack phases, cancellation, focus, actor/lease retirement, death, expiry,
rapid presses and SpaceUP. The accepted-press callback is tested for exactly
one immutable observation and isolation of presentation failure.

Native `jump-stamina` drains resources using actual RMB+WASD, never assigns
stamina or dispatches synthetic gameplay. It proves a fresh26-cost chord and
a distinct airborne12-cost attempt in both engines: each spends exactly14 in
the original World, has exactly one same-gesture5/3 pair, produces no attack or
HIT, preserves HP/guard100, and displays exactly one matching denial cue.
Both Chrome and Firefox passed. Separate genuine two-player Jump42 tests and
mixed-four held Heavy + Chat cancellation passed after the UI correction.
Final full Linux Node1035/1035 passed, including the one-Space/one-LMB context
regression. Both final native chord26/airborne12 runs passed after that guard;
all ten changed runtime/test/workflow Git blobs match on Windows/Linux.
Final exact-SHA tests and CI results are maintained in the PR.

Two CI cases are added; all existing matrix cases and thresholds remain.
Rust World/protocol are unchanged from the parent validated449/default and
456/private tests. Parent #1119 ended49SUCCESS/1FAILURE/1packageSKIP: Firefox
space-guard timed out during W3C new-session, before any Combat. Its bounded
original driver log is preserved; root cause remains unproven. No timeout,
retry or security setting is changed to conceal that incident.

```sh
node --test tests/*.test.mjs
MYASO_LIVE_GESTURE_INSTANT_LMB=1 \
MYASO_LIVE_GESTURE_PHYSICAL_MODE=jump-stamina \
MYASO_LIVE_GESTURE_NATIVE_BROWSERS=firefox,firefox,firefox,firefox \
  node tools/art/main0_v2_knights_combat_four_native.mjs
```

Repeat with four Chrome engines. These one-actor resource/feedback proofs do
not replace the separate multiplayer42HP/FFA/Chat qualification or independent
4D assessment. Production, release flags, protected branches and waiver are
unchanged; Main0 release HOLD remains.
