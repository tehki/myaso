# R2 — Public multi-host WAN browser acceptance

R1's browser-side extra render lag varies significantly by external route. Full local browser CI proves combat but cannot prove that the deployed site connects through the real WAN and supports two simultaneous players. This R2 helper is a cross-host observability probe, not replacement for human PvP acceptance.

## Reproduction

Prerequisites: Python 3.10+, Chromium, compatible chromedriver and outbound TCP/443 plus WebTransport UDP/4433. This uses only Python stdlib.

Run at roughly the same time on two independent hosts:

    python3 scripts/public_wan_smoke.py --duration 30 --require-peer

The helper fetches the public short-lived certificate SHA-256, rejects untrusted server origins, opens the public browser game with local netstats, performs an authentic W3C browser click and W keypress, samples the actual DOM scoreboard and bounded HUD stats, and closes the browser. Nothing writes to the public game service.

Both hosts must report pass:true, display a nonzero authoritative tick and include the other fighter's player ID. The peer detector reads per-player label spans rather than concatenated scoreboard text: a score of 0 beside fighter #44 cannot accidentally become ID #440.

Offline checks:

    python3 -m unittest discover -s tests -p 'test_public_wan_smoke.py'
    node --test tests/r2-public-wan-contract.test.mjs

## Limits and release policy

The reported input-to-ACK p50/p95 are local browser measurements, not ICMP RTT, server latency, or general performance promises. Extra render lag measures delay beyond the existing 90ms interpolation, not hit delay. The helper proves two real WebTransport sessions, W3C movement issuance, authoritative ticks, real browser ACK telemetry and peer presence; it does not certify Rust server binary identity, genuine hit/parry/respawn, 8-player load or good human game feel.

Keep issue #293 open for repeat WAN measurements, strict 2–8-player genuine combat and human acceptance. Do not weaken 1.45x max render catch-up, server authority or CI. This helper performs no VPS deployment, synthetic packet injection, private screenshot capture or server restart. Any unavailable real evidence fails closed with nonzero status.

The structured summary deliberately segments input ACK, ACK jitter, snapshot delivery and extra visual-render lag before parsing each p95. This prevents confusing the large remote-presentation outliers with network transport delay or global player RTT. Read alongside the per-host render-gap sample count and camera-correction measurement.

### CPU-load confounder (18 October)

X230i had a load average 17.64 while providing just 4 logical CPUs, with a concurrent npm install, compiler and GitHub Actions worker. Its later two-host sample had ~9.6 seconds extra visual-lag p95 while Serj recorded 122ms. That is **not** evidence of a 9.6-second Internet route RTT, nor proof of a renderer regression: the overloaded headless browser can stop scheduling frames or WebDriver reads. The probe now records the normalized one-minute CPU-load pressure before/after the session; a value >=1.5 per logical CPU flags its latency interpretation as inconclusive, while retaining a separate truthful connectivity outcome. Re-test on an idle browser host before tuning simulation or interpolation.
