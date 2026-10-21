# Core C3d — ABA-safe ground arrival confirmation

Core Department 8B follow-up to [C3c PR #379](https://github.com/tehki/myaso/pull/379). This is **dormant**, single-authority journal hardening, not live cross-zone networking or production authorization.

## Problem

An item can travel A -> B -> C -> B. Previously the historical A -> B arrival proof could become `Current` again because `confirm_arrival` only compared the current location with its destination. This is an ABA replay acceptance bug even when the original receipt was authentic.

## Correction

- Each successful ownership batch updates an in-memory **per-item last-mutation sequence** for every touched item, including destroy. The sequence is rebuilt deterministically by immutable journal replay after restart.
- `confirm_arrival` validates the exact original durable receipt and additionally requires that its sequence equals the item's last mutation sequence **and** its destination equals the current canonical location.
- An unrelated transaction touching another item does not invalidate a valid arrival proof.
- An idempotent replay never advances last-mutation sequence.
- The existing immutable journal format is unchanged. No new network protocol, database, authentication, World authority, wallet or live gameplay is activated.

## Acceptance

Run in a real Rust checkout:

```bash
cargo fmt --manifest-path server/Cargo.toml -- --check
cargo test --locked --manifest-path server/Cargo.toml zone_item_transfer::
cargo test --locked --manifest-path server/Cargo.toml --lib
```

New regressions: A -> B -> C -> B old proof must remain `Superseded` before/after restart; an unrelated item commit must leave the valid proof `Current` before/after restart. Protected exact-head quality CI is mandatory.

## Residual release blockers

This is still a single-writer local reference: no shared distributed CAS, trusted worker authentication, source-zone freeze, target activation, global uniqueness, failover, anti-symlink secure store, replication or full-loot gameplay integration. C4d's PostgreSQL fenced world mutations are not yet coupled to C3b item ownership; the eventual unified transaction must enforce source authority and the per-item version/epoch in one commit. Merge ordering is C2a -> C3a -> C3b -> C3c -> this PR, subject to Development Center review and protected tests.
