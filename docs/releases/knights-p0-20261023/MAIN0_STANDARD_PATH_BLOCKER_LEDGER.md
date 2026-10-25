# Main 0 standard-path acceptance ledger — 25 October 2026

Canonical candidate: [#1036](https://github.com/tehki/myaso/pull/1036).
Starting source: `78634ecc797ee0024a574f46ad0ea22ba9e76f4a`.
Protected main: `6fa59b649112c272bcbc018b4a32bf963f9a5bba`.
Final acceptance belongs to the final workflow head and package `REVISION`, never to this starting checkpoint.

## Constraints

Standard controls, original QUIC/WebTransport and the original 60Hz Rust World only.
No experimental gesture/HIT path is used to qualify this workstream.
No deployment, service restart, production configuration change, public protocol activation, release publication or merge is authorized.
Synthetic unit coverage does not replace native or independent-host acceptance.

## Blockers and acceptance

| Blocker | Owner | Reproduction/evidence | Correction and test | Acceptance |
| --- | --- | --- | --- | --- |
| Public Alpha parry not qualified | Combat4A/Core8A/8C, independent4D | [Public probe](https://github.com/tehki/myaso/pull/461#issuecomment-6399424521): HP100→66, guard100; numeric wheel sign and ingress/contact timing absent | Actual source listener maps positive deltaY to parry/block, negative to roll. Added executed-handler direction/expiry/cancellation tests; run two fresh standard M35/M41 trials with original World traces | Correct input → admitted Block → real PARRY within125ms, matching actors, no invalid damage, correct replicated stun/punish; pinned independent-host proof remains required |
| M156 old branch failure versus candidate success | Combat4B/4C/Core8C, independent4D | [Older docs quality](https://github.com/tehki/myaso/actions/runs/40202061191) failed; [786 quality](https://github.com/tehki/myaso/actions/runs/40203153986) passed. No causal M156 fix is inferred | M156 choreography/assertions remain unchanged. Enabled existing loopback read-only standard-input and World traces; two fresh Chrome/Firefox/Chrome trials | Exactly one attacker3→victim2 World HIT34 in the actual knockdown window, victim66HP, unaffected peers/guard, genuine native input |
| Old continuous controls may overwrite newer neutral input | Core8A/8C | Actual ingress probe accepts unseen old block samples after newer neutral. New original World regression is awaiting executed baseline; this is not yet an observed World-parry failure | Add regression first. Only after actual baseline failure, qualify monotonic packet-state admission while retaining old genuine action samples in NEW packets, duplicates, wrap and fresh-session behavior | Late old datagram cannot reopen parry or overwrite current movement/block. Forward packet recovery and exact original-edge tests still pass |
| Packaging skipped | Main0 | Existing job eligibility excludes canonical integration despite the workflow triggering | Extend the same approved artifact-only workflow to canonical PR/manual ref; exact head checkout, `REVISION`, complete file checksums and bundle digest; separate review artifact name | Exact-head package builds, downloads, verifies and retains default experimental-OFF configuration; no deployment implied |
| Candidate-specific independent-host WAN acceptance | Main0/Core8/Combat4D | [Public HIT/block](https://github.com/tehki/myaso/pull/461#issuecomment-6399397311) is a different-build smoke. Prior private bidirectional reachability probe received no packets | Both authorized devices are online; preserve VPN and pin checks. Need a reachable, authorized non-production target carrying the candidate and declared impairment profile | Same source/artifact, consistent two-host HIT/HP/guard/parry, loss/delay/reorder, departure/rejoin, raw client/server chronology; human acceptance recorded separately |
| Previous-version operational rollback | Main0/operator/Core8C | #1048 has no verified target, service identity, previous artifact or stop/restore/start commands | Preserve the acceptance template. Package hash/restore checks can be isolated, but do not substitute for the prescribed operator drill | Authorized isolated target, known-good restore point, real commands, independent witness and observed before/after health/TLS/player smoke; remains HOLD without these inputs |
| Serj temporary destination route cleanup | Main0/operator | Verified priority100 `to168.113.210.63 lookup main`; no active endpoint UDP connection. Exact deletion attempted using noninteractive sudo | Deletion was rejected because sudo requires a password. Rule and routing were re-read and remain unchanged. No VPN settings were disabled or password requested | Authorized operator removes that exact temporary rule and verifies resulting policy/route; no claim of completed cleanup |

## Evidence boundaries

- Historical exact-head automated QA at786: [independent4D](https://github.com/tehki/myaso/issues/695#issuecomment-6399641167).
- Two-host public Alpha light34HP and MMB block−38 guard are valid public smoke evidence, not the Pre-Alpha source/artifact acceptance.
- Old private M147 loopback evidence is preserved as historical context; the latest command does not authorize an experimental bypass for these standard-path gates.
- The first new stale-block regression is intentionally added before a production correction. A predicted failure or a compiler/environment error is not an executed RED result.
- Existing remote Rust was found on X230i, but the isolated baseline build failed during dependency linking due disk quota, before the test ran. Only this task's newly generated target directory was removed; unrelated dirty Alpha work was preserved.

Release decision remains **HOLD** pending exact final-source checks and the external gates above. Structural mergeability and a green quality job alone do not grant release GO.
