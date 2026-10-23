# Core 8 / Combat 4 — experimental v2 LMB session→World path

**Status:** isolated draft, off by default, loopback only. This is engineering
integration evidence, **NOT** authenticated account identity, public protocol
activation, independent-human-client proof, or Main Orchestrator release GO.

## Root M156 trace

M156 native W3C 5–8ms LMB pointerDOWN/UP on failing source heads produced
no original Rust `LightWindup` for third-party attacker and no 34HP impact.
It was previously not possible to tell whether v1 30Hz sampling submitted the
edge at all: the M156 inputSubmissions array was never instrumented in those
old heads. Dedicated Core8A #837 observed a *passing* short click via
`onLight` → actual sampled v1 attack clientTick48 → coalesced processed
INPUT_ACK → World LightWindup/34HP. This proves a successful baseline,
**not** the intermittent missing-edge root cause. The original data supports
a gap somewhere along DOM, sampler, transport, or server action eligibility,
not a specific proved QUIC drop.

## Implemented minimum isolated path

- New original Rust World actor incarnation increments on join, respawn, reset,
  and same-tick actor replacement; new process-local World instance number.
- Existing server **itself** allocates unique player and session epoch IDs,
  failing closed before rollover. Connection handler cannot accept a
  client-selected actor/lease.
- Environment gate `MYASO_EXPERIMENTAL_GESTURE_V2=1` is rejected on
  non-loopback server binds; default off means v1 transport unchanged.
- Server accepts a new **unidirectional stream on the already accepted QUIC
  connection** with 8-byte v2 control header `02 10 4d 59 41 53 4f 31`
  (ASCII `MYASO1` suffix). Only before legacy v1 Combat activity; then it
  emits reliable length-prefixed `02 13 00 00` grant on existing bidi
  server stream. This is temporary **lab negotiation**, not account login or
  finalized cross-department production version negotiation.
- Only after successful grant: selected 16B version2 `0x11` EVENT with LMB
  source=0 is admitted on **same** QUIC connection. Its actor and lease
  are derived from the connection handler, never client bytes.
- The exact original GameState World mutex contains the actor incarnation,
  owner epoch and lease revalidation, Combat4 GestureAuthority decision,
  original Rust World action mutation, and capture of authoritative server
  tick. `0x12` ACK is receipt/admission status, NEVER combat-hit evidence.
- A genuine PRESS executes the existing original `World` 135ms light
  windup even when RELEASE follows within the same sampled v1 period.
  UPGRADE only unlanded windup; original World 320ms READY waits until
  matching RELEASE; one real 46HP hit. No server damage fabricated.
- Once mode selected, original v1 movement remains possible but v1 attack and
  heavyAttack flags are suppressed for that actor, avoiding duplicate producers.
- Ordered per-lease sequence/gesture identities, bounded replay journal,
  duplicate suppression, full actor/World retirement and conservative denial
  on invalid source and malformed packet; KeyE source1 is **explicitly
  rejected** until its separate Combat4 source arbitration is integrated.

## Evidence and strict limitations

New Rust integration tests cover: two press/release events in one client tick;
real World 34HP and 46HP hits; no heavy auto-hit; duplicate/ACK; lost first
PRESS and later replay; wrong session epoch, same-tick actor slot reuse, a
different World with coincident actor/tick/incarnation, KeyE/source unsupported,
malformed bytes and incompatible `0x52`.

**Native experimental proof — X230i / original Rust server / real Chromium:**
`node scripts/core8_native_v2_quic_gesture_lab.mjs` **PASS** with genuine W3C
pointer down/up measured ~10.9ms, two actual accepted 0x12 ACKs at
server ticks 87 and 88, and original Rust `M201_AUTH_ACTION` LightWindup1
at server tick88. The test opened the accepted QUIC bidi stream, negotiated
v2 via client uni stream on that same connection, and sent two independent
16B edge datagrams. The browser did NOT supply an actor or World identifier.
This is an isolated one-client lab, **not** a native 2–4 player Combat test;
it does not prove the client resend outbox, network loss recovery, or
one 34HP hit on a second player. New real native workflow covers this exact
path on PR head; local proof alone is not GitHub CI green.

The test suite is **not** evidence of the original game's integrated
Chrome/Firefox authenticated v2,
fully validated player-account authentication, persistent 8B CAS/generation,
cluster-wide owner epoch, loss-resistant browser outbox transmission, or
finished source1 KeyE handling. Account authentication does not exist on the
original Pre-Alpha anonymous game; trusted identity cannot be invented from
WebTransport TLS or a client claim. The loopback gate is nonrelease.

Required next gates: implement genuine Chrome/Firefox original WebTransport
gesture client + negotiated ACK and bounded 8A typed resend queue; verify
M156 6ms pointer case and full original protected M-series, test 8B identity/
session generation, integrate source1 KeyE, deliver 2–4 independently
operated humans and Main immutable staging/rollback. Main is sole public
integration/release writer. **NO MAIN MERGE / PUBLIC PROTOCOL / DEPLOY / GO.**


## Core 8B cross-boot authority correction (P0, separate stacked draft)

- A separate Core8B source review showed the first actor/session/World/life
  tuple `1:1:1:1` repeats in independent process boots. Those process-local
  numeric identifiers cannot be cross-restart proof of game-seat identity.
- This child obtains a **fresh nonzero 128-bit CSPRNG boot nonce** from the
  operating system before an experimental v2 server starts accepting connections; failure to
  obtain randomness or an improbable all-zero result causes startup to fail.
  No timestamp, PID, network client input or MYCH checksum is used.
- The server stores the boot nonce in trusted `GameState`, and its
  `SessionGestureWorldPath` immutable actor binding now includes the nonce.
  Actual World admission and 60Hz dispatch verify the **current live boot
  nonce under the same GameState World mutex** together with current lease,
  World instance and actor incarnation. The nonce is **never transmitted on
  wire**, nor can a client choose it.
- New Rust tests launch **two independently booted OS subprocesses** and
  require a distinct real CSPRNG nonce while demonstrating identical local
  numeric actor tuple. Wrong-boot/zero-boot adversarial PRESS is rejected
  before the original World can enter windup. Exactly one OS boot identity
  is generated when the experimental v2 lab is enabled; new admissions use its immutable value.
  Disabled legacy v1 mode has no new entropy requirement.
- Security limit remains: this implements a **server-issued ephemeral game
  seat authority token** bound to the admitted QUIC session, not a human login,
  persistent account authentication, dedicated QUIC client identity or
  cluster-zone globally fenced epoch. Production approval still requires
  cross-department 8A/8B/8C explicit sign-off, original strict M-series,
  multi-host and Main single-writer release gates.


## Four simultaneously admitted ORIGINAL Rust QUIC sessions — 2026-10-23

Dedicated strict nonrelease original-server integration test
\`server/tests/prealpha_four_real_quic_gesture_seats.rs\` spawns a genuine
isolated loopback Rust game server with \`MYASO_MAX_PLAYERS=4\` and v2 lab
explicitly opted in. It opens **four separate wtransport client endpoints**
with separate native UDP sockets and **server-pinned real TLS**, each real
connection opening the original game bidi stream then a separate client
uni-stream carrying precisely the canonical 8-byte version grant hello.
Each receives its OWN accepted reliable v2 negotiation grant.

All four independent current QUIC leases send original \`02 11\` source0
PRESS(seq1,id1) and matching RELEASE(seq2,id1), proving a lease-scoped
identity means **the same sequence/gesture ID across different actors is not
a collision**. All eight ACKs are original Rust server \`02 12\` with
actual nonzero World ticks; no packet can name its fighter. Server read-only
original \`M201_AUTH_ACTION\` confirms **fighter1,2,3,4** each entered
\`LightActive2\` from genuine original \`LightWindup1\` during their common
World loop (not a mocked fixture). Actor life/boot epoch checks remain
unchanged. A fifth independent real TLS client receives real server
admission rejection, and all existing four continue delivering acknowledged
Combat inputs afterward.

This verifies **four genuine pinned QUIC sessions and server-owned World
combat state**, **NOT** four separate physical hosts, live human accounts,
four independent graphical browsers, or guaranteed multi-client HP damage
in a shared visual arena. The one-browser Chromium physical pointer test
still exists separately; KeyE source1, UI10 original-game event ownership
and complete loss/retransmit browser integration remain pending. Full
original protected Combat M107/M193/M194 are independent mandatory gates.\n

## KeyE source1 independent original World heavy — 2026-10-23, DRAFT child

The **default-OFF negotiated loopback experimental** source now accepts
\`02 11\` with source byte3 **1 KeyE**, as a genuine *independent source*
sharing LMB0's **one** global lease-scoped accepted sequence, gesture ID,
replay journal and trusted actor/boot/current World mutation lock. Original
source0 LMB early light/upgrade/undercharged light semantics and original
legacy v1 inputs are unchanged. Client tick and source byte are **not** actor
authentication. Source1 UPGRADE remains invalid in the canonical codec.

Source1 PRESS starts actual original Rust \`HeavyAttackWindup\` with a
server-owned **320ms** held charge. After READY, heavy stays held with
**zero hits until matching KeyE RELEASE**; that release makes the actual
\`HeavyAttackActive\`, capable of one original 46HP hit in range.
An under-320ms KeyE release or any prehit KeyE CANCEL aborts **without**
becoming a free 34HP LMB light or future heavy. This does NOT change
standalone *legacy v1* KeyE input, normal hit damage, parry, iframe or
stamina behavior. A wrong-source LMB RELEASE/CANCEL cannot manipulate
KeyE charge or consume that valid source1 shared sequence. A KeyE
RELEASE/CANCEL cannot release an LMB source0 gesture even if its ID
matches. Duplicate and replayed source1 sequences are bound to the
original exact source and cannot issue an extra World HIT. The source
owner is enforced under the **same original World mutex**.

New original World tests prove the real 46HP KeyE contact/HP100→54,
early-release and CANCEL no hit, typed replay/source separation,
and sequential LMB 34HP then KeyE 46HP (victim HP100→66→20).
A new **actual native pinned QUIC** test proves source1 PRESS,
held no auto-heavy, *rejected source0 RELEASE*, accepted source1 RELEASE
and original M201 World transition 9→10. Dedicated
\`scripts/core8_native_v2_keye_heavy_world_lab.mjs\` issues genuine W3C
physical Chrome KeyE keydown/keyup (not \`dispatchEvent\`) across the
original game binary's admitted WebTransport QUIC session, verifying
original World 9→10 **after real release**, and accepted 0x12 ticks.

These are **experimental harness** browser controls, NOT activation
of KeyE in original \`web/online-game.mjs\` or delivery of an original-game
shared 8A browser outbox. Remaining cross-project gates: original UI10
real DOM edge source-switch, one bounded outbox for BOTH sources,
Human/account player-seat authentication beyond ephemeral trusted QUIC
session, Core8C true zone owner fencing, 2–4 separate real physical
browser hosts, all original Combat M-series protected CI and orchestrator
GO. No main merge, staging, public endpoint, deploy or restart.


## Shared source0/source1 gap fence, 23 October review update

**Core 8 P0 bug fixed in draft only:** a transport-reordered KeyE PRESS with
global sequence 3 previously could arrive before valid older LMB PRESS
sequence 1 and RELEASE sequence 2, advance the lease's accepted sequence,
then irreversibly STALE the real physical source0 gesture. The converse
source0-after-lost-KeyE sequence has the same failure. Under the **existing
original authoritative World lock**, v2 admission now withholds ACK for
a valid typed event with a sequence greater than the current globally accepted
sequence plus one. This never mutates World, advances gesture timers or
creates fake HIT; the one bounded Core 8A outbox must retransmit the missing
earlier event. Existing duplicate/tamper/source1 ownership checks still
apply. New genuine original World integration tests use both orderings and
prove exactly one legal 34HP LMB plus one 46HP KeyE hit after retransmission.

**IMPORTANT CROSS-DEPARTMENT INCOMPATIBILITY — DO NOT MERGE EITHER BEHAVIOR
UNREVIEWED:** Core8A sibling draft PR #858 models standalone KeyE heavy as
auto-committing when World finishes the original 320ms windup, treating
KeyE RELEASE/CANCEL as noncommitting acknowledgements. This PR #855 models
KeyE as deliberate **release-only heavy**, with early release/CANCEL a
nonhitting abort. Both agree original LMB light 135ms and held LMB 320ms
READY then RELEASE-only. The owner and Combat4 must explicitly choose
**the standalone KeyE game rule**, with physical W3C test and canonical
UI10 behavior, before Main combines these mutually incompatible branches.
Original v1 KeyE remains untouched in both drafts.

This source-only experimental repair does NOT show the original UI10 source0/
source1 browser outbox is enabled, four independently operated humans,
or that unchanged protected Combat M193/M194 gate passed.
