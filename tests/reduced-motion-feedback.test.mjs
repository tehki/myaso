import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installReducedMotionFeedback } from "../src/browser/reduced-motion-feedback.mjs";

function fixture() {
  const head = { children: [], appendChild(node) { this.children.push(node); } };
  const doc = {
    head,
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        attributes: new Map(),
        setAttribute(name, value) { this.attributes.set(name, value); },
      };
    },
    querySelector(selector) {
      assert.equal(selector, "link[data-reduced-motion-feedback]");
      return head.children.find(item => item.attributes.has("data-reduced-motion-feedback")) || null;
    },
  };
  return { doc, head };
}

test("U5 installs passive reduced-motion stylesheet once", () => {
  const { doc, head } = fixture();
  const first = installReducedMotionFeedback(doc);
  assert.equal(first.tagName, "LINK");
  assert.equal(first.rel, "stylesheet");
  assert.equal(first.href, "./reduced-motion-feedback.css");
  assert.equal(installReducedMotionFeedback(doc), first);
  assert.equal(head.children.length, 1);
});

test("U5 no-ops on unheadable environments", () => {
  const { doc } = fixture();
  doc.head = null;
  assert.equal(installReducedMotionFeedback(doc), null);
});

test("U5 keeps static feedback visible only while the game marks an active impact", () => {
  const css = readFileSync(new URL("../web/reduced-motion-feedback.css", import.meta.url), "utf8");
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /\.arena-stage\[data-combat-feedback\]::after\s*\{/);
  assert.match(css, /animation:\s*none;/);
  assert.match(css, /opacity:\s*1;/);
  assert.match(css, /\.meter i\s*\{\s*transition:\s*none;/);
  assert.doesNotMatch(css, /pointer-events:|position:|setTimeout/);
});

test("U5 initializes before the online or practice mode is imported", () => {
  const source = readFileSync(new URL("../web/bootstrap.mjs", import.meta.url), "utf8");
  const init = source.indexOf("installReducedMotionFeedback(document)");
  const importOnline = source.indexOf('await import("./online-game.mjs")');
  const importPractice = source.indexOf('await import("./game.mjs")');
  assert.ok(init >= 0 && init < importOnline && init < importPractice);
});
