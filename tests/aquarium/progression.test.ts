import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  freshSave,
  prepareSave,
  validateSave,
  purchase,
  awardWin,
} from "../../src/aquarium/save/store";
import { createBoard } from "../../src/aquarium/core";
import { DECORATIONS, FISH } from "../../src/aquarium/content/catalog";
import {
  adventureOf,
  spendableShells,
  canPlayLevel,
  restoreReef,
  upgradeDecoration,
  decorationRefund,
  claimStory,
  nextStory,
  goalSummary,
} from "../../src/aquarium/content/progression";
beforeEach(() =>
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) }),
);
afterEach(() => vi.unstubAllGlobals());
function win(save: ReturnType<typeof freshSave>, id: number) {
  save.active = { board: createBoard(id), pending: null, rewarded: false };
  save.active.board.objectives.forEach((o) => (o.collected = o.target));
  return awardWin(save);
}
it("reserves ten of forty, never adds phantom shells, and never reserves a replay reward", () => {
  const s = freshSave();
  expect(win(s, 1)).toBe(40);
  expect(s.shells).toBe(80);
  expect(adventureOf(s).reefSavings).toBe(10);
  expect(spendableShells(s)).toBe(70);
  expect(win(s, 1)).toBe(10);
  expect(s.shells).toBe(90);
  expect(adventureOf(s).reefSavings).toBe(10);
});
it("all 30 first wins pay for all three reef stages, all fish, ten decorations and all upgrades without replay", () => {
  const s = freshSave();
  for (let id = 1; id <= 30; id++) {
    expect(canPlayLevel(s, id), `level ${id} accessible`).toBe(true);
    expect(win(s, id)).toBe(40);
    if ([6, 14, 22].includes(id)) {
      expect(canPlayLevel(s, id + 1)).toBe(false);
      expect(restoreReef(s)).toBeNull();
      expect(canPlayLevel(s, id + 1)).toBe(true);
    }
    expect(validateSave(s), `save after ${id}`).toBe(true);
  }
  expect(adventureOf(s).reefSavings).toBe(0);
  expect(s.shells).toBe(1020);
  for (const fish of FISH.filter((f) => f.price))
    expect(purchase(s, "fish", fish.id)).toBeNull();
  DECORATIONS.forEach((d, slot) =>
    expect(purchase(s, "decor", d.id, slot)).toBeNull(),
  );
  for (const id of ["cave", "ring"])
    for (let i = 0; i < 2; i++) expect(upgradeDecoration(s, id)).toBeNull();
  expect(s.shells).toBe(180);
  expect(validateSave(s)).toBe(true);
  expect(canPlayLevel(s, 31)).toBe(false);
});
it("protects region savings even after spending every free shell", () => {
  const s = freshSave();
  for (let id = 1; id <= 6; id++) win(s, id);
  s.shells = 60;
  const before = structuredClone(s);
  expect(purchase(s, "decor", "seagrass", 0)).toContain("frie");
  expect(s).toEqual(before);
  expect(restoreReef(s)).toBeNull();
  expect(s.shells).toBe(0);
  expect(canPlayLevel(s, 7)).toBe(true);
});
it("keeps project, rare decor, and upgrade failures atomic", () => {
  const s = freshSave(),
    before = structuredClone(s);
  expect(restoreReef(s)).toContain("bane 6");
  expect(purchase(s, "decor", "moon-gate", 0)).toContain("området");
  expect(upgradeDecoration(s, "cave")).toContain("først");
  expect(s).toEqual(before);
});
it("provides one additive legacy migration and preserves the old board, intent, wallet and personal fish", () => {
  const s = freshSave();
  delete s.adventure;
  delete s.active.board.voids;
  delete s.active.board.rocks;
  delete s.active.board.clams;
  delete s.active.board.bubbles;
  delete s.active.board.gravity;
  s.completed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  s.claimed = [...s.completed];
  s.shells = 7;
  s.fishStyles.bobo = { name: "Livs ven", color: "#ffaa22" };
  const board = structuredClone(s.active.board);
  expect(validateSave(s)).toBe(true);
  prepareSave(s);
  expect(s.shells).toBe(107);
  expect(spendableShells(s)).toBe(7);
  expect(s.active.board).toEqual(board);
  expect(s.active.legacy).toBe(true);
  expect(s.fishStyles.bobo.name).toBe("Livs ven");
  expect(canPlayLevel(s, 10)).toBe(true);
  expect(validateSave(s)).toBe(true);
  prepareSave(s);
  expect(s.shells).toBe(107);
  expect(restoreReef(s)).toBeNull();
  expect(s.shells).toBe(47);
});
it("refunds exactly the owned upgrade stages and permits fish stories only once in order", () => {
  const s = freshSave();
  s.shells = 500;
  expect(purchase(s, "fish", "sky")).toBeNull();
  expect(nextStory(s, "sky")?.ready).toBe(false);
  expect(claimStory(s, "sky")).toBeNull();
  expect(purchase(s, "decor", "cave", 0)).toBeNull();
  expect(claimStory(s, "sky")?.chapter).toBe(1);
  expect(claimStory(s, "sky")).toBeNull();
  expect(upgradeDecoration(s, "cave")).toBeNull();
  expect(claimStory(s, "sky")?.chapter).toBe(2);
  expect(claimStory(s, "sky")).toBeNull();
  expect(decorationRefund(s, "cave")).toBe(
    DECORATIONS.find((d) => d.id === "cave")!.price + 40,
  );
  expect(upgradeDecoration(s, "cave")).toBeNull();
  expect(decorationRefund(s, "cave")).toBe(
    DECORATIONS.find((d) => d.id === "cave")!.price + 110,
  );
  const before = structuredClone(s);
  expect(upgradeDecoration(s, "cave")).toContain("allerede");
  expect(s).toEqual(before);
});
it("goals reflect buying then upgrading and never offer a third paid upgrade", () => {
  const s = freshSave();
  s.shells = 1000;
  adventureOf(s).goal = "ring";
  expect(goalSummary(s).action).toBe("goal-place");
  expect(purchase(s, "decor", "ring", 0)).toBeNull();
  expect(goalSummary(s).action).toBe("upgrade-decor");
  expect(upgradeDecoration(s, "ring")).toBeNull();
  expect(upgradeDecoration(s, "ring")).toBeNull();
  expect(goalSummary(s).ready).toBe(false);
  expect(goalSummary(s).price).toBe(0);
});
it.each(Array.from({ length: 30 }, (_, i) => i + 1))(
  "validates a settled save for new level %i",
  (id) => {
    const s = freshSave();
    s.active.board = createBoard(id);
    expect(validateSave(s)).toBe(true);
  },
);
it.each([
  (s: ReturnType<typeof freshSave>) => {
    s.adventure!.reefSavings = 41;
  },
  (s: ReturnType<typeof freshSave>) => {
    s.adventure!.reefStage = 3;
  },
  (s: ReturnType<typeof freshSave>) => {
    s.adventure!.region = "star";
  },
  (s: ReturnType<typeof freshSave>) => {
    s.adventure!.upgrades.cave = 1;
  },
  (s: ReturnType<typeof freshSave>) => {
    s.adventure!.stories.sky = 1;
  },
  (s: ReturnType<typeof freshSave>) => {
    s.active.board.clams![0] = 3;
  },
  (s: ReturnType<typeof freshSave>) => {
    s.active.board.voids![0] = true;
  },
])("rejects corrupted progression and terrain %i", (mutate) => {
  const s = freshSave();
  mutate(s);
  expect(validateSave(s)).toBe(false);
});
