# Core 8A P0 — Native physical KeyE -> original Rust World auto-heavy

DRAFT, loopback-only/default-OFF, nonrelease. Test-only extension of Core8A
#868. Original myaso-server, World, gameplay browser, Combat timing, packet
formats and protected native acceptance remain unchanged.

Engineering candidate preserves original standalone KeyE **automatic heavy
after 320ms server windup from physical PRESS**, including if released early.
Unlike KeyE, owner-required source0 held LMB heavy remains READY then deliberate
RELEASE-only. Sibling #855 implements mutually incompatible KeyE RELEASE-only
semantics and cannot be merged with Core8A #868 without Combat/Main decision.

The lab starts the exact locally compiled original Rust binary on 127.0.0.1
with MYASO_EXPERIMENTAL_GESTURE_V2=1, opens true TLS-pinned WebTransport, sends
the canonical capability hello and receives original World session grant.
Only trusted native Chromium W3C physical KeyE keyDown/up handlers send typed
source1 canonical 16-byte 0x11 edges, seq1 PRESS and seq2 RELEASE on the same
server-issued current actor/lease. Each original 0x12 ACK must be ACCEPTED,
correct sequence/gesture and nonzero World tick. ACK does not prove damage.

Two independent fresh binary/browser/socket trials are mandatory:
1. Hold KeyE beyond 320ms, assert true original World HeavyWindup9 to
   HeavyActive10 with 19 or more server ticks **before any physical KeyE UP**.
2. Genuine short KeyE UP **before** server HeavyActive, then prove actual World
   HeavyActive10 arrives later by automatic World time (not a release trigger).

Both assert one World HeavyWindup and one HeavyActive, no second heavy after
terminal, true trusted W3C DOM code, original actual server 0x12 ACKs.
No user-selected player, client clock for combat, invented opponent HP or HIT.

It is NOT the UI10 live original gameplay page or multi-human acceptance;
Core8A owns ACK/outbox, Combat4 controls the source1 semantic decision, Core8B/C
own actor/World lease and death/respawn grant, and 4D independently validates
two/four real browser users and all original M-series. No merge/deploy/stage,
public v2 activation or Pre-Alpha GO.
