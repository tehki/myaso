# 🌕⚡️🚀 Graphics 3C P45 — ACTUAL Greyhaven authoritative multiplayer browser smoke

**21 October 2026 · myaso.io Moon Games · FIRST PLAYABLE ALPHA P0**. Strictly scoped **loopback-only QA / DRAFT**, stacked on [Graphics 3C P44 / World571 #648](https://github.com/tehki/myaso/pull/648) exact source `d4f05394f6d45af59ef9cc24f8487d6b5db55f8f`.

## What was ACTUALLY exercised

From exact P44 Rust source, built the real `server/Cargo.toml` `myaso-server` via Rust 1.89 in an independent user-owned build target on authorized Linux **Serj**. Launched the real compiled server with `MYASO_BIND=127.0.0.1:0` and development SHA256 certificate, and served the exact real `web/index.html` / `web/bootstrap.mjs` / `web/online-game.mjs` over a second ephemeral **127.0.0.1-only** static HTTP listener.

Four **separate headless Chromium 152.0.7977.82 browser processes**, each running a real `web/index.html?world=1&server=https://127.0.0.1:<ephemeral>/game&cert=<ephemeral-hash>&netstats=1`, successfully connected to the **same real authoritative Rust WebTransport server**. These were machine-driven separate browser processes on **ONE physical host**; they were **not four human testers, not four independent hosts and not a WAN/two-machine certification**.

The real browser game itself reported online status for four distinct player IDs. All four saw the same four scoreboard rows. A tiny test-only native `CanvasRenderingContext2D.drawImage` observer (installed at browser document load, not committed to the shipping app) counted authentic 512×512 cached terrain tile drawings **to the real opaque `#arena` Canvas**, rather than faking a renderer. Each local client received genuine server snapshots/input ACKs. Each briefly received a separate WASD input through browser keyboard automation; no sword pickup, 3A asset behavior or combat landing is inferred.

## Native four-client result

| Real same-host Chromium process | Authored World tile draw calls during measured window | rAF gap p95 (ms) | rAF samples | Real client Input→ACK p95 (ms) | Extra render lag p95 (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Player #1 | 2,152 | 16.8 | 268 | 64 | 28 |
| Player #2 | 2,256 | 16.8 | 281 | 82 | 62 |
| Player #3 | 2,529 | 16.8 | 280 | 87 | 48 |
| Player #4 | 1,662 | 16.8 | 276 | 75 | **174** |

Original HUD statuses reached "Online - player #1–#4" with fresh server tick counters 339,348,378,378. All clients' scoreboard rows displayed #1, #2, #3, #4. All four canvases had `alpha:false`, nonzero real source-tile draws and zero request/page errors in the four-browser smoke. Rust server's admission log independently confirmed all four IDs. The server/processes shut down on completion, and test host/public networks were not changed.

**Interpretation:** `rAFGapP95Ms` is a **browser animation callback spacing proxy** affected by the minimal instrumentation. It is NOT the time of full JS render code, GPU-present timing, frame-to-frame image identity, steady-state FPS or guaranteed 60 FPS. The game's own **Extra render lag p95** is a separate snapshot interpolation/network rendering indicator. Player #4 had **174ms** extra render lag p95: the session is genuinely connected but cannot be declared uniformly smooth just because rAF gap p95 was ~16.8ms. Input→ACK values are from the actual HUD but reflect same-host loopback; no WAN metric, packet-loss envelope or independent device success may be claimed.

## Evidence and source trust

- `assets/environment/greyhaven/3c-p45-online-loopback/p45-four-local-chromium-authoritative.json`: first-party real browser server-connected telemetry, sanitized to remove ephemeral certificate hash/session tokens/port numbers. Preserves actual client statuses, authoritative diagnostics, unique player IDs, scoreboards and rAF samples.
- `assets/environment/greyhaven/3c-p45-online-loopback/p45-client1-actual-authored-greyhaven.png`: **actual 960×720 browser screenshot** from the first connected client. Not a Blender render, not a generated reconstruction, not a four-player collage.
- `tools/art/probe_p45_actual_online_loopback_browser.mjs`: reproduction script launching **real Rust binary**, real browser processes and actual original online client; fixed exact source ancestry, refuses any changes to shipped client/server/World renderer in its child QA branch, binds localhost, accepts at most four local clients, terminates its own processes in `finally`. No bypass of production/Combat checks.
- `tests/graphics3c-p45-live-loopback-evidence.test.mjs`: strict evidence/source-scope regression checks; this does **not** rerun four browsers inside the Node unit suite.

To reproduce in an authorized safe Linux workspace containing the exact P44 source (or descendant with no runtime source changes), with installed Rust, Chromium and Puppeteer:

```bash
export TMPDIR="$HOME/.cache/myaso-graphics3c-p45-tmp"
export CARGO_TARGET_DIR="$HOME/.cache/myaso-graphics3c-p45-target"
mkdir -p "$TMPDIR" "$CARGO_TARGET_DIR"
mise exec rust@1.89.0 -- cargo build --offline --locked --manifest-path server/Cargo.toml --bin myaso-server -j 2
P45_SERVER_BIN="$CARGO_TARGET_DIR/debug/myaso-server" \
P45_CHROME_EXECUTABLE=/usr/bin/chromium \
PUPPETEER_MODULE_PATH="/path/to/puppeteer" \
P45_CLIENTS=4 P45_MEASURE_MS=4500 \
node tools/art/probe_p45_actual_online_loopback_browser.mjs ./qa/p45-four-browser.json
```

An earlier one-client smoke succeeded but the QA static server returned two irrelevant `favicon.ico` 404s; this was fixed to HTTP 204 without altering the real game. The final four-browser run **exited zero**, had zero HTTP/page errors and four distinct live real online players. First Rust compilation failed because shared `/tmp` exhausted its quota; rerunning with a **private user-owned TMPDIR** succeeded. We did not change global host settings or kill unrelated browser processes.

## Unresolved alpha gates / no GO

This represents **real same-machine 4× Chromium authoritative source integration**, considerably stronger than earlier P42–P44 isolated Canvas-source A/B. It still does **NOT** validate independently operated two-machine clients, Windows Firefox real connected online game, completed Silver Knight animations, 3B final named facades, real four physical Blacksmith sword pickups, server-authoritative fist/sword PvP, full-frame GPU presentation, or end-to-end stable 60 FPS.

Parent [#648](https://github.com/tehki/myaso/pull/648) strict protected [quality #39650976061](https://github.com/tehki/myaso/actions/runs/39650976061) **FAILED mandatory Combat M41 native parry gate**; no workaround or waiver. Main orchestrator [#360](https://github.com/tehki/myaso/issues/360) and Alpha integration [#480](https://github.com/tehki/myaso/issues/480) own GO/merge/deploy. Continue coordinating Combat, Core and Items. No production server, public network port, package release or main merge was created here.

**Verdict: real first in-source four-client Greyhaven/WebTransport loopback smoke PASSED; full Alpha remains NOT READY.**
