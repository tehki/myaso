# Combat 4 M111 — physical LMB punish, read-only v1 input-plane provenance

QA-only draft stacked on Main-selected first-party Knights+Combat+Core8B/C
#932. No original browser sender, 30Hz wire, Rust World, Combat state,
W3C timing, M111 protected predicate or HP gate is changed.

## Exact protected failure to investigate

#932 protected quality #40004441037 FAILED original
Validate M111 real post-heavy guard-break punish.
Authentic Chrome W3C pointerdown at browser t=2603.3ms,
pointerup t=2614.3ms, Opponent guard broken - punish at t=2117.9ms;
the defender guard was 0 but HP stayed 100 and no actual 34HP
server-authoritative punish feedback appeared. Earlier physical
KeyE heavies DID correctly produce guard pressure and guard break.
Do not claim the original 34HP punish occurred.

Source-derived timing budget: 2614.3-2117.9 = 496.4ms after
observed guard break. Original guard-break stun is 650ms, while
original light windup is 135ms. This leaves approximately 18.6ms
for 30Hz sampling, network delivery and original World action.
This is only a plausible timing hypothesis, NOT proof of packet loss,
range failure, or late server admission. Original onLight latches
attackRequested until the next true 30Hz send. 11ms physical click
alone is not proof it was lost.

## Scope of the additive strict observer

Only when real online game is served on loopback with
scenario=uiheavyguardbreakpunish, record read-only bounded
window.__MYASO_M111_INPUT_PLANE__: original pointer release
classification and trust, onLight release timestamp, and the
actual 30Hz clientTick and attack/heavyAttack/jump bits directly
before the unchanged networkClient.sendInput original call.

The original browser QA readUiEvidence copies these fields;
its unchanged strict M111 34HP failure path now reports
physical guardbreak-to-UP timing, actual nearby 30Hz sent
frames and physical release classification. No sample is a
World HIT or a server acknowledgement. There are no forged
packets, synthesized input or stale actor grants.

The protected step remains unskipped and must genuinely PASS on
its own exact review SHA. On failure the evidence should help
Combat4A/4B/4D distinguish: no client input bit, late World
action, collision/out-of-range, or target stun/recovery ordering.
Original World true HIT/HP proof is still required. Production
Pre-Alpha HOLD; no main merge, staging, server restart, public
v2 activation or deployment.
