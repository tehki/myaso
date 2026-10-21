// Context-only canvas focus guidance. Never intercept or synthesize game input.
export function installArenaFocusGuide(doc, { online = false } = {}) {
  const canvas = doc.querySelector("#arena");
  const hint = doc.querySelector(".focus-hint");
  if (!canvas || !hint) return null;

  const existing = hint.querySelector("[data-arena-focus-guide]");
  if (existing) return existing;

  const label = doc.createElement("span");
  label.setAttribute("data-arena-focus-guide", "");
  label.setAttribute("aria-live", "off");
  hint.replaceChildren(label);

  const render = () => {
    // Multiplayer bootstrap replaces this hint with a recovery link on failure.
    // Late canvas focus/blur must never undo that authoritative failure UI.
    if (label.parentElement !== hint) return;
    const focused = doc.activeElement === canvas;
    hint.dataset.arenaFocus = focused ? "active" : "awaiting";
    label.textContent = focused
      ? (online
        ? "Online arena focused · WASD move · Mouse aim · Release LMB to strike."
        : "Practice arena focused · WASD move · Mouse aim · Release LMB to strike.")
      : "Click or Tab to the arena to focus combat controls.";
  };
  canvas.addEventListener("focus", render);
  canvas.addEventListener("blur", render);
  render();

  if (doc.head && !doc.querySelector("link[data-arena-focus-style]")) {
    const css = doc.createElement("link");
    css.rel = "stylesheet";
    css.href = "./arena-focus-guide.css";
    css.setAttribute("data-arena-focus-style", "");
    doc.head.appendChild(css);
  }
  return label;
}
