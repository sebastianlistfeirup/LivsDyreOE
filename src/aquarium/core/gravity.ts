import { randomInt } from "./rng";
import type { BoardState, TileType } from "./types";

function makesTriple(board: BoardState, cell: number): boolean {
  const type = board.tiles[cell]?.type;
  if (type === undefined) return false;
  const row = Math.floor(cell / 8),
    col = cell % 8;
  for (const [dr, dc] of [
    [0, 1],
    [1, 0],
  ]) {
    for (let start = -2; start <= 0; start++) {
      let match = true;
      for (let step = 0; step < 3; step++) {
        const r = row + (start + step) * dr,
          c = col + (start + step) * dc;
        if (
          r < 0 ||
          r >= 8 ||
          c < 0 ||
          c >= 8 ||
          board.tiles[r * 8 + c]?.type !== type ||
          board.tiles[r * 8 + c]?.special === "color"
        ) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
  }
  return false;
}

/** Each coral cell is an impermeable boundary until that coral is destroyed. */
export function applyGravity(board: BoardState): void {
  for (let col = 0; col < 8; col++) {
    let bottom = 7;
    while (bottom >= 0) {
      if (board.blockers[bottom * 8 + col]) {
        bottom--;
        continue;
      }
      let top = bottom;
      while (top > 0 && !board.blockers[(top - 1) * 8 + col]) top--;
      const surviving = [];
      for (let row = bottom; row >= top; row--) {
        const tile = board.tiles[row * 8 + col];
        if (tile) surviving.push(tile);
      }
      for (let row = bottom; row >= top; row--) {
        const tile = surviving[bottom - row];
        board.tiles[row * 8 + col] = tile ?? null;
      }
      bottom = top - 1;
    }
  }
  // Keep genuine matches formed by falling survivors, but do not manufacture
  // runaway cascades simply because a random refill happens to make a triple.
  for (let cell = 0; cell < 64; cell++) {
    if (board.blockers[cell] || board.tiles[cell]) continue;
    const [start, next] = randomInt(board.rngState, 5);
    board.rngState = next;
    let type = start as TileType;
    // Four candidate types are enough to suppress most chance triples while
    // leaving a small possibility of a delightful spontaneous cascade.
    for (let offset = 0; offset < 4; offset++) {
      type = ((start + offset) % 5) as TileType;
      board.tiles[cell] = { id: board.nextId, type };
      if (!makesTriple(board, cell)) break;
    }
    board.tiles[cell] = { id: board.nextId++, type };
  }
}
