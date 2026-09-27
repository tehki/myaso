# M123 — Light Recovery Input Buffer

## Goal

Make light combat feel more responsive without weakening commitment.

A deliberate LMB tap placed in the final **90 ms** of centered or directional light recovery is remembered and begins the next light windup only after the current recovery fully completes.

## Rules

- buffer window: final **90 ms** of light recovery
- applies to centered, left-sweep, and right-sweep light recovery
- only a **fresh LMB press** can enter the buffer
- holding LMB does not auto-chain another attack
- taps earlier than the 90 ms window are ignored
- no active, windup, or recovery duration is shortened
- no dodge, block, parry, kick, jump, heavy, or running-strike cancel is added
## Directional intent

The buffer stores the lateral attack lane chosen at the moment of the tap.

That means a late strafe-left + LMB tap produces a left sweep after recovery even if movement changes before the follow-up starts. The same rule applies to the right sweep.

## Interruption safety

Buffered intent is discarded by states that invalidate the follow-up, including stun, knockdown, death, and respawn.

The buffer is private simulation state. It adds no packet bit, snapshot action, protocol version, or wire-format change.

## Acceptance

M123 proves in both the browser combat model and authoritative Rust simulation that:

- a late light tap waits through the complete recovery, then starts the next windup;
- an early recovery tap is not buffered;
- buffered directional intent selects the lane chosen on the tap;
- held LMB cannot auto-chain.
