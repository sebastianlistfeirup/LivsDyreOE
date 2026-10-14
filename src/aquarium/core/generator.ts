import { getLevel } from "../content/levels";
import { findMatchGroups } from "./matches";
import { randomInt } from "./rng";
import type { BoardState, Tile, TileType } from "./types";

function adjacent(a: number, b: number): boolean {
  return (
    a >= 0 &&
    a < 64 &&
    b >= 0 &&
    b < 64 &&
    ((Math.floor(a / 8) === Math.floor(b / 8) && Math.abs(a - b) === 1) ||
      Math.abs(a - b) === 8)
  );
}

export function hasLegalMove(
  tiles: readonly (Tile | null)[],
  blockers: readonly boolean[],
): boolean {
  for (let a = 0; a < 64; a++) {
    if (blockers[a] || !tiles[a]) continue;
    if (
      tiles[a]?.special === "row" ||
      tiles[a]?.special === "column" ||
      tiles[a]?.special === "bomb"
    )
      return true;
    for (const b of [a + 1, a + 8]) {
      if (!adjacent(a, b) || blockers[b] || !tiles[b]) continue;
      if (tiles[a]?.special || tiles[b]?.special) return true;
      const swapped = [...tiles];
      [swapped[a], swapped[b]] = [swapped[b], swapped[a]];
      if (findMatchGroups(swapped).length) return true;
    }
  }
  return false;
}

function createsTriple(tiles: readonly (Tile | null)[], cell: number): boolean {
  const type = tiles[cell]?.type;
  if (type === undefined) return false;
  const row = Math.floor(cell / 8),
    col = cell % 8;
  for (const [dr, dc] of [
    [0, 1],
    [1, 0],
  ]) {
    for (let offset = -2; offset <= 0; offset++) {
      let same = true;
      for (let step = 0; step < 3; step++) {
        const r = row + (offset + step) * dr,
          c = col + (offset + step) * dc;
        if (
          r < 0 ||
          r > 7 ||
          c < 0 ||
          c > 7 ||
          tiles[r * 8 + c]?.type !== type ||
          tiles[r * 8 + c]?.special === "color"
        ) {
          same = false;
          break;
        }
      }
      if (same) return true;
    }
  }
  return false;
}

export function createBoard(levelId: number, seed?: number): BoardState {
  const level = getLevel(levelId);
  if (seed !== undefined && (!Number.isSafeInteger(seed) || seed < 0))
    throw new RangeError("Seed must be a nonnegative integer.");
  let rngState = (seed ?? level.seed) >>> 0;
  const blockers = Array.from({ length: 64 }, (_, cell) =>
    level.coral.includes(cell),
  );
  const sand = Array.from({ length: 64 }, (_, cell) =>
    level.sand.includes(cell),
  );
  const fixed = new Map<number, TileType>();
  if (level.openingRay) {
    // Swap cells 3 and 11 to make four leaves on the first row.
    for (const [cell, type] of [
      [0, 2],
      [1, 3],
      [2, 3],
      [3, 1],
      [4, 3],
      [5, 0],
      [11, 3],
    ] as const)
      fixed.set(cell, type);
  }
  for (let attempt = 0; attempt < 1024; attempt++) {
    const tiles: (Tile | null)[] = Array(64).fill(null);
    let failed = false;
    for (const [cell, type] of fixed) tiles[cell] = { id: cell + 1, type };
    for (let cell = 0; cell < 64; cell++) {
      if (blockers[cell] || fixed.has(cell)) continue;
      const [start, next] = randomInt(rngState, 5);
      rngState = next;
      let chosen: TileType | undefined;
      for (let offset = 0; offset < 5; offset++) {
        const type = ((start + offset) % 5) as TileType;
        tiles[cell] = { id: cell + 1, type };
        if (!createsTriple(tiles, cell)) {
          chosen = type;
          break;
        }
      }
      if (chosen === undefined) {
        failed = true;
        break;
      }
    }
    if (
      failed ||
      findMatchGroups(tiles).length ||
      !hasLegalMove(tiles, blockers)
    )
      continue;
    let nextId = 1;
    for (const tile of tiles) if (tile) tile.id = nextId++;
    return {
      levelId,
      tiles,
      blockers,
      sand,
      rngState,
      movesRemaining: level.moves,
      objectives: level.objectives.map((objective) => ({
        ...objective,
        collected: 0,
      })),
      nextId,
      turnId: 0,
    };
  }
  throw new Error(`Could not generate a playable board for level ${levelId}`);
}
