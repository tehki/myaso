import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installArenaFocusGuide } from "../src/browser/arena-focus-guide.mjs";

function fixture({ withCanvas = true, withHint = true } = {}) {
  const listeners = new Map();
  const canvas = {
    addEventListener(type, listener) {
      const list = listeners.get(type) || [];
      list.push(listener);
      listeners.set(type, list);
    },
    emit(type) { for (const fn of listeners.get(type) || []) fn(); },
    listeners(type) { return (listeners.get(type) || []).length; },
  };
  const hint = {
    dataset: {},
    children: [],
    querySelector(selector) {
      assert.equal(selector, "[data-arena-focus-guide]");
      return this.children.find(x => x.attributes?.has("data-arena-focus-guide")) || null;
    },
    replaceChildren(...nodes) {
      for (const previous of this.children) previous.parentElement = null;
      this.children = nodes;
      for (const node of nodes) node.parentElement = this;
    },
  };
  const head = {
    children: [],
    appendChild(node) { this.children.push(node); },
  };
  const doc = {
    head,
    activeElement: null,
    querySelector(selector) {
      if (selector === "#arena") return withCanvas ? canvas : null;
      if (selector === ".focus-hint") return withHint ? hint : null;
      if (selector === "link[data-arena-focus-style]") {
        return head.children.find(x => x.attributes?.has("data-arena-focus-style")) || null;
      }
      throw new Error("Unknown selector " + selector);
    },
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        attributes: new Map(),
        setAttribute(name, value) { this.attributes.set(name, value); },
      };
    },
  };
  return { canvas, hint, head, doc };
}

test("U3 shows contextual practice focus state without changing combat input", () => {
  const { canvas, hint, head, doc } = fixture();
  const label = installArenaFocusGuide(doc);
  assert.match(label.textContent, /Click or Tab/);
  assert.equal(hint.dataset.arenaFocus, "awaiting");
  assert.equal(canvas.listeners("focus"), 1);
  assert.equal(canvas.listeners("blur"), 1);
  doc.activeElement = canvas;
  canvas.emit("focus");
  assert.match(label.textContent, /Practice arena focused/);
  assert.equal(hint.dataset.arenaFocus, "active");
  doc.activeElement = null;
  canvas.emit("blur");
  assert.equal(hint.dataset.arenaFocus, "awaiting");
  assert.equal(head.children.length, 1);
  assert.equal(head.children[0].href, "./arena-focus-guide.css");
});

test("U3 preserves existing install and multiplayer connection failure recovery link", () => {
  const { canvas, hint, head, doc } = fixture();
  const label = installArenaFocusGuide(doc, { online: true });
  assert.equal(installArenaFocusGuide(doc, { online: true }), label);
  assert.equal(canvas.listeners("focus"), 1);
  assert.equal(head.children.length, 1);
  doc.activeElement = canvas;
  canvas.emit("focus");
  assert.match(label.textContent, /Online arena focused/);
  const recovery = { tagName: "A", href: "/web/alpha.html" };
  hint.replaceChildren(recovery);
  doc.activeElement = null;
  canvas.emit("blur");
  assert.equal(hint.children[0], recovery);
  assert.equal(hint.children.length, 1);
});

test("U3 no-ops on pages without canvas or focus hint", () => {
  for (const f of [fixture({ withCanvas: false }), fixture({ withHint: false })]) {
    assert.equal(installArenaFocusGuide(f.doc), null);
    assert.equal(f.head.children.length, 0);
    assert.equal(f.canvas.listeners("focus"), 0);
  }
});

test("U3 CSS uses passive status only, without covering the arena", () => {
  const css = readFileSync(new URL("../web/arena-focus-guide.css", import.meta.url), "utf8");
  assert.match(css, /\.focus-hint\[data-arena-focus="active"\]/);
  assert.doesNotMatch(css, /position:\s*(fixed|absolute)|pointer-events:/);
});
