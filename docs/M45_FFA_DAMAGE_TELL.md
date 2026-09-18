# M45 Spatial FFA Damage Tell

## Objective

Make authoritative damage readable at the fighter who actually took the hit, so an FFA player does not have to infer the target from a two-player HUD or global feedback flash.

## Product behavior

The normal online arena tracks authoritative HP transitions for every replicated remote fighter.

- A remote fighter whose authoritative HP decreases receives a short orange impact ring with four outward ticks.
- The tell is keyed by authoritative network identity, so multiple damaged remote fighters can be marked independently in the same snapshot.
- Local HP loss never paints the remote-only tell around the local fighter.
- The tell lasts 320 ms from the observed authoritative HP decrease and expires automatically.
- A lethal transition is visually owned by the existing M44 defeat tell rather than layering the damage ring over `Dead`.
- Respawn or HP restoration does not trigger damage presentation.

The feature is presentation-only. It does not predict hits, infer collision outcomes, or change combat state.

## Real-browser acceptance

The dedicated `uihittell` flight opens the production `index.html` path in real headless Chrome and Firefox against the authoritative loopback server.

- The existing M30/M32 flow delivers real keyboard movement and a real primary-pointer attack.
- Both browsers must observe the authoritative 34 HP transition and the existing opposite-client `hit-confirm` / `damage-taken` feedback.
- A requestAnimationFrame sampler is armed before the exchange and measures only the exact M45 tell color inside the bounded 320 × 320 combat envelope.
- The attacking browser, which renders the damaged fighter remotely, must observe at least 24 exact-color tell pixels.
- The damaged browser must observe exactly 0 M45 pixels, proving local damage does not paint the remote-only marker.
- Existing HP, guard, action, networking, provenance, and frame/capacity gates remain unchanged.

No state, HP, target identity, server event, or combat result is injected by the harness.

## Risk / rollback

Presentation-only browser state derived from authoritative snapshots. No server simulation, attack timing, damage, knockback, dodge/block/parry rules, wire protocol, persistence, networking, public bind, deployment, or production activation changes.

Rollback is to close/discard M45; frozen M44 exact head `7f8361a5ff1b9a6ce7653549fe53aa88447876da` remains unchanged.

## Acceptance stabilization

FULL CI #176 reached the dedicated M45 gate and proved the exact tell color sampler was correct, but measured zero pixels. The remote interpolation hot path intentionally reuses identity-free scratch samples, so the first renderer implementation attempted the damage-track lookup with `sampled.netId` and always queried `undefined`. The renderer now resolves damage-tell visibility from the authoritative loop entity's `netId` before interpolation and passes only that presentation boolean into the scratch render path. Interpolation, networking, HP authority, damage semantics, and the M45 pixel threshold are unchanged.
