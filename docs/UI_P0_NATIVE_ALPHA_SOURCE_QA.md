# UI 10 P0 — Native source-alpha sword pointer acceptance (ART-ONLY)

This draft integrates Graphics 3B Blender rack source PR #500 at `82b9755891e620b28d53b03cb6b1bfb4c532c1e0` with UI pointer stack PR #503 at `2f143cd4c2f6c31554c8f058ae9da81e1a164556`.

The script `scripts/ui_p0_native_source_alpha.mjs` serves the original Graphics art preview and WebP from a read-only allowlisted loopback HTTP server. A genuine Chrome or Firefox browser supplies trusted pointerdown/up events, and the existing UI alpha gesture and canvas mapping modules consume the original Graphics WebP alpha hit callback.

Checks cover actual opaque pixels, transparent rejection, CSS size and DPR2, stale synthetic presented-frame rejection, genuine pointerdown-drag-pointerup across two different rendered swords (reserved, no retarget/no item), a subsequent fresh genuine click selecting the new sword, and zero Combat or item mutation. The test-only 4-sword IDs, positions and frame ID are *not* authoritative evidence of real online-game item presence. The displayed preview must match a separately derived visual plan or the test aborts.

No item request is sent. No inventory, server, Combat, World or production runtime file is changed by this QA harness. The live rack remains empty until Core8A/8B/8C+Items provide authenticated, committed current item presence and pickup/equip receipts.

Local X230i headless Chromium crashes before starting with an illegal-instruction fault. Native browser acceptance therefore requires the dedicated CI run; no browser PASS is claimed from the local attempt. This draft must not be merged to main or deployed independently of Main Orchestration.
