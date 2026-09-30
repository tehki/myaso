# M36 Real Online Dodge Feedback

## Objective

Make a successful authoritative dodge readable on the normal online arena without predicting iframe state or changing combat rules.

## Product behavior

In an exactly two-fighter state, dodge success is inferred only after a completed authoritative exchange:

- the defender is authoritatively `Dodge` while a committed attacker is `AttackWindup` or `AttackActive` and the defender is inside that attack's authoritative range/arc;
- the committed strike must subsequently be observed in `AttackActive`, so a windup-only sequence cannot earn dodge credit;
- once that threat is verified, the evidence remains eligible through later `DodgeRecovery` and evasive movement until the attacker reaches `AttackRecovery`;
- defender HP and guard must remain unchanged throughout the buffered evidence;
- out-of-range/out-of-arc windup or active samples never arm the evidence.

The defender receives `Dodge! Strike avoided.` plus `dodge-success`. The attacker receives `Attack evaded - opponent dodged.` plus `dodge-evaded`.

Out-of-range or out-of-arc attack recovery is not credited as a successful dodge. Multi-opponent states do not receive causal dodge attribution.
## Real-browser acceptance

The dedicated `uidodge` flight opens the production `index.html` path in real headless Chrome and Firefox against the authoritative loopback server.

- Firefox is the attacker and uses ordinary left/right movement plus a real aimed LMB hold; Chrome is the defender and uses a real pointer-directed wheel-forward roll with redundant `KeyS` evidence.
- The flight still derives left/right attack geometry from the assigned authoritative player IDs instead of assuming either browser receives player 1 or player 2.
- Chrome is first aimed toward Firefox through a real W3C pointer move. Its roll follows that pointer direction; the simultaneous `KeyS` is deliberately redundant proof that movement keys do not steer the committed roll.
- Each bounded attempt first aims Chrome perpendicular to the attack, holds genuine `KeyS`, then delivers and acknowledges Firefox's real LMB-down edge. After one 20 ms input tick, Chrome sends a short wheel-only W3C command while `KeyS` remains held; Firefox keeps LMB held for at least 180 ms. Separating KeyS, pointer aim, and wheel avoids W3C multi-device tick alignment delaying the wheel. M24 remains the timing/geometry proof for reacting after observed authoritative windup; M36 only proves the production dodge-feedback path. A timing miss may retry only while both fighters remain at 100 HP / 100 guard and no parry feedback appears; any resolved damage or parry fails closed. Before a clean retry, 550 ms of ordinary `KeyW` movement approximately unwinds the current 170 ms × 690 u/s perpendicular roll displacement at the normal 215 u/s move speed. Fresh attack-commit and opposite-client dodge feedback are scoped to the successful attempt, so stale evidence cannot satisfy a retry.
- The flight requires opposite-client `dodge-evaded` / `dodge-success` feedback and both semantic messages.
- Both fighters must remain at 100 HP / 100 guard.
- No parry feedback may appear.
- Input provenance must show the real `KeyS` + wheel-forward roll controls and the real pointer attack.

No state, HP, guard, action, position, server event, iframe timer, or combat result is injected by the harness.

## Risk / rollback

Presentation-only inference and feedback styling. No server simulation, dodge duration, 125 ms iframe window, attack timing, combat constants, wire protocol, persistence, networking, public bind, deployment, or production activation changes. Rollback is to close/discard M36; frozen M35 remains unchanged.

CI #169 first attempt exposed the complementary M36 timing case: Firefox authoritatively Dodged with full real-key provenance, but the Chrome attack did not produce fresh dodge feedback. M36 therefore uses up to three bounded genuine-input attempts with attempt-scoped evidence and ordinary-input repositioning between clean misses; product combat behavior and feedback thresholds are unchanged.


CI #170 exact-head retry exposed that the first retry implementation restored only 45 ms of ordinary movement after a perpendicular Dodge that can displace the defender by about 88 world units. That recovered only about 10 units and let later attempts drift outside the 94-unit authoritative hit envelope while remaining clean 100/100 misses. The harness now uses 410 ms of ordinary opposite movement after recovery, approximately matching the Dodge displacement at normal movement speed. Combat constants, server authority, iframe timing, feedback rules, and pass thresholds remain unchanged.

CI #175 exposed an observer-only freshness bug after genuine successful retries: repeated identical `dodge-evaded` / `dodge-success` feedback values were de-duplicated forever, so later real feedback could not increase the attempt-scoped count. The UI observer now records each non-empty feedback mutation occurrence instead of suppressing adjacent identical values. The authoritative exchange, retry choreography, combat rules, and acceptance thresholds are unchanged.

CI #182 and its exact-head rerun both reproduced a different scheduling failure: Firefox recorded genuine KeyS + Space down/up provenance, but the one-shot Dodge request was sampled too late and Chrome's real strike resolved as 34 HP damage.

CI #197/#200 later showed that placing a 70 ms pause inside Firefox's W3C action sequence was still sensitive to Firefox command-start latency: genuine controls were delivered, yet the ordinary 34 HP strike could resolve before authoritative Dodge. M36 now anchors ordering on the harness clock instead. The Chrome pointer-down request is started first; 50 ms later the Firefox dodge command is dispatched with zero internal pre-delay. No combat constants, iframe duration, damage rules, feedback rules, or fail-closed vitals checks are changed.

CI #202 showed the 50 ms Node-side stagger still left too little margin when Firefox command startup was slow: the exact real keys were delivered, but the strike resolved for 34 HP before authoritative Dodge. The harness then moved to concurrent cross-session launch.

CI #582 exposed the remaining cross-session skew under the Wilds control schema: Firefox's real LMB went down roughly 179 ms before Chrome's genuine wheel event, so the 34 HP strike resolved before the roll despite the nominal 45 ms Chrome-side pause. M36 now arms a Chrome-local observer first and dispatches the real roll immediately after Chrome sees the fresh replicated authoritative `WINDUP`. This changes no combat constant, input provenance requirement, iframe duration, damage rule, feedback rule, or fail-closed vitals check.


## M113 control-schema adaptation

The real-browser dodge control is now **wheel-forward** after a real pointer aim. M36 no longer requires the historical Space key; it requires the wheel event plus the redundant movement-key evidence and preserves the same authoritative no-damage / non-parry outcome checks.

CI #596 proved the browser-owned-pause approach was still serialized unexpectedly by W3C multi-device tick alignment: Firefox LMB-down preceded Chrome wheel by about 179 ms and the 34 HP hit resolved first. M126 now anchors on completed real input edges and keeps the wheel in its own short W3C command. No production timing or acceptance threshold changes.
