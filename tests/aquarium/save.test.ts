import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBoard,
  getHint,
  getLegalMoves,
  isWon,
  playTurn,
  type BoardState,
} from "../../src/aquarium/core";
import { DECORATIONS, FISH } from "../../src/aquarium/content/catalog";
import {
  SAVE_KEY,
  awardWin,
  freshSave,
  loadSave,
  persist,
  purchase,
  validateSave,
  type Save,
} from "../../src/aquarium/save/store";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
}

let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
});
afterEach(() => vi.unstubAllGlobals());

function wonBoard(levelId: number): BoardState {
  const board = createBoard(levelId);
  for (const objective of board.objectives)
    objective.collected = objective.target;
  return board;
}

describe("aquarium saves and rewards", () => {
  it("starts with exactly forty shells, Bobo and an untouched valid first level", () => {
    const save = freshSave();
    expect(validateSave(save)).toBe(true);
    expect(save.shells).toBe(40);
    expect(save.fishIds).toEqual(["bobo"]);
    expect(save.active.board.levelId).toBe(1);
    expect(save.active.board.movesRemaining).toBe(18);
    expect(save.active.pending).toBeNull();
  });

  it.each([
    [
      "unknown version",
      (s: Save) => {
        (s as { version: number }).version = 999;
      },
    ],
    [
      "negative shells",
      (s: Save) => {
        s.shells = -1;
      },
    ],
    [
      "duplicate completed level",
      (s: Save) => {
        s.completed = [1, 1];
      },
    ],
    [
      "missing Bobo",
      (s: Save) => {
        s.fishIds = [];
      },
    ],
    [
      "unknown decoration",
      (s: Save) => {
        s.decorations = ["alien"];
      },
    ],
    [
      "orphan placement",
      (s: Save) => {
        s.placements = [{ id: "seagrass", slot: 0, rotation: 0 }];
      },
    ],
    [
      "duplicate tile ID",
      (s: Save) => {
        s.active.board.tiles[1]!.id = s.active.board.tiles[0]!.id;
      },
    ],
    [
      "bad tile type",
      (s: Save) => {
        s.active.board.tiles[0]!.type = 8 as never;
      },
    ],
    [
      "bad pending action",
      (s: Save) => {
        s.active.pending = { kind: "swap", from: -1, to: 2 };
      },
    ],
    [
      "coral over a tile",
      (s: Save) => {
        s.active.board.blockers[0] = true;
      },
    ],
    [
      "nonnumeric objective",
      (s: Save) => {
        s.active.board.objectives[0].collected = NaN;
      },
    ],
  ] as const)("rejects malformed data: %s", (_, mutate) => {
    const save = freshSave();
    mutate(save);
    expect(validateSave(save)).toBe(false);
  });

  it.each([
    [
      "claimed level absent from completed",
      (s: Save) => {
        s.claimed = [1];
      },
    ],
    [
      "wrong objective target",
      (s: Save) => {
        s.active.board.objectives[0].target = 1;
      },
    ],
    [
      "progress beyond goal",
      (s: Save) => {
        s.active.board.objectives[0].collected = 999;
      },
    ],
    [
      "rewarded unfinished level",
      (s: Save) => {
        s.active.rewarded = true;
      },
    ],
    [
      "sand on coral",
      (s: Save) => {
        s.active.board = createBoard(5);
        s.active.board.sand[18] = true;
      },
    ],
  ] as const)("rejects impossible state: %s", (_, mutate) => {
    const save = freshSave();
    mutate(save);
    expect(validateSave(save)).toBe(false);
  });

  it("never awards an unfinished board", () => {
    const save = freshSave();
    const before = structuredClone(save);
    expect(awardWin(save)).toBe(0);
    expect(save).toEqual(before);
  });

  it("awards 400 new shells for ten first wins and ten for a replay, only once per clear", () => {
    const save = freshSave();
    for (let levelId = 1; levelId <= 10; levelId++) {
      save.active = {
        board: wonBoard(levelId),
        pending: null,
        rewarded: false,
      };
      expect(isWon(save.active.board)).toBe(true);
      expect(awardWin(save)).toBe(40);
      expect(awardWin(save)).toBe(0);
    }
    expect(save.shells).toBe(440);
    expect(save.completed).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(save.claimed).toEqual(save.completed);
    save.active = { board: wonBoard(1), pending: null, rewarded: false };
    expect(awardWin(save)).toBe(10);
    expect(awardWin(save)).toBe(0);
    expect(save.shells).toBe(450);
  });

  it("prices the expanded catalogue at 620, never extends credit, and keeps buys atomic", () => {
    expect(
      FISH.reduce((sum, fish) => sum + fish.price, 0) +
        DECORATIONS.reduce((sum, decor) => sum + decor.price, 0),
    ).toBe(620);
    const save = freshSave();
    const before = structuredClone(save);
    expect(purchase(save, "fish", "plet")).toMatch(/mangler/);
    expect(save).toEqual(before);
    save.shells = 1000;
    save.adventure!.reefStage = 3;
    save.completed = [6, 14, 22];
    save.claimed = [6, 14, 22];
    for (const fish of FISH.filter((fish) => fish.price > 0))
      expect(purchase(save, "fish", fish.id)).toBeNull();
    DECORATIONS.forEach((decor, slot) =>
      expect(purchase(save, "decor", decor.id, slot)).toBeNull(),
    );
    expect(save.shells).toBe(380);
    expect(save.fishIds).toHaveLength(4);
    expect(save.decorations).toHaveLength(10);
    expect(validateSave(save)).toBe(true);
    const purchased = structuredClone(save);
    expect(purchase(save, "decor", "seagrass", 0)).toMatch(/allerede/);
    expect(save).toEqual(purchased);
  });

  it("does not overwrite a damaged main save and offers the last valid backup", () => {
    const save = freshSave();
    persist(save);
    save.shells = 55;
    persist(save);
    storage.setItem(SAVE_KEY, "{broken json");
    const loaded = loadSave();
    expect(loaded.warning).toMatch(/bevare/);
    expect(loaded.backup?.shells).toBe(40);
    expect(storage.getItem(SAVE_KEY)).toBe("{broken json");
  });

  it("replays a pending turn exactly once after reload with one move charged", () => {
    const save = freshSave();
    const checkpoint = structuredClone(save.active.board);
    const action = getHint(checkpoint)!;
    const expected = playTurn(checkpoint, action);
    expect(expected.valid).toBe(true);
    save.active.pending = action;
    persist(save);
    const recovered = loadSave().save;
    expect(recovered.active.pending).toBeNull();
    expect(recovered.active.board).toEqual(expected.state);
    expect(recovered.active.board.movesRemaining).toBe(
      checkpoint.movesRemaining - 1,
    );
    expect(loadSave().save.active.board).toEqual(expected.state);
  });

  it("replays a pending winning turn without claiming the reward until the account step", () => {
    const save = freshSave();
    const board = save.active.board;
    const move = getLegalMoves(board).find(
      (action) => playTurn(board, action).state.objectives[0].collected > 0,
    );
    expect(move).toBeDefined();
    board.objectives[0].collected = board.objectives[0].target - 1;
    save.active.pending = move!;
    persist(save);
    const recovered = loadSave().save;
    expect(isWon(recovered.active.board)).toBe(true);
    expect(recovered.shells).toBe(40);
    expect(awardWin(recovered)).toBe(40);
    persist(recovered);
    expect(loadSave().save.shells).toBe(80);
    expect(awardWin(loadSave().save)).toBe(0);
  });
});
