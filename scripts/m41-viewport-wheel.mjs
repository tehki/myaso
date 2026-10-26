// Native acceptance only: one real W3C wheel-back at the canvas center.
// Does not dispatch synthetic DOM input or modify source0/World/QUIC.
export function planM41ViewportWheel({ arena, wheelId }) {
  if (!arena || !/^wheel-(firefox|chrome)$/.test(wheelId)
    || !["left", "top", "right", "bottom", "width", "height",
      "innerWidth", "innerHeight"].every(key => Number.isFinite(arena[key]))) {
    throw new TypeError("M41 requires authentic visible browser canvas bounds and W3C wheel source");
  }
  const { left, right, top, bottom, width, height, innerWidth, innerHeight } = arena;
  if (width <= 0 || height <= 0 || innerWidth <= 0 || innerHeight <= 0
    || left < 0 || top < 0 || right > innerWidth || bottom > innerHeight
    || Math.abs(right - left - width) > 1 || Math.abs(bottom - top - height) > 1) {
    throw new RangeError("M41 requires full real arena visibility in the viewport");
  }
  const x = Math.round(left + width / 2);
  const y = Math.round(top + height / 2);
  if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) {
    throw new RangeError("M41 native wheel must remain inside the real viewport");
  }
  return { actions: [{
    type: "wheel", id: wheelId,
    actions: [{type: "scroll", origin: "viewport", x, y,
      deltaX: 0, deltaY: 120, duration: 0}],
  }] };
}
