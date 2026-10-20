import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { installHudAnnouncements } from "../src/browser/hud-announcements.mjs";

function el() {
  return {
    attributes: new Map(),
    textContent: "",
    setAttribute(name, value) { this.attributes.set(name, value); },
    getAttribute(name) { return this.attributes.get(name) ?? null; },
  };
}
function fixture({ withHud = true, withEvent = true } = {}) {
  const hud = el();
  const event = el();
  const threat = el();
  const overlay = el();
  hud.setAttribute("aria-live", "polite");
  threat.setAttribute("aria-live", "assertive");
  overlay.setAttribute("aria-live", "assertive");
  event.textContent = "Enter the arena.";
  const doc = {
    querySelector(selector) {
      if (selector === ".hud") return withHud ? hud : null;
      if (selector === "#event-text") return withEvent ? event : null;
      throw new Error("Unexpected selector: " + selector);
    },
  };
  return { hud, event, threat, overlay, doc };
}

test("U4 scopes routine live updates to an atomic event status", () => {
  const { hud, event, doc } = fixture();
  assert.equal(installHudAnnouncements(doc), event);
  assert.equal(hud.getAttribute("aria-live"), "off");
  assert.equal(event.getAttribute("role"), "status");
  assert.equal(event.getAttribute("aria-live"), "polite");
  assert.equal(event.getAttribute("aria-atomic"), "true");
  assert.equal(event.textContent, "Enter the arena.");
});

test("U4 preserves urgent threat and defeat announcements and is idempotent", () => {
  const { hud, event, threat, overlay, doc } = fixture();
  const first = installHudAnnouncements(doc);
  assert.equal(installHudAnnouncements(doc), first);
  assert.equal(hud.getAttribute("aria-live"), "off");
  assert.equal(event.getAttribute("aria-live"), "polite");
  assert.equal(threat.getAttribute("aria-live"), "assertive");
  assert.equal(overlay.getAttribute("aria-live"), "assertive");
});

test("U4 no-ops if the HUD or event region is missing", () => {
  for (const args of [{ withHud: false }, { withEvent: false }]) {
    const { hud, event, doc } = fixture(args);
    assert.equal(installHudAnnouncements(doc), null);
    assert.equal(hud.getAttribute("aria-live"), "polite");
    assert.equal(event.getAttribute("role"), null);
  }
});

test("U4 preserves real markup's urgent live regions and removes nested chatter at bootstrap", () => {
  const html = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
  const bootstrap = readFileSync(new URL("../web/bootstrap.mjs", import.meta.url), "utf8");
  assert.match(html, /id="threat-cue"[^>]+aria-live="assertive"/);
  assert.match(html, /id="combat-overlay"[^>]+aria-live="assertive"/);
  assert.match(bootstrap, /installHudAnnouncements\(document\)/);
  assert.ok(bootstrap.indexOf("installHudAnnouncements(document)") < bootstrap.indexOf('if (params.has("server"))'));
});
