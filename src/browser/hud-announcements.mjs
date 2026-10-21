// Scope routine screen-reader announcements to actual combat events.
// Vital meters refresh frequently; never announce the entire HUD on each tick.
export function installHudAnnouncements(doc) {
  const hud = doc.querySelector(".hud");
  const event = doc.querySelector("#event-text");
  if (!hud || !event) return null;

  // Existing assertive threat/combat-overlay regions keep their own priority.
  hud.setAttribute("aria-live", "off");
  event.setAttribute("role", "status");
  event.setAttribute("aria-live", "polite");
  event.setAttribute("aria-atomic", "true");
  return event;
}
