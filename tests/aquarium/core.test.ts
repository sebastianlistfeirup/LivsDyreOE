import { describe, expect, it } from "vitest";
import { LEVELS } from "../../src/aquarium/content/levels";
import {
  createBoard,
  getHint,
  getLegalMoves,
  grantMoves,
  isWon,
  playTurn,
  reshuffle,
  type BoardState,
  type TileType,
} from "../../src/aquarium/core";
import { applyGravity } from "../../src/aquarium/core/gravity";
import { findMatchGroups } from "../../src/aquarium/core/matches";

function fixture(levelId = 1): BoardState {
  const board = createBoard(levelId);
  board.tiles = board.tiles.map((tile, cell) =>
    tile
      ? {
          id: cell + 1,
          type: ((Math.floor(cell / 8) * 2 + (cell % 8)) % 5) as TileType,
        }
      : null,
  );
  board.nextId = 65;
  return board;
}

describe("deterministic match-3 board", () => {
  it("creates all thirty shaped 8×8 levels without matches and with legal opening moves", () => {
    expect(LEVELS).toHaveLength(30);
    expect(new Set(LEVELS.map((level) => level.voids.join(","))).size).toBe(30);
    for (const level of LEVELS) {
      const board = createBoard(level.id);
      expect(board.tiles).toHaveLength(64);
      expect(board.blockers.filter(Boolean)).toHaveLength(level.coral.length);
      expect(board.sand.filter(Boolean)).toHaveLength(level.sand.length);
      expect(board.voids?.filter(Boolean)).toHaveLength(level.voids.length);
      expect(board.rocks?.filter(Boolean)).toHaveLength(level.rocks.length);
      expect(board.clams?.filter(Boolean)).toHaveLength(level.clams.length);
      expect(board.bubbles?.filter(Boolean)).toHaveLength(level.bubbles.length);
      const terrain = [...level.voids, ...level.rocks, ...level.clams, ...level.coral];
      expect(new Set(terrain).size, `Overlapping occupied terrain in level ${level.id}`).toBe(terrain.length);
      for (const cell of [...level.sand, ...level.bubbles]) expect(terrain).not.toContain(cell);
      expect(findMatchGroups(board.tiles)).toHaveLength(0);
      expect(getLegalMoves(board).length).toBeGreaterThan(0);
      expect(board.movesRemaining).toBe(level.moves);
      expect(
        board.objectives.map(({ kind, target }) => [kind, target]),
      ).toEqual(level.objectives.map(({ kind, target }) => [kind, target]));
      expect(createBoard(level.id)).toEqual(board);
      const ids = board.tiles.flatMap((tile) => (tile ? [tile.id] : []));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("rejects an invalid swap without consuming a move or mutating the checkpoint", () => {
    const board = createBoard(1);
    const legal = new Set(
      getLegalMoves(board)
        .filter((move) => move.kind === "swap")
        .map((move) => `${move.from},${move.to}`),
    );
    const from = board.tiles.findIndex(
      (tile, cell) =>
        tile &&
        board.tiles[cell + 1] &&
        cell % 8 < 7 &&
        !legal.has(`${cell},${cell + 1}`),
    );
    expect(from).toBeGreaterThanOrEqual(0);
    const before = structuredClone(board);
    const result = playTurn(board, { kind: "swap", from, to: from + 1 });
    expect(result.valid).toBe(false);
    expect(result.state).toBe(board);
    expect(result.events).toEqual([]);
    expect(board).toEqual(before);
  });

  it("gives levels three and seven a real opening four-match tutorial move", () => {
    for (const levelId of [3, 7]) {
      const board = createBoard(levelId);
      const result = playTurn(board, { kind: "swap", from: 11, to: 3 });
      expect(result.valid).toBe(true);
      expect(result.events[1].created).toEqual([
        expect.objectContaining({
          cell: 3,
          tile: expect.objectContaining({ special: "row" }),
        }),
      ]);
    }
  });

  it("creates a horizontal ray at the swapped destination for four in a row", () => {
    const board = fixture();
    for (const cell of [0, 1, 3, 10]) board.tiles[cell]!.type = 0;
    board.tiles[2]!.type = 1;
    expect(findMatchGroups(board.tiles)).toHaveLength(0);
    const result = playTurn(board, { kind: "swap", from: 10, to: 2 });
    expect(result.valid).toBe(true);
    expect(result.state.movesRemaining).toBe(board.movesRemaining - 1);
    expect(result.state.turnId).toBe(1);
    expect(result.events[0].kind).toBe("swap");
    expect(result.events[1].created).toEqual([
      { cell: 2, tile: { id: 11, type: 0, special: "row" } },
    ]);
    expect(result.events[1].removed?.map((item) => item.cell)).toEqual([
      0, 1, 3,
    ]);
    expect(result.events.some((event) => event.kind === "fall")).toBe(true);
    expect(board.tiles[10]?.type).toBe(0);
  });

  it("prioritizes a T/L bomb over rays and places it at the swap destination", () => {
    const board = fixture();
    for (const cell of [19, 25, 26, 28, 35]) board.tiles[cell]!.type = 0;
    board.tiles[27]!.type = 1;
    expect(findMatchGroups(board.tiles)).toHaveLength(0);
    const result = playTurn(board, { kind: "swap", from: 28, to: 27 });
    expect(result.valid).toBe(true);
    expect(result.events[1].created?.[0]).toMatchObject({
      cell: 27,
      tile: { special: "bomb" },
    });
  });

  it("activates both swapped specials once, even when their effects intersect", () => {
    const board = fixture(7);
    board.tiles[27] = { id: 28, type: 0, special: "row" };
    board.tiles[28] = { id: 29, type: 1, special: "column" };
    const result = playTurn(board, { kind: "swap", from: 27, to: 28 });
    expect(result.valid).toBe(true);
    const firstClear = result.events.find((event) => event.kind === "clear")!;
    expect(firstClear.activated?.map(({ tile }) => tile.id).sort()).toEqual([
      28, 29,
    ]);
    expect(new Set(firstClear.removed?.map(({ tile }) => tile.id)).size).toBe(
      firstClear.removed?.length,
    );
    expect(
      result.state.objectives.find((objective) => objective.kind === "special")
        ?.collected,
    ).toBe(2);
  });

  it("uses the swapped normal tile as a color pearl target", () => {
    const board = fixture();
    board.tiles[27] = { id: 28, type: 4, special: "color" };
    board.tiles[28] = { id: 29, type: 2 };
    const normalDrops = board.tiles.filter(
      (tile) => tile?.type === 2 && !tile.special,
    ).length;
    const result = playTurn(board, { kind: "swap", from: 27, to: 28 });
    const firstClear = result.events.find((event) => event.kind === "clear")!;
    expect(firstClear.activated?.map(({ tile }) => tile.id)).toEqual([28]);
    expect(
      firstClear.removed?.filter(
        ({ tile }) => tile.type === 2 && !tile.special,
      ),
    ).toHaveLength(normalDrops);
  });

  it("chooses the most prevalent normal type with lower type-id as tie breaker when an effect hits a color pearl", () => {
    const board = fixture();
    board.tiles[24] = { id: 25, type: 1, special: "row" };
    board.tiles[27] = { id: 28, type: 4, special: "color" };
    const counts = [0, 0, 0, 0, 0];
    for (const tile of board.tiles)
      if (tile && !tile.special) counts[tile.type]++;
    const expected = counts.indexOf(Math.max(...counts));
    const result = playTurn(board, { kind: "use", cell: 24 });
    const firstClear = result.events.find((event) => event.kind === "clear")!;
    expect(firstClear.activated?.map(({ tile }) => tile.id)).toEqual([25, 28]);
    const removedOfType = firstClear.removed?.filter(
      ({ tile }) => tile.type === expected && !tile.special,
    ).length;
    expect(removedOfType).toBe(counts[expected]);
  });

  it("uses color > bomb > ray priority for overlapping patterns", () => {
    const board = fixture();
    for (const cell of [0, 1, 2, 3, 4, 10, 18]) board.tiles[cell]!.type = 0;
    const group = findMatchGroups(board.tiles).find((match) =>
      match.cells.includes(2),
    );
    expect(group?.cells.length).toBeGreaterThanOrEqual(7);
    expect(group?.special).toBe("color");
  });

  it("clears sand only under removed tiles, including an activated special", () => {
    const board = fixture(4);
    board.tiles[56] = { id: 57, type: 0, special: "row" };
    board.sand[56] = true;
    const result = playTurn(board, { kind: "use", cell: 56 });
    expect(result.valid).toBe(true);
    expect(result.events[0].removed?.some((item) => item.cell === 56)).toBe(
      true,
    );
    expect(result.state.sand[56]).toBe(false);
    expect(result.state.objectives[0].collected).toBeGreaterThan(0);
    expect(board.sand[56]).toBe(true);
  });

  it("uses coral as a gravity divider, then fills an opened wall cell", () => {
    const board = fixture(9);
    const upper = board.tiles[16]!.id;
    const lower = board.tiles[32]!.id;
    board.tiles[40] = null;
    applyGravity(board);
    const afterFirstFall = [...board.tiles];
    expect(board.tiles[16]?.id).toBe(upper);
    expect(board.tiles[24]).toBeNull();
    expect(afterFirstFall[40]?.id).toBe(lower);
    board.blockers[24] = false;
    board.tiles[24] = null;
    applyGravity(board);
    expect(board.tiles[24]).not.toBeNull();
  });

  it("removes coral only on neighbouring match or direct special hit", () => {
    const board = fixture(5);
    board.tiles[16] = { id: 17, type: 0, special: "row" };
    const result = playTurn(board, { kind: "use", cell: 16 });
    expect(result.valid).toBe(true);
    expect(result.state.blockers[18]).toBe(false);
    expect(result.state.blockers[21]).toBe(false);
    expect(result.state.objectives[0].collected).toBeGreaterThanOrEqual(2);
  });

  it("reshuffles for free without changing objectives, obstacles or moves", () => {
    const board = fixture(5);
    const before = structuredClone(board);
    const event = reshuffle(board);
    expect(event.kind).toBe("shuffle");
    expect(board.blockers).toEqual(before.blockers);
    expect(board.sand).toEqual(before.sand);
    expect(board.movesRemaining).toBe(before.movesRemaining);
    expect(board.objectives).toEqual(before.objectives);
    expect(findMatchGroups(board.tiles)).toHaveLength(0);
    expect(getHint(board)).not.toBeNull();
  });

  it("keeps free continuation unlimited and victory based on objectives, not remaining moves", () => {
    const board = fixture();
    board.movesRemaining = 0;
    expect(getLegalMoves(board)).toEqual([]);
    expect(grantMoves(board).movesRemaining).toBe(5);
    expect(grantMoves(grantMoves(board)).movesRemaining).toBe(10);
    expect(board.movesRemaining).toBe(0);
    board.objectives[0].collected = board.objectives[0].target;
    expect(isWon(board)).toBe(true);
  });

  it("replays the same saved checkpoint and action into identical cascades and PRNG state", () => {
    const checkpoint = createBoard(6);
    const action = getHint(checkpoint)!;
    const serialized = JSON.stringify(checkpoint);
    const first = playTurn(checkpoint, action);
    const restored = JSON.parse(serialized) as BoardState;
    const second = playTurn(restored, action);
    expect(first).toEqual(second);
    expect(JSON.stringify(checkpoint)).toBe(serialized);
  });
});
