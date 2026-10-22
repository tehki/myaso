# Core 8B C3aj — deny unchecked IDR history and revocation through production APIs

**myaso.io / Moon Games First Playable Alpha P0.** Direct offline-only child of [Core 8B C3ai #703](https://github.com/tehki/myaso/pull/703). No main merge, running server route, new source of authenticated evidence, network packet, physical item writer, World or Physics change.

## Reason

C3ai correctly makes `OfflineClaimJournal::read_claim_for_current_viewer` the one current-observer view: it requires both current canonical Core player leases and the subject's server-owned presentation epoch, and can return only `Unknown` or `Claimed`. However the same public Rust library also offered `observed_unverified_claim` as an **unchecked historical retrieval** of per-observer names, `verify_historical_event` as an unauthenticated original event existence/payload-match oracle, and `append_offline_tombstone` as a public raw canonical subject revocation. These have no production moderator authorization, encrypted true-name store, audit or verified World evidence. A future integration could accidentally call the wrong public method, bypassing C3ai's current-view gate or revoking a character without proper authority.

## Scope of code change

Mark these four offline journal helpers **`#[cfg(test)] pub(crate)`**:
- `observed_unverified_claim(observer,subject)`: only tests/forensic fixture may read past claims without current actor/lease/revision checks. Compiled production library no longer exposes this raw bypass.
- `verify_historical_event(event_id,payload)`: historical receipt oracle is intentionally not yet a public subscriber-ACK interface. It remains compiled for unit tests, and a new assertion proves original exact event/receipt still matches after reconnect while the current authenticated viewer sees **Unknown**; a changed claimed name with the same event ID is rejected.
- `append_offline_tombstone(subject,event_id)`: **no standalone arbitrary character revocation in a production library API** before a trusted single-writer moderator/IDR authority exists. Recovery of existing historical Tombstone records remains implemented; tests still exercise fsync, SIGKILL, restart and rejection of post-tombstone claims.
- `retired(subject)`: raw private canonical subject-retirement existence query is test-only, not a public role/identity enumeration primitive.

Do NOT suppress test coverage, delete tombstone/event encoding, rewrite durable journal bytes or enable verification. `read_claim_for_current_viewer` remains public but dormant/unscheduled; every use requires a real currently authenticated Core observer and subject lease, matches source generation+presentation epoch, and reveals at most an unverified claim. The new public production library cannot directly call the four `#[cfg(test)]` methods, but this is **not** browser security, actual authentication or cross-host production identity trust.

## Tests and remaining P0 gates

- Original full-width canonical ID and viewer isolation, subject reconnect, stale viewer, server-owned disguise epoch, subject tombstone, fsynced exact replay, lost-ACK SIGKILL recovery and valid old-prefix rollback tests retained.
- New raw history test assertion shows a previously committed name/event still has a historical exact receipt after source reconnect while a current observer sees Unknown. Exact same event ID with a different name refuses historical match.
- **Still missing:** trusted 8C/Physics completed tick and genuine LOS/witness evidence, single globally fenced IDR authority, signed/protected monotonic rollback floor, durable session and appearance writer, secure private true names and moderator audit authorization, viewer-bound 8A projection/ACK and real multi-client disguise acceptance.
- Independent Core+Items item ownership split-brain #629 remains a separate Full Alpha hard stop. Pre-Alpha combat release track #695 must not be blocked by optional dormant IDR; Main Orchestrator #360 controls all releases.

The release invariant remains: a stored unverified claim is a historical fact about an alleged name, NOT a live verified identity.
