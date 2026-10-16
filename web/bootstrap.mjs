const params = new URLSearchParams(window.location.search);

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
