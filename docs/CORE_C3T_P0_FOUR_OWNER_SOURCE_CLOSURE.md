# Core 8B C3t — reproducible exact-source four-department integration audit

**Moon Games First Playable Alpha P0. Status: source integration TESTED; live pickup BLOCKED.**

This draft is **stacked on [Core 8B C3s #541](https://github.com/tehki/myaso/pull/541)**. It adds **one read-only JavaScript command** that can verify the provenance and module registration of a local four-department merge. It does NOT choose an item writer, set coordinates, run a public server, create network packets, bypass a required CI check, or merge/push a branch.

## Why this is necessary

Four departments currently evolve independent but closely coupled source:
Core 8B #541 owns durable `u128` identity/journal proofs and explicit unapproved cm conversion; Items 2B #552 owns `u64` Loot/Magic joint checkpoint, five physical equipment slots and exact-sword pickup logic; World #537 owns immutable Blacksmith sockets and 23 physical AABB solids; Core 8C #532 owns server-routed Greyhaven staging, static collision and real QUIC four-connection acceptance.

Our actual **disposable local merge** of those exact revisions passed **236 Rust library tests, 38 World/geometry Node tests, and 7 QUIC loopback tests**, but required additive `server/src/lib.rs` module declarations in two merges. The final resolution must retain the **entire existing 812-line Core server library** and add only the missing modules, not replace the original body. An early disposable audit attempt accidentally truncated the file; tests rejected it and the checkout was repaired before the accepted result. This motivates a reproducible fail-closed provenance and module-completeness check.

## Exact accepted four-source audit checkpoint

| Department | PR | Immutable commit |
| --- | --- | --- |
| Core 8B | [#541](https://github.com/tehki/myaso/pull/541) | `a6bda5a69179d81483754bcbc624810b94d1131f` |
| Items 2B | [#552](https://github.com/tehki/myaso/pull/552) | `1d0d4ec7f26e36fbe59f41b813deaa6fc92be61b` |
| World & Gameplay | [#537](https://github.com/tehki/myaso/pull/537) | `78537cd0285582b4d71497c9cf431988e042857e` |
| Core 8C | [#532](https://github.com/tehki/myaso/pull/532) | `0d007640fbf779d57e2e330b0e6c4d0266ea7937` |

The **local-only** audit merge commit (never pushed) was `de344a50c968233ca3c9553fcc725867b727a889`; its exact local tree is `a3a7c00befa9036cf6e891ecdafbdfbdb6b36aec`, and the working tree was clean. It is **not a deployable integration artifact or approved canonical merge**.

## Verification command

Use an **independently prepared, full, clean disposable Git checkout** containing all four actual tips; never run on the central `main` checkout, staging/production deployment tree, or user worktree with uncommitted changes.

```sh
node scripts/verify_p0_four_source_closure.mjs \
  --root /path/to/disposable-four-way-merged-checkout \
  --core a6bda5a69179d81483754bcbc624810b94d1131f \
  --items 1d0d4ec7f26e36fbe59f41b813deaa6fc92be61b \
  --world 78537cd0285582b4d71497c9cf431988e042857e \
  --core8c 0d007640fbf779d57e2e330b0e6c4d0266ea7937 \
  --self-test
```

All options except `--self-test` are mandatory. The program does not fetch, clone, reset, merge, write files, or push. It requires the exact named root of a **clean Git worktree** and four **distinct 40-character commit identities**, verifies that every named source is a real ancestor of local HEAD, and compares **20 owner-specific source files byte-for-byte using real Git blob IDs** with their originals.

It checks the complete `server/src/lib.rs`: exact one-per-name declarations for 23 required modules, no duplicate module names, no conflict markers, and existing `PROTOCOL_VERSION` and `coalesce_accepted_input_batch` anchors intact. The Core 8C `alpha_spawn` module belongs to the **server executable** in `server/src/main.rs`, not `lib.rs`; the checker verifies that placement. In the accepted combined tree there are **25 unique module declarations**. Common integration files such as `server/src/main.rs`, `server/src/simulation.rs`, CI and web entrypoints are deliberately **not** claimed as unchanged: these need separate semantic code and protected browser review.

`--self-test` injects in-memory missing/duplicate module, truncated `lib.rs`, merge marker, invalid SHA and missing root cases; the script must reject them. Separately, live invocation with the older Core #526 SHA instead of Core #541 and a duplicate owner SHA was verified to fail closed, without modifying the combined checkout.

## Evidence and scope

**Serj Linux Node 26 source audit:**
- Exact four-way HEAD ancestry, clean checkout, 20 owner blob IDs and 25 unique modules: **PASS**
- Core 8C executable-only `mod alpha_spawn` check: **PASS**
- Six in-memory negative assertions + two real negative argument/provenance cases: **PASS**
- `node --check` syntax: **PASS**

**The same exact four-way tree also passed** (under the C3s and latest Items/World/8C heads):
- Rust 1.89 `cargo fmt --check` **PASS**;
- `cargo test --locked --lib`: **236 passed, 0 failed, 3 intentionally ignored subprocess helpers**;
- strict `cargo clippy --all-targets -- -D warnings`: **PASS**;
- 38 World geometry/source tests **PASS**;
- 7 true QUIC **loopback** staging tests **PASS**, including four connected clients reaching distinct rack approaches;
- World/Core exact socket source-parity and Items/World reach56 overlap doctors **PASS**. Three midpoints have two eligible swords; pick explicit signed ground entity + item ID, not nearest.

Core #541 exact-head **[protected quality #39610109795](https://github.com/tehki/myaso/actions/runs/39610109795) PASSED 163/163**. Items #552 full **[quality #39610099950](https://github.com/tehki/myaso/actions/runs/39610099950) FAILED real M41**. The local merged source suite does **not** supersede mandatory protected/native Chrome/Firefox tests, nor demonstrate independent machines, actual physical sword click, real complete Physics LOS or an authenticated current-world ACK.

## Blocking signatures — NEVER inferred

All of the following must be jointly approved by Core 8B, 8C, 8A, Items, World/Physics, and central orchestrator at [#432](https://github.com/tehki/myaso/issues/432) and accepted at [#480](https://github.com/tehki/myaso/issues/480) before any First Playable item authority is active:

1. Exactly **one** live canonical item/world writer, with rollback and no MYWLD003 `u64` plus MYTX/PG `u128` dual-write or unreviewed downcast.
2. Explicit World V1 socket → ground entity → physical item mapping, backed by the real source inventory, with approved zone ID, world-unit↔cm scale/origin/rounding and worker epoch. No guessed 1:1 or 100:1 conversion.
3. Authenticated actor/session, bounded replay-safe `TryPickup` with exact two-ID target, same committed World/Physics LOS/range, atomic item/world mutation and a **durable ordered observer outbox**. Historical pickup-success receipt is not equivalent to currently equipped sword after a drop/ABA.
4. Four independently operated Chrome/Firefox browser clients on real two-machine staging, real Blacksmith sword pixel hit test, fists/sword combat and no ghost/duplicated items, protected full CI and tested rollback.

No merge into `main`, production deploy/restart, live-world mint, database migration, Moon Coin or custodial wallet activity was performed by this audit. Central orchestrator owns integration and release.
