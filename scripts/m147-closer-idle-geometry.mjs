import { COMBAT } from "../src/combat/model.mjs";

// Native staging only. Near-equal distances and a 55ms wait were not proof
// that the rendered ordinary focus had converged in the preserved first red.
export function planM147CloserIdleGeometry(victim, punisher, closer) {
  const fighters=[victim,punisher,closer];
  if(fighters.some(f=>!f || !Number.isSafeInteger(f.netId) || f.netId<1 || f.action!==0
    || ![f.x,f.y].every(Number.isFinite)) || new Set(fighters.map(f=>f.netId)).size!==3)
    throw new Error("M147 closer staging requires three distinct actual idle replicas");
  if(!(punisher.x<victim.x && victim.x<closer.x) || closer.x-victim.x>400)
    throw new Error("M147 closer staging lost original bounded left/center/right geometry");
  const desiredGap=COMBAT.attack.reach-24; //52px: clear of collision, distinctly nearer than72px punisher
  const pulse=(key,distance)=>({key,durationMs:Math.max(20,Math.min(180,
    Math.ceil(Math.abs(distance)*1000/COMBAT.moveSpeed)))});
  const dy=victim.y-closer.y;
  if(Math.abs(dy)>4)return pulse(dy>0?"s":"w",dy);
  const error=closer.x-victim.x-desiredGap;
  if(Math.abs(error)>4)return pulse(error>0?"a":"d",error);
  if(Math.hypot(punisher.x-victim.x,punisher.y-victim.y)
    - Math.hypot(closer.x-victim.x,closer.y-victim.y)<12)
    throw new Error("M147 closer replica lacks a distinct ordinary-focus margin");
  return null;
}
