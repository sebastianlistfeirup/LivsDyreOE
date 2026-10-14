import { describe, expect, it } from "vitest";
import {
  createBoard,
  getLegalMoves,
  grantMoves,
  isWon,
  playTurn,
  isOccupied,
  type BoardState,
  type Tile,
  type TileType,
} from "../../src/aquarium/core";
import { applyGravity } from "../../src/aquarium/core/gravity";
import { findMatchGroups } from "../../src/aquarium/core/matches";

function settledInvariants(board: BoardState): void {
  expect(board.tiles).toHaveLength(64);
  expect(board.blockers).toHaveLength(64);
  expect(board.sand).toHaveLength(64);
  expect(findMatchGroups(board.tiles)).toHaveLength(0);
  const ids = board.tiles.flatMap((tile) => (tile ? [tile.id] : []));
  expect(new Set(ids).size).toBe(ids.length);
  for (let cell = 0; cell < 64; cell++) {
    expect(Boolean(board.tiles[cell])).toBe(!isOccupied(board, cell));
    expect(isOccupied(board, cell) && board.sand[cell]).toBe(false);
    expect(board.clams?.[cell] ?? 0).toBeGreaterThanOrEqual(0);
    expect(board.clams?.[cell] ?? 0).toBeLessThanOrEqual(2);
  }
  for (const objective of board.objectives) {
    expect(objective.collected).toBeGreaterThanOrEqual(0);
    expect(objective.collected).toBeLessThanOrEqual(objective.target);
  }
  if (!isWon(board) && board.movesRemaining > 0)
    expect(getLegalMoves(board).length).toBeGreaterThan(0);
}

describe("settled-board invariants", () => {
  it("groups only touching matched runs of the same type", () => {
    const tiles: (Tile | null)[] = Array(64).fill(null);
    for (const cell of [0, 1, 2, 8, 9, 10])
      tiles[cell] = { id: cell + 1, type: 0 };
    expect(findMatchGroups(tiles)).toMatchObject([
      { cells: [0, 1, 2, 8, 9, 10], special: undefined },
    ]);
    for (const cell of [8, 9, 10]) tiles[cell] = { id: cell + 1, type: 1 };
    expect(findMatchGroups(tiles)).toHaveLength(2);
    tiles.fill(null);
    for (const cell of [0, 1, 2, 19, 20, 21, 10, 11])
      tiles[cell] = { id: cell + 1, type: 0 };
    expect(findMatchGroups(tiles)).toHaveLength(2); // An unmatched bridge cannot connect runs.
    tiles.fill(null);
    for (const cell of [0, 1, 2, 11, 12, 13])
      tiles[cell] = { id: cell + 1, type: 0 };
    expect(findMatchGroups(tiles)).toHaveLength(2); // Diagonal contact is not connected.
  });

  it("creates only one ray for two touching parallel four-runs", () => {
    const tiles: (Tile | null)[] = Array(64).fill(null);
    for (const cell of [0, 1, 2, 3, 8, 9, 10, 11])
      tiles[cell] = { id: cell + 1, type: 0 };
    const groups = findMatchGroups(tiles);
    expect(groups).toHaveLength(1);
    expect(groups[0].special).toBe("row");
  });

  it("does not count the ordinary tile transformed into a color pearl as cleared", () => {
    const board = createBoard(1);
    board.tiles = board.tiles.map((tile, cell) =>
      tile
        ? {
            id: cell + 1,
            type: ((Math.floor(cell / 8) * 2 + (cell % 8)) % 5) as TileType,
          }
        : null,
    );
    board.nextId = 65;
    for (const cell of [0, 1, 3, 4, 10]) board.tiles[cell]!.type = 0;
    board.tiles[2]!.type = 1;
    board.tiles[5]!.type = 2;
    expect(findMatchGroups(board.tiles)).toHaveLength(0);
    const result = playTurn(board, { kind: "swap", from: 10, to: 2 });
    expect(result.valid).toBe(true);
    expect(result.events[1].created).toMatchObject([
      { cell: 2, tile: { special: "color" } },
    ]);
    expect(
      result.events[1].removed?.filter((item) => item.tile.type === 0),
    ).toHaveLength(4);
    expect(result.events[1].removed?.some((item) => item.cell === 2)).toBe(
      false,
    );
  });

  it("does not damage adjacent coral merely because a ray removed a neighbour", () => {
    const board = createBoard(9);
    board.tiles[16] = {
      id: board.tiles[16]!.id,
      type: board.tiles[16]!.type,
      special: "row",
    };
    const result = playTurn(board, { kind: "use", cell: 16 });
    expect(result.valid).toBe(true);
    expect(result.events[0].blockers.filter(Boolean)).toHaveLength(8);
    expect(result.events[0].removed?.some((item) => item.cell === 16)).toBe(
      true,
    );
  });

  it("chooses the lower type id in an actual most-common tie after a ray hits a color pearl", () => {
    const board = createBoard(1);
    board.tiles = board.tiles.map((_, cell) => ({
      id: cell + 1,
      type: ((Math.floor(cell / 8) + (cell % 8)) % 2) as TileType,
    }));
    board.tiles[24] = { id: 25, type: 1, special: "row" };
    board.tiles[27] = { id: 28, type: 0, special: "color" };
    board.nextId = 65;
    const before = [0, 0];
    for (const tile of board.tiles)
      if (tile && !tile.special) before[tile.type]++;
    expect(before).toEqual([31, 31]);
    const result = playTurn(board, { kind: "use", cell: 24 });
    expect(result.valid).toBe(true);
    const first = result.events[0];
    expect(first.activated?.map((item) => item.tile.id)).toEqual([25, 28]);
    expect(
      first.removed?.filter(
        (item) => item.tile.type === 0 && !item.tile.special,
      ),
    ).toHaveLength(31);
    expect(
      first.removed?.filter(
        (item) => item.tile.type === 1 && !item.tile.special,
      ).length,
    ).toBeLessThan(31);
  });

  it("activates color and ray swapped together exactly once each", () => {
    const board = createBoard(7);
    board.tiles[27] = { id: board.tiles[27]!.id, type: 4, special: "color" };
    board.tiles[28] = { id: board.tiles[28]!.id, type: 1, special: "row" };
    const result = playTurn(board, { kind: "swap", from: 27, to: 28 });
    expect(result.valid).toBe(true);
    const first = result.events.find((event) => event.kind === "clear")!;
    expect(first.activated?.map((item) => item.tile.id).sort()).toEqual(
      [board.tiles[27]!.id, board.tiles[28]!.id].sort(),
    );
    expect(new Set(first.removed?.map((item) => item.tile.id)).size).toBe(
      first.removed?.length,
    );
  });

  it("refills both sides of an intact coral wall without leaking tile identities through it", () => {
    const board = createBoard(9);
    const upperIds = new Set([0, 8, 16].map((cell) => board.tiles[cell]!.id));
    const lowerIds = new Set(
      [32, 40, 48, 56].map((cell) => board.tiles[cell]!.id),
    );
    board.tiles[16] = null;
    board.tiles[56] = null;
    // The wall is row 3 and stays fixed throughout this refill.
    applyGravity(board);
    expect(board.blockers.slice(24, 32)).toEqual(Array(8).fill(true));
    expect(
      [...upperIds].filter((id) =>
        board.tiles.slice(0, 24).some((tile) => tile?.id === id),
      ),
    ).toHaveLength(2);
    expect(
      [...lowerIds].filter((id) =>
        board.tiles.slice(32, 64).some((tile) => tile?.id === id),
      ),
    ).toHaveLength(3);
    expect(
      board.tiles.slice(0, 24).some((tile) => tile && lowerIds.has(tile.id)),
    ).toBe(false);
    expect(
      board.tiles.slice(32, 64).some((tile) => tile && upperIds.has(tile.id)),
    ).toBe(false);
  });

  it("survives 1,000 seeded turns across every obstacle and objective type", () => {
    let selection = 0x6d2b79f5;
    let turns = 0;
    for (let level = 1; level <= 30; level++) {
      let board = createBoard(level, 0x1988 + level);
      for (let step = 0; step < (level <= 10 ? 34 : 33); step++) {
        if (isWon(board))
          board = createBoard(level, 0x1988 + level * 101 + step);
        if (board.movesRemaining === 0) board = grantMoves(board);
        settledInvariants(board);
        const moves = getLegalMoves(board);
        selection = (Math.imul(selection, 1664525) + 1013904223) >>> 0;
        const action = moves[selection % moves.length];
        const frozen = JSON.stringify(board);
        const result = playTurn(board, action);
        expect(result.valid).toBe(true);
        expect(JSON.stringify(board)).toBe(frozen);
        expect(result.state.turnId).toBe(board.turnId + 1);
        expect(result.state.movesRemaining).toBe(board.movesRemaining - 1);
        expect(result.events.length).toBeGreaterThanOrEqual(2);
        const finalEvent = result.events.at(-1)!;
        expect(finalEvent.tiles).toEqual(result.state.tiles);
        expect(finalEvent.blockers).toEqual(result.state.blockers);
        expect(finalEvent.sand).toEqual(result.state.sand);
        expect(finalEvent.clams).toEqual(result.state.clams);
        expect(finalEvent.gravity).toEqual(result.state.gravity);
        expect(result.state.voids).toEqual(board.voids);
        expect(result.state.rocks).toEqual(board.rocks);
        expect(result.state.bubbles).toEqual(board.bubbles);
        board.clams?.forEach((hp, cell) => expect(result.state.clams![cell]).toBeLessThanOrEqual(hp));
        for (let index = 0; index < board.objectives.length; index++) {
          expect(
            result.state.objectives[index].collected,
          ).toBeGreaterThanOrEqual(board.objectives[index].collected);
        }
        for (const event of result.events) {
          expect(event.tiles).toHaveLength(64);
          const removed = event.removed ?? [];
          expect(new Set(removed.map((item) => item.tile.id)).size).toBe(
            removed.length,
          );
          const activated = event.activated ?? [];
          expect(new Set(activated.map((item) => item.tile.id)).size).toBe(
            activated.length,
          );
        }
        if (step % 17 === 0)
          expect(playTurn(JSON.parse(frozen) as BoardState, action)).toEqual(
            result,
          );
        board = result.state;
        settledInvariants(board);
        turns++;
      }
    }
    expect(turns).toBe(1000);
  }, 30_000);
});
