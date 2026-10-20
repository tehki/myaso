# World & Gameplay D13 — Moonvale Roadside Chronicles

**Status:** isolated World & Gameplay draft stacked on D12 #425 and earlier authored-world preview milestones. All six sites are local **fictional environmental storytelling**, not loot objects, economic property, combat or server-authoritative entities.

## World content
D13 places six authored historical inscriptions beside existing walkable map anchors:

| Chronicle | Approach | Description |
| --- | --- | --- |
| The Red Lion Charter | Greyhaven, x4365 y4150 | The city’s early tradition of offering refuge |
| The Market Bell | Greyhaven Market, x4450 y4250 | Artisans’ gatherings before the square became permanent |
| The Millwright's Inscription | Western Old Mill, x2815 y4100 | Generations of caretakers through difficult winters |
| The Bridge Warden's Mark | Western bridge, x2010 y4240 | Road wardens who kept the bridge open during floods |
| The Last Watch Signal | Fallen Watch, x3210 y2070 | An ancient beacon warning of a storm rather than an army |
| The Mason's Promise | Stonebrook, x6565 y4080 | The first settlers' promise of shelter for travelers |

All records are frozen and addressed by stable `id`. They are visible as tiny gold squares in the *offline* world preview when near the camera. Unread entries appear as clues in the optional **Roadside chronicles** panel. Reading with **F** reveals the authored passage in the journal, updates **0/6** session progress, and displays a transient story notice. Reload clears all chronicle state. No network request or user identity exists.

## F-key arbitration, not multiple awards
D6 resource field observation and D7 expedition F-inspection previously used one key. D13 explicitly selects the physically nearest authored interaction *once per F keydown*:
1. Compute nearest valid walkable lore and resource points within each bounded 68-unit radius.
2. If lore distance is strictly less than resource distance, read exactly one nearby lore entry. Do **not** call D7 expedition inspect or D6 field observe.
3. Otherwise use the existing D7/D6 F path, including the case where the notebook already contains the resource: a deliberate repeat F still satisfies the appropriate active expedition stage without duplicating a field note.
4. Ties favor existing D6 field behavior for backward compatibility. Repeat keydown (`e.repeat`) is ignored.

Fallen Watch's lore inscription at (3210,2070) is 41 units from the existing Watchpost Ore at (3220,2110), so the inscription wins at its own center; the ore wins at its own center. This was tested without moving or weakening the resource or expedition collision/proximity rules.

## Validation and ownership
`src/world/roadside-lore.mjs`: immutable six-site manifest, `nearbyLocalLoreSite`, `readLocalLore`, and `localLoreProgress`. Uses existing D2 preview walkability. Rejected map, blocked or nonfinite positions, malformed journal, distant interactions and repeat reads do nothing. No persistence, inventory, quest, treasure, coin, wallet, NPC, XP, spell or network API.

`web/world-preview.html`: accessible local journal details, temporary notice, nearest-interaction HUD, six bounded cosmetic squares and F arbitration. No live client or Rust simulation changes.
`tests/world-roadside-lore.test.mjs`: seven tests covering exact authored coordinate accessibility, immutability, independent session reads, wrong-map/block/invalid positions, no entitlements, no walking auto-credit, lore-versus-ore priority and offline-only source wiring.
`.github/workflows/ci.yml`: additive D13 gate; all inherited Combat, networking, Rust, World, graphics and browser tests remain strict.

Reviewers should run:
```
node --test tests/world-roadside-lore.test.mjs tests/world-field-survey.test.mjs tests/world-local-expeditions.test.mjs
node --check src/world/roadside-lore.mjs
# plus the full Node suite and exact-head GitHub CI
```
For browser acceptance open `/web/world-preview.html` on an authorized local test server. At default Red Lion spawn observe **Press F — Read The Red Lion Charter**; press F once: chronicle 1/6, reveal passage and notice; hold/repeat must not duplicate; reload resets 0/6; existing expedition selection, F resource inspection, portal E and map M remain independent.

## Merge discipline
Review and integration belong to the central Development Center. Parent foundation #336 and a long stacked world chain remain unmerged and diverged from later `main`; no deployment or branch merge may be assumed. D10 #410 and D11 #422 exact-head CI passed, D12 #425 exact-head [quality #39513546621](https://github.com/tehki/myaso/actions/runs/39513546621) **failed inherited strict Combat M205 repeated M201 server-tick FFA punish proof**. Older inherited Combat M151/M144/M171/M194 failures also require central requalification. Do not weaken strict Combat gating to merge narrative content.
