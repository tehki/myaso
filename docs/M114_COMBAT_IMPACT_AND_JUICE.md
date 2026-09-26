# M114 — Combat Impact and Juice

## Goal

Make every successful combat exchange feel materially different without changing authoritative combat outcomes.

M114 is a presentation layer. It does not alter damage, guard, stamina, hitboxes, action timing, input ownership, or server simulation.

## Impact profiles

Each authoritative/readable combat result maps to a deterministic impact profile with:

- bounded visual hit-stop
- camera impulse amplitude
- impact flash strength
- radial impact-ray count
- total presentation duration

Parry and guard-break outcomes intentionally receive more weight than ordinary hits. Blocks receive less weight. Dodge/roll avoidance receives almost no hit-stop so evasive movement stays visually fluid.

## New distinct feedback

M114 adds dedicated presentation feedback for the Wilds-style control interactions:

- successful shove: `kick-confirm`
- being shoved: `shoved`
- successful roll collision: `roll-impact`
- being rolled over: `rolled-over`

These are inferred from authoritative replicated action/vital transitions. A generic stun is no longer the only visible explanation when the source is a kick or roll collision.

## Visual hit-stop

Hit-stop is client presentation only.

The simulation, input sampling, prediction history, networking, reconciliation, and authoritative server continue running. While the short impact window is active, the canvas holds the previous combat frame; after the freeze it catches up to current authority.

This provides contact weight without changing gameplay timing or granting hidden advantage.

## Weapon motion trails

Light, heavy, and jumping attacks now render distinct short weapon trails during windup/active phases. Heavy trails are wider and hotter; jumping attacks keep the new narrow attack language; light attacks remain visually lighter.

The trails do not alter authoritative reach or arc. They are presentation only.

## Camera impulse and impact bursts

After hit-stop, the arena receives a deterministic decaying camera impulse. A bounded radial burst is drawn at:

- the focused opponent for attack/block/guard-break/kick/roll confirmations
- the local fighter for damage, shove, knockdown, and defensive feedback

Colors distinguish broad outcome families:

- parry — pale green
- guard/block — gold
- dodge/roll — teal
- hit/kick — warm orange

No randomness is used, so browser acceptance and visual behavior remain reproducible.

## Validation

Dedicated tests cover:

- stronger impact weighting for parry and guard break than ordinary hit
- exact bounded hit-stop lifetime
- deterministic shake/flash sampling
- fail-closed unknown feedback
- authoritative kick/shove feedback
- authoritative roll-collision feedback
- local-vs-remote impact ownership

The existing combat, readability, and networking suites remain green locally.
