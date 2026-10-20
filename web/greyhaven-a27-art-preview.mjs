// Blood & Iron A2.7 – a standalone, non-game art-layer viewer.
// No imports from the combat renderer, no authoritative world coordinates,
// no combat input, no persisted state and no production asset activation.
const root = document;
const canvas = root.getElementById("review");
const ctx = canvas.getContext("2d", {alpha: false});
const building = root.getElementById("building");
const roofSlider = root.getElementById("roof");
const roofValue = root.getElementById("roof-value");
const markerToggle = root.getElementById("marker");
const roofFront = root.getElementById("roof-front");
const status = root.getElementById("status");
const reset = root.getElementById("reset");

const artPrefix = "../assets/environment/greyhaven/a26-review/";
const allowed = new Set(["red_lion", "gable_merchant", "blacksmith"]);
const imageCache = new Map();
let report = null;
let current = null;
let marker = {x: 0, y: 0};
// Don't put the illustrative silhouette across Blacksmith's visual doorway.
// A separate cross still marks the measured visual door-ground reference.
function initialMarkerPosition(slug) {
  return slug === "blacksmith" ? {x: 98, y: 58} : {x: 0, y: 0};
}
let dragging = false;
let scheduled = false;
let lastDrawMs = 0;
let currentDecodeMs = 0;

function validLayerFilename(file, slug, layer) {
  return file === slug + "_a26_" + layer + ".webp";
}
function drawGrid() {
  const {width, height} = canvas;
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#586c66");
  sky.addColorStop(1, "#667360");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(220,229,202,.09)";
  ctx.lineWidth = 1;
  for(let x = 0; x <= width; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for(let y = 0; y <= height; y += 32) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
}
function markerShape(x, y) {
  // Deliberately a diagram silhouette, NOT a game knight or collision shape.
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath(); ctx.ellipse(0, 0, 17, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#c8ae74";
  ctx.strokeStyle = "#473323";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-9, -3); ctx.lineTo(-11, -30);
  ctx.lineTo(0, -41); ctx.lineTo(11, -30); ctx.lineTo(9, -3);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#f3d99b";
  ctx.beginPath(); ctx.arc(0, -39, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function artDoorCross(x, y) {
  ctx.save();
  ctx.strokeStyle = "#ffda82";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y);
  ctx.moveTo(x, y - 9); ctx.lineTo(x, y + 9); ctx.stroke();
  ctx.restore();
}
function render() {
  scheduled = false;
  const start = performance.now();
  drawGrid();
  if (current) {
    const cx = canvas.width / 2, cy = canvas.height / 2;
    for (const name of ["base", "roof"]) {
      const {image, layer} = current[name];
      const [offsetX, offsetY] = layer.drawOffsetPixelsFromVisualDoor;
      if (name === "base") {
        ctx.drawImage(image, Math.round(cx + offsetX), Math.round(cy + offsetY));
        if (markerToggle.checked && roofFront.checked) markerShape(cx + marker.x, cy + marker.y);
      } else {
        ctx.save();
        ctx.globalAlpha = Number(roofSlider.value) / 100;
        ctx.drawImage(image, Math.round(cx + offsetX), Math.round(cy + offsetY));
        ctx.restore();
      }
    }
    if (markerToggle.checked) {
      if (!roofFront.checked) markerShape(cx + marker.x, cy + marker.y);
      artDoorCross(cx, cy);
    }
    ctx.fillStyle = "rgba(17,22,21,.8)";
    ctx.fillRect(12, 12, 530, 49);
    ctx.font = "15px system-ui";
    ctx.fillStyle = "#f8e8c9";
    ctx.fillText("A2.6 3/4 art layers · no game XY registration", 25, 32);
    ctx.font = "12px system-ui";
    ctx.fillStyle = "#d2c7b3";
    ctx.fillText("Manual roof fade · 640px source · original door anchor (320,320)", 25, 50);
  }
  lastDrawMs = performance.now() - start;
  canvas.dataset.lastRenderMs = lastDrawMs.toFixed(3);
}
function requestRender() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(render);
}
function setStatus(message, state) {
  status.textContent = message;
  status.dataset.state = state;
}
async function loadImage(slug, layer, entry) {
  if (!validLayerFilename(entry.filename, slug, layer)) {
    throw new Error("Invalid local art filename");
  }
  const url = new URL(artPrefix + entry.filename, import.meta.url);
  if (imageCache.has(url.href)) return imageCache.get(url.href);
  const img = new Image();
  img.decoding = "async";
  img.src = url.href;
  await img.decode();
  if (img.naturalWidth !== entry.cropPixels[0] ||
      img.naturalHeight !== entry.cropPixels[1]) {
    throw new Error("WebP crop geometry does not match the measured report");
  }
  imageCache.set(url.href, img);
  return img;
}
async function selectBuilding(slug) {
  if (!report || !allowed.has(slug)) throw new Error("Unknown preview building");
  const data = report.buildings[slug];
  if (!data || data.gameWorldDoorPositionValidated !== false ||
      data.spriteFeetPivotValidatedInBrowser !== false) {
    throw new Error("Unexpected art metadata");
  }
  setStatus("Decoding locally authored " + slug + " WebP layers…", "loading");
  const start = performance.now();
  const [baseImage, roofImage] = await Promise.all([
    loadImage(slug, "base", data.layers.base),
    loadImage(slug, "roof", data.layers.roof)
  ]);
  currentDecodeMs = performance.now() - start;
  current = {
    slug,
    base: {image: baseImage, layer: data.layers.base},
    roof: {image: roofImage, layer: data.layers.roof}
  };
  building.value = slug;
  marker = initialMarkerPosition(slug);
  requestRender();
  const byteCount = data.combinedWebPBytes;
  const failNote = "Visual pivot ONLY; world XY, real roof occlusion and FPS unverified.";
  setStatus(slug.replaceAll("_"," ") + " · 2 decoded WebPs · " +
    byteCount.toLocaleString() + " encoded bytes · decode " +
    currentDecodeMs.toFixed(1) + " ms · " + failNote, "ready");
  canvas.dataset.loadedBuilding = slug;
  canvas.dataset.decodedBytes = String(byteCount);
  canvas.dataset.alphaReview = "manual-only";
}
async function initialize() {
  try {
    const response = await fetch(new URL(
      artPrefix + "greyhaven_a26_webp_report.json", import.meta.url), {cache:"no-store"});
    if (!response.ok) throw new Error("HTTP " + response.status);
    report = await response.json();
    if (report.browserGameXYAligned !== false ||
        report.browserRuntimeIntegrated !== false ||
        report.roofOcclusionValidated !== false ||
        report.productionApproved !== false) {
      throw new Error("Expected offline review-only A2.6 report");
    }
    await selectBuilding(building.value);
  } catch (error) {
    console.error("Greyhaven art-only preview failed", error);
    setStatus("Cannot load art layers. Serve the repository over HTTP. " + error.message, "error");
  }
}
building.addEventListener("change", () => selectBuilding(building.value).catch(error => {
  setStatus("Art loading failed: " + error.message, "error");
}));
roofSlider.addEventListener("input", () => {
  roofValue.value = roofSlider.value + "%";
  requestRender();
});
for (const toggle of [markerToggle, roofFront]) toggle.addEventListener("change", requestRender);
reset.addEventListener("click", () => {
  roofSlider.value = "100";
  roofValue.value = "100%";
  markerToggle.checked = true;
  roofFront.checked = true;
  marker = initialMarkerPosition(current?.slug);
  requestRender();
});
function atCanvas(event) {
  const b = canvas.getBoundingClientRect();
  return {
    x:(event.clientX - b.left) * canvas.width / b.width - canvas.width / 2,
    y:(event.clientY - b.top) * canvas.height / b.height - canvas.height / 2
  };
}
canvas.addEventListener("pointerdown", event => {
  if (!current || !markerToggle.checked) return;
  dragging = true;
  canvas.setPointerCapture(event.pointerId);
  marker = atCanvas(event);
  requestRender();
});
canvas.addEventListener("pointermove", event => {
  if (!dragging) return;
  marker = atCanvas(event);
  requestRender();
});
for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) {
  canvas.addEventListener(name, () => {dragging = false;});
}
// Lightweight diagnostic hook for localhost browser acceptance; read-only snapshot.
window.__greyhavenArtReview = () => ({
  loadedBuilding: current?.slug ?? null,
  status: status.dataset.state,
  roofOpacity: Number(roofSlider.value)/100,
  roofFront: roofFront.checked,
  markerShown: markerToggle.checked,
  testSilhouetteOffsetFromVisualDoor: {...marker},
  lastCanvasRenderMs: lastDrawMs,
  decodeMs: currentDecodeMs,
  artOnly: true,
  gameXYCompatible: false,
  authoritativePortalIntegrated: false
});
requestRender();
initialize();
