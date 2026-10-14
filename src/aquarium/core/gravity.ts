import { randomInt } from "./rng";
import type { BoardState, TileType } from "./types";
import { isOccupied } from "./terrain";

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

/** All fixed terrain divides gravity into independent segments, in any current direction. */
export function applyGravity(board: BoardState): void {
  const direction = board.gravity ?? "down";
  for (let line = 0; line < 8; line++) {
    // Cells are ordered from the destination edge back toward the source.
    const cells = Array.from({ length: 8 }, (_, offset) =>
      direction === "down"
        ? (7 - offset) * 8 + line
        : direction === "up"
          ? offset * 8 + line
          : direction === "left"
            ? line * 8 + offset
            : line * 8 + 7 - offset,
    );
    let start = 0;
    while (start < 8) {
      if (isOccupied(board, cells[start])) {
        start++;
        continue;
      }
      let end = start + 1;
      while (end < 8 && !isOccupied(board, cells[end])) end++;
      const segment = cells.slice(start, end);
      const surviving = segment.flatMap((cell) =>
        board.tiles[cell] ? [board.tiles[cell]!] : [],
      );
      segment.forEach((cell, index) => {
        board.tiles[cell] = surviving[index] ?? null;
      });
      start = end;
    }
  }
  // Keep genuine matches formed by falling survivors, but do not manufacture
  // runaway cascades simply because a random refill happens to make a triple.
  for (let cell = 0; cell < 64; cell++) {
    if (isOccupied(board, cell) || board.tiles[cell]) continue;
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
