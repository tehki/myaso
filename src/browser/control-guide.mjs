// Progressive disclosure for the existing combat instructions. Moving the
// original element preserves every binding description and future changes.
// Never intercept keyboard, pointer, or wheel events on the combat canvas.
export function installControlGuide(doc) {
  const controls = doc.querySelector(".masthead .controls");
  if (!controls || !controls.parentElement) return null;
  if (controls.parentElement.tagName === "DETAILS") return controls.parentElement;

  const details = doc.createElement("details");
  details.className = "control-guide";
  const summary = doc.createElement("summary");
  const title = doc.createElement("strong");
  title.textContent = "Controls";
  const essentials = doc.createElement("span");
  essentials.className = "control-guide-essentials";
  essentials.textContent = "WASD move · Mouse aim · LMB release attack · RMB kick/run · Wheel roll/parry · Space jump";
  summary.append(title, essentials);

  controls.parentElement.insertBefore(details, controls);
  details.append(summary, controls);

  if (doc.head && !doc.querySelector("link[data-control-guide-style]")) {
    const stylesheet = doc.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "./control-guide.css";
    stylesheet.setAttribute("data-control-guide-style", "");
    doc.head.appendChild(stylesheet);
  }
  return details;
}
