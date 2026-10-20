// High-contrast presentation only; no event listeners or gameplay hooks.
export function installForcedColorsReadability(doc) {
  if (!doc.head) return null;
  const prior = doc.querySelector("link[data-forced-colors-readability]");
  if (prior) return prior;

  const link = doc.createElement("link");
  link.rel = "stylesheet";
  link.href = "./forced-colors-readability.css";
  link.setAttribute("data-forced-colors-readability", "");
  doc.head.appendChild(link);
  return link;
}
