import test from "node:test";
import assert from "node:assert/strict";
import { createNpcChatPanel } from "../web/npc-chat.mjs";

// Minimal isolated DOM fixture. This checks the actual optional browser
// module, but is NOT a real Chrome/Firefox/WebTransport acceptance.
class Element {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.hidden = false;
    this.value = "";
    this.textContent = "";
    this.listeners = new Map();
    this.focused = false;
    this.attributes = new Map();
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  addEventListener(event, listener) { this.listeners.set(event, listener); }
  append(...nodes) {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
    if (this.tag === "select" && this.children.length && !this.value) {
      this.value = this.children[0].value;
    }
  }
  replaceChildren(...nodes) {
    this.children.length = 0;
    this.value = "";
    this.append(...nodes);
  }
  remove() {
    const index = this.parent?.children.indexOf(this);
    if (index >= 0) this.parent.children.splice(index, 1);
  }
  focus() {
    if (globalThis.document.activeElement) globalThis.document.activeElement.focused = false;
    globalThis.document.activeElement = this;
    this.focused = true;
  }
  blur() {
    if (globalThis.document.activeElement === this) globalThis.document.activeElement = null;
    this.focused = false;
  }
  get firstElementChild() { return this.children[0] ?? null; }
  get options() { return this.children; }
  get scrollHeight() { return this.children.length; }
}

function installDocument() {
  const stage = new Element("div");
  const canvas = new Element("canvas");
  const original = globalThis.document;
  globalThis.document = {
    activeElement: null,
    createElement(tag) { return new Element(tag); },
    querySelector(selector) {
      if (selector === ".arena-wrap") return stage;
      if (selector === "#arena") return canvas;
      return null;
    },
  };
  return { stage, canvas, restore() {
    if (original === undefined) delete globalThis.document;
    else globalThis.document = original;
  } };
}

test("P0 NPC-off alpha has no accessible conversation or send until valid pilot roster", async () => {
  const { stage, restore } = installDocument();
  try {
    const sent = [];
    let divertedFocus = 0;
    const npc = createNpcChatPanel({
      onSend: async (id, text) => sent.push({ id, text }),
      onFocus: () => { divertedFocus += 1; },
    });
    const panel = stage.children[0];
    assert.equal(stage.children.length, 1);
    assert.equal(panel.hidden, true);
    assert.equal(npc.enabled, false);
    assert.deepEqual(npc.npcs, []);
    const [,, roster,,, history, form] = panel.children;
    const [input] = form.children;
    const submit = async () => form.listeners.get("submit")({
      preventDefault() {},
    });

    // A server snapshot, site status or supply report cannot activate chat
    // before the only enabled signal: a nonempty validated roster.
    npc.updateState({ tick: 60, states: [{ id: 3, x: 200, y: 150, activity: 1 }] });
    npc.updateSupplies({ tick: 60, sequence: 0, stocks: {
      wellWater: 8, tomasWater: 0, yardWater: 0,
      depotFood: 8, elaraFood: 0, stallFood: 0,
      forgeIron: 6, forgeNails: 0,
    }, lastActor: 0, lastOperation: 0 });
    npc.setObstacles([{ x: 100, y: 100, width: 20, height: 20 }]);
    npc.setWorksites([{ id: 1, name: "Yard" }]);
    npc.updateWorksiteStatus({ revision: 2, active: [true, true, true, true, true] });
    npc.receive({ text: "Ignored pilot packet cannot enable a game control" });
    npc.focus();
    input.value = "try chat before roster";
    roster.value = "3";
    await submit();
    assert.equal(panel.hidden, true);
    assert.equal(npc.enabled, false);
    assert.equal(divertedFocus, 0);
    assert.equal(sent.length, 0);

    npc.setRoster([{ id: 3, x: 155, y: 205, name: "Rowan", role: "Guard" }]);
    assert.equal(panel.hidden, false);
    assert.equal(npc.enabled, true);
    assert.equal(roster.value, "3");
    npc.focus();
    assert.equal(divertedFocus, 1);
    assert.equal(input.focused, true);
    input.value = "Where is the yard?";
    await submit();
    assert.deepEqual(sent, [{ id: 3, text: "Where is the yard?" }]);
    assert.equal(input.value, "");

    // Losing the roster prevents later accidental chat submissions,
    // including an input left in the former form by a stale UI task.
    npc.setRoster([]);
    assert.equal(panel.hidden, true);
    assert.equal(npc.enabled, false);
    input.value = "stale client request";
    roster.value = "3";
    await submit();
    npc.focus();
    assert.equal(sent.length, 1);
    assert.equal(divertedFocus, 1);
    assert.equal(history.children.length, 0, "revoked pilot transcript is cleared");
    assert.equal(globalThis.document.activeElement?.tag, "canvas",
      "revoking the focused NPC roster restores gameplay input focus");
  } finally {
    restore();
  }
});

test("pilot roster generation fences stale async sends and recycled UI state", async () => {
  const { stage, restore } = installDocument();
  try {
    const pending = [];
    const npc = createNpcChatPanel({
      onSend(id, text) {
        return new Promise((resolve, reject) => pending.push({ id, text, resolve, reject }));
      },
      onFocus() {},
    });
    const panel = stage.children[0];
    const [,, roster,,, history, form] = panel.children;
    const [input, sendButton] = form.children;
    const submit = () => form.listeners.get("submit")({ preventDefault() {} });
    const rowan = [{ id: 3, x: 155, y: 205, name: "Rowan", role: "Guard" }];
    const tomas = [{ id: 5, x: 270, y: 220, name: "Tomas", role: "Laborer" }];

    npc.setRoster(rowan);
    input.value = "Old session message";
    const first = submit();
    assert.equal(sendButton.disabled, true);
    assert.deepEqual(pending.map(({ id, text }) => [id, text]), [[3, "Old session message"]]);
    // Enter can submit forms while a button is disabled. Do not create a
    // second reliable NPC write until this one succeeds or fails.
    await submit();
    assert.equal(pending.length, 1, "only one outstanding NPC chat per roster");
    assert.equal(sendButton.disabled, true);

    npc.setRoster([]);
    assert.equal(panel.hidden, true);
    assert.equal(sendButton.disabled, false);
    assert.equal(input.value, "");
    assert.equal(history.children.length, 0);
    npc.receive({ text: "Late reply for revoked session" });
    assert.equal(history.children.length, 0);

    npc.setRoster(tomas);
    assert.equal(roster.value, "5");
    input.value = "New session draft";
    pending[0].resolve();
    await first;
    assert.equal(input.value, "New session draft",
      "an old promise cannot erase a new session's typed text");
    assert.equal(history.children.length, 0,
      "an old successful send cannot appear under a newer NPC roster");
    assert.equal(sendButton.disabled, false);

    const second = submit();
    assert.deepEqual(pending.at(-1) && [pending.at(-1).id, pending.at(-1).text],
      [5, "New session draft"]);
    await submit();
    assert.equal(pending.length, 2, "no duplicate while second session send is pending");
    pending.at(-1).resolve();
    await second;
    assert.equal(history.children.length, 1);
    assert.match(history.children[0].textContent, /Tomas: New session draft/);
    assert.equal(input.value, "");

    input.value = "Pending old failure";
    const third = submit();
    assert.equal(sendButton.disabled, true);
    await submit();
    assert.equal(pending.length, 3);
    npc.setRoster([]);
    npc.setRoster(rowan);
    pending.at(-1).reject(new Error("Connection closed"));
    await third;
    assert.equal(sendButton.disabled, false);
    assert.equal(history.children.length, 0,
      "an old failed request cannot leak error text into a new roster");
    npc.receive({ text: "Current uncorrelated server response" });
    assert.equal(history.children.length, 1,
      "server replies after a newly active roster are still possible without a wire request epoch");
  } finally {
    restore();
  }
});

test("pilot chat releases its one-flight gate after same-roster send failure", async () => {
  const { stage, restore } = installDocument();
  try {
    const attempts = [];
    let fail = true;
    const npc = createNpcChatPanel({
      async onSend(id, text) {
        attempts.push([id, text]);
        if (fail) throw new Error("reliable stream closed");
      },
      onFocus() {},
    });
    npc.setRoster([{ id: 2, name: "Marta", role: "Blacksmith" }]);
    const [,, roster,,, history, form] = stage.children[0].children;
    const [input, button] = form.children;
    assert.equal(roster.value, "2");
    const submit = () => form.listeners.get("submit")({ preventDefault() {} });
    input.value = "Are swords available?";
    await submit();
    assert.equal(button.disabled, false);
    assert.equal(input.value, "Are swords available?",
      "failure should not discard the player's draft");
    assert.equal(history.children.length, 1);
    assert.equal(history.children[0].textContent, "Unable to send your message.");

    fail = false;
    await submit();
    assert.deepEqual(attempts, [[2, "Are swords available?"], [2, "Are swords available?"]]);
    assert.equal(button.disabled, false);
    assert.equal(input.value, "");
    assert.match(history.children[1].textContent, /Marta: Are swords available/);
  } finally {
    restore();
  }
});
