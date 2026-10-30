# Combat native acceptance: held rear Block and sampled Jump entry

Base: Draft #1118, `84d1557b3b94bf5900345bb50ec94727a9928bee`.

## Preserved failures and cause

The original-browser `backblock,1` job failed its required Block/Active overlap:
https://github.com/tehki/myaso/actions/runs/41037648843/job/124002340627 .
Real replicas showed rear-facing Block during Light windup, then Idle when the
34HP hit arrived. The QA input planner required its own actor to be Idle to
send Block. As soon as the server acknowledged Block, the planner released it.
This alternation was a fixture input bug, not evidence that a valid defense
had been bypassed. The corrected planner arms from Idle against real windup,
continues the same held input while already blocking through windup/active,
and releases at recovery. It cannot start a late Block from Idle in Active.

The one-seat Firefox Jump action job timed out:
https://github.com/tehki/myaso/actions/runs/41037648461/job/124002340059 .
Its real World log contains accepted source0/action5, `0→16`, `16→17`,
`17→18`, `18→0`. The observer sampled after original Jump and its authenticated
conversion had both executed in one World tick. The two-player acceptance
already handles this case using the original 26-stamina spend as an additional
requirement. The one-seat consumer now uses that same classifier. ACK alone,
Jump-only 14 stamina, missing World entry, or missing Active cannot pass.
Separate `0→15→16` World ticks remain accepted by the existing classifier.

The one-seat case still requires genuine trusted Space-before-LMB native edges,
exactly one same-gesture action5/release3 pair, no ordinary Light, and a live
authenticated transport. It proves one actor's original JumpAttack action;
the separate two-player test remains responsible for actual 42HP victim proof.

## Validation and limits

Executable regressions first failed on the original consumers and then passed
10/10. The Jump regression executes the actual native wait callback against the
preserved Firefox transition sequence and includes negative World/stamina cases.
The Block regression follows consecutive replicated Idle/Block/Active samples
and catches the premature release. Full Linux Node1027/1027 passed. Native
backblock passed in both Chrome/Firefox replicas: actual Block/Active overlap,
rear arc3.142, one34HP damage transition and guard100. Genuine four-Chrome and
four-Firefox one-seat Jump runs passed. Chrome observed separate World entry;
Firefox reproduced compressed entry with real stamina100→74 and World Active.
These pre-commit runtime/test blobs matched on Windows/Linux; final exact-SHA
reruns and CI are tracked in the PR. Rust source remains the parent revision,
previously validated449/default and456/private Rust tests.

No Rust World, gameplay inputs, combat constants, packet fields, release flags,
CI selection, or acceptance thresholds change. The required Block/Active
overlap, rear/attack arcs, real 34HP damage and untouched guard remain intact.
Parry125ms, short Block240ms, Jump recovery450ms and native tap135ms stay intact.
Historical reds are preserved; independent4D and Main0 release decisions remain
separate from these development results.

```sh
node --test tests/*.test.mjs
MYASO_PVP_SCENARIO=backblock MYASO_PVP_WEBDRIVER_BASE_PORT=29515 \
  node scripts/pvp_browser_flight_runner.mjs
MYASO_LIVE_GESTURE_PHYSICAL_MODE=jump-review \
MYASO_LIVE_GESTURE_NATIVE_BROWSERS=firefox,firefox,firefox,firefox \
  node tools/art/main0_v2_knights_combat_four_native.mjs
```

Repeat the final command with four Chrome engines. These are local real-browser
development proofs, not independent human or multi-machine WAN qualification.
