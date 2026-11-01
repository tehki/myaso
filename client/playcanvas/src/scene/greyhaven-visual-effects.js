// Graphics 3C: PlayCanvas visual-only day/dusk environment.
export const GREYHAVEN_VISUAL_BUDGET = Object.freeze({
  maxChimneys: 2,
  wispsPerChimney: 6,
  maxPracticalLights: 4,
  shadowResolution: 1024,
  shadowDistance: 65
});

export function greyhavenLook(query) {
  const params = query instanceof URLSearchParams ? query : new URLSearchParams(query ?? '');
  return params.get('greyhavenTime') === 'dusk' ? 'dusk' : 'day';
}

export function smokePlan(chimneys, timeOfDay) {
  if (!Array.isArray(chimneys) || chimneys.length > GREYHAVEN_VISUAL_BUDGET.maxChimneys ||
      !['day','dusk'].includes(timeOfDay)) throw new TypeError('Invalid visual smoke plan');
  if (timeOfDay === 'day') return Object.freeze([]);
  return Object.freeze(chimneys.map(chimney => {
    if (typeof chimney.name !== 'string' || !chimney.name ||
        ![chimney.x,chimney.y,chimney.z].every(Number.isFinite))
      throw new TypeError('Invalid visual chimney position');
    return Object.freeze({...chimney});
  }));
}
