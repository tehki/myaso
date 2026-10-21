import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installArenaLobbyLink } from "../src/browser/arena-lobby-link.mjs";

function fixture({ withHint = true, withHead = true } = {}) {
  const hint = {
    children: [],
    appendChild(node) {
      this.children.push(node);
      node.parentElement = this;
    },
    replaceChildren(...nodes) {
      for (const old of this.children) old.parentElement = null;
      this.children = [];
      for (const node of nodes) this.appendChild(node);
    },
    querySelector(selector) {
      assert.equal(selector, "[data-arena-lobby-link]");
      return this.children.find(n => n.attributes?.has("data-arena-lobby-link")) || null;
    },
  };
  const head = {
    children: [],
    appendChild(node) { this.children.push(node); },
  };
  const doc = {
    head: withHead ? head : null,
    querySelector(selector) {
      if (selector === ".focus-hint") return withHint ? hint : null;
      if (selector === "link[data-arena-lobby-style]") {
        return head.children.find(n => n.attributes?.has("data-arena-lobby-style")) || null;
      }
      throw Error("Unexpected selector: " + selector);
    },
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        attributes: new Map(),
        setAttribute(key, value) { this.attributes.set(key, value); },
      };
    },
  };
  return { doc, hint, head };
}

test("U6 shows fixed same-origin navigation outside the combat canvas", () => {
  const { doc, hint, head } = fixture();
  const link = installArenaLobbyLink(doc, { online: true });
  assert.equal(link.tagName, "A");
  assert.equal(link.href, "/web/alpha.html");
  assert.equal(link.textContent, "Leave arena · Multiplayer lobby");
  assert.equal(link.parentElement, hint);
  assert.equal(head.children.length, 1);
  assert.equal(head.children[0].href, "./arena-lobby-link.css");
});

test("U6 practice lobby link is idempotent and uses native anchor keyboard semantics", () => {
  const { doc, hint, head } = fixture();
  const first = installArenaLobbyLink(doc);
  assert.equal(first.textContent, "Multiplayer lobby");
  assert.equal(installArenaLobbyLink(doc, { online: true }), first);
  assert.equal(hint.children.length, 1);
  assert.equal(head.children.length, 1);
});

test("U6 no-op when no hint exists, stylesheet optional when no head", () => {
  const absent = fixture({ withHint: false });
  assert.equal(installArenaLobbyLink(absent.doc), null);
  const bare = fixture({ withHead: false });
  assert.equal(installArenaLobbyLink(bare.doc).href, "/web/alpha.html");
});

test("U6 never fights authoritative multiplayer failure recovery", () => {
  const { doc, hint } = fixture();
  const link = installArenaLobbyLink(doc, { online: true });
  const recovery = { href: "/web/alpha.html", textContent: "Return to multiplayer lobby" };
  hint.replaceChildren(recovery);
  assert.equal(link.parentElement, null);
  assert.deepEqual(hint.children, [recovery]);
});

test("U6 is bootstrapped before gameplay and supports visible keyboard focus", () => {
  const js = readFileSync(new URL("../web/bootstrap.mjs", import.meta.url), "utf8");
  const css = readFileSync(new URL("../web/arena-lobby-link.css", import.meta.url), "utf8");
  assert.ok(js.indexOf("installArenaLobbyLink(document") >= 0);
  assert.ok(js.indexOf("installArenaLobbyLink(document") < js.indexOf('if (params.has("server"))'));
  assert.match(css, /\.focus-hint \.arena-lobby-link:focus-visible/);
  assert.match(css, /@media \(forced-colors: active\)/);
});
