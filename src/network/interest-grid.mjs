export class SpatialInterestGrid {
  #cellSize;
  #cells = new Map();
  #entities = new Map();

  constructor({ cellSize }) {
    if (!Number.isFinite(cellSize) || cellSize <= 0) throw new RangeError("cellSize must be positive");
    this.#cellSize = cellSize;
  }

  get size() {
    return this.#entities.size;
  }

  upsert(entity) {
    if (entity?.netId === undefined) throw new TypeError("entity.netId is required");
    if (!Number.isFinite(entity.x) || !Number.isFinite(entity.y)) throw new TypeError("entity position must be finite");
    const nextKey = this.#cellKey(entity.x, entity.y);
    const previous = this.#entities.get(entity.netId);
    if (previous?.cellKey !== nextKey) {
      if (previous) this.#removeFromCell(previous.cellKey, entity.netId);
      let cell = this.#cells.get(nextKey);
      if (!cell) this.#cells.set(nextKey, cell = new Set());
      cell.add(entity.netId);
    }
    this.#entities.set(entity.netId, { entity, cellKey: nextKey });
  }

  remove(netId) {
    const previous = this.#entities.get(netId);
    if (!previous) return false;
    this.#removeFromCell(previous.cellKey, netId);
    this.#entities.delete(netId);
    return true;
  }

  get(netId) {
    return this.#entities.get(netId)?.entity ?? null;
  }

  queryCircle(x, y, radius) {
    if (![x, y, radius].every(Number.isFinite) || radius < 0) throw new RangeError("query must be finite and radius non-negative");
    const minX = Math.floor((x - radius) / this.#cellSize);
    const maxX = Math.floor((x + radius) / this.#cellSize);
    const minY = Math.floor((y - radius) / this.#cellSize);
    const maxY = Math.floor((y + radius) / this.#cellSize);
    const radiusSq = radius * radius;
    const entities = [];
    let cellsVisited = 0;
    let candidatesChecked = 0;

    for (let cellY = minY; cellY <= maxY; cellY += 1) {
      for (let cellX = minX; cellX <= maxX; cellX += 1) {
        cellsVisited += 1;
        const cell = this.#cells.get(`${cellX}:${cellY}`);
        if (!cell) continue;
        for (const netId of cell) {
          candidatesChecked += 1;
          const entity = this.#entities.get(netId)?.entity;
          if (!entity) continue;
          const dx = entity.x - x;
          const dy = entity.y - y;
          if (dx * dx + dy * dy <= radiusSq) entities.push(entity);
        }
      }
    }
    return { entities, cellsVisited, candidatesChecked };
  }

  #cellKey(x, y) {
    return `${Math.floor(x / this.#cellSize)}:${Math.floor(y / this.#cellSize)}`;
  }

  #removeFromCell(cellKey, netId) {
    const cell = this.#cells.get(cellKey);
    if (!cell) return;
    cell.delete(netId);
    if (cell.size === 0) this.#cells.delete(cellKey);
  }
}
