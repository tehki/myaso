# Original Silver Knight — actual 3-player in-game victim fall screenshots

**Actual native W3C browser images, not an illustration or source-art scene.**

Source: [GitHub Actions #39790356235](https://github.com/tehki/myaso/actions/runs/39790356235), dedicated `graphics3a-native-original-victim-knockdown-png` job **SUCCESS**. Artifact `graphics3a-original-victim-real-arena`, ID **12429699830**, downloaded to authorized Windows QA and all THREE original PNG bytes verified against exact GitHub CI manifest's SHA-256. Images were copied to this folder unchanged; no local edits/cropping/Photoshop regeneration.

These screenshots are from the **same genuine Rust authoritative M153 3-player match**. Chrome attacker #1, Firefox victim #2 (the only player with a server-reported `COMBAT_ACTION.knockdown` own transition) and Chrome #2 observer #3. All three game canvases show first-party original 22-bone Silver victim `silver_knockdown.webp` low-pose sample **source frame 3**, with the other two actors, HP/guard HUD and yellow Combat tell present. The screenshot observer ran after the synchronous game render callback rather than half-way through the victim sprite draw.

- [Real Chrome attacker #1 view](original_silver_real_knockdown_chrome.png)
- [Real Firefox victim #2 view](original_silver_real_knockdown_firefox.png)
- [Real Chrome #2 spectator #3 view](original_silver_real_knockdown_chrome2.png)
- [Original exact browser IDs, frames, bytes and SHA-256 proofs](original_silver_victim_native_manifest.json)

## Actual visual review result — NOT ready for public game

**Art-review blocker:** The original Silver Knights appear **small and dark** at the current QA arena camera, and the victim fall at the low-pose key appears **partly suspended / insufficiently in contact with the floor**. This is a meaningful criticism rather than an art-source verification failure. The 2D source pose is tied to the existing 360ms server knockdown, but it has not been validated against real Greyhaven world floor geometry, boot soles, center of mass, IK or rigid-body dynamics. The yellow combat tell is real game rendering, **not independent proof of boot-to-body mesh collision or damage**. All actor motion/hitboxes stay server-authoritative.

The authentic full source 360ms 8×8 atlas is [here](../original_silver_knockdown_360ms_8way.webp), and the GIF is [here](../original_silver_victim_knockdown_8way_360ms.gif). The original source-art PR #774 remains subject to Graphics Director and owner aesthetic approval. This QA screenshot branch doesn't change original production art, player movement, camera/scale, Rust server, Combat code, game controls, damage, knockback, sound or public deployment.

**Test distinction:** Source/collision confidence is separate from visual quality. The parent [PR #779](https://github.com/tehki/myaso/pull/779) has true 3-browser source animation success; this actual imagery reveals a visual-readability/floor-contact defect that must be fixed as a separate future art pass. This archived evidence does NOT constitute full real floor contact, 0.84 Greyhaven approval, a 2–4-human playtest, or Pre-Alpha inclusion. **Hold all merges and deployments.**
