# R0 — game.open-trust-layer.org Multiplayer Alpha

**Goal:** real Chrome/Firefox players on independent networks join the same
publicly reachable, authoritative free-for-all Rust world using the existing
browser game and WebTransport datagrams. Initial controlled capacity: **8
concurrent players**, with no account or separate-room system in R0.

**Hosting:** existing open-trust-layer.org VPS, Ubuntu 24.04 at
**168.113.210.63**; existing Caddy 80/443, Admin-Call, PostgreSQL, Moon Support
and WireGuard must remain untouched. Current observed free disk ~14 GB, memory
available ~1.4 GB. This initial footprint is **not** evidence of 512 live-player
production capacity. Use a dedicated `myaso-alpha.service` with MemoryMax=512M
and CPUQuota=150%.

## Network endpoints

| Address | Use |
| --- | --- |
| https://game.open-trust-layer.org | Alpha entrypoint, public HTTPS via Caddy on TCP/443 |
| /web/alpha.html | Join button, single shared arena, invite link |
| /web/?server=…&cert=… | Existing real browser authoritative PvP client |
| https://game.open-trust-layer.org:4433/game | Rust WebTransport/HTTP3 **UDP/4433**, pinned short-lived certificate |
| /game-config.json | HTTPS-served **no-store** SHA-256 pin and transport endpoint |

**DNS prerequisite, under the AdminVPS DNS zone for open-trust-layer.org:**

```
Type: A
Host / Name: game
Target / Value: 168.113.210.63
TTL: 300 (or provider default)
```

No other records need to be changed. Remove a conflicting AAAA if one exists
without an actual IPv6 listener. Do not edit the `open-trust-layer.org` or
`admin-call.open-trust-layer.org` A records. No DNS change has been made by
this PR: the external DNS zone has no ChatGPT-connected write path.

## Why two TLS identities

The existing Caddy uses TCP/443 and UDP/443 (HTTP3) for existing production
sites, so do **not** replace or take over that listener. It will issue an
ordinary trusted HTTPS certificate for the new **TCP/443** site once DNS resolves.

The Rust binary uses its existing native `wtransport` WebTransport QUIC server.
It binds **UDP/4433** directly, without a reverse proxy trying to translate
HTTP/3 datagrams. Modern browsers allow a **dedicated WebTransport connection
pinned to an X.509v3 SHA-256 certificate**. Such certificates must have
ECDSA P-256 (not RSA) and a total validity under 14 days. R0 generates a 10-day
P-256 certificate, serves its current fingerprint over the Caddy HTTPS host,
and checks/rotates it daily (renew when less than three days remain). Secrets
remain on the VPS; only the cert *hash* is public. Rotations restart **only**
`myaso-alpha.service`.

Because this is a small open alpha, the game has no player logins or room
isolation yet. Cap limits admission, **not authentication**. Never describe
R0 as invite-locked or account-authenticated until those controls exist.

## Build and installation

1. Merge R0 only after normal project CI has passed; require independently
   green `main` checks, and keep the M38/M145/M108 issues open.
2. Invoke the manual [`alpha-package` workflow](../.github/workflows/alpha-package.yml)
   on `main`; it builds the pinned Rust release on Ubuntu 24.04, executes
   Rust R0 capacity tests and JS launcher tests, and produces a sha256-verified
   `myaso-alpha-<commit>.tar.gz` artifact. Do **not** compile on the 2 GB VPS.
3. Transfer the package and `.sha256` file over the already authorized
   key-only SSH connection; avoid putting any private keys in GitHub or logs.
4. On the VPS, run `bash install-vps.sh --stage PACKAGE PACKAGE.sha256`
   (installer is in the checked-out trusted PR/source). This creates a
   dedicated `myaso-alpha` user and release path under
   `/srv/myaso/alpha`, and stages an inactive release symlink. Certificate
   generation and changes to the active release are deferred to activation. When
   an existing WebTransport certificate remains valid for at least three days,
   stage also writes the corresponding **public, certificate-pinned**
   `game-config.json` **only into the inactive release**. On first installation
   or an expiring certificate, config generation waits for `--activate`.
   **Stage mode does not change Caddy, rotate certificates, modify the current
   release, open UDP/4433 or enable the game service**, and can run before the DNS record exists.
5. Verify the DNS A record resolves publicly to `168.113.210.63`, then run
   `bash install-vps.sh --activate PACKAGE PACKAGE.sha256`. It verifies DNS,
   validates Caddy before reload, adds an **isolated** hostname-only site,
   enables the dedicated game systemd service and daily cert-rotation timer,
   and permits only **4433/udp** as a new UFW rule.
**Release safety:** Do not treat a bare `current` symlink switch as a complete
activation: the packaged archive does not contain the runtime-generated
`game-config.json`. Always use the verified activation procedure or ensure a
staged config matching the live certificate exists *before* switching. After
switching, require `/game-config.json` HTTP 200 and the matching certificate pin
as well as the UDP/4433 listener; revert the symlink and restart **only
`myaso-alpha.service`** if any gate fails. An Oct 19 R2 trial exposed this
failure mode (HTTP 404) and was immediately rolled back before the corrected
activation and genuine two-browser join check.

6. Smoke checks: `systemctl is-active myaso-alpha.service`,
   `ss -lun | grep 4433`, `curl -fsSI https://game.open-trust-layer.org/web/alpha.html`,
   `curl -fsS https://game.open-trust-layer.org/game-config.json`
   (only cert hash, no private keys). Confirm other Admin-Call vhosts continue
   to return their expected endpoint statuses.
7. From **two separate external networks**, open the public URL, click
   **JOIN MULTIPLAYER**, verify two authoritative fighter identities, genuine
   simultaneous movement/attack/parry/roll, damage/death/respawn, and rejoin.
   Repeat at 2–8 actual browser participants. The full green CI does **not**
   substitute for this last real-player acceptance. Watch bounded VPS CPU/RAM
   and error logs during the test; stop rollout or revert on adverse impact.

## Current R0 constraints and acceptance

- **One** shared free-for-all room, not player-created invite-only rooms.
- Players identified by server-issued numeric fighter IDs. Usernames,
  moderation, chat, accounts and per-room isolation are follow-up releases.
- Chrome/Firefox versions need native WebTransport. The existing backend is
  QUIC-only, **not** a real WebSocket fallback; show an unsupported-browser
  error rather than falsely declaring a connection.
- Admission cap defaults to 512 for development/test fixtures but **production
  systemd explicitly fixes `MYASO_MAX_PLAYERS=8`**. Invalid caps fail closed.
- All existing combat W3C browser tests and server authority constraints remain.
- Do not publish until independent HTTPS, native QUIC, multiple network clients
  and cross-site regression checks have been witnessed.

## Rollback

The existing Caddyfile is preserved and a dated pre-Myaso backup is written
before appending the single `import /etc/caddy/myaso-alpha.caddy` line.
`caddy validate` runs **before** reload. To disable only Myaso:
```bash
systemctl disable --now myaso-alpha.service myaso-alpha-rotate.timer
ufw delete allow 4433/udp
# Remove only the import /etc/caddy/myaso-alpha.caddy line from Caddyfile;
# preserve all other entries, then caddy validate and reload.
```
For binary rollback, repoint `/srv/myaso/alpha/current` to the prior
`releases/<sha>` directory and restart **only** `myaso-alpha.service`.
Never restart Admin-Call, Moon Support or PostgreSQL as part of Myaso rollout.
