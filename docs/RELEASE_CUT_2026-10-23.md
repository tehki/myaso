# Moon Games — 2026-10-23 release cut (Main 0 GO/HOLD manifest)

**Prepared 23 October 2026; branch anchored to protected `main` `6fa59b649112c272bcbc018b4a32bf963f9a5bba`.** Release authority: **Main 0**. This file is an audit/handoff, **not an executable deployment authorization, merged game feature, validated artifact or uptime claim**.

## Decision: separate the three scopes

| Lane | Today's classification | Allowed action |
| --- | --- | --- |
| **A — previously installed R2/v1 Multiplayer Technical Alpha** | **CONDITIONAL TESTER CUT / live service unverified today** | Main 0 may re-share the **existing** `https://game.open-trust-layer.org/web/alpha.html` only after fresh independent live health, two real-human proof and current package/rollback checks. **Do not deploy or restart merely to announce it.** |
| **B — tested improvements for integrated staging** | **SOURCE REVIEW READY, NOT GAME RELEASE READY** | Freeze exact heads below for maintainers to review, resolve ancestry and construct ONE isolated, protected, main-rooted candidate. No protected-main cherry-pick without the Main 0 single-writer process. |
| **C — Pre-Alpha 0.1 Knights + updated instant Combat + multiplayer** | **HOLD / NOT PUBLIC READY** | Source0 original physical LMB press-to-135ms World light, owner-required server 320ms READY/release-only heavy, authenticated 2–4 humans, actual remote HP and clean death/rejoin are **not jointly demonstrated on one integrated exact head**. |

**Do not advertise lane A as new Knights/instant-Combat Pre-Alpha**, or infer a live deployment from a green branch.

## A — current historical installed alpha (verify fresh, read-only)

[Deployment incident #328](https://github.com/tehki/myaso/issues/328) records historic isolated R2 activation, pre-seeded `game-config.json`, stable `myaso-alpha.service` and two real Omarchy Serj/X230i browsers that joined one authoritative World with distinct actor IDs. [Player incident #293](https://github.com/tehki/myaso/issues/293) separately records earlier real cross-browser 34HP authoritative hit plus movement/latency complaints. [R2 session cleanup #387](https://github.com/tehki/myaso/issues/387) records abrupt-close ghost fighters surviving >10 seconds; do not promise instant cleanup. These are **historical observations**, not 23 October live service health. The assistant's current two read-only HTTPS requests failed DNS lookup from the remote verification environment; **it is not evidence the public service is down**. Separately branded `myaso.io` DNS is unverified ([#295](https://github.com/tehki/myaso/issues/295)).

Main 0's authorized host operator should record, without changing services:

1. Actual deployed `current` symlink/revision and immutable package SHA256; live `myaso-alpha.service` active and UDP/4433 reachable; compare with **current intended deployment record**, never assume the historical package revision is still current. Verify TLS chain, current not-expired pinned SPKI/certificate and existing `serverUrl` hostname/cert mapping; no certificate rotation during preflight.
2. Two independent-network HTTP **200** reads of `/web/alpha.html` and `/game-config.json`, `Cache-Control: no-store`, actual JSON `serverUrl https://game.open-trust-layer.org:4433/game`, valid matching `certificateSha256`, actual `maxPlayers` (historically eight, not 512). If DNS fails externally, stop and investigate the name; never invent a working hostname.
3. Two **separately operated human machines**, genuine Chrome/Firefox over **public** HTTPS/QUIC, click JOIN MULTIPLAYER, distinct authenticated actor IDs in same arena, mutually visible peer/HP, one genuine 34HP hit verified on **both** clients against actual server World, basic movement/defense, death/respawn, disconnect/rejoin. Observe known ghost/session-cleanup behavior and admission. Record UTC timestamp, sanitized server ticks and human witnesses. CI localhost multi-process browsers are not independent humans.
4. Existing immutable R2 deployment and previous-known-good pointer both verified; service-isolated rollback only if an actual approved rollout occurs. R2 release had previously rolled back when staged `game-config.json` was HTTP404, so check the file **before** any pointer change. Do not alter Caddy, PostgreSQL, certificates, unrelated Moon apps, Telegram desktop, or production merely to do this review.
5. After fresh evidence and **Main 0 release approval**, distribute the already-hosted existing alpha link to the **small intended tester group**, labeled *myaso.io — Multiplayer Technical Alpha (R2/v1, experimental)* and disclose known lag/ghost and nonfinal LMB behavior. If any gate fails, **HOLD player-ready announcement**; do not hide it by citing historical two-player joins.

No new binary/package is proposed for lane A. Any actual rollout requires a separately approved target, rollback SHA, preseeded public config, post-activation HTTP/QUIC smoke and exclusive Main 0 operator.

## B — green exact-head PRs; staging candidates only

**Against original protected main, test/control/QA:**

| Review PR | Exact head | Full protected quality | Purpose / restriction |
| --- | --- | --- | --- |
| [4A #861](https://github.com/tehki/myaso/pull/861) | `757b7cc407957bd4e32b66c5ebd4fcaf7ac938f7` | [SUCCESS #39941630961](https://github.com/tehki/myaso/actions/runs/39941630961) | Pointer-ID/cancel and original v1 movement provenance; **not** pointerDOWN 135ms light. |
| [4B #864](https://github.com/tehki/myaso/pull/864) | `ea7300a8a0818c484aa78ed56813ba0237205798` | [SUCCESS #39951537452](https://github.com/tehki/myaso/actions/runs/39951537452) | `#[cfg(test)]` original World M155/M156/M193/M194/M107 assertions only; **no live combat fix**. |
| [4D #865](https://github.com/tehki/myaso/pull/865) | `5e66c312e26bea9dbac411a85e34a7c365b9f9ec` | [SUCCESS #39952166078](https://github.com/tehki/myaso/actions/runs/39952166078) | Strict 45-gate QA/forensics and fail-closed unverified manifests. Green code check is **not** actual 45/45 evidence PASS. |
| [4A diagnostic child #896](https://github.com/tehki/myaso/pull/896) | `7166f5640604da2a3842c33012dc81c270f8a5cf` | [SUCCESS #39952379603](https://github.com/tehki/myaso/actions/runs/39952379603) | M156 read-only real sender packet telemetry; **stacked on #861**, no release/gameplay fix; review after parent. |

**Graphics / optional assets (not default public Knights without integrated proof):**

- [3A #881](https://github.com/tehki/myaso/pull/881) `2bf5d48e2c87b70dbb30e5e91ca96dc7e41b0938`: [full quality SUCCESS #39949256026](https://github.com/tehki/myaso/actions/runs/39949256026), genuine four-client original Silver native, Chat and rejoin dedicated workflows SUCCESS. **Stacked** opt-in `?knights=1&knightArt=relit`, keep default art unchanged until approved.
- [3A offline #853](https://github.com/tehki/myaso/pull/853) `47315372af2a20604f192db3b6fde4a62f79e1d3`: [full quality SUCCESS #39932007973](https://github.com/tehki/myaso/actions/runs/39932007973); source / offline gallery, not proof of live animation.
- [3C+3A #902](https://github.com/tehki/myaso/pull/902): five focused authentic graphics/Chat workflows green but **original protected quality FAILED M144** [#39954331347](https://github.com/tehki/myaso/actions/runs/39954331347). Terrain remains opt-in review/HOLD.
- [3C #903](https://github.com/tehki/myaso/pull/903): focused four-browser native PASS but **original quality FAILED M144** [#39954290541](https://github.com/tehki/myaso/actions/runs/39954290541). Not an accepted Terrain/Knights bundle.

**Experimental release-only KeyE integration (DO NOT publish yet):**

- Main has **selected genuine KeyE DOWN → server 320ms READY held → actual physical KeyE UP heavy**, not legacy standalone KeyE auto-fire; see [#723](https://github.com/tehki/myaso/issues/723). LMB held upgrade/release-only heavy also mandatory.
- [8A #899](https://github.com/tehki/myaso/pull/899) exact `60753c6908fc885c5d1c87ccb62041738b4b4841`: focused real original Rust QUIC + two Chromium actors [SUCCESS #39953000443](https://github.com/tehki/myaso/actions/runs/39953000443) and full protected [SUCCESS #39953000399](https://github.com/tehki/myaso/actions/runs/39953000399). **One CI host, no original-game page or real independent-human victim HP; DRAFT.**
- [Main experimental #897](https://github.com/tehki/myaso/pull/897) full protected [FAIL M143](https://github.com/tehki/myaso/actions/runs/39952777031) despite focused success. [UI10 #898](https://github.com/tehki/myaso/pull/898) focused real source0/1 Chromium→World passes but historical dormant-source guard FAILED and full protected pending at inventory; lacks original live `web/online-game.mjs` enable. [4C #901](https://github.com/tehki/myaso/pull/901) full protected [FAIL M144](https://github.com/tehki/myaso/actions/runs/39953549677) despite true QUIC focused success. Do NOT mix release-only #855/#862/#887 ancestry with incompatible auto-KeyE #858/#868/#885, and never enable default-OFF v2 publicly.
- [Core8C #892](https://github.com/tehki/myaso/pull/892) intentional fail-first stale old gesture bytes in hypothetical same-QUIC actor regrant: **unresolved security/actor incarnation review**. Need correct one-time HELLO, boot/actor leases, and death/rejoin fence before activation.

## C — Pre-Alpha 0.1 strict release blockers

[Master #695](https://github.com/tehki/myaso/issues/695) still requires one canonical original browser-to-original Rust World server-authoritative light **starts at physical LMB pointerDOWN**, 135ms genuine windup/34HP, upgrade-before-land to 320ms READY and 46HP **on real UP only**, single HIT/gesture, no phantom cancel. Current legacy `web/online-game.mjs` held LMB transmits both `attack` and `heavyAttack`, potentially producing initial HeavyWindup on a **7ms** genuine tap; [#864 native M156 red #39942079671](https://github.com/tehki/myaso/actions/runs/39942079671) is real. Independent passing runs never erase that trace.

**NOT GO without every item:** (1) one main-rooted combined artifact with compatible protocol/input/actor/World/Knights ancestry, (2) original unchanged strict M107/M121/M143/M144/M155/M156/M172/M173/M193/M194/M205/M206 and rest full protected exact-head AND postmerge, (3) 2–4 **independently operated human hosts** over original browser, correct remote HP/hits/cancel, death/rejoin/ghost and authenticated session, (4) immutable package SHA256, TLS pin/cert, isolated VPS stage & known-good rollback, (5) explicit Main 0 GO.

**Staging sequence (Main 0 only):** freeze SHA/selected KeyE, reconcile PR ancestry and negative tests, create isolated inactive candidate without mutating production, run full protected CI, two-network human smoke and rollback drill; only then request explicit GO for named target/time/rollback and activate. Failed mandatory CI, wrong World HP, stale actor accepted or broken config/pin => HOLD and keep R2 stable.

## Today's communication

Tell intended testers the **existing technical alpha** may be available at `https://game.open-trust-layer.org/web/alpha.html` after **fresh Main 0 live validation**. **Do not claim** the optional new Silver Knights, Arena Lite terrain, updated instant Combat, v2 KeyE or Pre-Alpha 0.1 have shipped. If even lane A live DNS/health or two-human proof is absent, public statement is *release preparation complete; service confirmation pending*, not *released*.

**No merge, deploy, restart, TLS rotation or public v2 activation authorized by this document.**
