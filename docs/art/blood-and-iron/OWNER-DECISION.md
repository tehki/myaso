# MYASO.IO — Blood & Iron: Owner Decision

**Owner decision date:** October 26, 2026  
**Status:** Approved artistic direction; **G0 PLANNING ONLY**  
**Issue:** https://github.com/tehki/myaso/issues/1065  
**Authority:** Project Owner; Graphics Orchestrator 3 reports to Main Orchestrator 0  
**Implementation/release authorization:** **NOT GRANTED**

## Approved vision

MYASO.IO shall contrast an attractive, authentic, atmospheric medieval fantasy world with exceptionally visceral and physically convincing **future** Combat visuals.

The artistic intent includes decapitation on qualifying **server-confirmed lethal** events, separation of left/right arms and legs, convincing collapse/death/finishing visuals, brief directional blood fountains and spray, droplets, bounded ground/surface stains and pools, optional character/armor marks and lightweight local-only severed-part motion. Players must be able to choose **Off / Reduced / Full** gore without changing combat outcomes.

The world remains credible, coherent and immersive, with visual direction influenced by Ultima Online and the existing **Blood & Iron — Medieval Realism** art bible (docs/art/BLOOD_AND_IRON_ART_DIRECTION_RU.md, owner decision October 19, 2026; tracked at #344). Bloody aftermath is intentionally localized and transient, not the constant appearance of every village.

**Artistic approval is not approval to implement new gameplay or production effects.** First implementations, once separately authorized, are initially **lethal-event presentation only**. There are no approved nonlethal limb disabilities, weapon drops, hitbox adjustments or death/damage changes.

## Non-negotiable release and ownership constraints

- Combat Pre-Alpha 0.1 (#695, Graphics #1029) takes precedence and does **not** depend on this new system.
- Preserve Rust authoritative World state, WebTransport, existing damage/HP/hitboxes, facing, attack/parry/guard timing, kill confirmation, movement, death/respawn, input gesture protocol and **450ms recovery-punch window**.
- Do not infer lethal outcomes from animation or predicted damage. Only server-confirmed lethal events may authorize future lethal visual effects.
- Existing authentic five-motion Silver Knight Idle/Walk/Sprint/Jump/Roll source assets remain unchanged. No assumption that current atlases contain severable parts.
- No unapproved renderer migration, new physics authority, packet protocol, server/world decal persistence or deployment.
- **Do not create a Gore Department.** Department 3 owns the artistic specification; 3A owns character assets, 3B surface/building integration, 3C environmental VFX, Combat4 gameplay eligibility, Core8 event/actor authority, Sound5 future sound brief, UI10 settings/disclosures.
- Main Orchestrator 0 retains final integration, merge, staging, rollback and release authority.

## Verified source context when decision was prepared

Protected main at `6fa59b649112c272bcbc018b4a32bf963f9a5bba`: original 960×540 browser Canvas 2D Combat client and Rust/WebTransport gameplay. Authentic source Silver renderer and original 8-way atlases are present in review stacks (#904 / #922); 22-bone Blender source experiment with editable .blend exists at #824. These drafts are **not assumed merged or release-qualified**. Pre-Alpha combined Combat #1036 remains a separate Draft/HOLD.

## Authorization gates

**G0 (now):** owner record, visual design, feasible technical architecture, draft versioned *proposed* event contract, risk/performance plan, G0–G4 roadmap, one GitHub parent issue and documentation-only Draft PR. No production code, assets or protocol changes.

**G1:** blocked until Combat Pre-Alpha stabilization and **new explicit Main + owner authorization**. One source-authored Silver Knight, one qualifying confirmed lethal event, decapitation/short fountain/part/collapse in an isolated prototype, truthfully labeled offline if not live.

**G2–G4:** subsequent separate approvals for genuine server event integration, 2/4-player testing, expanded dismemberment, polish, performance, content disclosures and release.

**Current decision:** G0 planning authorized; implementation, merging and deployment **HOLD**.
