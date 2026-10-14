import { describe, expect, it } from "vitest";
import { LEVELS } from "../../src/aquarium/content/levels";
import {
  createBoard,
  getHint,
  getLegalMoves,
  isWon,
  playTurn,
  type Action,
  type BoardState,
} from "../../src/aquarium/core";

type Candidate = { state: BoardState; path: Action[]; rating: number };

function rating(board: BoardState): number {
  const progress = board.objectives.reduce(
    (sum, objective) => sum + objective.collected / objective.target,
    0,
  );
  const specials = board.tiles.filter((tile) => tile?.special).length;
  return progress * 1000 + specials * 7;
}

function signature(board: BoardState): string {
  return `${board.rngState}|${board.tiles.map((tile) => (tile ? `${tile.type}${tile.special?.[0] ?? ""}` : "x")).join(",")}|${board.blockers.map(Number).join("")}|${board.sand.map(Number).join("")}|${board.objectives.map((objective) => objective.collected).join(",")}`;
}

function solve(seedBoard: BoardState, width = 24): Action[] | null {
  let beam: Candidate[] = [
    { state: seedBoard, path: [], rating: rating(seedBoard) },
  ];
  for (let depth = 0; depth < seedBoard.movesRemaining; depth++) {
    const choices: Candidate[] = [];
    const seen = new Set<string>();
    for (const candidate of beam) {
      for (const action of getLegalMoves(candidate.state)) {
        const result = playTurn(candidate.state, action);
        if (!result.valid) continue;
        const path = [...candidate.path, action];
        if (isWon(result.state)) return path;
        const key = signature(result.state);
        if (seen.has(key)) continue;
        seen.add(key);
        choices.push({
          state: result.state,
          path,
          rating: rating(result.state),
        });
      }
    }
    choices.sort(
      (a, b) => b.rating - a.rating || b.state.rngState - a.state.rngState,
    );
    beam = choices.slice(0, width);
    if (!beam.length) break;
  }
  return null;
}

describe("fixed-seed level solvability", () => {
  for (const level of LEVELS) {
    it(`level ${level.id} has an actual winning path from seed ${level.seed}`, () => {
      const path = solve(createBoard(level.id));
      expect(
        path,
        `No winning path found for level ${level.id}; rebalance its seed or move budget.`,
      ).not.toBeNull();
      let replay = createBoard(level.id);
      for (const action of path!) {
        const result = playTurn(replay, action);
        expect(result.valid).toBe(true);
        replay = result.state;
      }
      expect(isWon(replay)).toBe(true);
    }, 120_000);
  }
  it("keeps hint-following playthroughs within every move budget", () => {
    for (const level of LEVELS) {
      let board = createBoard(level.id);
      let maxWaves = 0;
      let used = 0;
      while (board.movesRemaining > 0 && !isWon(board)) {
        const action = getHint(board);
        expect(action).not.toBeNull();
        const turn = playTurn(board, action!);
        maxWaves = Math.max(
          maxWaves,
          turn.events.filter((event) => event.kind === "clear").length,
        );
        used++;
        board = turn.state;
      }
      expect(
        isWon(board),
        `Hints failed on level ${level.id} after ${used} moves`,
      ).toBe(true);
      expect(maxWaves).toBeLessThanOrEqual(8);
    }
  }, 120_000);
});
