/**
 * Graphics 3A — read-only First Playable Knight authored-action inventory.
 * No network state, render dispatch, timers, or gameplay changes.
 *
 * This audit is intentionally pessimistic: Combat fallback tells and T1 NPC
 * attack/block atlases cannot make a Silver HUMAN action "authored".
 */
import {COMBAT_ACTION} from "../../src/browser/combat-readability.mjs";
import {COMBAT} from "../../src/combat/model.mjs";
import {KNIGHT_CLIPS,knightClip} from "../../web/knight-sprites.mjs";

const row=(action,{family,clip=null,ms=null,priority="P0",next="author",event="snapshot-action",note=""})=>
 Object.freeze({name:action,id:COMBAT_ACTION[action],family,clip,
  classification:clip?"AUTHORED":"MISSING / FALLBACK",
  ms,priority,next,event,note,
  directions:clip?8:0,visualReady:!!clip && action!=="dodge" && action!=="dodgeRecovery"});
const a=COMBAT_ACTION,c=COMBAT;
export const SILVER_KNIGHT_ACTION_GAPS=Object.freeze([
row("idle",{family:"locomotion",clip:"silver_idle",ms:"until movement/action",next:"verify-grounding",note:"idle atlas: 4 frames; idle numeric state also selects authored walk/sprint when moving"}),
row("attackWindup",{family:"light-attack",ms:c.attack.windupMs,note:"distinct anticipation / hand grip required"}),
row("attackActive",{family:"light-attack",ms:c.attack.activeMs,note:"distinct true strike/impact required"}),
row("attackRecovery",{family:"light-attack",ms:c.attack.recoveryMs,note:"follow-through / stagger required"}),
row("dodge",{family:"roll",clip:"silver_roll",ms:c.dodge.durationMs,next:"correct-contact",note:"same 8-phase atlas shared with dodgeRecovery; true 170ms active boundary not encoded in sprite frames"}),
row("dodgeRecovery",{family:"roll",clip:"silver_roll",ms:c.dodge.recoveryMs,next:"correct-contact",note:"350ms continuous preview timing; actual visual foot/hand ground contact unapproved"}),
row("block",{family:"defense",ms:c.block.shortBlockMs,note:"human Silver has NO block atlas; T1 authentic NPC block doesn't apply to humans"}),
row("stunned",{family:"disruption",ms:"authoritative cause-dependent",note:"guard-break/parry stun often 650ms; do not invent universal stun time"}),
row("dead",{family:"death",ms:`respawn follows ${c.respawnMs}ms`,note:"no Silver death/respawn atlas"}),
row("heavyAttackWindup",{family:"heavy-attack",ms:c.heavyAttack.windupMs,note:"distinct weighted load-up"}),
row("heavyAttackActive",{family:"heavy-attack",ms:c.heavyAttack.activeMs,note:"distinct heavy contact"}),
row("heavyAttackRecovery",{family:"heavy-attack",ms:c.heavyAttack.recoveryMs,note:"visible vulnerability"}),
row("kickWindup",{family:"kick",ms:c.kick.windupMs,priority:"P0-FIRST",next:"kick-blender-8way",note:"leg anticipation + planted balancing foot"}),
row("kickActive",{family:"kick",ms:c.kick.activeMs,priority:"P0-FIRST",next:"kick-blender-8way",note:"70ms genuine leg strike, no phantom weapon"}),
row("kickRecovery",{family:"kick",ms:c.kick.recoveryMs,priority:"P0-FIRST",next:"kick-blender-8way",note:"retract leg + grounded stance"}),
row("jump",{family:"jump",clip:"silver_jump",ms:c.jump.durationMs,next:"verify-grounding",note:"6-frame original source; verify actual server-phase landing/airborne"}),
row("jumpAttackWindup",{family:"jump-attack",ms:c.jumpAttack.windupMs,note:"airborne attack pose distinct from simple jump"}),
row("jumpAttackActive",{family:"jump-attack",ms:c.jumpAttack.activeMs,note:"airborne hit confirmed by Combat"}),
row("jumpAttackRecovery",{family:"jump-attack",ms:c.jumpAttack.recoveryMs,note:"grounded landing/strike recovery"}),
row("knockdown",{family:"disruption",ms:"source event-dependent",note:"kick 360ms; roll collision 520ms; do not hardcode one generic timer"}),
row("feintRecovery",{family:"defense",ms:c.feint.recoveryMs,note:"cancel/disengage cue"}),
row("runningAttackWindup",{family:"running-attack",ms:c.runningAttack.windupMs,note:"forward velocity / weapon tell"}),
row("runningAttackActive",{family:"running-attack",ms:c.runningAttack.activeMs,note:"genuine running impact"}),
row("runningAttackRecovery",{family:"running-attack",ms:c.runningAttack.recoveryMs,note:"momentum deceleration"}),
row("attackLeftWindup",{family:"directional-attack",ms:c.directionalAttack.windupMs,note:"separate left swing/side"}),
row("attackLeftActive",{family:"directional-attack",ms:c.directionalAttack.activeMs,note:"left contact cue"}),
row("attackLeftRecovery",{family:"directional-attack",ms:c.directionalAttack.recoveryMs,note:"left follow-through"}),
row("attackRightWindup",{family:"directional-attack",ms:c.directionalAttack.windupMs,note:"separate right swing/side"}),
row("attackRightActive",{family:"directional-attack",ms:c.directionalAttack.activeMs,note:"right contact cue"}),
row("attackRightRecovery",{family:"directional-attack",ms:c.directionalAttack.recoveryMs,note:"right follow-through"}),
row("dash",{family:"dash",ms:c.dash.durationMs,priority:"P0-FIRST",next:"dash-blender-8way",note:"distinct rapid lean/lunge, not sprint or roll; 140ms authoritative displacement"})
].sort((x,y)=>x.id-y.id));

export function auditKnightCoverage(){
 const entries=Object.entries(a);
 const byId=new Map(SILVER_KNIGHT_ACTION_GAPS.map(r=>[r.id,r]));
 if(entries.length!==31 || byId.size!==31 ||
    entries.some(([name,id])=>byId.get(id)?.name!==name))
  throw new Error("Combat changed; 3A must explicitly re-audit every enum member");
 for(const item of SILVER_KNIGHT_ACTION_GAPS){
  if(item.clip && (!KNIGHT_CLIPS[item.clip]||knightClip(item.id,"player")!==item.clip))
   throw new Error("Existing authored Silver clip mapping drifted: "+item.name);
  if(!item.clip && knightClip(item.id,"player")!==null)
   throw new Error("Unsupported Silver state camouflaged by non-null renderer: "+item.name);
 }
 return Object.freeze({total:31,authored:SILVER_KNIGHT_ACTION_GAPS.filter(r=>r.clip).length,
  missing:SILVER_KNIGHT_ACTION_GAPS.filter(r=>!r.clip).length,
  kickAndDashMissing:SILVER_KNIGHT_ACTION_GAPS.filter(r=>r.next==="kick-blender-8way"||
    r.next==="dash-blender-8way").length});
}
export function renderKnightGapMarkdown(){
 const stats=auditKnightCoverage();
 const lines=[
  "# Graphics 3A — P0 Silver Knight 31-action authentic animation gap matrix",
  "",
  "**Scope and baseline:** `main` `COMBAT_ACTION` 0–30 from `src/browser/combat-readability.mjs`; real original Silver/T1 atlas list from `web/knight-sprites.mjs`; authoritative durations from `src/combat/model.mjs`. Audit is source-only. No Combat, client renderer, item grant, NPC identity or server changes.",
  "",
  `**Status: ${stats.authored}/31 numerically mapped to original Silver art; ${stats.missing}/31 currently MISSING the required authored Silver action clips.** Even the four mapped states are NOT a proven integrated gameplay/ground-contact pass; roll art and pickup equipment remain separately on visual HOLD.`,
  "",
  "| ID | Server action | Family | Silver source clip | Source authoring / eight directions | Server phase / ms | Status | Next action |",
  "| ---: | --- | --- | --- | --- | --- | --- | --- |"
 ];
 for(const r of SILVER_KNIGHT_ACTION_GAPS){
  const source=r.clip?`${r.clip} (${KNIGHT_CLIPS[r.clip]}×8 atlas)`:"**none**";
  const status=r.clip?"AUTHORED SOURCE / still QA-required":"**MISSING — truthful Combat fallback only**";
  lines.push(`| ${r.id} | \`${r.name}\` | ${r.family} | ${source} | ${r.directions}/8 if authored | ${r.ms??"cause-dependent"} | ${status} | ${r.next} |`);
 }
 lines.push("",
 "## First real source/atlas deliverables (owner directive #542)",
 "",
 "**Kick:** build a first-party editable 22-bone Silver Blender source containing distinct 90ms anticipation, 70ms contacting leg kick, 220ms return; export original transparent 160px frames for *all 8 directions* and decode in native Chrome/Firefox. **Dash:** separate physically believable 140ms leaning/lunging animation (not looped sprint or 350ms roll), eight directions and no fake visual displacement from the Combat hitbox. Start with actual Blender action clips; never claim readiness from a fallback, rig JSON, tests, or unreviewed atlas alone.",
 "",
 "**Visual phase sync:** local and remote **human** Silver use the same authoritative action-state/phase. Local input intent, prediction or packet retry are NOT accepted action events. Combat/Core controls 170ms dodge +180ms recovery, 140ms dash, kick 90/70/220; do not alter server movement or hitboxes to match art. Original T1 Sentinel sprite attack/block is available only for a verified NPC, not a remote human. Source Silver has `silver_walk` and `silver_sprint` as **idle-state locomotion** (speed-based), not separate numeric Combat actions.",
 "",
 "## Non-enum events and interactions — DO NOT counterfeit receipts",
 "",
 "| Interaction / event | Authoritative source | Current authentic Silver state | Action needed |",
 "| --- | --- | --- | --- |",
 "| Run/sprint | verified movement + speed while action 0 | `silver_walk` / `silver_sprint` (8-way), grounding QA open | start/stop transitions, slide metrics |",
 "| Confirmed parry / guard-break / hit | verified Combat/Core outcome, not a new enum number | no dedicated first-party Silver atlas | design outcome-specific reaction; never predict success |",
 "| Death→new spawn | verified Combat/Core transition | no death/respawn art | defeat/get-up/reset, prevent old pose on new actor |",
 "| Pickup/reach/grip | verified **Items/Core committed world→MainHand** receipt (not click) | MISSING authored pickup; no live public ACK | author 8-way reach now, trigger only on approved accepted receipt |",
 "| Equip/unequip/sheathe/drop | canonical actor-bound Core/Items current item snapshot + monotonic revision | no complete authentic grip transitions; sword review only | align physical held/original 3B item visuals; avoid double sword |",
 "| Open/interaction | actually implemented World/Core confirmed event | no authenticated Silver clip | do not invent unimplemented door/game mechanic |",
 "",
 "## QA and release gates",
 "",
 "All 31 action values and unknown values must be explicitly covered by tests. Art must include Blender editable clip, first-party atlas, eight directions, natural anticipation/contact/recovery, foot/ground/shoulder silhouette, true camera 0.84 / 120% Standing 96px / Roll 134px, real native Chrome and Firefox preview, and at least one **authenticated `online-game.mjs` local + remote Silver** acceptance for each P0 action family. Current source-only previews are insufficient for PLAYABLE. No NPC relabeling, no pre-commit item visual, no protected CI bypass, no autonomous merge or deployment.",
 "",
 "**Order:** Kick + dash original source PR first; then directional/light/heavy/running/jump attack; guard/parry and disruption/death; P1 pickup/receipt integration; P2 adult masculine/feminine separate. The original adult work [#421](https://github.com/tehki/myaso/issues/421) remains active but not an Alpha release gate.",
 "",
 "**Owner/coordination:** Graphics 3A + [#542](https://github.com/tehki/myaso/issues/542), [#344](https://github.com/tehki/myaso/issues/344); central [#360](https://github.com/tehki/myaso/issues/360); Alpha [#480](https://github.com/tehki/myaso/issues/480). **Readiness: MATRIX IMPLEMENTED/TESTABLE; 27 ANIMATION STATES MISSING; INTEGRATION BLOCKED.**",
 "");
 return lines.join("\n");
}
if(process.argv[1] && new URL("file://"+process.argv[1].replaceAll("\\","/")).pathname.toLowerCase()
     ===new URL(import.meta.url).pathname.toLowerCase()){
 const info=auditKnightCoverage();
 if(process.argv.includes("--markdown"))process.stdout.write(renderKnightGapMarkdown());
 else process.stdout.write(JSON.stringify(info)+"\n");
}
