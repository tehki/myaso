import { encodeNpcRequest, NPC_WIRE } from "../src/network/npc-chat-codec.mjs";

// An opt-in NPC pilot overlay. Server roster is the only activation signal.
export function createNpcChatPanel({ onSend, onFocus }) {
  const panel = document.createElement("aside");
  panel.className = "npc-pilot";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Nearby NPC conversation");

  const heading = document.createElement("strong");
  heading.textContent = "GREYHAVEN · NPC PILOT";
  const description = document.createElement("p");
  description.textContent = "Staging characters · scripted dialogue · memories last this session only.";
  const roster = document.createElement("select");
  roster.setAttribute("aria-label", "Choose a nearby NPC");
  const worksiteSummary = document.createElement("p");
  worksiteSummary.className = "npc-pilot-worksites";
  worksiteSummary.textContent = "Worksites: waiting for server status.";
  const supplies = document.createElement("p");
  supplies.className = "npc-pilot-supplies";
  supplies.textContent = "Settlement supplies: awaiting verified server report.";
  const history = document.createElement("ol");
  history.setAttribute("aria-label", "NPC conversation");
  history.setAttribute("aria-live", "polite");
  const form = document.createElement("form");
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Say something...";
  input.setAttribute("aria-label", "Say something to the NPC");
  input.maxLength = 240;
  input.autocomplete = "off";
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Speak";
  form.append(input, submit);
  panel.append(heading, description, roster, supplies, worksiteSummary, history, form);
  document.querySelector(".arena-wrap")?.append(panel);
  let npcs = [];
  let obstacles = [];
  let worksites = [];
  let lastWorksiteRevision = null;
  let lastStateTick = null;
  let lastSuppliesTick = null;
  // Invalidates in-flight chat send completions after roster replacement.
  // Old drafts and conversation text must not survive a revoked pilot roster.
  let rosterGeneration = 0;
  // Only show replies to actual locally submitted pilot messages. The
  // reliable stream preserves their ordering; do not invent request IDs.
  // This is local UI containment, not a substitute for Core session epochs.
  const pendingReplies = [];
  const MAX_PENDING_REPLIES = 12;

  function appendLine(text) {
    const li = document.createElement("li");
    // Absolutely no innerHTML: player and server responses are untrusted text.
    li.textContent = text;
    history.append(li);
    while (history.children.length > 12) history.firstElementChild.remove();
    history.scrollTop = history.scrollHeight;
  }
  function setRoster(entries) {
    rosterGeneration += 1;
    npcs = entries;
    pendingReplies.length = 0;
    history.replaceChildren();
    input.value = "";
    submit.disabled = false;
    if (!entries.length) {
      // A revoked pilot must return keyboard controls to the actual game,
      // even when the NPC selector or Speak button held focus instead of input.
      const active = document.activeElement;
      if (active === input || active === roster || active === submit) {
        active.blur();
        document.querySelector("#arena")?.focus();
      }
    }
    roster.replaceChildren();
    for (const npc of entries) {
      const option = document.createElement("option");
      option.value = String(npc.id);
      option.textContent = `${npc.name} · ${npc.role}`;
      roster.append(option);
    }
    panel.hidden = !entries.length;
    obstacles = [];
    worksites = [];
    lastWorksiteRevision = null;
    worksiteSummary.textContent = "Worksites: waiting for server status.";
    lastStateTick = null;
    lastSuppliesTick = null;
    supplies.textContent = "Settlement supplies: awaiting verified server report.";
  }
  function updateState({ tick, states }) {
    if (panel.hidden || states.length !== npcs.length) return;
    if (lastStateTick !== null) {
      const difference = (tick - lastStateTick) >>> 0;
      if (difference === 0 || difference >= 0x80000000) return;
    }
    const stateById = new Map(states.map((npc) => [npc.id, npc]));
    if (npcs.some((npc) => !stateById.has(npc.id))) return;
    npcs = npcs.map((npc) => ({ ...npc, ...stateById.get(npc.id) }));
    lastStateTick = tick;
    for (const [i, npc] of npcs.entries()) {
      const label = ["resting", "working / traveling", "at post"][npc.activity] ?? "working";
      roster.options[i].textContent = `${npc.name} · ${npc.role} · ${label}`;
    }
  }
  function updateSupplies({ tick, sequence, stocks, lastActor, lastOperation }) {
    if (panel.hidden) return;
    if (lastSuppliesTick !== null) {
      const difference = (tick - lastSuppliesTick) >>> 0;
      if (difference === 0 || difference >= 0x80000000) return;
    }
    lastSuppliesTick = tick;
    const summary = `Well ${stocks.wellWater} · Yard water ${stocks.yardWater} · Depot rations ${stocks.depotFood} · Market rations ${stocks.stallFood} · Forge iron ${stocks.forgeIron} · Nails ${stocks.forgeNails}`;
    const actor = { 2: "Marta", 4: "Elara", 5: "Tomas" }[lastActor];
    const action = {
      1: "collected water", 2: "delivered water", 3: "collected rations",
      4: "delivered rations", 5: "forged nails",
    }[lastOperation];
    supplies.textContent = `Server stocks · ${summary}`
      + (sequence && actor && action ? ` · Latest #${sequence}: ${actor} ${action}` : "");
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    // A disabled submit button alone does not protect against Enter
    // submitting the same form while an earlier async send is pending.
    if (panel.hidden || submit.disabled) return;
    const text = input.value.trim();
    if (!text) return;
    const id = Number(roster.value);
    const target = npcs.find((npc) => npc.id === id);
    if (!target) return;
    // Character count is not UTF-8 byte length: 61 emoji fit a 240-char
    // browser input but exceed the authoritative 240-byte reliable limit.
    // Use the exact shared encoder contract before claiming a local send.
    try {
      encodeNpcRequest(id, text);
    } catch (error) {
      appendLine(error instanceof RangeError
        ? `Message exceeds ${NPC_WIRE.maxTextBytes} UTF-8 bytes.`
        : "Enter a valid single-line NPC message.");
      return;
    }
    if (pendingReplies.length >= MAX_PENDING_REPLIES) {
      appendLine("Waiting for NPC replies before sending more messages.");
      return;
    }
    const requestGeneration = rosterGeneration;
    // A server reply can race the local send promise. Do not display it
    // before the player's own submitted line is confirmed for this roster.
    const expected = { id, sent: false, replied: false, stagedText: null };
    pendingReplies.push(expected);
    submit.disabled = true;
    try {
      await onSend(id, text);
      if (requestGeneration !== rosterGeneration || panel.hidden) return;
      appendLine(`You → ${target.name}: ${text}`);
      expected.sent = true;
      if (expected.replied) appendLine(expected.stagedText);
      // Preserve a newer draft entered while the send was pending.
      if (input.value.trim() === text) input.value = "";
    } catch {
      const index = pendingReplies.indexOf(expected);
      if (index !== -1) pendingReplies.splice(index, 1);
      if (requestGeneration === rosterGeneration && !panel.hidden) {
        appendLine("Unable to send your message.");
      }
    } finally {
      if (requestGeneration === rosterGeneration) submit.disabled = false;
    }
  });
  // Every focusable NPC control must release held arena inputs. Otherwise
  // clicking the selector or Speak while holding movement can leave the
  // canvas without receiving the matching native keyup event.
  for (const control of [roster, input, submit]) {
    control.addEventListener("focus", () => {
      if (!panel.hidden) onFocus();
    });
  }
  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      input.blur();
      document.querySelector("#arena")?.focus();
    }
  });
  return {
    get npcs() { return npcs; },
    get obstacles() { return obstacles; },
    setObstacles(value) { obstacles = value; },
    get worksites() { return worksites; },
    setWorksites(value) {
      worksites = value;
      lastWorksiteRevision = null;
      worksiteSummary.textContent = "Worksites: waiting for server status.";
    },
    updateWorksiteStatus({ revision, active }) {
      if (panel.hidden || worksites.length !== 5 || active.length !== 5
          || (lastWorksiteRevision !== null && revision <= lastWorksiteRevision)) return;
      // Render from server status only. Never infer whether a world prop
      // can be used from its static label or its client canvas position.
      worksites = worksites.map((site, i) => ({ ...site, active: active[i] }));
      lastWorksiteRevision = revision;
      const available = active.filter(Boolean).length;
      worksiteSummary.textContent =
        `Server worksites · ${available}/5 available · revision ${revision}`
        + (available < 5 ? ` · Closed: ${worksites.filter(s => !s.active).map(s => s.name).join(", ")}` : "");
    },
    setRoster,
    updateState,
    updateSupplies,
    receive({ id, text }) {
      if (panel.hidden || !pendingReplies.length) return;
      // A wrong-NPC or duplicate unsolicited reply must not consume the
      // expected answer for the player’s real current message.
      if (pendingReplies[0].id !== id || !npcs.some((npc) => npc.id === id)) return;
      const expected = pendingReplies.shift();
      expected.replied = true;
      // The reliable response might precede onSend resolution. Stage it
      // until the local write succeeds; on failure the entry is discarded.
      if (expected.sent) appendLine(text);
      else expected.stagedText = text;
    },
    focus() { if (!panel.hidden) { onFocus(); input.focus(); } },
    get enabled() { return !panel.hidden; },
  };
}
