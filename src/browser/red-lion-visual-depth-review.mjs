/**
 * A2.33 Red Lion visual-only draw-order proposal.
 *
 * This is not a server/world collision rule or an enabled runtime renderer.
 * It works only with candidate world positions from an existing authoritative
 * snapshot; it NEVER changes positions, hitboxes, packets, movement or portals.
 */
export const RED_LION_DEPTH_REVIEW = Object.freeze({
  visualDoorWorldX: 4365,
  visualDoorWorldY: 4075,
  authoritativeWorldEntranceY: 4060,
  boundaryRule: "feet at or south of visual door plane = in front of facade",
  productionApproved: false,
});

function finite(name, n) {
  if (!Number.isFinite(n)) throw new TypeError(name + " must be finite");
  return n;
}

/**
 * @param {object} args
 * @param {Array<{id: string|number, x:number, y:number}>} args.actors
 * @param {number} [args.visualPlaneY=4075] Visual artist-authored plane;
 *  NOT server-backed interior/portal/collision geometry.
 *
 * Returns an immutable staged plan: actors behind facade, facade, actors
 * in front. Identical Y uses stable string actor ID as tie-breaker.
 */
export function createRedLionVisualDepthPlan({
  actors,
  visualPlaneY = RED_LION_DEPTH_REVIEW.visualDoorWorldY,
} = {}) {
  finite("visualPlaneY", visualPlaneY);
  if (!Array.isArray(actors)) throw new TypeError("actors must be an array");
  const seen = new Set();
  const cleaned = actors.map((actor, index) => {
    if (!actor || typeof actor !== "object" || !(
      typeof actor.id === "string" || typeof actor.id === "number"
    )) throw new TypeError("Actor " + index + " lacks id");
    if (String(actor.id).length === 0) throw new TypeError("Empty actor id");
    const id = String(actor.id);
    if (seen.has(id)) throw new TypeError("Duplicate actor id: " + id);
    seen.add(id);
    const x = finite("x", actor.x);
    const y = finite("y", actor.y);
    return Object.freeze({id, x, y, originalIndex:index});
  });
  function order(a,b) {
    return a.y - b.y || a.id.localeCompare(b.id) || a.originalIndex - b.originalIndex;
  }
  const behind = Object.freeze(cleaned.filter(v => v.y < visualPlaneY).sort(order));
  const inFront = Object.freeze(cleaned.filter(v => v.y >= visualPlaneY).sort(order));
  const stageNames = Object.freeze(["background","behind-facade-actors","facade","in-front-of-facade-actors","roof-review"]);
  return Object.freeze({
    visualPlaneY, visualOnly:true, productionApproved:false,
    actualWorldRendererIntegrated:false,
    serverPortalOrCollisionChanged:false,
    thresholdTiePolicy:"front",
    behindFacade:behind, inFrontOfFacade:inFront,
    stageNames,
  });
}
