# Core 8B C3v — exact current Blacksmith rack click, READ-ONLY

P0 First Playable Alpha #480; Core authoritative item writer and migration #432; armory interface #488. Child of Core 8B C3u #577. This does **not** activate live item mutation or a browser wire protocol.

## Contract

`preflight_exact_current_rack_selection` consumes independently trusted source rows and the same local Core C3e `DurableItemJournal` as C3u. The untrusted click selector contains an **exact** rack socket label, *separate* proposed canonical ground-entity ID, canonical physical `ItemId(u128)`, and the last observed per-item committed mutation sequence.

All must match the *currently present* rack sword. An unknown socket, no current sword, wrong entity, different physical sword, zero mutation revision, or pickup/return ABA stale revision fails closed. A different sword may be simultaneously reachable (56-world-unit reach at World rack midpoints): **never substitute nearest**. Independent mutations to other items do not needlessly stale this item revision. Restart/reopen preserves matching results.

## Trust boundary — NOT an accepted pickup

This check does **not** prove actual World/socket ground-entity existence, an authentic Items checkpoint, `ItemKind`, a signed current Core 8C authority epoch, an approved World→centimeter transform, authenticated character/session generation, completed simulation tick, Physics LOS/reach, or a network packet. C3u source/transform inputs are caller-supplied proposals. The returned read-only candidate has a time-of-check/time-of-use gap: final exact identity/revision, actor, epoch, geometry and current equipment MUST be checked again *inside the single fenced ownership writer's atomic transaction* before a durable receipt/outbox and ACK.

It does not create a second ledger, authorize MYWLD003 u64 or MYTX u128 as live writer, mint or move an item, publish an observer change, or replace any release check. Production merge/deployment remains Main Orchestrator-only.

## Local evidence

On an isolated exact-parent checkout, Rust 1.89.0:

- `cargo test --manifest-path server/Cargo.toml --lib`: 125 passed, 0 failed, 3 intentionally ignored.
- Exact-click tests: 4 separate current physical swords; mismatched socket/entity/item; zero or stale item revision; pickup→return-to-same-rack ABA; unrelated sword commit; swapped checkpoint-derived source; durable reopen.
- `cargo fmt --check`, `cargo clippy --lib -- -D warnings`, and `git diff --check`: passed.
- Full protected exact-head Actions remains mandatory; local tests do not establish four independent real browsers or any live sword commit.
