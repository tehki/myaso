# R0 public HTTPS readiness probe

Run `node scripts/probe-r0-public.mjs` to check **only** the fixed public game hostname:

1. All resolved public IPv4 A records match the documented VPS IPv4 address.
2. A verified TCP/443 HTTPS GET of `/web/alpha.html` returns HTTP 200.
3. A verified TCP/443 HTTPS GET of `/game-config.json` returns HTTP 200 and valid bounded R0 configuration, including the pinned WebTransport/UDP 4433 certificate SHA-256.

This is a read-only command. It does **not** disable TLS verification, follow redirects, send credentials, change DNS, alter Caddy or restart services. It connects HTTPS only to the DNS-checked IP while preserving the hostname for TLS SNI verification. The JSON report prints status metadata, never raw responses or private keys. Success exits **0** and incomplete readiness exits **2**.

Run from two independent network clients, such as Serj and X230i, after **separately authorized** VPS deployment. The `r0-public-probe-static` GitHub Actions workflow runs only offline contract tests; it does not contact the production hostname.

**This check is necessary but insufficient for launch.** It does not prove that UDP/4433 or Rust WebTransport works, that the service is healthy, that 8 real players can play in Chrome/Firefox, that resource headroom is sufficient, or that backups and existing Admin-Call services are preserved. Follow [the full R0 acceptance runbook](R0_OPEN_TRUST_LAYER_MULTIPLAYER_ALPHA.md) for deployment and rollback.

## Observed network failure — 2026-10-17

Public DNS resolved game.open-trust-layer.org to the expected address, but verified TLS negotiation returned `tlsv1 alert internal error` independently from Serj and X230i. This does not identify the root cause: the operator must check the actual VPS Caddy site import/certificate state before attempting activation. Never bypass TLS verification or modify existing sites to force a green check.
