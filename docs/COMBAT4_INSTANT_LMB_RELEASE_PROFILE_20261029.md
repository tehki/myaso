# Source candidate: instant Light and held Heavy release profile

The first-party game can now select an operator-owned instant-LMB profile.
It is default OFF. No live configuration, runtime flag, public listener,
deployment or protected branch was changed by this work.

The source contains two explicit rollout controls:

- Trusted HTTPS `/game-config.json`: `instantLmbEnabled: true`. The official
  lobby adds `instantLmb=1` only for that validated flag. The game independently
  fetches the same-origin config and matches the exact server URL and TLS pin.
- Original Rust process: `MYASO_INSTANT_LMB_ENABLED=1`. Without that independent
  switch no gesture capability is granted. Existing experimental gesture and
  JumpAttack switches remain OFF for the release profile. Combining release
  and experimental gesture profiles fails closed.

These are concrete source integration settings for Main0's later release
assessment; they have not been applied to production. The existing
`gestureLab` path remains loopback-only. A separate `instantLmbPreview=1`
acceptance path requires both the HTTP page and pinned HTTPS game server to
be loopback. A public query alone cannot activate either profile.

One original QUIC lease owns physical LMB edges and the noncoalescing outbox.
The original sampled v1 Light/Heavy writer is excluded for that profile.
Physical DOWN immediately requests original World Light windup. An early
unlanded-only hold intent can upgrade the same gesture to Heavy; original
server elapsed time determines READY320, held until genuine physical UP.
An already activated Light can never become Heavy. Existing late-upgrade
NO-COMBAT admission preserves the matching terminal and healthy lease without
adding a second damage window. Client time remains diagnostic.

The selected 16byte source0 event/ACK codec, sequence/replay journal, server
nonce, actor incarnation, World mutex and admitted session remain unchanged.
Negotiation uses the original game bi stream from #1112; Chat C1 keeps its
existing optional uni stream and one-message-per-Enter UX. Source0 Space+LMB
uses the existing server-owned JumpAttack extension; Key E remains reserved
for Use. Parry125, short Block240, damage34/46/42 and JumpAttack recovery450
remain unchanged. Default legacy clients retain their existing control path.

Two actual cancellation defects were reproduced before correction:
visibility cancellation could wait for the170ms retry, and element blur does
not bubble to the window drain listener. The common source owner now flushes
hidden-page CANCEL immediately and handles actual canvas blur, including Chat
Enter, without a phantom RELEASE. Public gameplay exposes no local QA proof
hook; loopback diagnostics remain detached, read-only replica observations.

Validation on the source candidate:

- Linux full Node1011/1011; original Rust425/425; private-feature Rust432/432;
  format and all-target strict Clippy PASS.
- Real QUIC release capability with experimental flags OFF and Chat connected
  passes both negotiation orders, including idle legacy Chat.
- Native Chrome- and Firefox-led Heavy: Light DOWN, one upgrade, server-held
  READY, exactly one HIT46/HP54, no Light double hit or bystander damage.
- Native Chrome- and Firefox-led two-player JumpAttack actual World HIT proof.
- Three-player Chrome/Firefox/Chrome simultaneous Light threats: two HIT34,
  centerHP32, attackersHP100, original secondary WINDUP/STRIKE assertions.
- Four mixed Chrome/Firefox Chat focus, proximity, UTF8 and one-Enter regression.
- Four-player native lifecycle, death, respawn, stale old-lease rejection and
  fresh-actor reconnect, all on the new release profile with Chat connected.
- Both Chrome- and Firefox-led native held-READY cancellation: real Enter moves
  focus to Chat, server accepts CANCEL, later physical UP creates no RELEASE,
  no damage occurs and Escape restores canvas focus. Raw World/receipt proof.

The native matrix adds the release-profile cases without replacing the
existing experimental/default cases. Raw logs, first reds, original World
trace and screenshots are preserved under common Git evidence directory
`myaso-evidence/combat-convergence-20261029` on Serj and Windows. Exact source
hashes, final native cancellation results and CI belong in the PR/checkpoint.

This candidate does not resolve the independently preserved native defense
scheduling failures from earlier heads: delayed M33 wheel, M188 Heavy resolving
as Parry, and M111 expired Block. These remain active follow-up work; no old
release waiver or independent4D verdict is extended.
