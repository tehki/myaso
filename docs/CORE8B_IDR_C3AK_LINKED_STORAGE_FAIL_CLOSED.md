# Core 8B C3ak — fail closed on linked identity-journal storage

**Moon Games / myaso.io — P0 First Playable, dormant IDR only.** Direct stacked child of [Core8B C3aj draft PR #714](https://github.com/tehki/myaso/pull/714). Do NOT merge or activate any identity/item writer without Main #360 approval.

## Actual vulnerability / scope

The local offline MYID claim journal protects its root using mode 0700, its events and Unix flock lock file using mode 0600, and fsyncs individual event files. **Before this change**, `OfflineClaimJournal::open` used normal `OpenOptions::open` on `.identity-writer.lock`, and `File::open` on recovered numbered `*.myid` event files, both of which follow the final-component symlink. A manipulated local journal directory could cause a supposedly independent lock to be acquired on some unrelated file, or a canonical-name event to be read from a linked external file. `fs::set_permissions(root,0700)` also followed a symlinked journal root and could chmod the wrong directory.

This child changes ONLY the existing `server/src/idr_claim_journal.rs` offline filesystem-recovery path and new tests; it changes no production game runtime, clients, protocol, item MYTX writer, event bytes/checksum/sequence, service route, verified-evidence authority or real character identity.

## Fail-closed Linux local filesystem guard

- Validate `fs::symlink_metadata(root)` and require a real directory **before chmod**. Reject a final-component directory symlink with explicit error and leave its target's mode unchanged.
- Use Linux kernel `O_NOFOLLOW` for `.identity-writer.lock` when opening, closing the metadata-check/open symlink race on the **final path component**. The lock must be a regular file with exactly one hardlink and no group/other permission bits. A symlink lock is denied, not followed, and the unrelated target's bytes are untouched.
- When listing historical MYID entries, reject symlinks **including orphan staging names**. When opening each event file, use kernel `O_NOFOLLOW` and require the actual opened inode to be a private regular file with one hardlink. Ignore the contents of any otherwise-valid MYID event exposed through a symlink or hardlink; do not silently import a fake prior observer claim.
- Abort rather than silently fallback on non-Linux platforms: another platform needs a separately reviewed NOFOLLOW equivalent before allowing this offline writer. Existing Unix flock still governs exclusivity; production opening never waits for `WriterBusy`.
- Continue rejecting invalid MYID version/length/reserved bytes, checksum mismatch, sequence gaps, duplicate event IDs, stale source generation/appearance, actor tombstone and older snapshot below the caller-supplied minimum head. The new linked-path guard does **not** grant a Verified opcode, introduce a new writer or provide a cryptographic trust proof.

## Source-backed regressions

1. Symlink a candidate journal root to another real directory with mode `0755`; opening rejects it **without chmodding** the target.
2. Symlink a would-be `.identity-writer.lock` to an unrelated private file containing `DO_NOT_TOUCH`; opening denies and the external file's contents remain unchanged.
3. Commit/fsync a genuine `MYID` V1 unverified claim, save its byte-valid file to another path and replace the canonical record with a symlink to that external file. The journal refuses recovery; external bytes remain unchanged.
4. Replace the symlink with a hardlink to the byte-valid external event. Journal rejects the linked inode even though it has valid MYID checksum and payload.
5. Restore the original byte-valid canonical record with group-readable mode `0644`; journal denies. Restoring `0600` permits normal recovery of the same original committed event.

All earlier canonical current-view Unknown/Claimed-only, no public revocation API, real SIGKILL/lost-ACK, 8A/8C independent acceptance and stress regressions remain.

## Deliberate limits — NOT production file-system hardening

This **only** constrains local final-component links and opened file type/mode/link count. It is not an `openat2(RESOLVE_BENEATH|RESOLVE_NO_SYMLINKS)` traversal proof, a file-descriptor-relative directory root, inode pinning against parent-directory rename, protection against privileged users or attacks on writable parent ancestors, or an encrypted data-at-rest design. The offline journal remains rollbackable if **the entire valid previous store** is restored; FNV checksum is not a signature and `open_with_minimum_head` assumes a separately trusted high-water not supplied here.

Production IDR still requires an approved globally fenced single writer, authenticated Core account/lease and 8C/Physics signed World witness+appearance epoch, cryptographic/private true-name storage with moderator audit, monotonic rollback defense, recipient-bound 8A delivery and a real multi-browser test. The original four Greyhaven swords and one Core↔Items ownership writer remain Full Alpha P0; owner-approved combat Pre-Alpha #695 excludes this optional dormant IDR dependency. **No live activation, main merge, production migration or deployment.**
