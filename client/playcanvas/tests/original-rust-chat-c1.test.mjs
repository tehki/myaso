import test from 'node:test';
import assert from 'node:assert/strict';
import { connectPlayCanvasChatC1 } from '../src/chat/original-rust-chat-c1.mjs';
import { installLocalChat } from '../../../src/browser/local-chat.mjs';

// All tests here are mocked source CONTRACTS, not live Rust Chat C1 acceptance.
function fixture() {
  const calls = [], statuses = [];
  const transport = { kind: 'webtransport', closed: false };
  const gameClient = { transport, close() { throw Error('must never close gameplay'); } };
  const documentObj = { createElement() {} };
  const stage = { append() {} };
  const canvas = { addEventListener() {} };
  const panel = {
    root: { isConnected: true },
    bindAdapter(adapter) { calls.push(['bind', adapter]); },
    dispose() { calls.push(['dispose']); },
  };
  const adapter = {
    ready: true,
    async close() { calls.push(['close-chat-only']); this.ready = false; },
    send() {}, subscribe() {},
  };
  function install(doc, options) {
    assert.equal(doc, documentObj);
    assert.equal(options.online, true);
    assert.equal(options.stageElement, stage);
    assert.equal(options.canvasElement, canvas);
    assert.equal(options.includeStylesheet, false);
    calls.push(['install']);
    return panel;
  }
  return { calls, statuses, transport, gameClient, documentObj, stage,
    canvas, panel, adapter, install, onStatus: s => statuses.push(s) };
}

test('PlayCanvas Chat C1 fails closed without original QUIC and never creates a second transport', async () => {
  const f = fixture();
  let openings = 0, installations = 0;
  const args = { ...f, install() { installations++; }, openBridge() { openings++; } };
  assert.equal(await connectPlayCanvasChatC1({
    ...args, gameClient: {transport: {kind: 'websocket'}}
  }), null);
  assert.equal(await connectPlayCanvasChatC1({
    ...args, gameClient: {transport: {kind: 'webtransport', closed: true}}
  }), null);
  assert.equal(openings, 0);
  assert.equal(installations, 0);
});

test('Main0 mounts ORIGINAL Chat C1 on PlayCanvas canvas and authenticates existing game QUIC', async () => {
  const f = fixture();
  const chat = await connectPlayCanvasChatC1({
    ...f,
    async openBridge(transport, callbacks) {
      assert.equal(transport, f.gameClient.transport);
      assert.equal(typeof callbacks.onDisconnect, 'function');
      f.calls.push(['open-original-chat-stream']);
      return f.adapter;
    },
  });
  assert.equal(chat?.ready, true);
  assert.equal(chat.panel, f.panel);
  assert.equal(f.calls.filter(([type]) => type === 'open-original-chat-stream').length, 1);
  assert.equal(f.calls.filter(([type]) => type === 'bind').length, 1);
  assert.equal(f.calls.at(-1)[1], f.adapter);
  assert.match(f.statuses.at(-1), /connected to original Rust QUIC/);
  await chat.close();
  assert.equal(chat.ready, false);
  assert.equal(f.calls.filter(([type]) => type === 'close-chat-only').length, 1);
  assert.equal(f.calls.filter(([type]) => type === 'dispose').length, 1);
  assert.equal(f.transport.closed, false);
  await chat.close();
  assert.equal(f.calls.filter(([type]) => type === 'close-chat-only').length, 1);
});

test('optional original Chat C1 stream failure never tears down Rust Combat', async () => {
  const f = fixture();
  const chat = await connectPlayCanvasChatC1({
    ...f,
    async openBridge() { throw Error('server denied optional Chat C1'); },
  });
  assert.equal(chat, null);
  assert.equal(f.calls.some(([type]) => type === 'dispose'), true);
  assert.equal(f.calls.some(([type]) => type === 'bind'), true);
  assert.equal(f.transport.closed, false);
  assert.match(f.statuses.at(-1), /server rejected chat stream/);
});

test('server Chat C1 disconnect detaches composer and does not touch game QUIC', async () => {
  const f = fixture();
  let disconnect;
  const chat = await connectPlayCanvasChatC1({
    ...f,
    async openBridge(_transport, options) {
      disconnect = options.onDisconnect;
      return f.adapter;
    },
  });
  assert.equal(chat.ready, true);
  disconnect();
  assert.equal(f.calls.at(-1)[0], 'bind');
  assert.equal(f.calls.at(-1)[1], null);
  assert.equal(f.transport.closed, false);
  assert.match(f.statuses.at(-1), /disconnected/);
  await chat.close();
});

test('original Chat C1 ungranted reliable stream is never reported connected', async () => {
  const f = fixture();
  const chat = await connectPlayCanvasChatC1({
    ...f,
    async openBridge() { return {...f.adapter, ready: false}; },
  });
  assert.equal(chat, null);
  assert.equal(f.calls.some(([type]) => type === 'dispose'), true);
  assert.equal(f.transport.closed, false);
});

test('ORIGINAL Chat C1 panel mounts on the PlayCanvas host with unchanged defaults elsewhere', () => {
  const elements = [];
  const doc = {
    activeElement: null,
    defaultView: { addEventListener() {}, removeEventListener() {} },
    head: { append() { throw Error('PlayCanvas bundles original CSS'); } },
    createElement(tag) {
      const node = {
        tagName: tag, dataset: {}, children: [], isConnected: false,
        setAttribute() {}, addEventListener() {}, removeEventListener() {},
        append(...children) { this.children.push(...children); },
        remove() { this.isConnected = false; },
        focus() { doc.activeElement = this; },
      };
      elements.push(node);
      return node;
    },
    querySelector() { throw Error('PlayCanvas must pass original host overrides'); },
  };
  const stage = {
    append(root) { root.isConnected = true; this.mounted = root; },
    hasAttribute() { return false; },
  };
  const canvas = {
    addEventListener() {}, removeEventListener() {},
    focus() { doc.activeElement = this; },
    contains() { return false; },
  };
  const chat = installLocalChat(doc, {
    online: true, stageElement: stage, canvasElement: canvas,
    includeStylesheet: false,
  });
  assert.ok(chat);
  assert.equal(stage.mounted, chat.root);
  assert.equal(chat.root.isConnected, true);
  assert.equal(chat.root.dataset.connected, 'false', 'no fake chat stream');
  assert.equal(chat.input.disabled, true, 'no simulated chat acknowledgement');
  assert.ok(elements.find(e => e.tagName === 'input'));
  chat.dispose();
  assert.equal(chat.root.isConnected, false);
});
