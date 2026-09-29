# M44 - Spatial FFA Defeat Tell

## Objective

Make authoritative remote death unmistakably attributable to the correct fighter in free-for-all combat.

## Player presentation

- A remote fighter whose replicated authoritative action is `Dead` keeps the existing faded-body presentation and gains a full-opacity rose defeat ring with an X marker.
- The local defeated fighter never paints this remote-only marker around itself; M31 keeps the local `DEFEATED / Respawning.` overlay.
- The marker clears only when replicated authoritative state leaves `Dead` after server-owned respawn.
- No countdown, predicted respawn time, client-owned death decision, or combat authority is added.

## Real-browser acceptance

The dedicated `uideathtell` Chrome+Firefox flight reuses the proven M31 production-page death/respawn choreography against one loopback authoritative server. It adds only passive canvas evidence during the authoritative `Dead` interval.

The flight passes only when:

- the attacking browser sees at least 24 exact-color pixels from the remote-only defeat marker;
- the defeated browser sees zero pixels of that remote-only marker around its local fighter;
- the existing M31 authoritative death and respawn messages/overlay lifecycle still pass;
- real movement and attack input provenance still passes;
- the defeat marker clears after the server restores the fighter to full-vitals `Idle`.

## Scope / risk

Base is frozen M43 exact head `be462f6d6acbacc663ab902e2daa7f242b9424fb`.

M44 is presentation/test/CI/docs only. It does not change server simulation, death timing, respawn timing, spawn placement, HP/guard rules, combat geometry, wire protocol, networking, persistence, public bind, deployment, or runtime activation.

Rollback is to close/discard M44; frozen M43 remains unchanged.
