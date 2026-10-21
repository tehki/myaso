// Progressive enhancement: respect OS reduced-motion preference in the
// existing arena without intercepting game events or changing simulations.
export function installReducedMotionFeedback(doc) {
  if (!doc.head) return null;
  const existing = doc.querySelector("link[data-reduced-motion-feedback]");
  if (existing) return existing;
  const link = doc.createElement("link");
  link.rel = "stylesheet";
  link.href = "./reduced-motion-feedback.css";
  link.setAttribute("data-reduced-motion-feedback", "");
  doc.head.appendChild(link);
  return link;
}
