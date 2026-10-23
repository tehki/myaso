# Core 8A — two independent browser sessions over one original Rust World

DRAFT / NONRELEASE. Child of the real one-browser Core8A outbox proof
#872; no production code, Combat timings, protocol ABI or protected test
expectations modified.

One spawned actual original myaso-server uses loopback-only explicitly
negotiated v2 with cap4 and an ephemeral TLS certificate. Two independent
ChromeDriver processes on distinct OS ports each start their own real
Chromium and distinct W3C session. Both simultaneously connect their
own pinned WebTransport QUIC socket, original bi-stream and exact
capability HELLO/FIN, then receive one server-owned original grant.
Both use an independent import of the SAME original Core8A source
ES module ProposedSharedTypedGestureOutbox, separate opaque leases,
global per-lease accepted sequence, and a separate ACK receive path.

Browser #1 executes actual W3C physical LMB down then KeyE down/up while
LMB is active then LMB up: seq1/2/3/4; the server must acknowledge
each and enter original fighter1 World LightActive. Competing KeyE
BUSY is no-combat and cannot cause fighter1 HeavyActive.

Browser #2 separately executes trusted W3C physical KeyE down, requires
original fighter2 World HeavyWindup9 to HeavyActive10 while physically
held, then KeyE up: its own seq1/seq2 and server ticks. Exactly
one fighter2 HeavyActive; never a second strike caused by release.
Both separate browser queues must settle with no pending and remain
open; all ACKs must prove transportSettled without pretending HIT.

Local X230i successfully ran browser1 but could not launch a second
independent Chromium. Thus local two-browser evidence is NOT PASS.
The exact-head focused GitHub Actions test MUST run on a runner that
can start two real separate Chrome browser processes. Any failure is
a failed acceptance, not a test to skip. No desktop browsers or other
unrelated user processes may be killed to free resources.

This is distinct browsers and QUIC game sessions on one CI host,
NOT independently operated human players on distinct host machines.
Original production UI10 web/online-game.mjs remains v1, and no
human-identity, post-respawn regrant, real target HP vs 2 browsers
or Combat4 M107/M143/M156/M193/M194 full Pre-Alpha release GO is claimed.
No main merge, public ingress, staging, restart, deployment or waiver.
