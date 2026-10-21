// Player-owned navigation: passive same-origin anchor only. No network
// commands, combat inputs, wallet actions or session authority mutations.
export function installArenaLobbyLink(doc, { online = false } = {}) {
  const hint = doc.querySelector(".focus-hint");
  if (!hint) return null;
  const existing = hint.querySelector("[data-arena-lobby-link]");
  if (existing) return existing;

  const link = doc.createElement("a");
  link.setAttribute("data-arena-lobby-link", "");
  link.className = "arena-lobby-link";
  link.href = "/web/alpha.html";
  link.textContent = online ? "Leave arena · Multiplayer lobby" : "Multiplayer lobby";
  hint.appendChild(link);

  if (doc.head && !doc.querySelector("link[data-arena-lobby-style]")) {
    const css = doc.createElement("link");
    css.rel = "stylesheet";
    css.href = "./arena-lobby-link.css";
    css.setAttribute("data-arena-lobby-style", "");
    doc.head.appendChild(css);
  }
  return link;
}
