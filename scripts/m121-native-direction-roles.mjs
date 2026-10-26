// NONRELEASE, M121 native acceptance only. Derive physical left/right
// attack roles from actual server-assigned actors, not browser launch order.
// No synthetic position, DOM event, source0 packet or World action is made.
export function selectM121NativeRoles(ready, direction = "right") {
  if (direction !== "right" && direction !== "left") {
    throw new TypeError("M121 requires explicit original right or mirrored left native trial");
  }
  if (!Array.isArray(ready) || ready.length !== 2
    || ready.some(actor => !actor || typeof actor.browser !== "string"
      || !["chrome", "firefox"].includes(actor.browser)
      || !Number.isSafeInteger(actor.playerNetId) || actor.playerNetId < 1)
    || new Set(ready.map(actor => actor.browser)).size !== 2
    || new Set(ready.map(actor => actor.playerNetId)).size !== 2) {
    throw new TypeError("M121 requires two distinct genuine native player identities");
  }
  const actors = [...ready].sort((a, b) => a.playerNetId - b.playerNetId);
  // The first and second authenticated fighters are not reordered or moved;
  // only which real W3C browser performs a strict attack is selected.
  const attacker = direction === "right" ? actors[0] : actors[1];
  const defender = direction === "right" ? actors[1] : actors[0];
  return {
    attackerName: attacker.browser,
    defenderName: defender.browser,
    attackerNetId: attacker.playerNetId,
    defenderNetId: defender.playerNetId,
    expectedStrafeCode: direction === "right" ? "KeyW" : "KeyS",
    direction,
  };
}
