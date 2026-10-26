// Read-only native acceptance parser. Never changes combat authority or HIT.
export function hasOriginalWorldActionTransition(log, fighter, from, to) {
  if (typeof log !== "string" || ![fighter,from,to].every(Number.isSafeInteger)
      || fighter < 1 || from < 0 || to < 0) return false;
  return log.split(/\r?\n/).some(line => {
    const match = /^M201_AUTH_ACTION tick=(\d+) fighter=(\d+) from=(\d+) to=(\d+)$/.exec(line);
    return match !== null && Number(match[2]) === fighter
      && Number(match[3]) === from && Number(match[4]) === to;
  });
}
