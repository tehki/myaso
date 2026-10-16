import { parseAlphaConfig, alphaPlayPath } from "./alpha-config.mjs";

const play = document.querySelector("#join-arena");
const status = document.querySelector("#server-status");
const cap = document.querySelector("#alpha-cap");
const invite = document.querySelector("#copy-invite");
const shareStatus = document.querySelector("#share-status");

play.disabled = true;
status.textContent = "Checking the arena configuration…";
try {
  if (!window.isSecureContext || typeof WebTransport !== "function") {
    throw new Error("This browser needs HTTPS and WebTransport support.");
  }
  const response = await fetch("/game-config.json", { cache: "no-store" });
  if (!response.ok) throw new Error("The arena is not configured yet.");
  const config = parseAlphaConfig(await response.json(), window.location.hostname);
  cap.textContent = `One shared arena · Up to ${config.maxPlayers} fighters`;
  play.disabled = false;
  status.textContent = "Arena configured. Join to start multiplayer.";
  play.addEventListener("click", () => {
    play.disabled = true;
    status.textContent = "Connecting to the multiplayer arena…";
    window.location.assign(alphaPlayPath(config));
  });
} catch (error) {
  status.textContent = `Arena not ready: ${error instanceof Error ? error.message : "unknown error"}`;
}
invite.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(new URL("/web/alpha.html", window.location.origin).href);
    shareStatus.textContent = "Invite link copied.";
  } catch {
    shareStatus.textContent = "Copy the address in the browser to invite a friend.";
  }
});
