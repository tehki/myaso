# Main 0 — child native timing investigation, 27 October 2026

Classification: durable project engineering evidence. Risk: LOW, native fixture
and read-only diagnostics only. Continue existing Draft #1077; no release gate
or gameplay changes. Rollback: revert this investigation commit on the child.

## Verified starting state

- Canonical #1036: `a312e857aafc4fcdc241403f98281932ebd9f56d`,
  Draft/open/unmerged; all 28 exact-head workflows completed SUCCESS.
  [Protected quality](https://github.com/tehki/myaso/actions/runs/40367422769).
  Its description's b8ce29 checkpoint is historical, not the live head.
- Experimental child #1077: `83e82d35956a2399787fb971fde712831a9e347a`,
  Draft/open/unmerged, based on #1076 branch, not canonical integration.
- [Independent Combat 4D findings](https://github.com/tehki/myaso/pull/1077#issuecomment-6427548023)
  qualify isolated same-host JumpAttack42, not WAN or overall combat.
- [Standard native matrix](https://github.com/tehki/myaso/actions/runs/40401497446):
  9/11 jobs SUCCESS, two genuine failures. Preserve these logs and artifacts.

## M147 — demonstrated physical input scheduling failure

[Failed job121848232544](https://github.com/tehki/myaso/actions/runs/40401497446/job/121848232544)
recorded actual native Space down1195.7ms and pointer down1358.4ms in the same
browser: 162.7ms apart. The server did deliver real34HP during recovery, but
this cannot qualify the unchanged <=60ms physical chord gate.

The scenario already pre-aims the original pointer while idle, then redundantly
calls the helper containing a pointerMove tick before the chord. Reuse the
existing pointer-first `performArenaPreAimedJumpAttackChord` in this scenario
only. One original W3C transaction now starts pointerDown/keyDown in its first
action tick. This removes an unnecessary scheduling step; native repetition
must still establish whether it resolves the observed delay under load.
No event timestamp, trust flag, HIT or acceptance threshold is rewritten.

The executed helper regression verifies actual W3C payload order and preserves
the strict measured chord and original World recovery proof. The recovery-cue
VM test normalizes CRLF before extracting its script; all semantic checks remain.

## M156 — late contact remains uncorrected

[Failed job121848232271](https://github.com/tehki/myaso/actions/runs/40401497446/job/121848232271)
original World: defender2 Knockdown1326→Idle1358; punisher3 LightWindup1356,
LightActive/HIT34 at1364. Contact occurred six World ticks after recovery.
No reach or damage defect is established: the real HIT reached intended actor2
with HP66, but was late. The reported browser transition and Windup are about
477ms apart. Those observations do not locate delay within the watcher return,
driver scheduling, physical input, classification or network delivery.

Add read-only browser observation time, Node watcher-return/dispatch/completion
times, original physical pointer records, original source0 samples/submissions
and World chronology before strict rejection. Node command durations are measured
within Node; browser-local times remain separately labeled. Do not derive WAN
latency by subtracting unsynchronized clocks. Dispatch still follows actual
Knockdown and still does not await the roller's unrelated wheel ACK. The5ms
physical hold and every strict damage/window/provenance check remain unchanged.

## Validation before commit

- Syntax, diff whitespace, policy and governance validators: PASS.
- Focused M147/M156:34/34 PASS.
- Complete local Node:856/859 PASS. Three Windows environment failures:
  existing Core8A source-string check assumes LF in unmodified Rust source;
  two staging tests require OpenSSL/POSIX paths unavailable in this shell.
  No test is skipped or weakened. Linux full quality remains required.
- Rust/native browser execution unavailable locally (Cargo absent). Use existing
  exact-head CI; never inherit predecessor conclusions onto a new SHA.

## Blockers and next actions

1. Combat4A/4C: repeat M147 and M156 on the new immutable child SHA, inspect actual
   trusted events and original World chronology; use M156 diagnostics to locate
   the delay before selecting a correction.
2. Main0/Core8A/8C: verify full quality and complete applicable native matrices
   on that same SHA, including42HP and no duplicate action/HIT.
3. Independent Combat4D: qualify the final candidate separately; then prepare
   pinned nonproduction two-human Chrome/Firefox independent-host acceptance,
   death/respawn/reconnect/ghost cleanup and operational rollback evidence.

Release decision: HARD HOLD. No main merge, deployment, production restart,
network configuration, public experimental activation, approved timing/damage
change or Living World implementation. #1067 remains architecture/backlog only;
#480/#488 retain their separate full First Playable Alpha requirements.
