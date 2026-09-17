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

Because authoritative Dodge is brief, both browsers arm a passive `requestAnimationFrame` pixel sampler before the genuine input. The sampler tracks only the unique violet tell color and never injects or mutates fighter state. Chrome scans the full rendered canvas because M43 does not move the fighters together before Dodge; Firefox scans only a central 96x96 envelope because its own fighter is always rendered at canvas center and the remote-only ring radius is 36 px. This minimum safe envelope reduces synchronous canvas readback in the browser that must consume the Dodge input.

CI #165 ruled out a pixel-crop-only explanation. CI #166 retry passed M36-M42 but still showed M43 could receive real `KeyS` + Space provenance without producing Dodge. CI #167 then passed M22-M42, including M36 on its first attempt, while M43 still produced `0/0` even with an 180 ms no-Marionette quiet window. That rules out both the central-crop theory and immediate post-keydown polling as root causes. The remaining M43-specific difference is Firefox's synchronous `getImageData()` negative-control sampler running every animation frame while the one-shot Dodge input must be sampled. M43 now reuses M36's exact proven one-call 40 ms real-input choreography and reduces Firefox's local negative-control readback to the minimum safe 96x96 envelope around the centered local fighter. Chrome retains full-canvas observation. No state is injected or mutated.

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
