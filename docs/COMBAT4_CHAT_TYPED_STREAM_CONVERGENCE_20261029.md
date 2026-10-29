# Chat C1 and source0 Combat stream convergence

This source candidate preserves the selected 16byte source0 event/ACK codec,
server-assigned actor, lease epoch, boot nonce, World admission and Combat rules.
All experimental activation remains explicit, default OFF and loopback-only.
Production was not changed. This is a prerequisite to the release-profile LMB
source work, not public activation or a release verdict.

The existing server rejected Chat C1 plus typed gestures because two concurrent
`accept_uni` calls could claim each other's stream. A prefix dispatcher would
break an older C1 client that opens an idle stream and waits for its server
reply before writing. Preserve that existing Chat behavior.

The original game bi stream now accepts the existing 8byte gesture HELLO in its
existing length framing. It returns the same 4byte server grant on the same
original reliable stream. Actual source0 events and receipts remain unchanged
datagrams. Chat exclusively owns incoming uni streams when enabled. The older
unframed experimental uni HELLO remains compatible when Chat is disabled.
No second connection, actor identity, admission clock or client authority is added.

Control reads are incremental and cancellation-safe, bounded to one header and
one permitted frame: 8byte HELLO before grant, or existing private 32byte control
after its separately enabled grant. Partial negotiation does not pause Chat or
the original simulation. Lease creation and World access remain under the same
original mutex. Browser writer backpressure shares the existing handshake
deadline; retirement prevents an old queued HELLO from escaping afterward.

Real QUIC regression first failed on baseline with the actual startup error
`Chat C1 and experimental V2 cannot both accept optional uni streams`.
The fixed regression proves both connection orders, including idle legacy Chat;
another sends Chat successfully between partial game-header and partial-body
writes, then completes the exact same HELLO and receives the real grant.

Validation before source freeze:

- Full Node: 1003/1003.
- Full original Rust: 424/424; private-feature Rust: 431/431.
- Rust format and private-feature all-target Clippy `-D warnings`: PASS.
- Four Chrome/Firefox/Chrome/Firefox Chat clients with typed capabilities:
  proximity, one-message-per-Enter, text-only HTML handling, UTF8 boundaries,
  focus isolation/restoration and continuing original input ACKs: PASS.
- Four original Silver game pages with Chat connected: actual W3C typed text
  delivered before and after a held LMB; original World Light on PRESS,
  one unlanded Heavy upgrade, server READY held until physical UP, exactly one
  Heavy HIT46/HP54, no Light HIT and no bystander damage: PASS.

The first four-Chat attempt exposed a harness limitation: one GeckoDriver
cannot host two simultaneous Firefox sessions. It failed before the fourth
session, with no Combat verdict. Each real browser now has its own owned driver.
The raw failure is retained. CI adds a mixed four-native Chat + held-LMB matrix
entry and the complete Chat focus regression for that entry.

Raw developer evidence lives in Serj common Git evidence directory
`myaso-evidence/combat-convergence-20261029`, with SHA256 manifest and native
screenshots/World traces. Exact commit and CI results belong in the PR/checkpoint.
Independent 4D scope and Main0 release assessment remain separate gates.
