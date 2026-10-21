import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installControlGuide } from "../src/browser/control-guide.mjs";

function element(tagName) {
  return {
    tagName: tagName.toUpperCase(),
    children: [],
    parentElement: null,
    className: "",
    attributes: new Map(),
    textContent: "",
    append(...children) { for (const child of children) this.appendChild(child); },
    appendChild(child) {
      if (child.parentElement) {
        const siblings = child.parentElement.children;
        siblings.splice(siblings.indexOf(child), 1);
      }
      this.children.push(child);
      child.parentElement = this;
      return child;
    },
    insertBefore(child, reference) {
      assert.ok(this.children.includes(reference));
      this.children.splice(this.children.indexOf(reference), 0, child);
      child.parentElement = this;
      return child;
    },
    setAttribute(name, value) { this.attributes.set(name, value); },
  };
}

function fixture(withControls = true) {
  const masthead = element("header");
  const original = element("div");
  original.className = "controls";
  const binding = element("span");
  binding.textContent = "Wheel ↑ roll; Wheel ↓ parry";
  original.appendChild(binding);
  if (withControls) masthead.appendChild(original);
  const head = element("head");
  const doc = {
    head,
    createElement: element,
    querySelector(query) {
      if (query === ".masthead .controls") return withControls ? original : null;
      if (query === "link[data-control-guide-style]") {
        return head.children.find(child => child.attributes.has("data-control-guide-style")) || null;
      }
      throw new Error("Unexpected selector " + query);
    },
  };
  return { doc, masthead, original, binding, head };
}

test("guide starts collapsed with concise onboarding and original, unchanged controls", () => {
  const { doc, masthead, original, binding, head } = fixture();
  const guide = installControlGuide(doc);
  assert.equal(guide.tagName, "DETAILS");
  assert.equal(guide.open, undefined, "native details stays closed by default");
  assert.equal(masthead.children.length, 1);
  assert.equal(masthead.children[0], guide);
  assert.equal(guide.children[0].tagName, "SUMMARY");
  assert.match(guide.children[0].children[1].textContent, /LMB release attack/);
  assert.equal(guide.children[1], original, "original binding nodes are moved, not rewritten");
  assert.equal(original.children[0], binding);
  assert.equal(head.children.length, 1);
  assert.equal(head.children[0].href, "./control-guide.css");
});

test("reinstall is idempotent and does not duplicate stylesheet or wrapper", () => {
  const { doc, masthead, head } = fixture();
  const one = installControlGuide(doc);
  const two = installControlGuide(doc);
  assert.equal(one, two);
  assert.equal(masthead.children.length, 1);
  assert.equal(head.children.length, 1);
});

test("pages without the arena instructions are untouched", () => {
  const { doc, masthead, head } = fixture(false);
  assert.equal(installControlGuide(doc), null);
  assert.equal(masthead.children.length, 0);
  assert.equal(head.children.length, 0);
});

test("closed disclosure hides flex-based instructions without removing them", () => {
  const css = readFileSync(new URL("../web/control-guide.css", import.meta.url), "utf8");
  assert.match(css, /\.control-guide:not\(\[open\]\)\s*>\s*\.controls\s*\{\s*display:\s*none\s*;\s*\}/);
});
