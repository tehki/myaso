import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installForcedColorsReadability } from "../src/browser/forced-colors-readability.mjs";

function fixture() {
  const head = { children: [], appendChild(node) { this.children.push(node); } };
  return {
    head,
    doc: {
      head,
      querySelector(selector) {
        assert.equal(selector, "link[data-forced-colors-readability]");
        return head.children.find(n => n.attributes?.has("data-forced-colors-readability")) || null;
      },
      createElement(tag) {
        return { tagName: tag.toUpperCase(), attributes: new Map(),
          setAttribute(key,value) { this.attributes.set(key,value); } };
      },
    },
  };
}

test("U7 installs the forced-colors stylesheet at most once", () => {
  const { doc, head } = fixture();
  const first = installForcedColorsReadability(doc);
  assert.equal(first.tagName, "LINK");
  assert.equal(first.rel, "stylesheet");
  assert.equal(first.href, "./forced-colors-readability.css");
  assert.equal(installForcedColorsReadability(doc), first);
  assert.equal(head.children.length, 1);
});

test("U7 no-ops if no document head is available", () => {
  const { doc } = fixture();
  doc.head = null;
  assert.equal(installForcedColorsReadability(doc), null);
});

test("U7 system-color styles keep meters and focus visible without new overlays", () => {
  const css = readFileSync(new URL("../web/forced-colors-readability.css", import.meta.url), "utf8");
  assert.match(css, /@media\s*\(forced-colors:\s*active\)/);
  assert.match(css, /\.meter > div\s*\{/);
  assert.match(css, /outline:\s*1px solid CanvasText;/);
  assert.match(css, /\.meter i\s*\{\s*background:\s*Highlight;/);
  assert.match(css, /canvas:focus-visible/);
  assert.match(css, /\.arena-stage\[data-combat-feedback\]::after/);
  assert.match(css, /outline-style:\s*dashed;/);
  assert.doesNotMatch(css, /pointer-events:|position:\s*(fixed|absolute)|setTimeout|transform:/);
});

test("U7 loads before online or practice game modules", () => {
  const source = readFileSync(new URL("../web/bootstrap.mjs", import.meta.url), "utf8");
  const installed = source.indexOf("installForcedColorsReadability(document)");
  assert.ok(installed >= 0);
  assert.ok(installed < source.indexOf('await import("./online-game.mjs")'));
  assert.ok(installed < source.indexOf('await import("./game.mjs")'));
});
