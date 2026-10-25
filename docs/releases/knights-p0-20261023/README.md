# 🌕⚔️ myaso.io — Silver Knights Pre-Alpha Ready-Five · 2026-10-23

**STATUS: candidate packet prepared, not released. Owner request: ship all ready Knights animations today.** Main Development & Deployment Orchestrator alone can approve integration and deployment. This packet has exactly FIVE source-qualified game motions; other gallery art is **not** automatically part of playable Combat.

## Ready for first-party multiplayer release decision

| Action | Source / in-game animation | Authority | Direction |
|---|---|---|---|
| Idle | original Blender Cycles 1.29-camera relit atlas | existing server Idle | original source 8-row Roll-native camera |
| Walk | original Blender Cycles 1.29-camera relit atlas | existing server movement | original source 8-row Roll-native camera |
| Sprint | original Blender Cycles 1.29-camera relit atlas | existing server high-speed movement | original source 8-row Roll-native camera |
| Jump | original Blender Cycles 1.29-camera relit atlas, source 6 frames | existing server Jump and Jump→Idle | original source 8-row Roll-native camera; shadow remains at floor |
| Roll | immutable original Roll source WebP, 350ms | existing Combat dodge/dodgeRecovery | unchanged native source rows |

Exact bytes, 160px frame sizes, 8-direction source rows, SHA256s and authorship are machine-readable in [ready-five-manifest.json](ready-five-manifest.json). Relit Idle/Walk/Sprint/Jump already passed original source pixel/hashes, 634+ Node source tests, real Chrome/Firefox/Chrome/Chrome browser read, authoritative source test and grounded-shadow server Jump→Idle acceptance as stacked draft [#881](https://github.com/tehki/myaso/pull/881) SHA `2bf5d48e2c87b70dbb30e5e91ca96dc7e41b0938`. At that exact base: [protected CI #39949256026](https://github.com/tehki/myaso/actions/runs/39949256026) SUCCESS and [native four-player #39949255632](https://github.com/tehki/myaso/actions/runs/39949255632) SUCCESS (same-source Chrome start failure then same-SHA rerun green).

## The actual reversible release switch (this candidate branch)

**OFF by default:** the trusted `/game-config.json` served to the first-party lobby omits `silverKnightRelitEnabled` (or uses `false`). `alphaPlayPath(parseAlphaConfig(...))` emits unchanged authenticated `knights=1` and never adds an art query flag. The five immutable original root WebPs remain in effect.

**Main GO only:** after target-branch protected quality, full authentic client/server test, end-to-end live visual review, human players and a coordinated code-integrated release, Main *may* deliberately set `silverKnightRelitEnabled: true` in the **trusted operator-served and TLS-pinned** config, preserving all other fields. The launcher then appends only `knightArt=relit` alongside existing `server`, certificate fingerprint and `knights=1`. The game chooses the four owner-authored relit WebPs plus *unchanged Roll*.

**Fast art rollback:** Main sets `silverKnightRelitEnabled: false` or removes it from trusted operator config and validates a **fresh launcher session** emits no `knightArt`. This restores the immutable original five-clip bundle without any new deploy, changes to Rust server, actor authority or asset overwrite. Do not fake/edit certificate pin or change endpoint. Existing in-progress sessions require refresh/rejoin to load new config. For complete application rollback use normal Main supervised previous-release workflow and rollback gates.

**Never accept a URL flag as authentication:** the query selects visual presentation only, after the pinned official server and authenticated player join; it cannot grant Combat, payments, inventory, identity or network privileges. Only Main's trusted served config should advertise the rollout to public lobby users.

## Deliberately excluded from *this* gameplay release

- **Spartan Kick V3 normal lighting:** original art is reviewed and correctly NOT the overlit support-leg variant. It remains an art/opt-in study; production server's Kick Windup/Active/Recovery and corresponding source frame alignment are not qualified on this candidate. Real Combat kick telegraph remains unchanged.
- **Knockdown V2 grounded:** original original-source grounded animation is prepared for review but not qualified on this specific protected gameplay integration; retain true Combat knockdown fallback.
- **Dash traction 140ms:** original eight-way Blender art in [draft #863](https://github.com/tehki/myaso/pull/863), but actual native four-client Dash-source/action mapping is still unqualified. Maintain existing real authoritative Dash speed 750, duration 140ms, stamina20 and cooldown 3000ms. Do **not** turn the Dash art study on to meet a date.
- Attack, heavy, parry, feint, stun, death and weapon actions: no substitute false clip, preserve original Combat tells.

## Release qualification

1. Check target release candidate exact HEAD; all PR-stack deps are present and correctly merged in dependency order, no accidental first-party server/Combat/Physics/Networking edits.
2. CI for **this** PR and the eventual protected integration must be green: all Node/Rust/protected/native four-player browser workflows. CI on parent #881 does NOT certify a new integration SHA.
3. Confirm genuine 2–4 human clients on target public/staging host; 8 facings, Idle→Walk→Sprint, Roll 350ms, Jump→Idle with shadow grounded, readable Combat fallback and crash-free rejoin. Verify both baseline-off and relit-on from trusted config.
4. Separate Combat team still owns M193/M194 guard-break repeat reliability (previous failures occurred despite final parent CI pass); do not waive/dilute guard-damage/parry assertions.
5. Main provides the sole **GO/HOLD**, audits staged SHA, preserves restore point, certificates and private user data, activates if authorized, monitors errors and can revert the release switch.

**No merge, deploy, signed installer, server restart, public config modification or GitHub release tag was performed by Graphics 3A.** Today is a preparation target, not evidence of a live release.
