# M43 - Spatial FFA Dodge Tell

## Objective

Make an authoritative remote Dodge unmistakably readable in free-for-all combat without adding client combat authority or exposing hidden iframe timing.

## Player presentation

- The existing neutral 28 px Dodge ring remains unchanged for every fighter.
- A remote fighter whose replicated authoritative action is `Dodge` gains a unique violet dashed 36 px outer ring.
- The local fighter never paints the remote-only violet ring around itself.
- The violet ring clears when replicated state leaves `Dodge`; `DodgeRecovery` continues to use the existing M38 recovery presentation where applicable.
- The tell does not expose the 118 ms iframe duration or make a local dodge-success decision. It is a direct presentation of the already-replicated action.

## Real-browser acceptance

The dedicated `uidodgetell` Chrome+Firefox flight opens the production `index.html` path against one loopback authoritative server. Chrome is the passive observer and Firefox is the dodger. Firefox receives genuine W3C `KeyS` + Space input.

Because authoritative Dodge is brief, both browsers arm a passive `requestAnimationFrame` pixel sampler before the genuine input. The sampler tracks only the unique violet tell color and never injects or mutates fighter state. Chrome scans the full rendered canvas because M43 does not move the fighters together before Dodge; Firefox scans only the central 320x320 envelope because its own fighter is always rendered at canvas center. Keeping the local negative-control scan bounded avoids unnecessary main-thread pressure in the browser that must consume the Dodge input.

CI #165 ruled out a pixel-crop-only explanation: full-canvas sampling still produced `0/0`, while Firefox recorded genuine `KeyS` + Space down/up events but never rendered the normal `Dodging - use the movement to reset spacing.` action hint. CI #166 retry then passed M36-M42 but showed that even a held `KeyS` + Space could be lost when M43 immediately issued repeated Marionette script commands to Firefox while waiting for that hint. The production client intentionally clears one-shot inputs on blur/visibility transitions, and the proven M36 choreography already avoids cross-driver churn during the Dodge timing window. M43 therefore keeps the split real W3C key input but, after key-down, leaves Firefox completely untouched for 180 ms while the already-armed passive RAF samplers continue running. Only then does it release Space + `KeyS` and inspect the captured remote tell. No state is injected or mutated.

On timeout, the acceptance reports the normal UI/key evidence from both browsers so a missing tell can be distinguished from missing input or state convergence.

The flight passes only when:

- Chrome paints at least 24 exact-color pixels from the remote-only violet Dodge boundary;
- Firefox paints zero pixels of that remote-only color around its own local fighter;
- genuine Firefox `KeyS` and Space key-down/up provenance is present;
- both fighters remain at 100 HP / 100 guard;
- Chrome observes the tell clear after authoritative state leaves `Dodge`.

## Scope / risk

Base is frozen M42 exact head `df6274a50072a8f53ec6c18854096ebc1ddae586`.

M43 is presentation/test/CI/docs only. It does not change server simulation, dodge speed, iframe duration, recovery duration, combat geometry, HP/guard rules, wire protocol, networking, persistence, public bind, deployment, or runtime activation.

Rollback is to close/discard M43; frozen M42 remains unchanged.
