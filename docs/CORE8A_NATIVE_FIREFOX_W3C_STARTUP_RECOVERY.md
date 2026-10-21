# Core 8A — bounded native Firefox W3C startup recovery, no mock clients

Scope: DRAFT test-runner-only child of PR #673. A previously checked
four-player Blacksmith snapshot/QUIC flight occasionally failed before
Firefox #2 admission: real geckodriver answered `GET /status` but
`POST /session` stayed unresolved until its 30-second deadline, then
reported Node `TimeoutError`. This failure cannot be counted as a game
replication, disconnect, combat, or sword interaction result.

This isolated change permits exactly **one** restart under the
specific conditions: (1) test running on Linux; (2) the actor family
is `firefox`; (3) this was the *first* session creation attempt;
(4) the actual native W3C `POST /session` returned a
`TimeoutError`. It kills the entire previously detached driver +
Firefox browser process group with SIGKILL and starts a **fresh**
geckodriver on a **different loopback-only driver port** (original
port +100). If the second session fails, the test fails as before.
No fake sessionId or game actor, retry-on-gameplay-failure,
server-side re-admission shortcut, changed certificate, shell/browser
profile spoofing or extra real game player is allowed. Native PID,
W3C `sessionId`, QUIC handshake, exact fighter roster, server ticks,
rack proximity, ghost removal and peer consensus MUST still pass in
the unchanged original test paths.

No packet/protocol/game client/server, timeout contract, physics,
combat, authored world, item ownership or production config changes.
The synthetic policy unit tests do not represent a native game flight:
existing genuine Chrome+Firefox W3C workflows must pass the same
exact head, along with protected `quality`. The first-run
Firefox startup timeout remains visible in the job logs and is
never silently qualified as a pass. Runbook for subsequent failures:
examine whether any actual W3C session was created and whether a
real QUIC `ALPHA_M1_NATIVE_BROWSER_JOIN` was emitted; distinguish
browser init from gameplay authority.

Release HOLD remains until live physical sword ItemId,
authenticated pixel-click TryPickup, single-writer durable receipt,
four-player equipment replication, Combat and independent client-host
proofs are integrated, tested and authorized by Main.
