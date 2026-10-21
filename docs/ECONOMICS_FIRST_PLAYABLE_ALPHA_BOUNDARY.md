# Moon Games · Economics · First Playable Alpha boundary

**Owner:** Department 7, Economics · **Priority:** P0 integration stability · **Status:** guarded alpha scope, with all gameplay economy features postponed to P2.

The first playable multiplayer experience is browser connection, shared world, movement, skill-based combat, death and respawn, with stable synchronization and Chrome/Firefox and independent-machine acceptance. It **does not depend** on wallets, currency, trade, market or real estate ownership. Do not merge Economics prototype [PR #385](https://github.com/tehki/myaso/pull/385) into the initial alpha. Its SQLite lab, PostgreSQL `e2j_lab`, test-only account and worker assertions, and E3 profession simulations remain isolated and unmerged. The fictional credits are nonredeemable and not Moon Coin/MOCMP.

## Small P0 deliverable

`scripts/verify_alpha_economy_boundary.py` is a **read-only CI check** walking active local Rust module declarations (including explicit `#[path]` modules) from `server/src/lib.rs` and `server/src/main.rs`, and **discovering browser JavaScript from the actual served HTML entrypoints `web/index.html` and `web/alpha.html`**. It follows their local script sources, including the Alpha lobby `web/alpha.mjs`, and recursively walks local static/re-export/dynamic ESM imports (relative or root-relative). It reports a failure if the shipping import graph references known Economy prototype hooks, test-only settlement APIs, wallet or Moon Coin access, or if an active local source dependency cannot be resolved. It does **not** block inactive research files in `scripts/` or a future reviewed Core persistence library, and it never alters runtime, protocol packets, browser controls or game state. It deliberately fails closed on missing local imports, escaping the repo, unreviewed external HTML scripts, and inline browser scripts added to those entrypoints. Plain explanatory HTML text is not scanned as executable script. **22/22 unit tests passed locally** after expanding Alpha lobby / absolute-import / explicit Rust path coverage; the exact-head GitHub CI workflow is the authoritative repository-level scan.

The narrow check is **not** a proof of the absence of all commerce code or game security; it deliberately does not fully analyze runtime-generated or computed imports, network traffic, package contents, scripts embedded in other HTML files, comments or the full JS/Rust language. It refuses inline scripts on the two protected HTML entrypoints rather than attempting to interpret them. It does not simulate gameplay or replace combat/physics/rendering/browser/network acceptance.

A separate lightweight `.github/workflows/economics-alpha-boundary.yml` runs when runtime sources or the guard change. The existing main `quality` gate remains unchanged and mandatory. A relevant future feature legitimately requiring trade or settlement should be planned with Main Orchestrator and introduced with explicit review rather than suppressing the guard.

## Alpha acceptance and handoff

**Economics:** NO gameplay runtime integration. **Core & Multiplayer:** own authoritative sessions, replication and multi-machine connectivity. **Combat/Physics/World/UI/Graphics/Sound:** own their existing browser and gameplay acceptance. **Main Orchestrator:** owns cross-department sequencing, merging, staging, deployment and rollback.

The Economics production implementation remains **EXPERIMENTAL**, not integration-ready: stable authenticated AccountId ↔ Core CharacterId mapping, final transaction fence using the actual Core PostgreSQL worker-zone authority row, canonical title/item provenance, signed seller consent, operational migrations, strict grants and disaster recovery are outstanding. Successful isolated PostgreSQL tests do not prove live player ownership or economic security.

**Promotion conditions for a future economy alpha:** separately green exact-head integration and PostgreSQL multi-client tests with real Core identity/authority; no 60-Hz-loop blocking database operations; documented rollback and smoke acceptance; explicit central approval. Until then, no wallet, Moon Coin, economic settlement endpoint, real token custody, or activation.

See [Development Center #360](https://github.com/tehki/myaso/issues/360) for published Department 7 alignment and issue-level integration coordination.
