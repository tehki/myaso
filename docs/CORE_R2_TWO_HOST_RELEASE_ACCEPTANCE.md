# R2 — independent-host staged admission recovery acceptance

This is a **test-only** acceptance gate for Core 8A R2, stacked on
[PR #391](https://github.com/tehki/myaso/pull/391) and tracked by
[Development Center #360](https://github.com/tehki/myaso/issues/360).

It does not change the game server, live protocol, TLS configuration,
firewall, VPS service, public URL or gameplay logic. Its only output is a
locally written `r2-two-host-w3c-evidence.json` log.

## Previously verified, and the remaining gap

- [PR #391 quality run #39510483602](https://github.com/tehki/myaso/actions/runs/39510483602)
  passed its real **local** Chrome abrupt-close/2-player admission reclamation,
  Rust, strict browser-combat and R4 audio suites.
- The Chief Architect's independent review found the source #391 and
  [integration #414](https://github.com/tehki/myaso/pull/414) byte-identical
  gameplay trees. Only R2-vs-R4 workflow test ordering differs. Merge **one**.
- On 2026-10-21, a short **private UDP connectivity probe** from Linux X230i
  `10.8.1.6` to Serj `10.8.1.5` port `41439` timed out at both ends.
  These are separate machines, but the currently configured VPN path does
  **not** show usable host-to-host UDP. There is no two-host gameplay PASS.
  The test listener exited and no route/firewall rules were modified.

## Scope and prerequisites

Only the Development Center or the network/system owner may provision an
**isolated staging sidecar**, on a distinct machine from the test browser,
with the exact release-candidate binary, non-production URL, temporary
certificate pinned by SHA-256 and `MYASO_MAX_PLAYERS=2`. No active
player traffic, production credentials, real wallet or economy data.

Before accepting results:

1. Explicitly identify both independently operated machines, build SHA,
   isolated bind IP/port, TLS fingerprint, server-side logs, and rollback
   owner. Confirm their real UDP route with a separately authorized network
   check. **Do not disable VPN/firewall isolation to make a test pass**.
2. Have the staging owner attest isolated cap 2 and no unrelated clients.
   Copy no production identities or account secrets into the test.
3. From the *other* machine, checkout the exact branch/commit and provide
   a local `chromedriver`, `chromium`, and Node.js. The browser page is
   served on the local test client's `127.0.0.1` HTTP endpoint; WebTransport
   connects to the remote staging QUIC endpoint.
4. Export the following variables using the owner-approved private host
   address and the actual 64-character hex certificate fingerprint:

```sh
export MYASO_R2_REMOTE_TEST_ONLY=1
export MYASO_R2_STAGING_OWNER_ATTESTED=YES
export MYASO_R2_REMOTE_PLAYER_CAP=2
export MYASO_R2_REMOTE_ALLOW_HOST='<approved-staging-host-or-IPv4>'
export MYASO_R2_REMOTE_URL='https://<approved-staging-host-or-IPv4>:<port>/game'
export MYASO_R2_REMOTE_CERT_SHA256='<64-hex-sha256>'
node scripts/r2-remote-abrupt-close-acceptance.mjs
```

The script explicitly rejects loopback and
`*.open-trust-layer.org` production-associated names, missing approval,
non-HTTPS/credentialed URLs, unexpected paths/ports, wrong host and absent
or malformed pins. Approval flags are **human attestations**, not actual
cryptographic authorization to operate a server.

## Acceptance and evidence

The script runs the existing R2 **genuine W3C Chrome browser sequence**
against an *external* QUIC server:

- Player A and B join with server-issued IDs and a 2-player admission cap.
- Close B's **WebDriver session**, retain A and wait for the authoritative
  scoreboard to remove B within the 38-second bound.
- Player C joins and receives a fresh ID; A observes exactly A+C.
- Native W3C keyboard movement by C is accepted and advances the
  authoritative action/tick state.
- Save timestamps, session IDs, observed scoreboards, step outcomes,
  certificate pin and host into `r2-two-host-w3c-evidence.json` locally.

A W3C browser-session DELETE is **not** a forced process SIGKILL, complete
host power loss or network partition. These need additional separately
reviewed fault-injection fixtures; a successful result must not claim
otherwise. The test also does not prove latency/load capacity, durable
account recovery, live multi-zone authority or outbox correctness.

For a release candidate, collect **server-side logs and client-side
evidence from the same build SHA**, prove session and permit recovery, then
run a staged rollback/restart to the prior approved version and repeat the
admission test. Run a genuine Firefox/Chromium game-combat smoke after chat
UI integration rather than downgrading M41/M194 assertions.

## Local and CI verification

The new `tests/r2-remote-acceptance-config.test.mjs` validates the
staging-only configuration guard. `node --check` validates the executable
runner. Both run without contacting a remote server:

```sh
node --check scripts/r2-remote-abrupt-close-acceptance.mjs
node --test tests/r2-remote-acceptance-config.test.mjs
```

**Production release is not authorized by this fixture.** If private UDP
remains blocked, report **network acceptance blocked**, retain PR #391/#414
in review and request a specifically authorized ephemeral test path from
the network owner. Do not create permanent ingress rules or point this
runner at a production endpoint. Development Center #360 alone decides
merge, rollout, rollback and promotion.
