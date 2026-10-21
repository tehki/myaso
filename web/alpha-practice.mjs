// Keep the multiplayer lobby useful even when WebTransport or the server
// configuration is unavailable. This is navigation only, not a session.
export function installLobbyPracticeLink(doc) {
  const actions = doc.querySelector(".actions");
  if (!actions) return null;
  const existing = doc.getElementById("lobby-practice-link");
  if (existing) return existing;

  const practice = doc.createElement("a");
  practice.id = "lobby-practice-link";
  practice.className = "practice-link";
  practice.href = "/web/";
  practice.textContent = "TRY LOCAL PRACTICE";
  const invite = doc.getElementById("copy-invite");
  if (invite && invite.parentElement === actions) actions.insertBefore(practice, invite);
  else actions.appendChild(practice);
  return practice;
}
