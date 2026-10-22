import { isChatC1Eligible } from "../src/browser/chat-c1-activation.mjs";
import { installLocalChat } from "../src/browser/local-chat.mjs";
const params = new URLSearchParams(window.location.search);
// No chat UI or streams on public origins unless the operator-configured lobby
// adds chatC1=1. Existing loopback preview remains explicitly nonproduction.
if (isChatC1Eligible(window.location)) {
  installLocalChat(document, { online: params.has("server") });
}

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
