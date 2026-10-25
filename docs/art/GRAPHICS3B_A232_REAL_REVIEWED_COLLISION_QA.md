# Graphics 3B — original Red Lion visual depth with actual Rust reviewed collision

**QA-only child of #1037; P1 Alpha review, not Combat Pre-Alpha scope or deployment.**

The successful four-actor facade run #1037 deliberately disabled original static collisions. Real authoritative behind-facade actors (#1 and #2, y=4028) overlapped reviewed World9's `building:red-lion` static AABB [4240,3880]–[4490,4050]. This **cannot qualify legal movement**.

This independent alternative keeps the original Rust WebTransport staging server with `MYASO_ALPHA_STATIC_COLLISION=reviewed-static-only`, carrying pinned SHA256 `9bb023c95d86821f219113d71b6e480789a72df064f083790e746d79423b3f43` and 23 immutable static AABBs. No game source or collision physics/zone/portal code changed. Every actor is real, authenticated, server-snapshotted, moved only through genuine W3C input. The original 3B localhost read-only observation hook reports actual World9 facade depth, source-art readiness, and true rendered HUD decisions.

**Question:** Can an actor with authoritative 18-unit review collision radius truthfully move to a `behindFacade` sample south of the Red Lion's collidable wall at `y=4050` but before the existing visual-depth threshold `y=4075`? The mathematical candidate strip is `4068 < y < 4075`; the native test must observe actual server coordinates and original full Canvas, not use this inequality as proof. Two fighters attempt that boundary; two others remain in unobstructed foreground. All four real browsers must independently confirm original camera movement, read-only HUD occlusion and every actor clear of reviewed solids.

**Negative result is meaningful:** if original collision prevents reaching this 7-unit strip consistently, World9/Core8C must explicitly reconcile facade visual depth and door/entry geometry; Graphics 3B will NOT disable collision to fabricate an Alpha pass.

Even a green result covers only reviewed static 23 AABBs, not dynamic objects, rivers, authoritative portals, openable doors, item pickups, bank/Blacksmith transactions or independent-host PvP. Full protected quality, Chrome/Firefox, gameplay frame-cost and Main owner approval remain separately required. **Draft, HOLD; no merge/deploy.**
