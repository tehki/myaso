# 🌕🎨 Graphics 3A — Verified Free Standard Asset Acquisition (2026-10-25)

**Status:** OWNER APPROVED / FIVE OFFICIAL ARCHIVES ACQUIRED / OFFLINE ZIP+LICENSE+RIG METADATA VERIFIED / **P1 RUNTIME HOLD**.

**Machine:** authorized X230i Linux development runner, local-only assets at `/home/tehki/Downloads/myaso-graphics3a-p1-assets-20261025/`. **No third-party raw ZIP, GLB, FBX, texture, .blend or screenshot has been committed to the public repository.** No payment, login, Source-tier purchase, runtime renderer/World/Combat modification, staging, or deployment.

## Official creator downloads and immutable evidence

All acquired via each author's official itch.io page, its own `/download_url` free Standard selection and the signed CDN URL returned by itch.io. Selected the exact free upload ID/name; no Source/paid upload requests.

| Owner-approved pack | Source page | Local archive filename | Actual ZIP bytes | SHA-256 | Safety audit |
|---|---|---|---:|---|---|
| Universal Base Characters | [Quaternius](https://quaternius.itch.io/universal-base-characters) | `Universal Base Characters[Standard].zip` | 128,968,391 | `fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40` | PASS |
| Modular Character Outfits - Fantasy | [Quaternius](https://quaternius.itch.io/modular-character-outfits-fantasy) | `Modular Character Outfits - Fantasy[Standard].zip` | 294,347,394 | `c3468b18871cc8c8f05ab14df7712baf22cb9f389cbd870babf130e595187f70` | PASS |
| Universal Animation Library 1 | [Quaternius](https://quaternius.itch.io/universal-animation-library) | `Universal Animation Library[Standard].zip` | 15,904,933 | `cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724` | PASS |
| Universal Animation Library 2 | [Quaternius](https://quaternius.itch.io/universal-animation-library-2) | `Universal Animation Library 2[Standard].zip` | 18,735,003 | `4008ea208a604773a2b2177d965f0f5d3195498b5bf838c3f5785d68e95f2a68` | PASS |
| Character Animations 1.1 | [KayKit](https://kaylousberg.itch.io/kaykit-character-animations) | `KayKit Character Animations Free 1.1.zip` (publisher upload is named `Free 1.1`) | 14,858,957 | `65882f31f905ad2e953819648a59287cdeab8f623908d5ef701971d3758be20f` | PASS |

**Integrity:** for each completed archive, the repository's read-only `scripts/graphics3a_p1_standard_intake.py` generated a local `<Pack>-audit.json` report with the exact SHA256 and file metadata. Independently ran Python `ZipFile.testzip()` across **every member**: five archives **CRC PASS**, no corrupt entries. Validator results were all **zero warnings**, and each output explicitly says `HOLD_NOT_IMPORTED`. Local audit JSONs are beside the ZIPs; do not commit raw binary archives or huge audit dumps.

**Exact in-archive licenses:** every ZIP has a real included `License.txt` or `License_Standard.txt` identifying **CC0 1.0 Universal**. The Base and Outfit `License_Standard.txt` files explicitly warn that the *free Standard edition contains only a portion* of the complete pack. This is distinct from Quaternius' newer **general QAL v1.0** page; record license evidence associated with **these exact obtained bytes** and re-evaluate any future newer ZIP separately. Asset author credit is not required under CC0 but attribution/provenance should be kept internally; do not misrepresent authorship.

## Verified contents, not brochure headline totals

| Obtained Standard ZIP | Actual regular files | Candidate 3D files (.gltf/.glb/.fbx/.blend/etc.) | What actually exists |
|---|---:|---:|---|
| Universal Base Characters | 112 | 44 | **Two free original rigged base bodies**: `Superhero_Male_FullBody.gltf`, `Superhero_Female_FullBody.gltf`; hairstyle/eyebrow/beard variants. Full advertised six-body roster is **not** in Standard. |
| Modular Fantasy Outfits | 121 | 48 | **Four complete free rigged outfits**: Female/Male Peasant, Female/Male Ranger; 20 modular glTF parts plus 4 full outfits; 24 equivalent FBX exports. Full advertised 12 outfits/62 parts are **not** all in Standard. |
| Universal Animation Library 1 | 9 | 4 | `UAL1_Standard.glb` **43 actual animations** plus `UAL1_Standard_RM.glb` **43 matching root-motion variants**; corresponding FBX files. |
| Universal Animation Library 2 | 13 | 7 | `UAL2_Standard.glb` **43 actual animations** plus `UAL2_Standard_RM.glb` **43 matching root-motion variants**, two FBX files and female mannequin .blend. |
| KayKit Character Animations 1.1 | 37 | 32 | **16 GLB animation groups + 16 FBX** (14 named animation groups and two mannequin files); GLB animation group counts total **173 clips** across medium and large rigs (includes variations, not asserted unique actions). |

These counts came from reading actual ZIP central directories and native GLB animation JSON, **not** from inferring that all paid/source assets are in the free packs. Manufacturer headline counts (e.g. 120+ / 130+ Quaternius libraries, 12 outfits) describe broader packs, not a promise of free Standard contents.

## Actual skeleton compatibility evidence (read-only metadata)

- Quaternius Base male free `Superhero_Male_FullBody.gltf`: **65 skin joints**.
- Quaternius UAL1 `UAL1_Standard.glb` and UAL2 `UAL2_Standard.glb`: **65 joints each**, exact joint-name **and order** match with the Base character (**65/65**).
- **Every one of 24 outfit glTF exports** (20 modular body/garment pieces + four complete character outfit glTFs): **65/65** identical joint name/order to Base and both UAL libraries. No glTF in this set lacked a skin or diverged.
- KayKit `Rig_Medium_MovementBasic.glb`: **23 skin joints** and **only `root` name intersects** Quaternius' 65-joint naming. Explicit humanoid retarget mapping/pose validation is mandatory; never simply play KayKit GLB clips against a Quaternius skeleton.
- Joint match alone **does not** establish correct bind pose, animation lengths, mesh clipping, feet grounding, root-motion safety, weapon socket correctness or that all outfits work at the 960×540 game presentation scale.

## Selected candidate actions for P1 review

The obtained files contain `Idle_Loop`, `Walk_Loop`, `Sprint_Loop`, `Jump_Start`, `Jump_Loop`, `Jump_Land`, `Roll`, `Death01`, and `Sword_Attack` (UAL1); `Sword_Block`, `Sword_Dash`, `Shield_Dash` and several civilian/zombie actions (UAL2); `Dodge_Forward/Backwards/Left/Right`, `Melee_Unarmed_Kick`, `Melee_Block`, multiple weapon attack and death poses (KayKit). These are **authored source animation names**, not valid gameplay state changes or authorization to replace Combat's original truthful fallback.

## Mandatory next checks before **any** game runtime import

1. Open actual acquired Standard FBX/glTF models and animations in Blender/compatible rig importer; check rest/bind poses, animation frame ranges, normals, materials, scale, clothing seams and modular layering (including a shared head on outfits).
2. Create a **separate, reproducible, offline, original-source** proof exporting Base + Peasant/Ranger samples with eight camera/facing directions, 160px source cells, correct grounded shadows, texture values and the actual Silver Knight screen-space visual scale.
3. Author a distinct KayKit 23↔65 joint retarget profile and verify arms, feet, hit reaction, roll and combat cues. Do **not** alter authoritative Rust World, Combat inputs, HP/stamina, hitboxes or server tick.
4. Collect real Chrome+Firefox native 960×540 full-Canvas screenshots and p50/p95 frame intervals with 2 and 4 authenticated humans against the original one Rust server actor/World.
5. Art Director 3 reviews aesthetics against Moon Games; Main 0 and owner provide explicit **GO** before any merge, production operator flag, vendor asset distribution, staging or deployment. Preserve P0 original Silver Knight Ready-Five release and separate P1 Dash/Kick/Knockdown HOLD.

**Rejected character:** Mid-Poly Knight is not included, downloaded, tested, or planned.

## Final checkpoint

**Five official Standard archives obtained, all ZIP CRC/hash audits and actual embedded CC0 licenses verified; bone compatibility probed; zero gameplay changes.** Still **NOT** a playable P1 character release and **NOT** a visual/Blender acceptance.
