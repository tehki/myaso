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
  panel.append(heading, description, roster, supplies, history, form);
  document.querySelector(".arena-wrap")?.append(panel);
  let npcs = [];
  let obstacles = [];
  let lastStateTick = null;
  let lastSuppliesTick = null;

  function appendLine(text) {
    const li = document.createElement("li");
    // Absolutely no innerHTML: player and server responses are untrusted text.
    li.textContent = text;
    history.append(li);
    while (history.children.length > 12) history.firstElementChild.remove();
    history.scrollTop = history.scrollHeight;
  }
  function setRoster(entries) {
    npcs = entries;
    roster.replaceChildren();
    for (const npc of entries) {
      const option = document.createElement("option");
      option.value = String(npc.id);
      option.textContent = `${npc.name} · ${npc.role}`;
      roster.append(option);
    }
    panel.hidden = !entries.length;
    obstacles = [];
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
    const text = input.value.trim();
    if (!text) return;
    const id = Number(roster.value);
    const target = npcs.find((npc) => npc.id === id);
    if (!target) return;
    submit.disabled = true;
    try {
      await onSend(id, text);
      appendLine(`You → ${target.name}: ${text}`);
      input.value = "";
    } catch {
      appendLine("Unable to send your message.");
    } finally {
      submit.disabled = false;
    }
  });
  input.addEventListener("focus", onFocus);
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
    setRoster,
    updateState,
    updateSupplies,
    receive({ text }) { appendLine(text); },
    focus() { if (!panel.hidden) { onFocus(); input.focus(); } },
    get enabled() { return !panel.hidden; },
  };
}
