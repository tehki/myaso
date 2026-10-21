import test from "node:test";
import assert from "node:assert/strict";
import { installLobbyPracticeLink } from "../web/alpha-practice.mjs";
import { readFileSync } from "node:fs";

function fixture({ withActions = true, withInvite = true } = {}) {
  const invite = { id: "copy-invite", parentElement: null };
  const actions = {
    children: [],
    appendChild(child) {
      this.children.push(child);
      child.parentElement = this;
    },
    insertBefore(child, next) {
      const position = this.children.indexOf(next);
      if (position === -1) throw new Error("invalid insertion target");
      this.children.splice(position, 0, child);
      child.parentElement = this;
    },
  };
  if (withInvite) actions.appendChild(invite);
  const doc = {
    querySelector(selector) {
      assert.equal(selector, ".actions");
      return withActions ? actions : null;
    },
    getElementById(id) {
      return id === "copy-invite" && withInvite ? invite
        : id === "lobby-practice-link" ? actions.children.find(child => child.id === id) || null
        : null;
    },
    createElement(tag) { return { tagName: tag.toUpperCase() }; },
  };
  return { actions, doc, invite };
}

test("U2 exposes same-origin local practice before invite, without requiring the server", () => {
  const { doc, actions, invite } = fixture();
  const link = installLobbyPracticeLink(doc);
  assert.equal(link.tagName, "A");
  assert.equal(link.href, "/web/");
  assert.equal(link.textContent, "TRY LOCAL PRACTICE");
  assert.deepEqual(actions.children, [link, invite]);
});

test("U2 link is idempotent and gracefully handles missing optional lobby elements", () => {
  const standard = fixture();
  const first = installLobbyPracticeLink(standard.doc);
  assert.equal(installLobbyPracticeLink(standard.doc), first);
  assert.equal(standard.actions.children.length, 2);
  const noInvite = fixture({ withInvite: false });
  assert.equal(installLobbyPracticeLink(noInvite.doc).href, "/web/");
  assert.equal(noInvite.actions.children.length, 1);
  assert.equal(installLobbyPracticeLink(fixture({ withActions: false }).doc), null);
});

test("U2 initializes practice before networking capability and remote config checks", () => {
  const source = readFileSync(new URL("../web/alpha.mjs", import.meta.url), "utf8");
  const css = readFileSync(new URL("../web/alpha.css", import.meta.url), "utf8");
  const initAt = source.indexOf("installLobbyPracticeLink(document)");
  const checkAt = source.indexOf('typeof WebTransport !== "function"');
  assert.ok(initAt >= 0 && initAt < checkAt);
  assert.match(css, /\.actions\s+\.practice-link\s*\{/);
  assert.match(css, /\.actions\s+\.practice-link:focus-visible\s*\{/);
});
