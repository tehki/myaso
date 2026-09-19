# M54 - FFA Incoming Threat Awareness

## Objective

Answer the FFA readability question: **who is attacking me right now?**

M53 made the top-right HUD meaningful in multiplayer by focusing the nearest living rival. M54 adds a separate short-lived incoming-threat cue so the player does not have to infer whether a remote attack tell is actually aimed at them.

## Threat rule

Threat detection is browser presentation derived only from authoritative replicated fighter state.

A remote fighter threatens the local fighter only when all of the following are true:

1. the remote fighter is in authoritative `AttackWindup` or `AttackActive`;
2. both fighter positions and the attacker's facing are finite;
3. local fighter center is within `attack.reach + fighterRadius`;
4. the local fighter lies inside the attacker's authoritative attack arc;
5. the local fighter is alive.

When multiple fighters threaten simultaneously, selection is deterministic:

1. active strike before windup;
2. nearest attacker;
3. lower authoritative network ID.

The selector returns a primitive network ID and allocates no presentation object on the render hot path.

## UI

The arena shows a centered warning only while the authoritative threat exists:

- `THREAT #<netId> · WINDUP`
- `THREAT #<netId> · STRIKE`

The cue clears when the attacker leaves windup/active state, leaves reach/arc, or the local fighter dies.

This cue is independent from M53 nearest-rival focus. A fighter can be the nearest rival without threatening the player, and a threatening fighter can temporarily take threat priority without changing the focused HUD target.

## Authority boundary

M54 does not:

- choose an attack target for the server;
- modify hit detection;
- modify attack reach, arc, damage, timing, movement, or facing;
- inject combat state;
- change score or match lifecycle;
- change replication, snapshots, or protocol fields.

Combat remains fully server-authoritative.

## Deterministic coverage

JavaScript coverage proves:

- active attack beats windup when both threaten;
- attacker must face the local fighter;
- attacker must be inside authoritative reach;
- equal-priority/equal-distance threats tie-break by lower network ID;
- dead local fighters expose no threat.

## Real-browser acceptance

The M54 `uithreat` flight starts three real clients:

- Chrome as fighter #1;
- Firefox as fighter #2;
- isolated second Chrome as fighter #3.

At deterministic spawn spacing, #1 moves right using genuine keyboard input and attacks #2 with a genuine left-mouse pointer sequence.

Acceptance requires:

- #2 records `THREAT #1 · WINDUP`;
- #2 records `THREAT #1 · STRIKE`;
- #1 never receives a self-threat cue;
- distant #3 never receives a threat cue from #1;
- the same exchange resolves to the ordinary authoritative 34 HP hit on #2;
- #1 and #3 remain at 100 HP;
- real pointer provenance is preserved.

The UI observer records DOM threat transitions; it does not extend combat windows or poll the critical attack state into existence.

## Performance

The browser computes threat from the existing authoritative state `Map` with scalar math and returns one primitive net ID. DOM text is changed only when threat identity or phase changes.

## Scope / risk

Base is M53 frozen exact head `d4099ff65f33ae4796b25a20ef0275e3aacd0210`, validated by FULL quality CI #195 / run `35435924914`.

M54 changes browser presentation, deterministic JS coverage, real-browser acceptance, CI, and documentation only. It does not change server simulation, combat rules, match rules, networking protocol, snapshot size, persistence, deployment, public bind, or runtime activation.
