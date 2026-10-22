# Core 8B C3al — pin active MYID writer lock + root inode before append

**Project:** myaso.io / Moon Games First Playable Alpha, Core 8B IDR #653. **Status: DORMANT, DRAFT, LOCAL LINUX ONLY.** This is a direct child of [draft PR #718](https://github.com/tehki/myaso/pull/718). Neither IDR nor the independent Core/Items physical-sword owner is activated. Main #360 owns protected merge and deployment decisions.

## Threat demonstrated and bounded

POSIX advisory `flock` locks an **open file inode**, not the filename. Once an attacker with write access to the journal directory unlinks `.identity-writer.lock` and creates a new file at the same pathname, a second process can acquire an exclusive lock on that **different inode**, while the original first process still holds the former inode lock. This is a real local two-writer safety gap that cannot be addressed by checking only for `WriterBusy` at initial open. Likewise, renaming/replacing the MYID directory path after opening could redirect a subsequent path-based append away from the original store.

## Narrow implementation

- During initial offline `OfflineClaimJournal::open`, pin the actual Linux journal directory using `O_DIRECTORY|O_NOFOLLOW` and a real `File` descriptor. Compare its device+inode to the independently checked path metadata before setting `0700` permissions **through the pinned descriptor**. Keep it open throughout the journal lifetime. The existing final-component lock and event `O_NOFOLLOW`, regular-file/nlink/mode checks remain.
- Add a local `ensure_writer_anchor()` preflight comparing the held directory descriptor's device/inode to the named directory's device/inode, and comparing the held exclusive lock descriptor's device/inode to the named lock entry's device/inode and private single-link status. Directory rename/swap, symlink, lock disappearance, lock recreation, hardlink, and widened lock permissions are errors.
- Check this anchor **before every append**, including replay of an existing event ID, and again immediately before new-record write and after file fsync + rename + **the pinned directory descriptor's fsync**. Once an anchor check fails, the caller poisons the local writer so later appends deny. No new event is accepted into local sequence or returned as a successful ACK when detected.
- Keep the previously approved MYID event magic, version, record size, checksum, claim/subject/observer typed u128, exact event ID idempotency, record recovery, authority generation/appearance checks and tombstone behavior unchanged. **No item journal, gameplay, socket/protocol, production IDR packet or source-of-truth migration is changed.**

## Adversarial real tests

1. Open the sole local writer; fsync a genuine observer claim at sequence 1. Unlink its canonical lock pathname while the writer is still alive, then open **another independent `OfflineClaimJournal`** at the same directory; the new lock inode allows that second open (actual POSIX semantics). The original writer attempts a fresh event and fails with `MYID writer lock/directory binding changed`, keeps sequence 1, emits no sequence-2 file and becomes poisoned. The second is closed, and normal reopen still sees only the first claim.
2. Open the sole writer and fsync sequence 1. Rename the entire original journal directory while its descriptor remains open, then create a new directory at the same old pathname. The original writer refuses sequence 2 even though a path now exists; neither old nor replacement directory gets the proposed event. The original historical record is preserved.
3. Prior tests for linked root/lock and hardlinked/symlinked/weak-permission event records, crash SIGKILL after fsync-before-ACK, actual stable canonical authenticated speaker/viewer epochs, old-prefix rollback, source reconnect, actor tombstone and strict event format remain unchanged.

## Security and launch limits

This detects **specific between-operation local inode/path replacement** and pins the root descriptor for directory fsync. Checks are not atomic with all future path operations; a malicious actor can race between a check and a rename, and a privileged actor or writable ancestor directory can interfere. It does NOT implement descriptor-relative `openat2 RESOLVE_BENEATH` file creation/rename, cross-host consensus, tamper-proof identity audit, protected global authority epoch, encrypted true-name custody, a cryptographic signature/MAC, or whole-snapshot anti-rollback. In particular, a valid earlier MYID snapshot may still be replayed **at reopen** without externally protected monotonic high-water. Do NOT call this a globally fenced identity writer. Further live activation requires current Core 8A authenticated leases, signed Core8C/Physics completed-tick LOS/witness, actor appearance and subject persistence, reviewed Verified evidence and role-gated audit, and a real multi-browser evidence flow.

**First Playable four physical Greyhaven swords remain P0; original Core-vs-Items dual-writer durable split-brain #629 is a separate release blocker. Combat Pre-Alpha #695 is independent of optional dormant IDR. No merge to main, DB migration or deployment in this change.**
