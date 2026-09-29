# M7 — Real Browser Flight & Impairment Evidence

## Objective

Prove the M6 authoritative browser path in actual browser engines instead of relying only on Node.js and Rust protocol tests.

M7 keeps the existing browser/server architecture unchanged and adds measurable flight evidence around it.

## Required browser engines

The CI runner must execute the same WebTransport flight in both:

- Google Chrome / Chromium engine;
- Mozilla Firefox / Gecko engine.

The repository does not add Playwright, Selenium client libraries, or another browser framework. The flight runner talks to the preinstalled WebDriver endpoints directly over the W3C WebDriver HTTP protocol.

## Flight path

Each browser flight:

1. starts the real Rust `myaso-server` on loopback with its short-lived self-signed development identity;
2. reads the server's SHA-256 certificate hash;
3. serves the repository over loopback HTTP;
4. launches the browser headlessly through its native WebDriver;
5. loads `web/flight.html`;
6. creates a real browser `WebTransport` session using `serverCertificateHashes`;
7. sends the normal M2/M6 input datagrams;
8. receives authoritative M4 snapshots and M6 processed-input acknowledgements;
9. performs browser-side prediction/reconciliation while rendering through `requestAnimationFrame`;
10. renders 128 deterministic synthetic combat-view entities in addition to real network state to exercise Canvas work;
11. exports browser measurements back through WebDriver;
12. closes the session and proceeds to the second browser engine.

## Enforced flight invariants

The flight fails if either browser:

- lacks `WebTransport`;
- cannot establish the real HTTP/3/WebTransport connection;
- receives fewer than 20 authoritative snapshots;
- receives fewer than 10 processed-input acknowledgements;
- sends fewer than 30 input packets;
- produces fewer than 60 animation frames during the flight;
- has a pathological p95 animation-frame interval of 100 ms or worse;
- escapes the 64-entry prediction-history bound;
- produces a non-finite or >=512 px reconciliation correction.

These are broad flight-safety bounds, not a production FPS/SLO claim.

## Measurements

Each browser prints one machine-readable `M7_BROWSER_FLIGHT` record containing:

- browser user agent;
- WebTransport capability;
- elapsed flight time;
- frame count;
- frame p50/p95/p99/max interval;
- frame counts above 25 ms and 50 ms;
- observed long-task count where supported;
- authoritative snapshot count;
- processed-input ACK count;
- sent input count;
- maximum pending prediction-history length;
- reconciliation correction p50/p95/p99/max;
- assigned player netId;
- final observed server tick;
- JS heap usage when the browser exposes it.

Measurements from GitHub-hosted headless browsers are evidence for regressions and interoperability, not a claim about production player hardware.

## Deterministic impairment model

`src/browser/impairment.mjs` provides an application-layer deterministic impairment queue with bounded:

- base delay;
- jitter pattern;
- packet loss cadence;
- deterministic reordering delay.

Its tests verify loss/reordering behavior and reconciliation after a delayed acknowledgement without requiring privileged OS traffic shaping.

This model is intended for repeatable browser/client behavior tests. Later internet-path testing may additionally use network namespaces or external impairment infrastructure, but those results must be recorded separately from deterministic unit evidence.

## Browser optimization principles retained

M7 does not relax the M5/M6 browser rules:

- rendering follows `requestAnimationFrame`;
- fixed-step catch-up is bounded;
- snapshot application remains in-place;
- prediction history is bounded;
- server combat authority is preserved;
- snapshots remain latest-state oriented;
- input packets remain compact and redundant;
- remote replication remains interest/budget limited;
- background tabs are not allowed to accumulate unbounded work.

## Non-claims

M7 does not claim:

- production 60 FPS on all hardware;
- mobile thermal stability;
- public-internet latency quality;
- 512 simultaneous browser clients against one deployed server;
- production deployment readiness.

Those require device matrices and representative server/load measurements.

## Next boundary

After both real-browser flights are green, the next capacity milestone is a bounded multi-client load driver that measures authoritative tick time, replication-build time, bytes/player/second, packet omission pressure, memory/session, reconnect/resync cost, and correction behavior while scaling toward the 512-player map target.
