# M35 native Windup observer correction — 27 October 2026

Durable engineering evidence; LOW risk, test-runner changes only. Continue
Draft #1077 from `d4041466692918c0ba961c0c464a717ab02ef6eb`.
No merge, deployment, production or gameplay activation.

## Preserved failure and demonstrated scheduling defect

[Job121862669811](https://github.com/tehki/myaso/actions/runs/40405674960/job/121862669811)
failed with no fresh Light cue, no defensive wheel and real HIT34: actor1
HeavyWindup1560 → LightWindup1563 → Active/HIT1571, defender Idle/HP66.
The unchanged-head standard repeat passed. Neither result identifies every
source of the intermittent delay.

`dispatchM41ObservedParry` issues the attack first, then requests execute/async
observation through that same browser's WebDriver session. Apparent concurrent
Node promises do not create independent browser command queues. The
[WebDriver processing model](https://www.w3.org/TR/webdriver/#processing-model)
queues session commands. A delayed action acknowledgement can leave the
observer starting after the transient Windup has been superseded. The new
deterministic regression models this queue: late observation correctly returns
null, while pre-armed observation sees the original fresh cue before click ACK.
This establishes a fixture scheduling defect; it does not establish that every
historical M35 failure had that sole cause.

## Narrow correction

For `uistun` only, arm a nonblocking read-only browser observer before issuing
the same physical35ms W3C LMB. The observer starts its4ms checks only after a
trusted native pointerDOWN and takes a fresh event baseline there, so events
from aim/earlier actions cannot qualify. It calls the existing
`readM41ScalarWorldCue` with Heavy disabled: current latest original rendered
Light, correct actor and valid event index/time remain mandatory. It never
authorizes from superseded history.

A single-use random token carries this small cue over the existing runner's
same-origin, loopback-only HTTP server. The endpoint is bounded to1024bytes and
validates role/index/text/time. It neither generates input nor talks to World.
Node still issues exactly one real defensive wheel only after the cue, awaits
both native action acknowledgements and enforces unchanged actual Parry,
HP/guard/stun and rendering assertions. A delayed receipt can still fail those
strict native/World checks. The180ms observation deadline starts at genuine
pointerDOWN; no gameplay timing or acceptance window is extended.

M33/M41 retain their original observation and wheel paths. Reused Draft #1061
failure-only timeout provenance (`4bb352c0`) adds bounded original event history;
timeouts still return null and never admit a wheel. M35 also emits that timeout
summary on rejection. Browser watcher and pending receipt are retired after the
attempt, including failure; no second input/Combat writer is introduced.

## Validation before commit

- Targeted observer, provenance, native-null and wheel tests:26/26 PASS.
- Full Windows Node suite:861/864 PASS. Same three existing environment reds:
  LF-sensitive Core8A unmodified Rust source assertion, absent OpenSSL and POSIX
  staging paths. No test skipped or semantic assertion relaxed.
- Syntax, diff whitespace, policy and governance validators: PASS.
- Original Rust/transport/control/damage source: unchanged.
- Fresh immutable-head M35 repetitions, standard matrix, full quality and
  independent Combat4D review remain required. Synthetic queue tests do not
  constitute native browser acceptance or prove human/WAN playability.

Rollback: revert this work-unit commit on the child Draft. Preserve original
red logs. Release remains HARD HOLD; canonical #1036 and Living World #1067 are
unchanged by this correction.
