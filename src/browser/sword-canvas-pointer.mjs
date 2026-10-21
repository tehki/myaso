// Convert native pointer client coordinates to the *backing pixels* of the
// arena canvas. The same coordinate space must be used by Graphics' rendered
// per-sword hit shapes before passing the point to createSwordPointerGate.
// This is a presentation-only conversion: no pickup, action or network calls.
export function swordPointerCanvasPoint(event, canvas) {
  if (!Number.isFinite(event?.clientX) || !Number.isFinite(event?.clientY)
    || !canvas || !Number.isSafeInteger(canvas.width)
    || !Number.isSafeInteger(canvas.height)
    || canvas.width <= 0 || canvas.height <= 0
    || typeof canvas.getBoundingClientRect !== "function") return null;

  let rect;
  try { rect = canvas.getBoundingClientRect(); } catch { return null; }
  if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top)
    || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)
    || rect.width <= 0 || rect.height <= 0) return null;

  const nx = (event.clientX - rect.left) / rect.width;
  const ny = (event.clientY - rect.top) / rect.height;
  // Do not reserve Combat's attack when the actual pointer is outside
  // the rendered canvas. A failed coordinate conversion is not an item hit.
  if (!(nx >= 0 && nx < 1 && ny >= 0 && ny < 1)) return null;
  const x = nx * canvas.width;
  const y = ny * canvas.height;
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}
