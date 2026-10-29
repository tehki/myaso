import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installLocalChat } from "../src/browser/local-chat.mjs";

function fakeDocument() {
  const doc = { activeElement: null };
  const make = tag => {
    const listeners = new Map();
    const node = {
      tagName: tag.toUpperCase(), dataset: {}, children: [], textContent: "", value: "",
      setAttribute() {},
      append(...nodes) { for (const n of nodes) { n.parentElement = this; this.children.push(n); } },
      remove() { const s = this.parentElement?.children; if (s) s.splice(s.indexOf(this), 1); },
      addEventListener(type, fn, options) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push({ fn, capture: options === true || options?.capture === true });
      },
      removeEventListener(type, fn) {
        listeners.set(type, (listeners.get(type) ?? []).filter(record => record.fn !== fn));
      },
      fire(type, extra = {}) {
        let stopped = false, prevented = false;
        const e = {
          key: "", repeat: false, cancelable: true, isComposing: false,
          // A real DOM-dispatched canvas pointer event always supplies target.
          // The fake fixture must model that before validating the same guard.
          target: this,
          preventDefault() { prevented = true; },
          stopPropagation() { stopped = true; },
          stopImmediatePropagation() { stopped = true; },
          ...extra,
        };
        for (const { fn } of [...(listeners.get(type) ?? [])].sort((a, b) => Number(b.capture) - Number(a.capture))) {
          if (stopped) break;
          fn(e);
        }
        return { stopped, prevented };
      },
      focus() { doc.activeElement = this; },
      get childElementCount() { return this.children.length; },
      get firstElementChild() { return this.children[0] ?? null; },
      get lastElementChild() { return this.children.at(-1) ?? null; },
    };
    return node;
  };
  const stage = make("div"), canvas = make("canvas");
  doc.head = make("head");
  doc.createElement = make;
  doc.querySelector = selector => selector === ".arena-stage" ? stage : selector === "#arena" ? canvas : null;
  return { doc, canvas };
}

function readyChat() {
  const { doc, canvas } = fakeDocument();
  let id = 0;
  const chat = installLocalChat(doc, { online: true, idFactory: () => "id-" + ++id });
  chat.bindAdapter({ ready: true, subscribe() { return () => {}; },
    send(message) { return Promise.resolve({ ok: true, clientMessageId: message.clientMessageId }); },
  });
  return { doc, canvas, chat };
}

test("Enter opens the composer ahead of Combat; Escape restores arena focus", () => {
  const { doc, canvas, chat } = readyChat();
  let combatKeydowns = 0;
  canvas.addEventListener("keydown", () => combatKeydowns++);
  canvas.focus();
  const opened = canvas.fire("keydown", { key: "Enter" });
  assert.equal(opened.stopped, true);
  assert.equal(opened.prevented, true);
  assert.equal(combatKeydowns, 0);
  assert.equal(doc.activeElement, chat.input);
  for (const key of ["w", " ", "e"]) {
    const typed = chat.input.fire("keydown", { key });
    assert.equal(typed.stopped, true);
    assert.equal(combatKeydowns, 0);
  }
  chat.input.fire("keydown", { key: "Escape" });
  assert.equal(chat.root.dataset.open, "false");
  assert.equal(doc.activeElement, canvas);
  chat.dispose();
});

test("Focused composer capture-blocks real canvas attack, kick, wheel and mouse-up paths", () => {
  const { canvas, chat } = readyChat();
  const combat = [];
  for (const type of ["pointerdown","pointerup","mousedown","mouseup","wheel","contextmenu","auxclick"]) {
    canvas.addEventListener(type, () => combat.push(type));
  }
  chat.setExpanded(true, true);
  for (const type of ["pointerdown","pointerup","mousedown","mouseup","wheel","contextmenu","auxclick"]) {
    const result = canvas.fire(type, { button: 0 });
    assert.equal(result.stopped, true, type + " must not reach Combat");
    assert.equal(result.prevented, true, type + " must not steal input focus");
  }
  assert.deepEqual(combat, []);
  chat.input.fire("keydown", { key: "Escape" });
  assert.equal(canvas.fire("pointerdown", { button: 0 }).stopped, false);
  assert.deepEqual(combat, ["pointerdown"]);
  chat.dispose();
});

test("Untrusted message markup is inert and local sends require the explicit server ACK", async () => {
  const { chat } = readyChat();
  const payload = "<img src=x onerror=window.hacked=1>";
  assert.equal(chat.receive({ channel:"local",serverMessageId:"16",
    sender:{displayName:"Player #2"},text:payload }), true);
  assert.equal(chat.history.firstElementChild.children[1].textContent, payload);
  chat.input.value = "Guard the tavern";
  assert.equal(await chat.submit(), true);
  assert.equal(chat.history.lastElementChild.dataset.delivery, "accepted");
  assert.equal(chat.history.lastElementChild.children[2].textContent, "Accepted");
  chat.dispose();
});

test("Online runtime still retires Combat on canvas blur; no fake config activation", () => {
  const online = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  const activation = readFileSync(new URL("../src/browser/chat-c1-activation.mjs", import.meta.url), "utf8");
  const css = readFileSync(new URL("../web/local-chat.css", import.meta.url), "utf8");
  assert.match(online, /canvas\.addEventListener\("blur", releaseInputs\)/);
  // Canonical Main0 preserves the additional trusted first-party config gate;
  // it must NEVER be removed while adopting UI10's capture-only input fix.
  assert.match(activation,/isTrustedChatC1ReleaseConfigured/);
  assert.match(activation,/await openBridge\(/);
  assert.match(activation, /if \(!adapter\?\.ready\)/);
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /position: absolute/);
});
