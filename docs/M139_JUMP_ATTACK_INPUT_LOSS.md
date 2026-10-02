# M139 — Jump attack input-loss recovery

## Goal
Prove the real Space + LMB jump-attack chord survives deliberate loss of its first newly observed action datagram.

This milestone changes no combat balance and no authoritative combat semantics.

## Fault model
The existing browser-flight server fault injector is enabled with `MYASO_FLIGHT_DROP_NEW_ACTION_DATAGRAMS=1` for the M139 scenario.

When the server first observes a new action tick, it logs `M63_INPUT_ACTION_PACKET_DROPPED` and discards that datagram. The normal redundant input history in later datagrams must recover the action.

## Real-browser proof
M139 reuses the M136 WebDriver chord:
- Space key down/up from the real keyboard source;
- LMB pointer down/up from the real mouse source;
- down edges within 60 ms;
- no synthetic gameplay input injection.

Acceptance still requires Chrome authority and Firefox replication of the jump-attack lifecycle.
## Acceptance
The exact scenario must prove all of the following:
- at least one first-send action datagram was deliberately dropped;
- the genuine Space + LMB chord was delivered once;
- authority entered `jumpAttackWindup -> jumpAttackActive -> jumpAttackRecovery -> idle`;
- Firefox replicated the same lifecycle;
- no plain jump won before the jump attack;
- the clean hit still deals exactly 42 HP damage;
- attacker HP/guard remain unchanged;
- no accidental parry occurs.

## Scope
Only browser acceptance plumbing, query-gated diagnostics, CI, and this document are changed. The playable build is not opened by this acceptance path.