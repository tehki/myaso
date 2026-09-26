# M119 — Real Running Strike

## Goal

Prove the M118 running strike through the production browser controls and authoritative server rather than only model tests.

## Real input contract

The Chrome attacker performs one genuine WebDriver action sequence:

- hold the movement key toward the rival;
- press and hold RMB;
- keep RMB held past the 180 ms sprint threshold;
- press and release LMB while movement + sprint remain active;
- keep movement/RMB held through the initial commitment, then release them.

No direct input-state mutation, simulation mutation, teleport, or synthetic server action is allowed.

## Required authoritative result

The flight must prove:

- both movement key edges are delivered;
- RMB down/up and LMB down/up are delivered;
- LMB occurs at least 180 ms after RMB-down;
- defender loses exactly 30 HP: 100 -> 70;
- attacker remains at full HP/guard;
- defender guard remains 100;
- attacker renders `Opponent hit - 30 HP.`;
- defender renders `Hit taken - 30 HP.`;
- defender observes `RUNNING WINDUP` or `RUNNING STRIKE`;
- defender observes `PUNISH · Running recovery`;
- attacker renders running-strike commitment/recovery text.

The test stays fail-closed: any different damage, guard interaction, missing control edge, missing running threat, or missing recovery cue fails the milestone.

## Why this matters

M118 says movement is combat. M119 verifies that claim through the same production browser path a player uses: sprinting into a committed attack is not merely a model state or test fixture.
