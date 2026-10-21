# Core C3e — exclusive local item-journal writer fencing

Department 8B incremental hardening, stacked on dormant C3d [PR #401](https://github.com/tehki/myaso/pull/401), itself stacked on C3c #379, C3b #377, C3a #375 and C2a #365.

## Failure being prevented

C3b's journal explicitly requires one trusted writer but previously allowed two independent `DurableItemJournal::open` calls against the same directory. Each would reconstruct the same sequence and might both attempt to publish the next immutable canonical file. Even with hard-link uniqueness, a losing process cannot safely continue with its stale in-memory item state. The invariant must be enforced *before journal replay*, across cooperating operating-system processes.

## Implementation

- Acquire one nonblocking POSIX `flock` exclusive lock on `.item-journal-writer.lock` **before reading any commits**; hold the file descriptor for the entire journal handle lifetime. A second opener returns `ItemJournalError::WriterBusy` without replay or mutations.
- On handle drop or process termination the operating system releases its advisory lock, allowing a fresh process to reconstruct the committed state.
- Treat only this exact reserved lock filename as journal metadata; all other unexpected files remain invalid. Keep owner-only `0600` mode on new Unix lock files.
- On non-Unix platforms fail closed with an Unsupported IO error rather than silently offering false exclusivity. No dependency, format, gameplay protocol or journal receipt changes.
- Add a unit test for two open handles in one process and a **real child-process lock denial**; verify the next owner recovers/commits after release.

## Acceptance commands

```bash
cargo fmt --manifest-path server/Cargo.toml -- --check
cargo test --locked --manifest-path server/Cargo.toml --lib
cargo clippy --locked --manifest-path server/Cargo.toml --lib -- -D warnings
```

**Verified local evidence on the connected Serj Linux runner (Rust 1.89):** `cargo fmt --check` passed; full server `cargo test --lib` passed **94 tests, 0 failed, 2 ignored child helpers**, each executed and passed by a parent subprocess acceptance test; strict `cargo clippy --lib -- -D warnings` passed. The new tests confirm same-process and independent-process lock denial, post-release durable replay, and **real OS SIGKILL** of the writer after fsync/commit followed by recovery of the item and its exact original idempotency receipt in a fresh process. The two ignored helpers are intentionally not run unconditionally because one deliberately parks until killed.

Exact-head full protected GitHub `quality` is also required.

## Remaining limitations

This is advisory locking for **cooperating processes on a trusted local Unix filesystem**. It does **not** protect a malicious process that ignores the lock, an untrusted/symlink-swapped journal directory, network filesystems, distributed workers, cross-host concurrency, process-independent 8C zone authority or any live character/item gameplay permissions. Production must use a global transaction authority (coordinated with 8C PostgreSQL), real session and worker verification, atomic world/item/economic commits and reviewed backups/migrations. No live inventory, Magic, property settlement, Moon Coin, production credentials or deployment is activated.
