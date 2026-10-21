// Display a tick only if it was actually received from the authoritative client.
// Never extrapolate or run a UI-side tick clock.
export function authoritativeOnlineStatus(playerId, serverTick) {
  if (!Number.isInteger(playerId) || playerId < 1 || playerId > 0xffffffff
    || !Number.isInteger(serverTick) || serverTick < 0 || serverTick > 0xffffffff) return null;
  return `Online - player #${playerId} - server tick ${serverTick}`;
}
