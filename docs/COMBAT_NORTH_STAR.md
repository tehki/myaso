# myaso.io Combat North Star

## Product promise

myaso.io is a browser action game where player skill decides fights more than accumulated stats.

A stronger player should usually win because they read intent, control spacing, choose timing, preserve defensive options, and punish commitment better — not because they have a larger numerical progression advantage.

## M1 combat kernel

The first playable slice intentionally contains only the minimum loop needed to test whether fighting is fun:

- free directional movement;
- independent facing/aiming;
- one committed melee attack with windup, active, and recovery phases;
- timed dodge with a short invulnerability window and recovery;
- directional block;
- a short block-entry parry window that stuns the attacker;
- guard pressure and guard break so passive defense is not dominant;
- health, death, and automatic respawn;
- one deterministic sparring bot for repeatable local practice.

No progression, inventory, loot, account system, monetization, world persistence, classes, skills, or additional weapons belong in M1.

## Combat rules

1. **Readable attacks.** Every strike has visible commitment before damage can happen.
2. **Commitment creates counterplay.** Recovery gives the opponent a punish window.
3. **Movement is combat.** Range, angle, and facing determine whether an attack can connect or a block can work.
4. **Defense is active.** Dodge timing and directional block/parry require input and prediction.
5. **No free turtling.** Blocking spends guard; broken guard creates a punish window.
6. **No hidden power.** M1 fighters use identical combat parameters.
7. **Deterministic core.** Combat rules are isolated from rendering/input so the same model can later become server-authoritative.

## M1 acceptance

M1 is successful when two things are true:

- the combat model has deterministic regression tests for attack phases, hit direction/range, dodge, block, parry, and death/respawn;
- a player can open the browser prototype and immediately understand why each exchange was won or lost.

The next milestone should deepen **human-vs-human combat**, not add metagame progression.
