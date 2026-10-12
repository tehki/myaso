# M199 — Sequential one-click block-only timing margin

## Verified failure

M198 PR #227 passed exact-head quality #1030 and merged as `f96bb5b`.
The independent main quality [#38259669037](https://github.com/tehki/myaso/actions/runs/38259669037)
passed M194 guard-break repetitions 1 through 4, then correctly failed
repetition 5's third real exchange with a **successful parry**, not
the required -38 blocked-guard hit. Chrome's 3 genuine LMB clicks and
Firefox's 3 genuine wheel-back events were present. No HP/guard assertion
was loosened.

M198's 0ms pointer pause made the nominal wheel-to-impact time the
unchanged 135ms light windup, only 10ms after the unchanged 125ms parry
boundary. Cross-browser WebDriver/renderer/authoritative ingress skew
occasionally kept the heavy-guard break exchange inside the parry window.

## M199 acceptance-only adjustment

Keep M198's sequential one Firefox WebDriver wheel ACK followed by one
genuine Chrome W3C LMB click *per exchange*, and its intact event
provenance and three distinct -38 guard hits.

Set a bounded **40ms genuine pointer pause** after the Firefox wheel
acknowledgment. Derive it from the center of the 125–240ms block-only
window, minus 135ms attack windup, capped to 40ms to retain margin
against slow browser ingress. The nominal 175ms impact target leaves
50ms after the parry boundary and 65ms before short-block expiry.
Fail the deterministic planner if those timing limits become impossible.
Document the actual pause and margin in the existing W3C plan telemetry.

Do not issue extra wheel/click inputs, retry a resolved exchange, forge
combat actions, extend block/parry, modify gameplay constants, or
accept any parry, HP loss, unexpected damage, missing guard break, or
wrong direction.

## Qualification

Run the full original CI with five fresh Chrome/Firefox guard-break
sessions, strict Rust authoritative combat, JavaScript, multiplayer
FFA and 512-occupant capacity. Merge only on a fully passing exact-head
run and then independently verify the merged main. Production stays
undeployed and the playable build closed.
