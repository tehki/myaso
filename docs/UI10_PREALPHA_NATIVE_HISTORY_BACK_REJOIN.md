# Department 10 — real browser History Back after a fourth voluntary multiplayer seat exit

## Critical corrected interpretation — original offscreen HUD marker, not missing player

The original `web/online-game.mjs` draws offscreen player identity labels in `drawOffscreenEnemyPointers()`, using **9px** font and a viewport-edge position derived from `nearbyOffscreenPointers()`. The on-canvas `drawRemoteIdentity()` instead uses **10px** and sits above the actual Silver. On the genuine actor #8 History Back run, spectator #1 observed a `#8` label at **(919.59,143.09)**, within the right viewport-edge pointer region of the original **960x540** arena. This is NOT proof that #8 had an on-canvas label with no body. Other spectators #3 and #4 had #8 within their camera and correctly rendered its original Silver source WebP immediately.

The **old QA requirement of 4 source Silver drawImage calls in EVERY spectator's frame was inappropriate when the fourth fighter was genuinely offscreen**. The revised strict source acceptance requires:
1. Exactly 4 authenticated server roster identities, and no departed #2/#5/#6/#7 ghosts.
2. In a spectator where remote #8's original **9px offscreen arrow label** is drawn, THREE on-canvas original Silver WebPs (local + two nearer fighters), no prototype fallback, **and no duplicate 10px on-canvas #8 label**.
3. In a spectator where actor #8's original **10px on-canvas badge** is drawn, FOUR original Silver WebP source draws in the SAME real RAF, no offscreen #8 arrow, no prototype fallback.
4. Genuine server-ACKed W3C movement from authenticated #8 brings that actor into each original survivor's view and requires **FOUR source WebPs in ≥8 recent same-real-RAF frames per spectator**, with the offscreen #8 marker replaced by the true on-canvas badge. No fake camera, direct World relocation, NPC, actor packet or sprite shim.

Thus the new acceptance is **more accurate**, not permission for a missing in-view character. The earlier statement that #8's sprite was incorrectly missing from viewer #1 is **superseded** by this original-source interpretation. The genuine actor never disappeared from the server; it was offscreen for viewer #1 and available as a pointer.


**DRAFT / TEST ONLY / NO PRODUCTION CODE CHANGE.** This is a direct test-only child of assembled four-player Physics6 / Silver Knight / local Chat C1 / short viewport seat-rotation [PR #777](https://github.com/tehki/myaso/pull/777), exact parent `bf8b06c0f053712b693dba77210f8e6fc246cdd2`. The parent already has a genuinely native two-matrix three-seat lifecycle success [CI #39788812164](https://github.com/tehki/myaso/actions/runs/39788812164), but its exact full protected quality [#39788812072](https://github.com/tehki/myaso/actions/runs/39788812072) **FAILED strict Combat M143**, and none of these browser QA steps waives that.

## New stricter same-browser lifecycle acceptance

Reuse the authored genuine W3C **browser Back** navigation from Core8C × UI10 [PR #769](https://github.com/tehki/myaso/pull/769), source `3abd4c6a90e104037102b710a54b89c4c6a83c45`, instead of merely manually reentering the game URL. Do this AFTER three authenticated original hard-four-seat rotations already passed with genuinely fresh actors #5, #6 and the returning original-browser #7. Have that exact same Chrome or Firefox session (now actor #7) intentionally navigate away from its original Rust game and issue actual WebDriver `POST /session/{id}/back`. The original server must authenticate it as **fresh actor #8**, not #7 or retired #2/#5/#6, within existing strict native bounded wait, while every surviving original Canvas and HUD no longer paints stale retired player identities.

Additional UI-specific requirements on the **same original live actor #8 browser**:
- Native measured **1366×682 inner CSS pixels**, full original **960×540** 16:9 Combat Canvas visible with no document scrolling, all **14** original accessible Controls remain.
- Original real server-connected local **Chat C1** still available (disposable loopback test-only enablement; public remains OFF).
- All three surviving authentic browsers must show genuine **four original Silver Knight WebP draws in the SAME real RAF** along with the actual original authenticated #8 remote fighter identity and absence of #2/#5/#6/#7 ghosts.
- The returning browser and every survivor must get a fresh input/server tick acknowledgement from actual W3C `S` movement. No `dispatchEvent`, fake actor, local position edits, forced server close or privileged debug endpoint.

A browser History Back can use a fresh page or BFCache. This test intentionally records the native navigation type but does **not claim BFCache reuse occurred**, and the original page's defensive `pageshow.persisted` reload is not counted as separately proved. Abrupt browser process crash still requires normal WebTransport idle timeout, not instantaneous voluntary pagehide. This is four real browser sessions on one CI host, **not** four independent human computers. No authenticated v2 instant mouseDOWN Light / server-held 320ms READY heavy, no Combat HP, stage/rollback or Main GO. Exact-head native and full protected quality must both pass before integration, and original Combat M143 native red is not relaxed.

**No main merge, service restart, deployment, production Chat C1 activation or v2 protocol switch.**
