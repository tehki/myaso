// One fresh physical Space may join one fresh Light within the existing
// 60ms physical chord bound, even when the fast Space sender already ran.
export function createPhysicalJumpChord() {
 let pressedAt=null;
 return Object.freeze({
  press(now,trusted) { pressedAt=trusted&&Number.isFinite(now)?now:null; },
  consume(now,held) {
   const start=pressedAt;pressedAt=null;
   return held&&start!==null&&Number.isFinite(now)&&now>=start&&now-start<=60;
  },
  release() { pressedAt=null; },
 });
}
