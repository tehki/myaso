# World & Gameplay D19 — Real E-Key Red Lion Round-Trip Acceptance

**Status:** independent *draft* offline-preview test milestone, stacked on D18 #471 → D17 #456 → D16 #450 and earlier unmerged Moonvale World branches. No production gameplay changes.

## Why a browser acceptance gate

D18 statically checks that both portal triggers, their reciprocal links, preview transfer landings and local walkable approaches are correct. It cannot prove that the **actual preview browser** responds to the physical **E** key when close enough, refuses E from outside reach, displays the correct entrance/exit prompts, moves between real zones without breaking state, or restores the M sketch after returning. D19 tests all of this in a *real headless Chrome session* rather than source-only assertions.

## Browser acceptance sequence

`scripts/world-portal-browser-flight.mjs` serves the project repository on **127.0.0.1** at an ephemeral local port and drives a temporary real Chrome session through **W3C WebDriver/chromedriver**, matching the browser infrastructure already used by the inherited PVP flight tests. It never writes game state, injects debug coordinates or calls the local transition helper directly:

1. Load `/web/world-preview.html` at the authored outside start (4365,4150).
2. Press **E** outside the 52+16-unit entry reach: verify no transfer.
3. Press **F** to read *The Red Lion Charter* (1/6); verify field notes are 0/8. Select *The Fallen Watch* expedition and verify its first Red Lion milestone is 1/3.
4. Press **M** to open the existing Moonvale sketch, then move physically **W** toward the tavern until the browser shows **Press E — Enter The Red Lion Inn**.
5. Press **E**: verify real interior transfer to the **(390,480)** authored destination, that M sketch hides indoors and the lore/field/expedition state is unchanged.
6. Move physically **S** near the exit, after the cooldown, until **Press E — Return to Greyhaven** appears.
7. Press **E**: verify return to the outside **(4365,4143)** landing; existing M sketch is visible again, lore stays 1/6, fields 0/8 and expedition 1/3.
8. Press **M** to close the sketch and verify its lore legend is hidden.

The suite has a strict bounded wait for every physical interaction and fails hard if ChromeDriver or the Chrome session cannot launch. Browser/WebDriver resources are explicitly closed. No test silently skips unavailable browsers.

### Tests and CI

`tests/world-portal-browser-flight.test.mjs` adds five source/geometry contract tests. They confirm that the actual preview uses **KeyE**, checks portal proximity, reciprocal destination and D2 landing collision, enforces the 550 ms transition cooldown, requires physical W/S steps before door prompts, avoids network/authority/persistence hooks, and keeps the harness isolated from Rust/online gameplay. D18's eight existing reciprocal/blocked-landing tests remain strict.

Run:

```sh
node --check scripts/world-portal-browser-flight.mjs
node --test tests/world-portal-browser-flight.test.mjs
node scripts/world-portal-browser-flight.mjs
```

The new `.github/workflows/ci.yml` step runs all three commands **after D18** and before the existing heavy browser/Combat gates. CI uses the existing preinstalled ChromeDriver on `ubuntu-latest`; the command is a **required real-browser gate**, not an optional or mocked smoke test.

On the authorized Windows machine ChromeDriver is not installed, so the same physical E/W/S/F/M acceptance sequence was independently executed using headless Chrome **DevTools Protocol** with genuine key events: **PASS**. Observed interior landing **(390,480)**, outdoor return **(4365,4143)**, journal 1/6, field 0/8, expedition 1/3, M map hidden indoors and restored outside, and zero JavaScript exceptions. Full GitHub Actions ChromeDriver execution must still be confirmed at the D19 exact head.

## Safety and ownership

The test targets only the **offline authored preview**, not the live multiplayer client or authoritative server. It does not validate server zone handoff, dynamic doors, combat animation, NPC pathing, inventory persistence, XP, wallet/Moon Coin ownership or real-world deployment. This new gate is intentionally additive and does not suppress, relax or substitute any existing strict Combat/Rust/Network test.

Upstream D18 #471 [quality #39527441362](https://github.com/tehki/myaso/actions/runs/39527441362) **failed inherited strict Combat M41 spatial FFA parry tell**, while local D18 Node 589/589 and portal audits passed. D17 #456 failed the same M41 step. D16 #450 CI passed. D15 #442's inherited M158 and D12 #425's inherited M205 must also be resolved or requalified by Combat/central integration. The full World stack remains open and unmerged, and `main` has advanced. **No bypass, no independent merge or production deployment.**
