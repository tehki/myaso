import { installControlGuide } from "../src/browser/control-guide.mjs";
import { installArenaFocusGuide } from "../src/browser/arena-focus-guide.mjs";
import { installHudAnnouncements } from "../src/browser/hud-announcements.mjs";
import { installReducedMotionFeedback } from "../src/browser/reduced-motion-feedback.mjs";
import { installArenaLobbyLink } from "../src/browser/arena-lobby-link.mjs";
import { installForcedColorsReadability } from "../src/browser/forced-colors-readability.mjs";
installControlGuide(document);
installHudAnnouncements(document);
installReducedMotionFeedback(document);
installForcedColorsReadability(document);

const params = new URLSearchParams(window.location.search);
installArenaFocusGuide(document, { online: params.has("server") });
installArenaLobbyLink(document, { online: params.has("server") });

if (params.has("server")) {
  try {
    await import("./online-game.mjs");
  } catch (error) {
    console.error("Unable to establish authoritative game session", error);
    const status = document.querySelector("#event-text");
    if (status) status.textContent = "Multiplayer connection failed. Return to the lobby and retry.";
    const hint = document.querySelector(".focus-hint");
    if (hint) {
      const link = document.createElement("a");
      link.href = "/web/alpha.html";
      link.textContent = "Return to multiplayer lobby";
      hint.replaceChildren(link);
    }
  }
} else {
  await import("./game.mjs");
}
