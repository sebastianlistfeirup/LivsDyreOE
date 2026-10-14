import { describe, expect, it } from "vitest";
import { LEVELS } from "../../src/aquarium/content/levels";
import {
  createBoard,
  getHint,
  getLegalMoves,
  isOccupied,
  normalizeBoard,
  playTurn,
  type BoardState,
  type Gravity,
  type Special,
  type TileType,
} from "../../src/aquarium/core";
import { applyGravity } from "../../src/aquarium/core/gravity";

function fixture(): BoardState {
  const board = createBoard(1);
  board.tiles = board.tiles.map((_, cell) => ({
    id: cell + 1,
    type: ((Math.floor(cell / 8) * 2 + (cell % 8)) % 5) as TileType,
  }));
  board.nextId = 65;
  board.objectives = [{ kind: "special", target: 20, collected: 0 }];
  return board;
}

describe("special pair combinations", () => {
  const pairs: [
    Special,
    Special,
    "cross" | "cross-blast" | "rainbow",
    number,
  ][] = [
    ["row", "row", "cross", 15],
    ["column", "column", "cross", 15],
    ["row", "column", "cross", 15],
    ["bomb", "row", "cross-blast", 39],
    ["column", "bomb", "cross-blast", 39],
    ["color", "color", "rainbow", 64],
  ];
  for (const [first, second, kind, cleared] of pairs) {
    it(`${first} + ${second} produces the exact ${kind} footprint`, () => {
      const board = fixture();
      board.tiles[27]!.special = first;
      board.tiles[28]!.special = second;
      const result = playTurn(board, { kind: "swap", from: 27, to: 28 });
      expect(result.valid).toBe(true);
      expect(result.state.movesRemaining).toBe(board.movesRemaining - 1);
      const wave = result.events.find((event) => event.kind === "clear")!;
      expect(wave.combo).toMatchObject({ kind, cell: 28 });
      expect(wave.combo?.cells).toHaveLength(cleared);
      expect(
        wave.removed?.map((item) => item.cell).sort((a, b) => a - b),
      ).toEqual(wave.combo?.cells);
      expect(
        wave.activated?.map((item) => item.tile.id).sort((a, b) => a - b),
      ).toEqual([28, 29]);
      expect(wave.created).toHaveLength(0);
      expect(result.state.objectives[0].collected).toBe(2);
    });
  }
  it("chain-activates a third special once without duplicating an overlapping hit", () => {
    const board = fixture();
    board.tiles[27]!.special = "row";
    board.tiles[28]!.special = "column";
    board.tiles[12]!.special = "bomb";
    const wave = playTurn(board, { kind: "swap", from: 27, to: 28 }).events[1];
    expect(
      wave.activated?.map((item) => item.tile.id).sort((a, b) => a - b),
    ).toEqual([13, 28, 29]);
    expect(new Set(wave.removed?.map((item) => item.tile.id)).size).toBe(
      wave.removed?.length,
    );
  });
});

describe("authored terrain and underwater mechanics", () => {
  it("resumes a version-one board without injecting its level's new holes or obstacles", () => {
    const legacy = createBoard(10);
    delete legacy.voids;
    delete legacy.rocks;
    delete legacy.clams;
    delete legacy.bubbles;
    delete legacy.gravity;
    const normalized = normalizeBoard(legacy);
    expect(normalized.voids).toEqual(Array(64).fill(false));
    expect(normalized.rocks).toEqual(Array(64).fill(false));
    expect(normalized.clams).toEqual(Array(64).fill(0));
    expect(normalized.bubbles).toEqual(Array(64).fill(false));
    expect(normalized.gravity).toBe("down");
    expect(normalized.tiles).toEqual(legacy.tiles);
    expect(normalized.tiles).not.toBe(legacy.tiles);
    expect(normalized.objectives).toEqual(legacy.objectives);
  });
  it("requires exactly two separate hits to open a clam, then fills its former cell", () => {
    const board = fixture();
    board.objectives = [{ kind: "clam", target: 1, collected: 0 }];
    board.clams![19] = 2;
    board.tiles[19] = null;
    board.tiles[16]!.special = "row";
    const one = playTurn(board, { kind: "use", cell: 16 });
    expect(one.events[0].clams?.[19]).toBe(1);
    expect(one.state.clams?.[19]).toBe(1);
    expect(one.state.objectives[0].collected).toBe(0);
    expect(one.state.tiles[19]).toBeNull();
    one.state.tiles[16]!.special = "row";
    const two = playTurn(one.state, { kind: "use", cell: 16 });
    expect(two.events[0].clams?.[19]).toBe(0);
    expect(two.state.objectives[0].collected).toBe(1);
    expect(two.state.tiles[19]).not.toBeNull();
  });
  it("damages a clam only once when several simultaneous matches touch it", () => {
    const board = fixture();
    board.clams![27] = 2;
    board.tiles[27] = null;
    for (const cell of [18, 19, 20, 34, 35, 36]) board.tiles[cell]!.type = 0;
    board.tiles[0]!.special = "row";
    // A special swap resolves both already-matched runs in one wave.
    const wave = playTurn(board, { kind: "swap", from: 0, to: 1 }).events[1];
    expect(wave.clams?.[27]).toBe(1);
  });
  it("never swaps, destroys, fills, or counts an immovable rock or a void", () => {
    const board = fixture();
    board.rocks![26] = true;
    board.voids![25] = true;
    board.tiles[25] = null;
    board.tiles[26] = null;
    board.tiles[24]!.special = "row";
    expect(playTurn(board, { kind: "swap", from: 24, to: 25 }).valid).toBe(
      false,
    );
    expect(playTurn(board, { kind: "swap", from: 26, to: 27 }).valid).toBe(
      false,
    );
    const result = playTurn(board, { kind: "use", cell: 24 });
    expect(result.state.rocks?.[26]).toBe(true);
    expect(result.state.voids?.[25]).toBe(true);
    expect(result.state.tiles[25]).toBeNull();
    expect(result.state.tiles[26]).toBeNull();
    expect(result.events[0].removed?.map((item) => item.cell)).not.toContain(
      25,
    );
    expect(result.events[0].removed?.map((item) => item.cell)).not.toContain(
      26,
    );
  });
  it("bubbles visibly lift the exact jewel identity once per paid turn", () => {
    const board = createBoard(16);
    const result = playTurn(board, getHint(board)!);
    const lifts = result.events.filter((event) => event.lifted?.length);
    expect(lifts).toHaveLength(1);
    expect(lifts[0].lifted).toHaveLength(2);
    for (const lift of lifts[0].lifted!) {
      expect(lift.to).toBe(lift.from - 8);
      expect(lifts[0].tiles[lift.to]?.id).toBe(lift.tile.id);
    }
    expect(result.state.movesRemaining).toBe(board.movesRemaining - 1);
    expect(result.state.turnId).toBe(1);
  });
  it("rotates currents only on valid turns, persists direction, and deterministically replays", () => {
    let board = createBoard(26);
    expect(board.gravity).toBe("down");
    expect(
      playTurn(board, { kind: "swap", from: 0, to: 63 }).state.gravity,
    ).toBe("down");
    for (const direction of ["left", "up", "right", "down"]) {
      const action = getLegalMoves(board)[0];
      const before = JSON.stringify(board);
      const result = playTurn(board, action);
      expect(result.state.gravity).toBe(direction);
      expect(result.events.at(-1)?.gravity).toBe(direction);
      expect(playTurn(JSON.parse(before) as BoardState, action)).toEqual(
        result,
      );
      board = result.state;
    }
  });
  for (const direction of ["down", "up", "left", "right"] as Gravity[]) {
    it(`packs survivors with ${direction} gravity without crossing fixed terrain`, () => {
      const board = fixture();
      board.gravity = direction;
      const [edge, interior, barrier, other] =
        direction === "down"
          ? [56, 48, 40, 32]
          : direction === "up"
            ? [0, 8, 16, 24]
            : direction === "left"
              ? [0, 1, 2, 3]
              : [7, 6, 5, 4];
      const survivor = board.tiles[interior]!.id;
      const isolated = board.tiles[other]!.id;
      board.rocks![barrier] = true;
      board.tiles[barrier] = null;
      board.tiles[edge] = null;
      applyGravity(board);
      const settled = [...board.tiles];
      expect(settled[edge]?.id).toBe(survivor);
      expect(board.tiles[barrier]).toBeNull();
      expect(board.tiles[other]?.id).toBe(isolated);
      expect(board.tiles.filter(Boolean)).toHaveLength(63);
    });
  }
  it("introduces one mechanic at a time and retains a playable connected core in every silhouette", () => {
    expect(LEVELS[10].rocks.length).toBeGreaterThan(0);
    expect(LEVELS[14].clams.length).toBeGreaterThan(0);
    expect(LEVELS[15].bubbles.length).toBeGreaterThan(0);
    expect(LEVELS[22].currentCycle?.length).toBeGreaterThan(0);
    for (const level of LEVELS) {
      const board = createBoard(level.id);
      expect(board.tiles.filter(Boolean).length).toBeGreaterThanOrEqual(36);
      const land = new Set(
        Array.from({ length: 64 }, (_, cell) => cell).filter(
          (cell) => !board.voids?.[cell],
        ),
      );
      const reached = new Set<number>();
      const pending = [land.values().next().value as number];
      while (pending.length) {
        const cell = pending.pop()!;
        if (reached.has(cell) || !land.has(cell)) continue;
        reached.add(cell);
        pending.push(
          cell - 8,
          cell + 8,
          ...(cell % 8 > 0 ? [cell - 1] : []),
          ...(cell % 8 < 7 ? [cell + 1] : []),
        );
      }
      expect(reached.size, `Disconnected silhouette in level ${level.id}`).toBe(
        land.size,
      );
      for (const move of getLegalMoves(board)) {
        if (move.kind === "use")
          expect(isOccupied(board, move.cell)).toBe(false);
        else {
          expect(isOccupied(board, move.from)).toBe(false);
          expect(isOccupied(board, move.to)).toBe(false);
        }
      }
    }
  });
});
