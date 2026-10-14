import type { BoardState } from "./types";

/** A deep, non-mutating migration: never infer new level terrain for an old saved board. */
export function normalizeBoard(board: BoardState): BoardState {
  return {
    ...board,
    tiles: board.tiles.map((tile) => (tile ? { ...tile } : null)),
    blockers: [...board.blockers],
    sand: [...board.sand],
    objectives: board.objectives.map((objective) => ({ ...objective })),
    voids: board.voids ? [...board.voids] : Array(64).fill(false),
    rocks: board.rocks ? [...board.rocks] : Array(64).fill(false),
    clams: board.clams ? [...board.clams] : Array(64).fill(0),
    bubbles: board.bubbles ? [...board.bubbles] : Array(64).fill(false),
    gravity: board.gravity ?? "down",
  };
}

export function isOccupied(board: BoardState, cell: number): boolean {
  return Boolean(
    board.blockers[cell] ||
      board.voids?.[cell] ||
      board.rocks?.[cell] ||
      board.clams?.[cell],
  );
}
