# Core 8B C3am — pinned-directory-relative MYID publication and no-overwrite

**myaso.io / Moon Games — IDR #653, First Playable Alpha P0.** DRAFT, DORMANT and Linux-local. Direct child of [C3al draft #722](https://github.com/tehki/myaso/pull/722). Main orchestrator #360 alone owns production identity authority, merges and deployment. IDR must not block the combat-focused Pre-Alpha.

## Why this is required

The preceding offline MYID implementation pinned an open root directory and compared its device/inode and the lock's inode with current pathnames before/after an append. But **between those checks** it used path-based `OpenOptions::open(root.join(".staging-..."))` and `fs::rename(root.join(staged),root.join(sequence))`, meaning a local actor able to replace the root directory pathname in that window could redirect staged writes into a different, unrelated directory. The original pathname could also already contain a conflicting numbered event that a plain rename would overwrite before the post-write anchor check.

## Narrow implementation

Only `server/src/idr_claim_journal.rs` changes. Existing original MYID 256-byte v1 event body, checksum, Rust typed `CharacterId`/observer/speaker lease validation, sequence, durable tombstone semantics, SQL/World/game/runtime and single in-memory observer view remain unchanged.

- New Linux-only helpers use raw kernel `openat`, `renameat2` and `unlinkat` **relative to the previously verified and held `root_dir: File` descriptor**. They require locally generated single-component, NUL-free event/staging names.
- Stage with `openat(dirfd, staging, O_CREAT|O_EXCL|O_WRONLY|O_NOFOLLOW|O_CLOEXEC, 0600)`, validate that the opened inode is one private regular file, fsync its exact content. Publish with `renameat2(dirfd, staging, dirfd, sequence, RENAME_NOREPLACE)`, then fsync the **same pinned directory**. No path-based write or rename remains in the offline publication path.
- `RENAME_NOREPLACE` atomically refuses a conflicting preexisting committed sequence rather than overwriting it. On failure, cleanup targets only the staging entry **in the pinned directory**, never another path with the same name.
- The C3al writer-anchor check remains before and after publication. An on-path root replacement detected after a file was fsynced into the original pinned directory returns failure with **no success receipt**, and the original append marks its writer poisoned. On restart the committed event may be replayed idempotently; this is standard crash-after-commit-before-ACK semantics, not duplicate recognition.
- All other operating systems remain explicitly unsupported until they have a separately reviewed fd-relative equivalent. This is an offline review API, not live server control.

## True adversarial regressions

1. Create and fsync a genuine first MYID unverified name claim. In a special **test-only interleaving hook**, rename the active journal root and create a new directory at its previous pathname **after the real writer-anchor preflight but before the actual staged `openat`**. The original pinned dir receives the second event; the new path receives neither event, lock nor staging. The operation refuses success due the changed binding. No in-memory ACK/head advance. Closing/reopening the moved original directory replays the genuine second event once, illustrating a lost ACK rather than a duplicate.
2. With sequence 1 already committed and fsynced, attempt a second different `Record` to the same exact canonical `000...001.myid` path via the real pinned publication helper. `renameat2(RENAME_NOREPLACE)` refuses, original contents stay byte-for-byte identical, the conflicting staging file is cleaned, original journal head stays 1.
3. Keep all 11 existing focused MYID tests from C3al (Linux NOFOLLOW root/lock/event/hardlink/permissions, replaced lock inode, renamed root, stale actor/epoch/observer, tombstone, valid old-prefix rollback, real child SIGKILL after fsync-before-ACK, exact replay) and the complete previous Core/Items/Combat/QUIC suites unchanged.
4. Under 16-thread repeated full Rust library stress, an existing independent offline rack test intermittently returned `WriterBusy` **during its fixture reopen after dropping the original local item writer**. Add a bounded 500ms/5ms retry for `WriterBusy` only inside the `#[cfg(test)]` helper in `alpha_quiescent_rack_handoff.rs` (four fixture openings). **No production item writer or journal locking behavior changes.** With this fixture-only adjustment, 40 consecutive entire 16-thread Rust library suites passed (284 PASS each, five intentional helper ignores). The complete locked server Rust integration suite, strict Clippy and rustfmt also passed.

## IMPORTANT BOUNDARY

This improves **local write path binding** but is NOT a cross-host epoch-fenced MYID authority, not cryptographic tamper protection, not immutable event storage against privileged actors, not protected anti-rollback high-water, and not full `openat2(RESOLVE_BENEATH|RESOLVE_NO_SYMLINKS)` fd-relative recovery/lock acquisition. Current startup still lists event files via pathname and uses final-component O_NOFOLLOW; separately review the full read/recovery path and mutable ancestor directories. The initial lock still uses `root.join` before post-open inode verification. A malicious actor with permissions may race or restore an entire valid previous snapshot; a benign `flock` on separate inodes is not a distributed fencing token. FNV checksum is not a signature. Live IDR still lacks verified evidence, encrypted true names, moderator audit, complete signed 8C/Physics LOS/witness, 8A session-bound observer delivery, and external monotonic lineage.

**No production actor verification, real item authority, client packet, CI waiver, main merge, migration or deployment.** Core↔Items dual-authority physical sword negative #629 still blocks Full Alpha. Combat-focused Pre-Alpha #695 is independent.
