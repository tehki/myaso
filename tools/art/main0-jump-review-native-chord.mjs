// Review-only W3C action plan for the original Rust JumpAttack admission.
// One native request: physical Space DOWN on tick 0, physical LMB DOWN on
// tick 1, release the same LMB, then Space UP. No synthetic DOM/gameplay
// events, no added input owner, and no alteration to the World jump window.
export function planMain0NativeJumpReviewChord({
  keyboardId, pointerId, holdMs = 90,
} = {}) {
  if (typeof keyboardId !== "string" || !keyboardId
    || typeof pointerId !== "string" || !pointerId
    || keyboardId === pointerId
    || !Number.isInteger(holdMs) || holdMs < 45 || holdMs > 120) {
    throw new TypeError("JumpReview requires bounded distinct native W3C sources");
  }
  return {actions:[
    {type:"key",id:keyboardId,actions:[
      {type:"keyDown",value:" "},
      {type:"pause",duration:0},
      {type:"pause",duration:holdMs},
      {type:"pause",duration:0},
      {type:"keyUp",value:" "},
    ]},
    {type:"pointer",id:pointerId,parameters:{pointerType:"mouse"},actions:[
      {type:"pause",duration:0},
      {type:"pointerDown",button:0},
      {type:"pause",duration:holdMs},
      {type:"pointerUp",button:0},
      {type:"pause",duration:0},
    ]},
  ]};
}
