# Blood & Iron A2.8 — browser XY registration laboratory

**Status:** standalone read-only browser review. No runtime game integration, physics, portals, knight animations, network actions, or production deployment.

## Why A2.8 exists

- The real production browser viewport helper, src/browser/arena-viewport.mjs, defines ARENA_VIEW_ZOOM = **0.84** and projectArenaPoint(worldX,worldY,cameraX,cameraY,width,height).
- A1 Greyhaven art convention defines **0.025 authoring meters per game world unit** and proposes the Red Lion door coordinate **(4365, 4075)**. These coordinates are **not proof that the door has been activated in a server-authoritative world**.
- The original A2.5 vertical orthographic camera outputs pixels with +Y down after PNG vertical flip and matches the game XY basis at **33.6 pixels per authored meter**.
- The beautiful A2.6 3/4 building retains visibly different projected ground vectors. Placing the 3/4 visual door at one screen position is valid for an isolated visual reference, but that cannot make nearby ground positions register to true multiplayer world XY.

## Reproduce

Run a basic HTTP file server **from the root of the checked-out graphics branch**:

    python -m http.server 8080

Open in a browser:

    http://localhost:8080/web/greyhaven-a28-xy-lab.html

The page imports **the actual game projection function** (not a duplicate). It reads the already committed A1 art manifest, A2.5 camera measurement and layer reports, and A2.6 3/4 camera measurement and layer reports. Both canvases independently draw the appropriate original author-authored Red Lion lossless WebP base/roof layers using the saved door-relative visual crop offset. No images or map coordinates are guessed or fetched externally.

Controls adjust a simulated world origin by ±120 world units on X/Y from the **proposed** Red Lion door and manually change roof alpha. The pink ring identifies the game's projected **combat-disc origin** (fighter radius 18 game units, displayed radius 15.12px at 0.84 zoom). The yellow dot/line identifies the ground location implied by the respective Blender authoring camera, which generally differs from the pink ring on the 3/4 art. These visual aids **are not actual knight sprites, foot positions, hitboxes or confirmed game collisions**.

## Real Chrome acceptance (Windows / 2026-10-20)

Run (Puppeteer installed on authorized workstation):

    node tools/art/verify_greyhaven_a28_browser.mjs /local/art-evidence

The harness binds a localhost-only HTTP file server and launches real Chrome. Captures:

- greyhaven_a28_camera_comparison.png — both cameras, synthetic origin +40,+40 world units, roof alpha 60%.
- greyhaven_a28_xy_offset_and_roof_fade.png — both cameras, +120,-80 world units, roof alpha 20%.
- greyhaven_a28_browser_report.json — actual browser version, numeric pixel agreement, error and safety flags.

Verified results, at 640x640 art review canvases:

| World XY offset from proposed door | Calibrated overhead error | Cinematic 3/4 error |
|---|---:|---:|
| (+40,+40) | 0.000px | 36.170px |
| (+120,-80) | 0.000px | 270.766px |

The numeric errors measure the difference between *actual game XY screen projection* and the Blender-reported camera ground-vector projection, not visually tracked sprites or measured real game runtime FPS. Chrome reported zero JS/page/network errors. This test explicitly **does not** measure online-game FPS, correct A3 knight foot pivot, multiplayer roof occlusion, VRAM use or interior/portal authority.

## Integration blockers

1. The good-looking 3/4 architecture must not be directly stamped into an authoritative flat-XY world as though its ground basis were orthogonal. Future sprite art may be visually anchored at one world reference, but all occlusion, door positions and movement require a separate placement/occlusion strategy.
2. The live game currently draws fighter discs around the world-space origin. It does not provide verified A3 knight foot pivot metadata in this browser path. **A3 foot alignment remains unverified**; this synthetic disc does not substitute for testing actual sprites.
3. Dynamic roof fade, player-around-door depth sorting and enterable interiors are not enabled by the preview. Real Chrome/Firefox/mobile online frame-time and decoded texture memory remain unmeasured.
4. The existing graphics PR #350 is long-lived and behind main. Exact-head CI must pass before merge. The earlier graphics head CI #39449539107 failed required **M145 spatial recovery handoff**, unrelated to changes made here; no combat assertions have been weakened or bypassed.
5. No merge or production deployment without separate owner authorization. Preserve A3 roll, forge/anvil correction, 0.325m forge-anvil edge clearance and non-overlapping barrels.
