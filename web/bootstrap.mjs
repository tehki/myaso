const params = new URLSearchParams(window.location.search);

if (params.has("server")) {
  await import("./online-game.mjs");
} else {
  await import("./game.mjs");
}
