# Silver Knight — authentic 140ms Dash traction, multiplayer review (24 Oct 2026)

**DRAFT / NONRELEASE.** This is an original Blender 22-bone Silver Knight Dash source preview. Owner source study: [Graphics 3A #863](https://github.com/tehki/myaso/pull/863). No merge, stage, production rollout, Combat change or server restart.

## Source and runtime contract

- Original owner Blender traction source WebP: `web/assets/knights/review/silver_dash_traction_p0.webp` SHA256 **`ac399c5ce02473ca68d8d99474b230c4782f6bfb2f6e8232b950fcce5cf707fe`**; 8 source directions × 8 frames, each 160px. No retouching; 8 rows have **Roll-native camera order**, not the mirrored legacy Idle/Walk source rows.
- Real **server-authored Dash(30)** action, duration 140ms / movement speed 750 / cost 20 stamina / cooldown 3000ms. The renderer simply selects the original Dash WebP when this actual action is replicated, at the correct original timeline. No new Combat state, client prediction, hitbox, collision, physics or network message.
- Visual enablement requires explicit first-party review URL **`?knights=1&knightDashArt=traction`**, optionally `&knightArt=relit` to preview the original source-lit locomotion. Default game and [Ready-Five #904](https://github.com/tehki/myaso/pull/904) remain exactly **Idle, Walk, Sprint, Jump, Roll**. Immutable five baseline root WebPs + Roll 350ms unchanged. No public `game-config.json` Dash switch.
- Unsupported Kick/Knockdown/attack/death continue Combat fallbacks, never misleading animated stand-ins. No NPC art.

## Native first-party evidence

- Real Rust authoritative TLS-pinned WebTransport server and four native authenticated Chromium clients, all observing a true admitted Dash **server tick 474→483** (~150ms, nine ticks) with genuine trusted `KeyW` double tap. The browser's actual `isTrusted` keydown/keyup events are asserted under the **unchanged 240ms** original double-tap threshold. Second hold must span a real 30Hz client send; an earlier too-short 3ms key hold did not reach the server even though the keyboard gesture was valid.
- Read-only source Canvas instrumentation confirms original Blender Dash atlas in all four clients with multiple real frames (5, 3, 4, 3), and foot/baseline 4.5–6.6px below shadow center. No mismatched original shadow/sprite pair, no synthetic fighters.
- [All-eight-facing browser source audit](../../../scripts/graphics3a_dash_all_facing_source_audit.js) independently decoded the full original 1280×1280 WebP in real Chromium: all **8 facing rows** are distinct; each has **8 source frame slots, 7 pixel-distinct source frames**, with more than 2,500 nontransparent pixels in every frame. This is a source-art check, NOT evidence that eight distinct Dash directions were triggered live against the server. The live authenticated test separately observes genuine Dash in four clients.
- [Native review script](../../../scripts/graphics3a_dash_four_native_review.py) and [trusted local Chrome input helper](../../../scripts/graphics3a_dash_native_keys.py) are **test-only**. They use local Chromium DevTools WebSocket input, rather than fake DOM key dispatch or server state injection.
- SHA/fallback/8-direction/clip-start tests are in `tests/graphics3a-dash-140-authentic-preview.test.mjs`; native first-party CI builds the real Rust server. Physical 2–4-person WAN testing is still required.

**Eligibility remains HOLD:** source-commit protected quality + independent first-party native GitHub CI, visual owner approval, Main's combined updated-Combat branch + human Pre-Alpha acceptance, explicit Main GO. Never promote Dash into Ready-Five merely to meet a date.
