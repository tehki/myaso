// Passive qualification of actual three-client evidence, never UI mutation.
export function isM147RenderedRecoveryCue(cue, jumpId) {
  return Number.isSafeInteger(jumpId) && jumpId > 0 && cue?.visible === true
    && cue.state === "jump-attack-recovery" && cue.label === "PUNISH"
    && cue.detail === "Jump attack recovery" && Number.isFinite(cue.epochMs)
    && cue.focusLabel === `PUNISH TARGET #${jumpId}`;
}

export function hasM147PunishFeedback(states, { jumpBrowser, observerBrowser, closerBrowser }) {
  const jump = states.find(x => x.browser === jumpBrowser);
  const observer = states.find(x => x.browser === observerBrowser);
  const closer = states.find(x => x.browser === closerBrowser);
  return Boolean(jump && observer && closer
    && jump.playerHp === 66 && observer.playerHp === 100 && closer.playerHp === 100
    && [jump, observer, closer].every(x => x.playerGuard === 100)
    && jump.events.includes("Hit taken - 34 HP.")
    && observer.events.includes("Opponent hit - 34 HP.")
    && !closer.events.includes("Hit taken - 34 HP."));
}
