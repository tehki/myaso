// M225: CI-only read-only geometry plan. Fighter positions are genuine
// authoritative snapshot replicas in the centre browser, not mutable game state.
export function planM225ThreatDistanceStaging({fighters, leftId, centerId, rightId, mode}) {
  if (!Array.isArray(fighters) || !["primary","secondary"].includes(mode)
    || ![leftId,centerId,rightId].every(x=>Number.isInteger(x)&&x>0)
    || new Set([leftId,centerId,rightId]).size!==3) {
    throw new TypeError("M225 requires valid genuine three-fighter snapshot");
  }
  const find=(id)=>fighters.find(x=>x.netId===id);
  const l=find(leftId),c=find(centerId),r=find(rightId);
  if (!l||!c||!r||[l,c,r].some(x=>!Number.isFinite(x.x)||!Number.isFinite(x.y))) {
    throw new TypeError("M225 snapshot missing finite authoritative fighter coordinates");
  }
  if (!(l.x<c.x && c.x<r.x)) {
    throw new Error("M225 real fighter order changed before attack");
  }
  const leftDistance=Math.hypot(l.x-c.x,l.y-c.y);
  const rightDistance=Math.hypot(r.x-c.x,r.y-c.y);
  const spread=Math.hypot(r.x-l.x,r.y-l.y);
  // Preserve actual M142 combat reaches: jump 48+18=66, light 76+18=94.
  // Leave ≥95 separation so the right light does not clip the left attacker.
  const primary=mode==="primary";
  // M340: keep a stable safety margin under the unchanged 66px native
  // jump threat radius. Exact merged-main CI #39437391824 accepted 64px in
  // M142 secondary, but late authoritative movement reached 82px before
  // attack, so Firefox correctly rendered only the right-side light.
  const leftTarget=primary?53:57;
  const rightTarget=primary?82:47;
  const inBands=primary
    ? leftDistance>=46 && leftDistance<=60 && rightDistance>=70 && rightDistance<=92
    : leftDistance>=53 && leftDistance<=60 && rightDistance>=40 && rightDistance<=58;
  const correctOrder=primary
    ? leftDistance+8<=rightDistance
    : rightDistance+8<=leftDistance;
  const ready=inBands && correctOrder && spread>=96;
  // Position-only W3C key pulses: this planner never sends gameplay actions.
  const move=(distance,target,toward,away)=>{
    const delta=distance-target;
    if(Math.abs(delta)<=2)return {key:null,ms:0};
    const key=delta>0?toward:away;
    const ms=Math.max(30,Math.min(145,Math.round(Math.abs(delta)*1000/215)));
    return {key,ms};
  };
  return Object.freeze({
    ready,
    leftDistance:Number(leftDistance.toFixed(2)),
    rightDistance:Number(rightDistance.toFixed(2)),
    spread:Number(spread.toFixed(2)),
    correctOrder,
    leftMove:ready?{key:null,ms:0}:move(leftDistance,leftTarget,"d","a"),
    rightMove:ready?{key:null,ms:0}:move(rightDistance,rightTarget,"a","d"),
  });
}


// M340 acceptance-only stable replica certificate. Two consecutive real
// server-replicated snapshots must independently satisfy the unchanged M142
// geometry, and be stationary to within 3px. Never creates or edits fighters.
export function qualifyM340StableThreatGeometry(first, confirmed) {
  if (!first || !confirmed
    || ![first.leftDistance, first.rightDistance,
      confirmed.leftDistance, confirmed.rightDistance].every(Number.isFinite)) {
    throw new TypeError("M340 requires two finite authoritative geometry samples");
  }
  const leftDrift = Math.abs(first.leftDistance - confirmed.leftDistance);
  const rightDrift = Math.abs(first.rightDistance - confirmed.rightDistance);
  return Object.freeze({
    ready: first.ready === true && confirmed.ready === true
      && leftDrift <= 3 && rightDrift <= 3,
    leftDrift: Number(leftDrift.toFixed(2)),
    rightDrift: Number(rightDrift.toFixed(2)),
  });
}
