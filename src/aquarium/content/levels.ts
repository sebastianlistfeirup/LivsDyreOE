export type ObjectiveKind =
  | "shell"
  | "star"
  | "drop"
  | "leaf"
  | "pearl"
  | "sand"
  | "coral"
  | "special";
export type LevelDefinition = Readonly<{
  id: number;
  moves: number;
  objectives: readonly Readonly<{ kind: ObjectiveKind; target: number }>[];
  /** Zero-based row-major cells. */
  coral: readonly number[];
  sand: readonly number[];
  /** A tested seed is preferred to a runtime-random opening. */
  seed: number;
  openingRay?: boolean;
}>;

const row = (r: number, first = 0, last = 7): number[] =>
  Array.from({ length: last - first + 1 }, (_, n) => r * 8 + first + n);

export const LEVELS: readonly LevelDefinition[] = [
  {
    id: 1,
    moves: 18,
    objectives: [{ kind: "shell", target: 12 }],
    coral: [],
    sand: [],
    seed: 101,
  },
  {
    id: 2,
    moves: 20,
    objectives: [
      { kind: "star", target: 15 },
      { kind: "drop", target: 10 },
    ],
    coral: [],
    sand: [],
    seed: 202,
  },
  {
    id: 3,
    moves: 22,
    objectives: [{ kind: "leaf", target: 18 }],
    coral: [],
    sand: [],
    seed: 303,
    openingRay: true,
  },
  {
    id: 4,
    moves: 22,
    objectives: [{ kind: "sand", target: 8 }],
    coral: [],
    sand: row(7),
    seed: 404,
  },
  {
    id: 5,
    moves: 24,
    objectives: [{ kind: "coral", target: 6 }],
    coral: [18, 21, 26, 29, 34, 37],
    sand: [],
    seed: 505,
  },
  {
    id: 6,
    moves: 24,
    objectives: [
      { kind: "pearl", target: 20 },
      { kind: "sand", target: 8 },
    ],
    coral: [],
    sand: row(6),
    seed: 606,
  },
  {
    id: 7,
    moves: 25,
    objectives: [{ kind: "special", target: 3 }],
    coral: [],
    sand: [],
    seed: 707,
    openingRay: true,
  },
  {
    id: 8,
    moves: 26,
    objectives: [{ kind: "sand", target: 12 }],
    coral: [],
    sand: [...row(5, 2, 5), ...row(6, 2, 5), ...row(7, 2, 5)],
    seed: 808,
  },
  {
    id: 9,
    moves: 27,
    objectives: [
      { kind: "coral", target: 8 },
      { kind: "drop", target: 18 },
    ],
    coral: row(3),
    sand: [],
    seed: 909,
  },
  {
    id: 10,
    moves: 28,
    objectives: [
      { kind: "shell", target: 15 },
      { kind: "star", target: 15 },
      { kind: "sand", target: 12 },
    ],
    coral: [],
    sand: [...row(5, 2, 5), ...row(6, 2, 5), ...row(7, 2, 5)],
    seed: 1010,
  },
];

export function getLevel(id: number): LevelDefinition {
  const level = LEVELS[id - 1];
  if (!level || level.id !== id) throw new RangeError(`Ukendt bane: ${id}`);
  return level;
}
