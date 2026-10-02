# M142 — Jump attack in real FFA multi-threat awareness

## Goal
Prove the M141 jump-attack telegraph composes correctly with the existing three-player FFA threat system when another opponent is attacking at the same time.

M142 changes no combat constants and no authoritative combat rules. It is an acceptance/readability milestone.

## Real clients
The scenario keeps the deterministic FFA browser roles used by the earlier threat milestones:

- Chrome = authoritative #1, left-side jump attacker
- Firefox = authoritative #2, center observer
- second Chrome = authoritative #3, right-side light attacker

Both attackers use genuine DOM/WebDriver controls. The jump attacker uses one same-tick Space + LMB chord; the light attacker uses genuine LMB clicks.
## Primary-threat case
The left jump attacker is staged slightly closer than the right light attacker while both remain inside their unchanged attack geometry. During overlapping windups the center observer must render:

- primary `#1`
- phase `JUMP WINDUP`
- bearing `FROM LEFT`
- guard arc `FLANK`
- `2 THREATS`
- secondary `NEXT #3`
- secondary phase `WINDUP`
- secondary bearing `FROM RIGHT`
- secondary guard arc `FRONT`

## Secondary-threat case
The right light attacker is staged slightly closer. During overlapping windups the center observer must instead render:

- primary `#3`
- phase `WINDUP`
- bearing `FROM RIGHT`
- guard arc `FRONT`
- `2 THREATS`
- secondary `NEXT #1`
- secondary phase `JUMP WINDUP`
- secondary bearing `FROM LEFT`
- secondary guard arc `FLANK`

The two-threat UI must remain center-observer-only and must not leak to either attacker client.

## Scope
Only browser acceptance, CI wiring and this document are changed. The playable build is not opened.