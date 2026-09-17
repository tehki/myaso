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

- Chrome is the attacker regardless of connection order: it uses ordinary `KeyD` + rightward LMB when spawned left, or `KeyA` + leftward LMB when spawned right.
- Firefox is the defender regardless of connection order and receives real `KeyS` + Space controls through W3C actions.
- The flight derives left/right attack geometry from the assigned authoritative player IDs instead of assuming a browser always receives player 1 or player 2.
- Firefox is first aimed toward Chrome through a real W3C pointer move. Its dodge then uses `KeyS` to travel perpendicular to the attack line, avoiding the unstable no-movement case where facing sends the defender through the attacker and out of the tracked threat arc.
- Each bounded attempt gives Firefox a genuine W3C dodge sequence with a 90 ms internal pause; Chrome starts the genuine attack about 50 ms later, leaving roughly a 40 ms attack-to-dodge offset. The critical iframe/strike window contains no evidence polling. A timing miss may retry only while both fighters remain at 100 HP / 100 guard and no parry feedback appears; any resolved damage or parry fails closed. Fresh attack-commit and opposite-client dodge feedback are scoped to the successful attempt, so stale evidence cannot satisfy a retry.
- The flight requires opposite-client `dodge-evaded` / `dodge-success` feedback and both semantic messages.
- Both fighters must remain at 100 HP / 100 guard.
- No parry feedback may appear.
- Input provenance must show the real `KeyS` + Space dodge controls and real pointer attack.

No state, HP, guard, action, position, server event, iframe timer, or combat result is injected by the harness.

## Risk / rollback

Presentation-only inference and feedback styling. No server simulation, dodge duration, 118 ms iframe window, attack timing, combat constants, wire protocol, persistence, networking, public bind, deployment, or production activation changes. Rollback is to close/discard M36; frozen M35 remains unchanged.

CI #169 first attempt exposed the complementary M36 timing case: Firefox authoritatively Dodged with full real-key provenance, but the Chrome attack did not produce fresh dodge feedback. M36 therefore uses up to three bounded genuine-input attempts with attempt-scoped evidence and ordinary-input repositioning between clean misses; product combat behavior and feedback thresholds are unchanged.
