# M192 — Real server-ingress calibration for heavy defense

## Evidence

M190 merged as `3cef1c75de8f3f7c323009cae7ab6629a06407ee` after an exact-head green PR run. Its post-merge main run [#38136882013](https://github.com/tehki/myaso/actions/runs/38136882013) passed three real guarded heavy blocks, then the first heavy-parry test resolved as ordinary -64 guard damage. Pointer-move delivery calibration does not measure the actual **E→authoritative windup** or **wheel-back→authoritative short block** paths.

## Change

For each real Chrome/Firefox heavy counterplay session, M192 calibrates **both actual input paths** without changing game state: a genuine Chrome E heavy attack is first aimed *away* from the Firefox opponent, and the runner waits for its full recovery while asserting both players still have 100 HP / 100 guard. Chrome's read-only replicated `heavyAttackWindup` transition records end-to-end E-request-to-server latency. Then, with no heavy attack pending, one real Firefox W3C wheel-back creates a short block and the runner records its read-only server `block` transition and end-to-end wheel-request-to-server latency. After the 240ms short block expires, both cursors are restored to their real target angles and the measured real attack and defense gestures are sent concurrently, with a W3C-native pause compensating for the difference in their measured **server-ingress** paths.

The browser runner requires a distinct second real Firefox wheel for the *measured exchange*, and logs calibration tick/latency and observed attack/block tick timing. No gameplay action is synthesized in JavaScript, no server state is set, and no positive combat outcome is manufactured. The calibrated offsets initially target 155ms after windup for a block and 255ms after windup for a parry. Any unexpected damage, parry on a block test, ordinary block on a parry test, or failure to observe the real input is a hard CI failure.

## Qualification

- 3 independent real heavy blocks with exactly 64 guard damage, unchanged 100 HP and no parry
- 3 independent real heavy parries with actual stun feedback, unchanged 100 HP and no guard damage
- Original M107 heavy block/parry/dodge, M34/M40 guard-break, all Chrome+Firefox PvP, Rust and JavaScript, FFA and M8 capacity
- Unchanged 320ms heavy windup, 125ms parry window, 240ms short block, guard/stamina/damage rules
- Full green quality on exact PR head before merge; playable build and live deployment remain closed
