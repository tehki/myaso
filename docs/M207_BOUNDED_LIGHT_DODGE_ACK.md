# M207 — bound genuine first-light dodge W3C acknowledgement delay

## Failure observed
In M201 merged-main [quality #38359994241](https://github.com/tehki/myaso/actions/runs/38359994241), the existing M36 real Firefox light strike / Chrome perpendicular wheel roll test failed correctly. Firefox recorded one real 34 HP hit before the defender's actual dodge became effective; a later successful dodge event cannot undo the damage. The strict 100 HP acceptance assertion failed. Its unchanged rerun passed, confirming a driver scheduling variance rather than permission to relax the combat contract. Tracking: [issue #239](https://github.com/tehki/myaso/issues/239).

## Candidate correction
M36 previously sent a genuine Firefox pointer-down W3C call and **awaited the entire driver acknowledgement** before even scheduling a 20ms pause and Chrome's genuine wheel-forward. In the exceptional slow-ACK case, that sequence can deliver the first wheel after the first unchanged 135ms light-attack windup.

M207 still starts **one real Firefox W3C LMB-down first**, but waits no longer than **35ms** for its driver ACK before initiating **one genuine Chrome W3C wheel-forward** while the real Chrome S key remains held. Both driver operations must succeed, and the single Firefox LMB-up and real Chrome S-up must be sent; no synthetic gameplay input, extra attack, second roll, hidden retries, timing constants or client/server code changes. Firefox ACK timing is only a harness scheduling hint; it does *not* prove input ingress ordering between separate drivers.

The unchanged M36 real-browser acceptance must continue to prove actual defender 100HP/100 guard, real Firefox pointer down/up and directional aim, authentic Chrome wheel and S down/up, authoritative dodge evasion feedback, and absence of parry or damage. A late roll, unblocked strike or real input inversion fails the CI gate.

## Qualification
Pass all focused scheduler tests plus the full exact-head Rust/Node and authentic Chrome/Firefox M36/M107/M194, three fresh M205 M152 server-proof sessions, M155/M159, and 512-occupant quality. Then independently verify merged main. Production and public playable remain closed.
