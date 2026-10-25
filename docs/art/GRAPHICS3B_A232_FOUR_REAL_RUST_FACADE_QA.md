# Graphics 3B A2.32 four real WebTransport players — Red Lion facade/HUD QA

This is a **DRAFT QA-only child of graphics candidate PR #921**. Its original parent has all protected and original browser CI green. This draft **does not** merge, deploy, activate Alpha, or change server, collision, Combat/KeyE, input semantics, original Blender art, Silver Knight assets, or item authority.

- Four independent original W3C browser sessions (Chrome / Firefox / Chrome / Firefox) connect to the same real private-loopback Rust WebTransport server, which admits four server-owned Greyhaven staging actors. No fake snapshots, hidden position patches or synthetic item grants.
- Original game uses explicit `?world=1&redlion=1`; original Red Lion day/roof WebPs are SHA-validated. An additional opt-in `nativeRedLionProbe=1` only on localhost exports an **observation-only** function returning received Rust positions and the existing source-rendered HUD visibility list. The game does not use this hook to control gameplay.
- Real physical WebDriver keyboard movement places two original server actors behind the source Red Lion threshold and two in front; all four original pages must show the correct actual front-HUD/behind occlusion split, real camera movement and original 960×540 game Canvas screenshots plus real page/HUD PNG SHA256.
- World static-collision preview is deliberately **OFF**. This verifies actor presentation, **not** whether a player legally walks through walls. Core 8C / World9 / Physics6 must approve legal collision, interaction, door, portal and roof fading separately. No inventory/rack sword feed is tested. No public First Playable Alpha signoff or measured in-game FPS is inferred.
- Failure, timeout or missing original browser evidence must fail hard; do not fabricate PASS. Keep original P0 Combat Pre-Alpha zero-building-dependent.

No merge or deployment without explicit Main Orchestrator 0 and owner decision.
