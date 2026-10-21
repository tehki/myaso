# Graphics 3B A2.32 — Red Lion entrance 3A actor / 3B source-alpha hazard and Firefox canvas evidence

**21 October 2026 · DRAFT original-art QA only.**

Graphics Orchestrator [A2.31 #459](https://github.com/tehki/myaso/issues/459) flagged the 69 changed A2.30 facade alpha pixels as unapproved until checked against real actors at game zoom. This focused follow-up is an **objective source-pixel audit**, not a redesign, and does **not** change roof, facade, Blender, World, server, Combat or 3C lighting. Stacks on draft Graphics 3B #466 / #443 / #411 / #350.

## Threshold alpha mask investigation

The 69 source-altered pixels are confined to the original game 640×640 facade frame's **X=289–350, Y=321–331** entrance threshold. **51 originally transparent pixels became visible, 18 antialiased edge pixels changed, zero pixels were removed to fully transparent.** The bounding rectangle is unchanged.

A new reproducible Python/Pillow audit cross-checks those exact pixels, old/new source WebP alpha and independently SHA-pinned original 3A sprite masks from two separate unmerged draft streams: Silver Knight PR #326 and 3A adult masculine/feminine PR #433. It projects genuine 160×160 first-frame source WebP idle artwork to the same 96×96 display rectangle used by the existing 0.84-zoom source-art browser and positions the actor at the original art door (4365,4075) and five additional deterministic offsets.

| Player and exact original idle art | Centered at visual door | 16 units south | 25 west | 25 east | +80 east, -10 north |
| --- | ---: | ---: | ---: | ---: | ---: |
| Silver Knight | 0 | 0 | 32 | 37 | 0 |
| Adult masculine (draft) | 0 | 10 | 32 | 37 | 0 |
| Adult feminine (draft) | 0 | 10 | 32 | 37 | 0 |

Numbers represent **source facade alpha-changed pixels that geometrically overlap nontransparent actor sprites**, *not* measured player-collision defects, not server hitbox dimensions and not a determination that every overlapping pixel is an unacceptable image artifact. Source art remains at native zoom and independent of all actual multiplayer avatar enablement.

The image \`assets/environment/greyhaven/a232-review/greyhaven_a232_original_actor_alpha_review.png\` explicitly highlights the changed alpha source pixels. All sprite atlas SHA-256s are pinned in the report.

## Genuine Chrome/Firefox art viewer edge cases

\`tools/art/verify_greyhaven_a232_threshold_browser.mjs\` reuses the original source-pinned A2.31 3B+3C+3A composite page and source-functions, adding **5-world-unit granularity only in the review HTML's X slider** to inspect actual west/east offsets ±25. Original 3C light source remains untouched, one Red Lion fixture and ground pool; neither new texture nor automatic occlusion is introduced.

- Native Chrome 154 and Firefox 153.4: **8 real screenshots**, 0 browser/network errors.
- For each browser: western threshold **front/behind** and eastern threshold **front/behind** hypotheses. State checks preserve exact actor world XY, original 3C world coordinates and 3A sprite sources.
- No browser outcome establishes actual depth sorting in the final World renderer. Source-alpha/character-mask overlap is verified offline; screenshots show **hypotheses** and are not ground truth for correct wall/interior occlusion.

## Firefox dusk Canvas performance experiment — candidate rejected

A **single exploratory before/after trial** removed \`willReadFrequently:true\` from the *standalone* 640×640 art review Canvas, then reran the exact same A2.31 scripted camera route and independent pinned assets. The prior baseline Firefox dusk p95 was **22 ms**, while the unpersisted candidate reported **28 ms**. Because this is one uncontrolled trial, it is not a statistically strong regression claim. It **does not demonstrate improvement**, so this potential change was **reverted and is NOT delivered**. The original review hint remains unchanged and **no production renderer change or FPS improvement is claimed**. Measured Chrome results and source/caveats are preserved in \`greyhaven_a232_rejected_canvas_hint.json\`.

## Reproduction

Using authorized Windows browser checkout, a separate exact-head Knight #326 checkout and adult #433 checkout:

\`\`\`powershell
python tools/art/audit_red_lion_a232_threshold_actor.py --knight '<KnightCheckout>' --adults '<AdultCheckout>'
node tools/art/verify_greyhaven_a232_threshold_browser.mjs '<3CCheckout>' '<KnightCheckout>' '<AdultCheckout>' 'assets/environment/greyhaven/a232-review'
node --test tests/art-direction-a232-threshold.test.mjs
\`\`\`

Original scene and A2.26 roof SHA provenance is untouched. The full game renderer still lacks approved automated depth/occlusion, multiplayer gameplay lighting, server portal/collision validation and low-end FPS. Alpha **intersections are a concrete art-director review item**, not a release-safe finding. Protected exact-head CI, 3C/Art Director signoff and Development Center #360 approval are still required before any merge.
