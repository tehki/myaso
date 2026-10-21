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
  focus() { this.focused = true; }
  get firstElementChild() { return this.children[0] ?? null; }
  get options() { return this.children; }
  get scrollHeight() { return this.children.length; }
}

function installDocument() {
  const stage = new Element("div");
  const canvas = new Element("canvas");
  const original = globalThis.document;
  globalThis.document = {
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
    assert.ok(history.children.length >= 1);
  } finally {
    restore();
  }
});
