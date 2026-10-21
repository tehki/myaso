# Core 8A P0 — two independent client machines, four real browsers (staging only)

**Status: test fixture / no physical multi-host flight has been run.**

First Playable tracking: [#480](https://github.com/tehki/myaso/issues/480); orchestration: [#360](https://github.com/tehki/myaso/issues/360). This **does not** replace the owner-required Greyhaven rack swords, physical clicks, authoritative armed/unarmed combat, and death/respawn proofs. An actual on-LAN two-host R2 browser recovery flight is separately evidenced in [#391](https://github.com/tehki/myaso/pull/391). One-host four native Chrome/Firefox crash/rejoin already passed in [#525](https://github.com/tehki/myaso/pull/525).

## What the acceptance runner DOES and does NOT prove

Two **independently operated, distinct client machines** (host A and host B) each start one genuine headless Chrome and one genuine headless Firefox through isolated native W3C WebDrivers, with all four connecting via pinned WebTransport QUIC to **the same third, independently owned private staging server**. The script **never starts a game server, opens nonloopback HTTP, changes routes/firewall, deploys, or uses synthetic clients**.

An approved future UTC barrier lets role A's real Chrome player move first; role B's real Chrome moves later. Chrome and Firefox on **both** machines independently capture authoritative snapshots before/after, requiring **both their local player and a real opposite-host player to move** while the four identities remain constant and authoritative server ticks advance.

Each machine writes its own locally captured report **and two genuine W3C browser screenshots** under `alpha-p0-hostpair-evidence/pair-a-chrome.png`, `pair-a-firefox.png` (or `pair-b-*` on host B). Each report includes browser-native W3C session ID, driver OS PID, screenshot filename, file length and SHA-256. A separate offline verifier cross-checks identical server URL/certificate/epoch, four unique disjoint client IDs, two reported private client networks/OS hostnames, two distinct local native W3C/browser driver identities and screenshot hashes per machine, two local real browser families per machine, synchronized native-movement windows, fresh server ticks and the **exact other host's Chrome player** as the observed remote mover. Fake samples in the unit tests are labeled synthetic and never accepted as live network evidence.

**Limitations:** two JSON files are self-reported and can be forged; distinct hostnames/IPs are not cryptographic device attestation. An operator must inspect OS/process evidence, synchronized timestamps and **server-side QUIC session/movement logs at the exact build SHA**, and verify two physically independent machines plus an approved third server. A structurally valid evidence pair **is not release approval**. It does not exercise cross-host power loss, WAN/NAT, 8C Greyhaven static collision, sword/pickup state or Combat.

## Prerequisites — authorized operator only

1. Obtain **explicit staging-owner/network-owner approval** for an isolated **nonproduction** private IPv4 QUIC server, cap exactly **4**, no background/AI/synthetic player slots, no active users. Choose a third independent private host that is different from both client machines. No production domains, VPN/firewall changes, public ingress, production cookies, wallets or persistent services.
2. Deploy an identical, pinned test build revision of `myaso-server` and the browser `web/` source to staging; record commit SHA, Rust server log, PID, dedicated TLS SHA-256 fingerprint and rollback contact. Both client hosts need the same checked-out revision, Node 20+, `chromedriver`, `geckodriver`, Chrome and Firefox. Native drivers must be locally installed, not exposed remotely.
3. Independently prove **UDP QUIC connectivity** from both distinct client machines to the approved staging server before attempting the browser flight. The private VPN X230i→Serj route previously failed: absence of routing is a **blocker**, not license to disable network isolation.
4. Synchronize both client clocks to UTC, and choose a common `Date.now()+120000` start value at least two minutes ahead; **the exact same epoch milliseconds** must be entered on both machines. Each host must have enough time to start two real browsers and observe four identities before the barrier.
5. Set these environment variables **locally on both client hosts**, replacing only approved private staging placeholders:

```sh
export MYASO_P0_HOST_PAIR_APPROVED=YES
export MYASO_P0_ISOLATED_STAGE=1
export MYASO_P0_MAX_PLAYERS=4
export MYASO_P0_SERVER_IPV4='<approved third-host RFC1918 IPv4>'
export MYASO_P0_SERVER_URL='https://<same-private-IPv4>:<explicit-UDP-port>/game'
export MYASO_P0_SERVER_CERT_SHA256='<exact 64-character TLS SHA256 hex>'
export MYASO_P0_COORDINATED_START_MS='<same future UTC epoch milliseconds>'
```

On client **A** only:

```sh
export MYASO_P0_PAIR_ROLE=A
export MYASO_P0_PAIR_HOST_ID=client-a
export MYASO_P0_PAIR_PEER_HOST_ID=client-b
node scripts/alpha_p0_host_pair_flight.mjs
```

On different client **B** only, before the same barrier:

```sh
export MYASO_P0_PAIR_ROLE=B
export MYASO_P0_PAIR_HOST_ID=client-b
export MYASO_P0_PAIR_PEER_HOST_ID=client-a
node scripts/alpha_p0_host_pair_flight.mjs
```

Both scripts start exactly two real browsers, connect to the server pinned by the provided hash and terminate their local W3C sessions/processes after the test. They **do not coordinate by forging input**, carry no server-side authority, and never write a success file on failure.

Collect `alpha-p0-pair-a-evidence.json` from host A and `alpha-p0-pair-b-evidence.json` from host B, **plus both original PNG files from each host**, on an authorized reviewer machine. Preserve the `alpha-p0-hostpair-evidence/` subdirectory relative to **each** report JSON. The verifier now **actually reads all four original PNG files and requires matching byte length, PNG signature and SHA-256**, failing closed on missing/tampered files; it does not trust JSON hashes alone. Inspect the rendered browser frames for the expected four-person arena and HUD, and the native OS process/driver evidence; filenames, PID values and hashes in untrusted JSON are not sufficient by themselves. Run:

```sh
node scripts/alpha_p0_host_pair_verify.mjs \
  alpha-p0-pair-a-evidence.json alpha-p0-pair-b-evidence.json
```

The CLI prints `MYASO_P0_PAIR_EVIDENCE_FILES_VERIFIED` only after reading and hashing all four PNG files and subsequently returns `EVIDENCE_STRUCTURALLY_CONSISTENT_REQUIRES_SERVER_LOGS`. **Only the orchestrator** may inspect genuine host/session/server evidence, cross-check build/source pins and decide release readiness. Any missing host evidence, cross-host UDP timeout, 5th admission, failed movement or unexpected server state is **BLOCKED**.

## Offline-only developer verification

```sh
node --check scripts/alpha_p0_host_pair_config.mjs
node --check scripts/alpha_p0_host_pair_flight.mjs
node --check scripts/alpha_p0_host_pair_verify.mjs
node --test tests/alpha_p0_host_pair_config.test.mjs
```

The CI workflow `alpha-p0-multihost-pair-preflight.yml` runs only syntax and **offline synthetic negative/security unit tests**, **never** contacts a staging or production network and **never** claims a real two-machine PASS. No branch merging, stage provisioning or production deployment follows automatically from this fixture.
