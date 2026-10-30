# Combat: submit physical Jump before RAF and cold audio startup

Base: #1117, `2976ec331ee7c26992bf4da8952b50f9c9e4ad04`.

## Reproduced source defect

Native M144 recorded genuine Space DOWN at1793352399516 and original input
submission at1793352399749,233ms later. The resulting original server recovery
windows did not overlap. The normal RAF sender and synchronous first-use audio
unlock were on the critical input path. The original assertion remained RED;
the test did not invent recovery overlap or widen timing gates.

A regression executes the actual original game keyboard callback with a
stalled RAF. Before the correction it submitted zero inputs. The selected
typed-LMB case likewise failed to submit the original Space input promptly.
The first-red and initial CRLF fixture-setup error are separately preserved.

## Correction and ownership

A trusted focused physical Space DOWN submits one normal sampled input through
the existing authoritative client, prediction history, redundant-input encoder
and transport owner. It uses the same uint32 client tick and advances it once;
one-shot flags are cleared so the next RAF cannot replay the chord under a new
tick. Rust still decides Jump, stamina, priority, damage and recovery.

Legacy Space+LMB includes the existing committed Light bit. The selected typed
profile sends original Space without a v1 attack bit, retaining one exclusive
typed LMB owner. Unadmitted/hidden/unfocused/untrusted events and pending or
retired typed negotiation cannot submit an immediate Jump. No packet fields,
identity, certificate, control-stream or server-clock rules change.

Cold Jump audio uses the existing after-original-send scheduler. AudioContext
creation and its cue occur after genuine input submission. Focus loss resets
pending/scheduled audio. Music, recordings, sound design and normal hot cues are
unchanged. The first-use handler no longer blocks the input behind audio unlock.

## Validation

Executable callback tests cover immediate submission before RAF/cold unlock,
typed LMB exclusivity, hidden/focus/admission/trust gates, uint32 wrap and typed
negotiation retirement. Audio tests cover cue matching, one delivery and focus
reset. Full Linux Node1024 passed before the added negotiation test; the final
suite is repeated. Rust source is exactly the parent validated449/private456
test revision.

Final pre-commit Node1025/1025 passed, including the pending/retired typed-grant
fence. All six changed runtime/test/workflow Git blobs match on Windows/Linux.

Pre-commit native M144 and M145 both passed their unchanged lead/overlap/HP/
three-stage focus/spatial gates. M211 original World proof showed actual
overlap415..428 for M144 and409..421 for M145, with full450ms Jump recovery.
Both Chrome-led and Firefox-led two-native selected-profile JumpAttack passed;
mixed-four held Heavy + Chat cancellation passed; mixed-four lifecycle with
death, respawn and fresh-actor reconnect passed.

The parent CI separately recorded real Firefox physical holds194/185ms during
an intended zero-pause short click, versus Chrome10/8ms. The strict <135ms
physical gate correctly failed. It is not classified as infrastructure without
further evidence. The native lifecycle observer now records bounded frame
chronology alongside actual pointer edges to distinguish driver waiting from
a stalled browser frame when this recurs. All physical/timing/World assertions
remain required. First red:
https://github.com/tehki/myaso/actions/runs/41034612605/job/123992273575 .

```sh
node --test tests/combat4-physical-jump-ingress.test.mjs tests/after-source0-audio.test.mjs
MYASO_PVP_SCENARIO=uimultirecoveryffa node scripts/pvp_browser_flight_runner.mjs
MYASO_PVP_SCENARIO=uimultirecoveryspatial node scripts/pvp_browser_flight_runner.mjs
```

Native browser/QUIC evidence is same-host qualification. Independent4D and
Main0 release decisions remain separate; no deployment or config activation.
