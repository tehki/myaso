# Graphics — adult base-body and equipment presentation v1

**Status:** shared render-only contract; **dormant / nonactivated**. Tracking [Graphics 3A adult character foundation #421](https://github.com/tehki/myaso/issues/421).

## Player fantasy
A newly created character is an **adult** man or woman and begins visibly unclothed and unarmed. The body is a permanent underlying visual layer; garments, armor and weapons come from actual earned, crafted, bought or looted physical items. Full-loot death eventually transfers all possessions to corpse/ground. **This module does not implement character creation, naked adult meshes, inventory transactions, network replication or that death handoff.** It establishes a safe contract while Graphics 3A authors source art.

### V1 art/style standards
- Body presentation options: `adult-masculine` and `adult-feminine`, independent from durable account/character identity. Both are strictly adult, grounded, nonsexual character designs in **Blood & Iron — Medieval Realism**.
- Source authored in editable Blender/GLB, with a reproducible eight-direction sprite-atlas workflow. Preserve real game XY ground contact, character pivot, weapon silhouette and honest animation state. Artwork must be properly licensed.
- Continue 3A approved 120% opt-in size: **96px standing, 134px A3 roll**; maintain 350ms roll representation without changing Combat timing, i-frames or world collision.
- Required motion coverage includes idle/walk/run/roll/jump, parry/kick, attacks and stunned/knockdown/death as appropriate; incomplete states require truthful existing fallback, not misleading substitute animation.
- Optional client-local **privacy cover** can conceal unclothed bodies visually. It is never physical clothing, has no loot identity or statistics and must not change gameplay. Actual content availability, platform rating and audience policy require review before production default nudity.

## Pure JavaScript presentation contract

`src/browser/character-appearance.mjs` exports:
- `createUnequippedAdultAppearance(bodyPresentation)`: immutable, schema-v1 snapshot with **Body**, **Feet**, **Head**, **OffHand** and **MainHand** empty.
- `planAdultCharacterLayers(appearance, {concealUnclothedBody})`: deterministic symbolic base-body / optional privacy cover / equipped items in draw order. This is **not a canvas renderer, asset loader or network protocol**.
- The current draft mapping covers **five** physical server equipment slots introduced by Magic & Items [#424](https://github.com/tehki/myaso/pull/424), which is stacked on [#354](https://github.com/tehki/myaso/pull/354): `Body`, `Feet`, `Head`, `OffHand`, `MainHand`. All nine equippable physical `ItemKind` values in #424 are mapped explicitly. This is a preview dependency on a **draft domain change**, not a claim those kinds have landed in `main` or are live. No unsupported item should silently render as naked. Additional garment slots need explicit agreement with Magic/Core, not cosmetic invention.

### Draw/render safety
The `supported` flag means the symbolic presentation request is *schema-valid*, **not** that the actual atlases exist or are loaded. A future renderer must check all asset readiness before selecting this presentation. Any invalid schema, unknown equipment kind, wrong slot, missing canonical slot or missing atlas falls back to existing known-good fighter rendering rather than suppressing gear or presenting unsupported clothing as nudity.

Never derive visible authoritative inventory from client-provided item names, locally chosen cosmetics, visual privacy settings or these layer plans. Equipped item state must ultimately be validated by server-owned loot/domain and an authenticated durable character identity; remote appearance and reconnect require separately reviewed Core networking/persistence and server-authority work.

## Integration fences
1. **Graphics 3A:** owns base meshes/atlas art and truthful sprite animation; do not overwrite existing [Knight #326](https://github.com/tehki/myaso/pull/326) or stacked [fallback #408](https://github.com/tehki/myaso/pull/408), nor their uncommitted owner GLB sources.
2. **Magic & Items / Core 8B:** authoritative physical equipment, death/loot, identity and persistence. They currently are NOT live.
3. **Core 8A:** serialize per-character cosmetic base/body choice and server-owned equipment appearance without altering existing 34-byte v1 inputs or Combat snapshot protocol until separately approved.
4. **UI 10:** adult body presentation selector, paper doll equipment inspection and independent optional concealment.
5. **Graphics 3B/3C:** validate actual bare/armored body depth layering against Red Lion roof/terrain and combat readability at scale, zoom 0.84.
6. **Development Center [#360](https://github.com/tehki/myaso/issues/360):** determines merges, rollouts and production settings after exact-head strict CI / Chrome/Firefox acceptance.

## Tests

Run `node --test tests/character-appearance.test.mjs` locally. Dedicated pull-request GitHub workflow `graphics-adult-character-contract.yml` also runs Node syntax and these tests, independently of protected full quality. The new test is import-only and does not change any existing game runtime or strict browser acceptance.

**No live feature is enabled by this change.** Real adult base-body assets and equipment renderer remain outstanding. New slots are intentionally incorporated ahead of the Magic #424 stack to prevent 3A creating an obsolete 3-slot atlas specification. This is a compatibility foundation, not a declaration that playable nude characters are already in production.

### Staged equipment art catalog (Magic #424)

| Server item kind | Physical slot | Symbolic asset key |
| --- | --- | --- |
| LeatherArmor | Body | `equipment/leather-armor` |
| ChainmailArmor | Body | `equipment/chainmail-armor` |
| LeatherBoots | Feet | `equipment/leather-boots` |
| IronHelmet | Head | `equipment/iron-helmet` |
| Spellbook | OffHand | `equipment/spellbook` |
| WoodenShield | OffHand | `equipment/wooden-shield` |
| RustySword | MainHand | `equipment/rusty-sword` |
| IronSword | MainHand | `equipment/iron-sword` |
| WoodenClub | MainHand | `equipment/wooden-club` |

**These are asset-name specifications, not images already checked into the repo.** Layer order is a deterministic data ordering for preview only. 3A must resolve directional occlusion (for example which hand/shield goes behind the torso in northeast vs southwest) before creating a final art compositor. A missing required WebP should trigger safe legacy rendering rather than be drawn invisibly. Additional source requirements, rigging, character state transitions and responsible departments are in [#421](https://github.com/tehki/myaso/issues/421).
