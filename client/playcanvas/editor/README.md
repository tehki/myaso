# PlayCanvas Editor — Greyhaven dusk smoke

This directory mirrors a PlayCanvas **Editor-only** script so source revisions can be reviewed and reproduced independently of the Editor checkpoint.

## Working Editor integration

- Private PlayCanvas project: `1634867`; development scene: `2639984`.
- Script asset: `313963450` (`greyhaven-dusk-chimney-smoke.js`), script name `greyhavenDuskChimneySmoke`.
- Original smoke texture: `313963445` (created in the Editor, not bundled into this directory).
- Red Lion emitter: `f92268db-0256-4bac-9d29-47d56df8f64c`.
- Blacksmith emitter: `da15d00c-c027-4c87-9111-7404b683b046`.
- WebGL2 Launch with PlayCanvas Engine 2.23.3: dusk produced visible chimney smoke from both buildings. Dusk instance values were temporarily set to false, and a restarted Launch showed no smoke and logged `day/off` on both instances. The instances were restored to true; a restarted Launch restored smoke, logging `dusk`.
- Editor checkpoint: `0ce29c80-e4c5-42fb-9be4-1e59e2225414`.
- URL override `?greyhavenTime=day` / `?greyhavenTime=dusk` is implemented by the source script but has not been independently tested via URL input; the verified day/dusk A/B test used Editor script instance attributes.
- Launch generated warnings for camera `offscreen` and `alphaDither null` in imported materials. These remain to be triaged; do not claim warning-free runtime.

## Reproduction and authority

Import the script source into PlayCanvas Editor, parse it, attach it to a visual-only entity with a configured particle system, point `colorMapAsset` at a smoke texture, and set the `duskByDefault` attribute. The JavaScript file alone does **not** recreate the emitter, particles, texture, or Editor scene.

No original Rust World server/QUIC/Combat/Chat authority, collision, portals, item permissions, live multiplayer, merge, public publishing, or deployment are granted by this source-only artifact.
