# Core 8A P0 — a syntactically valid QUIC replay is NOT fighter liveness

## Observed server-owned lifecycle defect

The original Rust `server/src/main.rs` uses a **30-second** authoritative
input-inactivity deadline to release an abruptly disconnected fighter and
its four-player admission slot. Original P0 native
[crash + Blacksmith return evidence](https://github.com/tehki/myaso/pull/668)
measured genuine Firefox-2 process-group SIGKILL → authoritative ghost
removal at approximately **30.15 seconds**, then a truly new Firefox
WebTransport session (net player5) walked back to its original authored
Blacksmith rack2. This was real single-host W3C acceptance, **not** a
durable character login/physical sword ownership proof.

**Defect:** prior code renewed `input_idle_timeout` after syntactic
`decode_input_packet` and **before** `InputIngressWindow::ingest` decided
whether any sample tick was new. A malicious **still-connected** peer
could resend a well-formed already-seen datagram with a new UDP/packet
sequence/ACK, repeatedly renewing its actor/admission lease despite
server ingress accepting zero fresh samples. This is not a claim that a
killed browser actually sent packets after death: it is a separate
adversarial QUIC-stream liveness failure mode.

## Minimal Rust owned fix

Keep `CLIENT_INPUT_IDLE_TIMEOUT=30s`, original admission cap,
WebTransport configuration, client protocol and all native Combat gates.
Decode exactly the same packet and run the same action-loss testing,
snapshot-ACK and ingress pipelines. Move the *only* inactivity reset
to immediately AFTER `ingress.ingest(&packet)`, and renew only when
the actual bounded duplicate/reorder ingress accepts **one or more
previously unseen input samples**. Invalid/unparseable, test-injected
dropped and fully replayed/stale samples never renew. Legitimately new
input samples continue to renew normally, including u32 tick wrap.

The focused test uses the **real Rust decoder + ingress** and
intentionally sends a well-formed unchanged client tick repeatedly
while increasing packet sequence and ACK. Previously the session would
have been kept alive; with this gate none of those duplicates can
extend the deadline. A fresh tick then succeeds. No extra allocations
are needed in the hot path beyond the preexisting bounded batch.

## Boundaries and verification

This test does **not** cryptographically authenticate a canonical
`CharacterId`. QUIC protects an existing transport association, but
a malicious **actively connected** client can still create novel
input ticks and retain its own slot, subject to future actor/session
authorization and server input-rate/time validation. It does not claim
gameplay-server equivalence to actual crash-recovery tests; the latter
must still pass with real W3C Chrome and Firefox players.

No replacement of 8B-owned durable session-generation/fencing,
8C-owned zone/current epoch, Items-owned canonical `u128` item ID or
single-writer receipt is made here. There is **still no authenticated
TryPickup, click-to-pickup, MainHand transfer or real rack sword**.
Prior ghost-cleanup delay of approximately 30s remains intentional;
this patch prevents stale replay from making that deadline unbounded,
not from reducing the configured timeout. The existing test-only
four-person Greyhaven alpha staging mode and production defaults are
unchanged.

Qualify this **DRAFT** with exact-head Rust/Clippy/rustfmt tests,
existing real Chrome/Firefox networking acceptance, original strict
Combat and protected quality. Do not merge `main`, deploy, change
public ports/firewall or claim First Playable readiness without the
Main Orchestrator's explicit integration release decision.
