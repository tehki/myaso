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
  panel.append(heading, description, roster, history, form);
  document.querySelector(".arena-wrap")?.append(panel);
  let npcs = [];

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
    setRoster,
    receive({ text }) { appendLine(text); },
    focus() { if (!panel.hidden) { onFocus(); input.focus(); } },
    get enabled() { return !panel.hidden; },
  };
}
