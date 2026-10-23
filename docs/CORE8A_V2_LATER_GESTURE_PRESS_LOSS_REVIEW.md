# Core 8A — later-gesture PRESS-loss / early RELEASE recovery (draft)

This review is a direct child of the experimental authenticated QUIC/World path in PR #841. It changes only the loopback-only gesture admission policy and genuine original `World.step()` Rust regression tests. It does **not** activate public v2, add a second wire codec/outbox, change original v1 input, or claim user-account authentication.

## Defect

`SessionGestureWorldPath::accept_under_world_lock` withholds an ACK when a RELEASE/CANCEL overtakes a lost PRESS *only when no earlier gesture has ever started*. After the first legitimate gesture has completed, `last_gesture_id=Some(1)` persists. If a new gesture `2` sends PRESS seq3 (lost) followed by RELEASE seq4 (arrives first), the old branch sends `REJECTED` instead of withholding the premature terminal receipt. The proposed Core8A bounded sender treats `REJECTED` as a terminal protocol failure and retires its lease, so the missing PRESS cannot retry. A physical sub-30Hz second click may then be silently lost, even though the gesture itself is legitimate.

## Bounded correction

For any terminal action (`UPGRADE`, `RELEASE`, `CANCEL`) with `gesture_id` newer than the previously *actually admitted* gesture ID, and where reducer rejects because the matching PRESS is absent, withhold only that terminal ACK and leave existing replay/actor/World state intact. The caller still owns the same real, admitted QUIC session and same World lock, and no attack is started until the original PRESS is actually processed. For a terminal against an already completed gesture ID, preserve the explicit `REJECTED` behavior. The unchanged original duplicate/tombstone rules prevent two damage events. A future transport sender must bound retries; no unlimited retry promise is made.

A new real original Rust `World` test admits gesture1 PRESS/RELEASE and confirms one 34HP hit; drops second gesture PRESS3, delivers RELEASE4 first and requires **no ACK and no hit**, then accepts actual PRESS3 + RELEASE4 and steps the real World to exactly one further 34HP (victim 66→32). Duplicate terminal does not double-hit. A companion test denies a CANCEL against the old completed gesture. This remains review-only and needs Core8A/Combat4/8C signoff, focused Clippy/fmt and unchanged full protected CI before Main can consider integration.

**No live v1 changes, production protocol activation, public listener, restart, deployment, merge or Pre-Alpha GO.**
