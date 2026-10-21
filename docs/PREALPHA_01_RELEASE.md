# 🌕⚡️🚀 Moon Games — Combat Pre-Alpha 0.1 (MAIN ORCHESTRATOR)

## Release objective

Approved owner directive 2026-10-21. This is an accelerated *separate* P0 milestone.
Minimal existing arena, two to four independently controlled real human players,
real Rust authoritative multiplayer, current movement/kick/roll/parry/block/jump,
stamina, damage, death/respawn and reconnect.

**OWNER AMENDMENT — ONE AUTHENTIC SILVER KNIGHT CHARACTER TYPE:** All human
players in the existing multiplayer arena must use the five original source-
qualified Silver Knight idle/walk/sprint/roll/jump atlases. Unsupported attacks,
kicks, guard, damage, knockdown and death keep the original truthful Combat
telegraphs/fallback. Local practice mode is a separate non-release demo.
The authentic Spartan kick from Graphics #611/#617 remains visual HOLD and
cannot be substituted by idle/walk or enabled without genuine client qualification.

**EXCLUDED AS RELEASE DEPENDENCIES:** Greyhaven and World 9, items and swords,
Sentinels/NPCs, magic, all other Blender or new character assets, economy, IDR
and world persistence. Continue the complete First Playable Alpha separately
via #480/#488. Do not remove any unfinished feature branches.

## Current baseline and one mandatory Combat correction

Verified current merged main when this track started:
6fa59b649112c272bcbc018b4a32bf963f9a5bba.

The merged source currently uses release-to-strike LMB in
src/browser/left-button-charge.mjs, both web/game.mjs and
web/online-game.mjs. This DOES NOT satisfy the owner-required normal light
commit on pointerDOWN. The server has an earlier unlanded-light upgrade path
but existing browser initially sends both attack+heavy while held.

Required correction, **not yet implemented in this release packaging PR**:
- Quick LMB immediately starts server-owned light WINDUP, not instant HP loss.
- Sustained hold upgrades only an unlanded light before it goes active.
- Server-owned 320ms heavy windup reaches READY; READY does not auto-fire.
- Heavy fires exactly once on deliberate release. No light+heavy double-hit,
  including late/lost upgrade packets or very long holds.
- Release before 320ms gives one light. Focus loss and canceled pointer cannot
  strike by surprise. RMB run + LMB and Space+LMB still work.
- Strict native Chrome/Firefox authoritatively prove input ordering, damage,
  guarding, recovery and active HIT chronology without bypassing old assertions.
- If the 34-byte protocol cannot distinguish old KeyE heavy from held-LMB
  release without two hits, develop a minimal backward-compatible protocol
  or present a grounded conflict for owner approval; NEVER fake a hit.

Department Combat4 task: see the department issue linked from master #695.

## Non-activating package procedure

Production/main merge and public DNS/service activation are not authorized by
this script. Use only on an isolated Linux staging/QA checkout of the exact
reviewed candidate SHA AFTER mandatory Combat and browser quality gates.

On a trusted Linux builder with cargo, Node, sha256sum and GNU tar:

    git checkout <EXACT_APPROVED_RC_COMMIT>
    git status --porcelain                  # must be empty
    node --test tests/*.test.mjs
    cargo test --locked --manifest-path server/Cargo.toml
    cargo fmt --check --manifest-path server/Cargo.toml
    cargo clippy --locked --manifest-path server/Cargo.toml --all-targets -- -D warnings
    mkdir -p /path/to/isolated/output
    bash scripts/prealpha-package.sh /path/to/isolated/output

Packager builds a locked release binary from that checkout and exports
**committed** web/src/ops/alpha at HEAD. The tarball includes:

    ./REVISION                      exact 40-character Git SHA
    ./RELEASE-STATUS                explicit NOT APPROVED FOR PUBLIC CUTOVER
    ./CONTENT-SHA256                file-by-file integrity list
    ./bin/myaso-server              compiled native Linux binary
    ./public/web/                   existing minimal arena and lobby
    ./public/src/                   shared client modules
    ./ops/alpha/                    existing installer / service templates

Outer tarball filename:
myaso-prealpha-0.1-<full_SHA>.tar.gz
with separate .sha256.

Verify:

    ( cd /path/to/isolated/output && sha256sum -c myaso-prealpha-0.1-<full_SHA>.tar.gz.sha256 )
    tar -xzOf /path/to/isolated/output/myaso-prealpha-0.1-<full_SHA>.tar.gz ./REVISION
    tar -tzf /path/to/isolated/output/myaso-prealpha-0.1-<full_SHA>.tar.gz

**STAGING is a separate action** requiring explicit authorized target and
root-controlled installer:

    bash ops/alpha/install-vps.sh --stage <archive> <sha256-file>

This exact existing --stage path does not reload Caddy, change live services,
open firewall or activate public QUIC. Treat its output as UNVERIFIED until
the staged checksum, config and endpoint behavior are independently checked.
**Do not execute --activate** without Main/owner target confirmation, full
native real-human acceptance, independent-host reachability, formal rollback
check and protected post-merge CI.

## GO/HOLD checklist

- [ ] Exact current main verified; Pre-Alpha minimal arena source accepted
- [ ] Instant LMB pointerDOWN server light begins
- [ ] 320ms hold-READY-release heavy, absolutely no double attack
- [ ] Full exact-head protected CI, no skipped Combat gates
- [ ] Genuine Chrome/Firefox native attack/damage/recovery/defense tests
- [ ] 2 independently operated humans and 4 genuine browsers complete fight
- [ ] Death/respawn/rejoin/ghost cleanup and packet-loss tests
- [ ] Immutable artifact SHA-256 and content integrity verified
- [ ] Stage-only isolated target and endpoint verified without affecting live
- [ ] Rollback artifact and restoration independently proven
- [ ] Post-merge full CI and owner-approved production cutover

**Current release status: HOLD, NOT PLAYABLE, NOT STAGED, NOT DEPLOYED.**
This packaging track alone does not satisfy Combat or external acceptance.
