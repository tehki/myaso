# Combat 4 × Core 8C — Current 4-peer QUIC and Combat authoritative source joined QA

**Review only / DRAFT / unmerged / no runtime v2.** Main [Pre-Alpha #695](https://github.com/tehki/myaso/issues/695), Combat4 [P0 #696](https://github.com/tehki/myaso/issues/696), protocol [#723](https://github.com/tehki/myaso/issues/723). This integration is stacked **directly on protected-green Combat [draft #759](https://github.com/tehki/myaso/pull/759) exact `06a79da0eb8642f1da1d63b4141813bccaec6328`**.

## Integration lineage, without inventing protocol compatibility

Original Core8C [draft #733](https://github.com/tehki/myaso/pull/733) was previously copied through `f15ab87103859b9e9e940d6ad10e329f6f021959` in Combat's [draft #740](https://github.com/tehki/myaso/pull/740). This separate integration cherry-picks ALL subsequent 21 original owner-authored Core8C commits from that exact point through original Core8C head `b4ab6a56218db1f6710b777fccaad34a7555aebb` onto Combat4's current stack. No original Core8C source/test/CI logic was replaced. The only conflict was the initial three-line review memo formatting: Combat4's prior commit had used a Markdown backslash hard break to remove trailing spaces, while Core8C removed the hard breaks. The resolution adopted Core8C's original three clean text lines, preserving the full rest of the original report. **No `server/src/main.rs`, original QUIC handler, `World` gameplay or browser gameplay code change occurred in this integration.**

Core8C's new original `server/tests/core8c_real_quic_actor_departure.rs` is a **genuine Rust QUIC client/server acceptance test**:
- four separately authenticated certificate-pinned sessions admitted as original v1 netIDs 1,2,3,4 under four-seat cap, with real current actor-specific INPUT_ACK,
- a real peer #2 disconnect and replacement fresh netID 5, with existing v1 peers continuing,
- real server-generated removal-tombstone and new-player authoritative snapshot delta tracking, including repeated lost removal-ACK case and converged replication,
- other Core8C dedicated native Chrome/Firefox four-player script `scripts/core8c_prealpha_native_ghost_rejoin.mjs` additionally requires true W3C WASD/Input ACK, then checks Canvas ghost retirement/rejoin under real browser peer-loss constraints.

These are **owner-authored Core8C tests carried unchanged**, not newly developed Combat4 features. This integration branches from the **latest owner source at the time of test** and does not claim Core8C PR #733's independent protected quality is green if it has not completed successfully.

On the **same joined source**, inherited Combat4 actual `World.step()` tests demonstrate original 34HP light, 46HP heavy held READY release and Core8C review actor-lease retirement, plus strict native M121 directional-press correction from [#749](https://github.com/tehki/myaso/pull/749), original M193 125ms parry-vs-guard 100→62→24→0 from [#752](https://github.com/tehki/myaso/pull/752), and original M143 transmitted-sample conditional arbitration from [#759](https://github.com/tehki/myaso/pull/759). **Those original World gesture tests are fixture-owned, not end-to-end QUIC v2 admission.** A real original v1 INPUT_ACK is *not* proof an intended Combat gesture was successfully applied to World.

## Verified source QA and unsolved issues

On isolated Serj Linux in the exact joined source worktree:
- `node --test tests/*.test.mjs`: **591/591 PASS**.
- complete `cargo test --locked --manifest-path server/Cargo.toml`: **PASS**, including original actual Core8C real QUIC disconnect/replacement test, Core8A review, Combat4 real World tests, and preexisting WebTransport smoke.
- `cargo clippy --locked --manifest-path server/Cargo.toml --all-targets -- -D warnings`: **PASS**.
- `cargo fmt --manifest-path server/Cargo.toml --check`: **PASS**.
- `git diff --check` comparing exact #759 parent to joined head: **PASS**.
- Parent #759 *independently* achieved original [full protected quality #39771907097](https://github.com/tehki/myaso/actions/runs/39771907097) **SUCCESS 165/165 steps**, including native M143 and M121. **This cannot be transferred** to any different joined SHA. Exact joined-head native W3C/real QUIC tests must pass on their own CI run.

Still unresolved, despite positive source proof:
1. Main #723 must adopt **one** version2 0x11 event/0x12 ACK with explicit future LMB-vs-KeyE source; Core8C tentative 0x52 remains incompatible and must never be guessed/accepted.
2. Core8A must implement authorized negotiated admission/reliable outbox and ACK over actual current peer, Core8C bind server-issued per-actor generation+epoch, per-World tick lock and retirement to that real admitted session. No source-test lease constructor proves authentication.
3. Combat4 must execute real 135ms pointerDOWN light and 320ms READY/release-only heavy HIT once, preserve standalone KeyE/Space+LMB/guard/roll/kick and refuse stale/duplicate events.
4. UI10 must switch real browser pointer/Space input atomically, with genuine M143 30Hz outgoing INPUT tick provenance and authenticated per-peer server World turn; don't infer packet loss merely from absent M143 trace fields.
5. Main final 2–4 **independently human-operated hosts**, original Silver/R4/Chat C1 default-OFF, strict all M gates, real full-joined-head protected, immutable stage+rollback and explicit owner/Main GO are still mandatory.

**NO main merge, deployed/live v2, staging, public listener, firewall, database or service restart. PRE-ALPHA RELEASE HOLD.**
