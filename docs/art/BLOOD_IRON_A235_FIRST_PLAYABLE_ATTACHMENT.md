# 🌕⚡️🚀 Graphics 3B A2.35 — minimal First Playable building art attachment contract

**Moon Games first playable P0 · 21 October 2026 · DRAFT / not integrated / no production GO.**

Graphics 3B owns the authored Red Lion **visual asset** and source-space placement; World & Gameplay owns the *World #336* authored-map renderer and its Red Lion placeholder; Graphics 3C owns the outdoor lantern/terrain atmosphere; Core 8C owns authoritative actor/collision/portal/zone state. Graphics 3B has no authority to alter those contracts independently.

## Tiny visual-only API

\`src/browser/red-lion-alpha-art-attachment.mjs\` exports frozen \`RED_LION_ALPHA_ART\` source data and pure \`createRedLionAlphaArtAttachment({building,camera,width,height,zoom,mood})\`.

- **Exact building:** only World ID \`red-lion\`, footprint **(4240,3880), 250×170**, World interaction entrance **(4365,4060)**. The function throws if World geometry/entrance drift; no inferred fallback, teleport or mutation.
- **3B art pivot:** **(4365,4075)**, separate from World entrance and original 3C fixture **(4365,4045)**.
- **Day facade:** original lossless \`red_lion_a231_day_dimensional.webp\`, **228×297**, draw **(-114,-269)** from the visual pivot; exact pinned SHA.
- **Dusk facade:** original lossless \`red_lion_a231_dusk_dimensional.webp\`, same footprint and alpha, no second 3B radial glow; exact pinned SHA.
- **Unmodified roof:** original historical A2.26-derived \`red_lion_a231_roof_unchanged.webp\` **238×197**, draw **(-119,-283)**; exact pinned SHA. No roof redesign, animation or automatic fade.
- Uses existing **\`projectArenaPoint\` at zoom 0.84** for **screen-space** draw commands; caller selects day or dusk. All returned pixel coordinates are immutable, independently calculable and read-only. Rendering implementation, layer order, fallback mode and cache strategy remain **owned by World & Graphics Orchestrator**, not this contract.

The function returns two separate **facade** and **roof** draw commands with original source paths and SHA-256, plus explicit **world-must-suppress-one-red-lion-placeholder**, 3C single-lamp ownership and \`actualWorldRendererIntegrated:false\`, \`productionApproved:false\`.

## Integration plan with Center #480 / World #336

1. **World team** integrates an explicit named-building visual override into its existing 512-unit tile renderer: render other 14 buildings as before; suppress **only** the Red Lion placeholder if a compatible, loaded 3B attachment is available. On failure, continue to show the original placeholder (no blank building). World, not Graphics, must own this safe fallback.
2. **World/Graphics Orchestrator** decides exactly which facade/roof layer is behind/in front of each real fighter. Existing A2.33 feet-Y threshold is **not** authoritative; keep any uncertain automated hiding disabled until tested.
3. **Core 8C** defines collision/door/zone authority; this module cannot invent a new portal or alter World entrance (4365,4060).
4. **Graphics 3C** emits exactly one original P2.4 fixture and ambient pass; no duplicate lamp halo or new day/night game protocol.
5. **QA** tests two independent server-connected real browsers in one 1–4-player staging area. Must preserve all genuine Combat input and screenshot gates and meet chosen real Firefox/Chrome performance budget. The measured isolated Firefox A2.34 composite p95 **37ms** is a warning, not a 60FPS pass. A2.34 exact-head quality failed **M41** and awaits Combat owner correction; no test weakening.

**Acceptance state:** IMPLEMENTED source contract, local verification only; NOT integration-ready, NOT integrated and NOT playable. Full exact-head CI and Art Director / World / Core review still required. No replacement placeholder, live renderer hook, World map mutation, multiplayer server, collision or production change was made.

**Source provenance:** 3B PR #479 \`c08639cb1290611cf5c28c564022e9658226c1c5\`; World PR #336 \`260a7b85a33b7a51663a70af8d410e0d33e0e236\`; 3C PR #419 \`8e85584b6007b38e1a00155b77473e92b0afec6a\`. First Playable [#480](https://github.com/tehki/myaso/issues/480) controls integration sequencing.
