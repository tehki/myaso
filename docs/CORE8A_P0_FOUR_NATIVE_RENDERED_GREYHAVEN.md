# Core 8A P0 — original authored Greyhaven pixels in four real WebTransport browsers

**DRAFT / test-only**. Parent: [#565](https://github.com/tehki/myaso/pull/565), the source/CI qualified combined Core 8A/8C networking+Greyhaven authority, exact parent `46492e50c4142834676ea66d4d49f855593a921c`.

## Why this separate smoke test exists

[#565](https://github.com/tehki/myaso/pull/565) has an exact-head protected-green **four real W3C browser + authoritative Greyhaven + SIGKILL/ghost cleanup/rejoin** acceptance. Its native game page uses `?scenario=uijumpffaprimary` to expose an existing read-only authoritative test state. The production client source intentionally prevents the authored static-world renderer while `scenario` exists. This is correct for the networking fixture, but **a green #565 alone does not prove the actual Greyhaven visual city was drawn**.

This new smoke test has no scenario, uses the app's existing `?world=1` rendering path and requires the **actual Canvas 2D `createAuthoredWorldRenderer`** source to render true outdoor Greyhaven palette pixels in all four independent live browsers.

## What the test actually does

- Starts the unchanged, disposable **localhost-only Rust WebTransport server**, with **Greyhaven spawn, 23-static-solid reviewed profile and cap exactly four**, no synthetic players.
- Starts **two real native Chrome and two real Firefox WebDriver sessions**, each with its own authenticated QUIC connection using the actual development TLS certificate pin.
- Opens the unmodified genuine `web/index.html?world=1&server=...&cert=...` page, explicitly **without** the scenario parameter and without the scenario-only `__MYASO_ACCEPTANCE_STATE__` test object.
- Reads the actual rendered scoreboard DOM and requires four independent browser sessions to see **exactly #1, #2, #3 and #4**, with one unique DOM-marked own player per browser and positive current server tick.
- Samples an actual 2D canvas grid; requires at least eight outdoor-green pixels with green channel greater than red/blue, filtering out the dark generic arena. Each browser must pass this visual gate; no simulated world object or fabricated screenshot is accepted.
- Saves genuine **W3C screenshots with SHA-256 file digests**, sends a real native A-key keyboard gesture in Chrome #1 and requires fresh server ticks and continued four-player roster/visible-world proof in all four browsers.
- Emits `ALPHA_P0_FOUR_REAL_RENDERED_GREYHAVEN_BROWSERS_PASS` **only** if every strict assertion passes. Dedicated new CI workflow compiles the exact Rust binary and runs the full native test.

## Strict nonclaims

This is real original *authored* Greyhaven outdoor World 2D painting with four live connected browser clients, **not** a source-authentic Blender 3B wooden rack/sword render, actual sword pickup or item ownership, fully authored original Silver Knight combat animations, physically correct city buildings/World colliders beyond the reviewed 23 solids, complete fantasy MMO assets, PvP weapon-vs-fist proof, session restoration, genuine multi-computer test, or launch readiness.

The visual smoke test independently complements (does **not** replace) the existing dedicated four browser actual server position/ghost-removal/rejoin [#565](https://github.com/tehki/myaso/pull/565) gate, whose protected quality remains required. New independent exact-head focused browser CI must pass along with unchanged full `quality`. Main Orchestrator [#360](https://github.com/tehki/myaso/issues/360) controls merges and all release/network policy.

No production networking, host package installations, server runtime changes or authorization bypass were made.
