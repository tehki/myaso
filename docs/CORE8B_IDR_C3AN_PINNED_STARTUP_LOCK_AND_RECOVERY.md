# Core 8B C3an — pin MYID startup lock and recovery to one directory inode

**Project:** myaso.io / Moon Games. **Authority:** Core 8B IDR #653 and Main #360. **Status:** DRAFT, DORMANT, Linux offline only. Direct child of [C3am PR #734](https://github.com/tehki/myaso/pull/734). Nothing in this change is connected to live QUIC, item custody or gameplay.

## Actual threat: pathname rebinding during startup

The C3am MYID writer correctly created/published NEW event records relative to a pinned Linux directory descriptor using `openat` and `renameat2(RENAME_NOREPLACE)`, but startup could still open its lock using `OpenOptions::open(root.join(".identity-writer.lock"))`, enumerate via `fs::read_dir(root)` and read historical records by name-derived path. A local actor able to rename and replace the directory pathname **after** pinning the original root but **before** those operations could make the startup lock one directory and inspect another, or import historical claims from the wrong directory. A subsequent writer anchor check would reject writes but would not guard the initial recovery before publishing the in-memory result.

## Actual scoped implementation

Only `server/src/idr_claim_journal.rs` and this document change.

- Opening/creating the private `.identity-writer.lock` now uses Linux kernel `openat(root_dir_fd, constant_name, O_CREAT|O_RDWR|O_NOFOLLOW|O_CLOEXEC,0600)`. Its actual opened inode is checked as a private regular single-link file, then flocked. There is **no independent pathname-based lock acquisition after pinning**.
- Recovery enumerates the **pinned directory** through Linux `/proc/self/fd/<root_dir_fd>` and retains only its entry names, rejecting any symlink encountered (including staged names), unknown filenames, oversized entry count and noncanonical sequence identifiers. Historical event files are opened with `openat(root_dir_fd, canonical_single_component_filename, O_RDONLY|O_NOFOLLOW|O_CLOEXEC)`; actual opened inode is checked for regular/private/single link. Do not use a name-returned path for subsequent event reads.
- Recovery remains bounded, sequence-contiguous, checks exact record bytes/version/shape/checksum/event ID and replays deterministic observer claims/tombstones. **Before returning a usable recovered journal**, validate that the pinned directory and lock's inode still match the named original root+lock. If the pathname was rebound during startup, fail closed; never advertise the history as live/current.
- The existing C3al/C3am writer-anchor checks and pinned-directory-relative fsynced event publication remain unchanged. This is **local Linux filesystem containment**, not protection against privileged ancestor mutation or distributed writers.

## Deterministic adversarial test

With a genuine completed MYID event 1 from a real original journal, run a test-only hook precisely after the Linux root descriptor is pinned but before writer lock acquisition or event listing; rename the original journal to a different path and create a clean replacement directory at the previous name. Startup must reject the rebinding. The replacement directory must receive **no lock file and no identity record**, while the original moved directory retains the old valid event and its original writer lock. Only an explicit open at that original directory's actual new name can recover the original event once.

All prior tests still run: real SIGKILL-after-fsync-before-ACK and exact receipt replay, forged epoch and stale session generation denial, independent observer Unknown/Claimed, post-tombstone denial, linked root/lock/symlink/hardlink/weak permissions, duplicate numbered-record no-overwrite and controlled writer-lock inode replacement. Under repeated full 16-thread testing, two **existing test-only** moved-journal reopens intermittently received `WriterBusy` immediately after dropping the former local writer; they now use the same bounded 500ms/5ms `Root::with_bounded_writer_handoff` test helper as other MYID recovery tests. Production `OfflineClaimJournal::open` still rejects an occupied writer immediately. After this test-only adjustment, **40 full 16-thread library suites passed**, each with 285 PASS / 5 intentionally ignored helpers.

## Remaining production hard stops

This relies on Linux procfs to enumerate a pinned `dirfd`, not a dependency-free `fdopendir` implementation or a full `openat2(RESOLVE_BENEATH|RESOLVE_NO_SYMLINKS)` traversal proof of untrusted root ancestors. Root path `create_dir_all` and initial root pin still happen before descriptor binding; malicious privileged or writable-ancestor races and an attacker rewriting files they legitimately own are not eliminated. `flock` is NOT an unforgeable global writer authority epoch. An entire old internally valid snapshot may still replay without a separately protected monotonic high-water. FNV is not a signature or MAC.

**No Verified evidence, secure private true-name/alias custody, moderator role-gated audit, trusted 8C/Physics world LOS and completed-tick evidence, authenticated 8A viewer delivery, global identity consensus or production migration.** The independent Core↔Items dual-writer sword counterexample #629 and four physical Greyhaven rack swords remain First Playable P0 blockers; optional IDR MUST NOT delay the combat-focused Pre-Alpha. Main #360 exclusively controls GO, merger and deployment. **No main merge, identity activation, production migration or deploy.**
