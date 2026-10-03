# M146 — Real punish conversion from selected FFA recovery target

## Goal
Prove that the authoritative `PUNISH TARGET` selected by the M143–M145 recovery system is not only readable, but actionable with genuine player input while another opponent is also recovering.

M146 changes no combat constants and no authoritative combat rules. It is a real-browser acceptance milestone.

## Three-player choreography
The deterministic roles are:

- Chrome / #1: off-axis jump attacker
- Firefox / #2: observer and punisher
- second Chrome / #3: closer off-axis heavy attacker

#3 is staged on Firefox's right within light-attack range while #1 remains on Firefox's left. #3 performs a genuine KeyE heavy attack aimed away from Firefox. Two hundred milliseconds later #1 performs a genuine same-tick Space + LMB jump attack aimed away from Firefox.
The unchanged heavy recovery and jump-attack recovery overlap. When Firefox observes `PUNISH TARGET #3`, it immediately sends one genuine right-aimed LMB.

Acceptance requires:

- the Firefox LMB begins only after the selected-target cue is visible;
- that LMB is issued while both #1 and #3 are authoritatively in recovery;
- exactly one unchanged 34 HP light punish lands on selected #3;
- #1 remains at 100 HP and is never hit by the punish;
- Firefox remains untouched because both setup attacks are deliberately off-axis;
- the selected recovery card reports `PUNISH / Heavy recovery`;
- genuine KeyE provenance is present for #3 and genuine Space + LMB provenance for #1;
- all guards remain unchanged and no 46 HP heavy or 42 HP jump hit reaches Firefox.

## Scope
Changes are limited to browser acceptance, CI wiring, and this document. The playable build is not opened.