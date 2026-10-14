export type ObjectiveKind =
  | "shell"
  | "star"
  | "drop"
  | "leaf"
  | "pearl"
  | "sand"
  | "coral"
  | "clam"
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
  title: string;
  region: "Solbugten" | "Koralhaven" | "Perlelagunen" | "Stjernedybet";
  tutorial?: string;
  voids: readonly number[];
  rocks: readonly number[];
  clams: readonly number[];
  bubbles: readonly number[];
  gravity?: "down" | "up" | "left" | "right";
  currentCycle?: readonly ("down" | "up" | "left" | "right")[];
}>;

const row = (r: number, first = 0, last = 7): number[] =>
  Array.from({ length: last - first + 1 }, (_, n) => r * 8 + first + n);

type LevelRecipe = Omit<
  LevelDefinition,
  "title" | "region" | "voids" | "rocks" | "clams" | "bubbles"
> &
  Partial<Pick<LevelDefinition, "rocks" | "clams" | "bubbles">>;

// Authored silhouettes, one per level. # is open water outside the board, not a removable obstacle.
const SHAPES = [
  "......../......../......../......../......../......../......../........",
  "#......#/......../......../......../......../......../......../#......#",
  "......../......../......../......../......../......../#......#/##....##",
  "##....##/#......#/......../......../......../......../......../........",
  "#......#/......../......../......../......../......../#......#/##....##",
  "##....##/......../......../......../......../......../......../#......#",
  "......../......../......../......../......../#......#/##....##/###..###",
  "##....##/##....##/......../......../......../......../##....##/##....##",
  ".......#/.......#/......../......../......../......../......../.......#",
  "#......#/#......#/......../......../......../......../#......#/#......#",
  "###..###/##....##/#......#/......../......../#......#/##....##/###..###",
  "##....##/#......#/......../...##.../...##.../......../#......#/##....##",
  "..####../......../......../......../......../......../......../..####..",
  "#......#/#......#/......../......../......../......../##....##/###..###",
  "###..###/#......#/......../......../......../......../#......#/###..###",
  "##....##/......../......../#......#/#......#/......../......../##....##",
  "#......#/......../..#..#../......../......../..#..#../......../#......#",
  "##....##/##....##/#......#/......../......../#......#/......../#......#",
  "#......#/......../......../##....##/##....##/......../......../#......#",
  "###..###/##....##/......../......../......../......../......../##....##",
  "##....##/......../......../...##.../......../......../......../##....##",
  "#......#/##....##/......../......../......../......../##....##/#......#",
  "###..###/#......#/......../......../......../......../......../###..###",
  "##....##/......../......../#......#/......../......../#......#/##....##",
  "#......#/......../......../..#..#../..#..#../......../......../#......#",
  "##....##/#......#/......../......../......../......../......../###..###",
  "###..###/......../......../#......#/#......#/......../......../###..###",
  "#......#/......../...##.../......../......../...##.../......../#......#",
  "##....##/......../#......#/......../......../#......#/......../##....##",
  "###..###/##....##/#......#/......../......../......../#......#/##....##",
] as const;

const TITLES = [
  "De første skatte",
  "Solglimt",
  "Fire på stribe",
  "Sandets hemmelighed",
  "Koralporten",
  "Perlemorgaven",
  "Strålernes have",
  "Sandrosen",
  "Koralbroen",
  "Skattefest",
  "Havets diamant",
  "Stenringen",
  "Sommerfuglevandet",
  "Havens hjerte",
  "Muslingernes sang",
  "Boblekilden",
  "Tvillingerevet",
  "Perlestien",
  "Tidevandsgaven",
  "Bobledansen",
  "Den skjulte perle",
  "Lagunens lys",
  "Strømmens hemmelighed",
  "Stjernestrømmen",
  "Den dobbelte grotte",
  "Nordlysvandet",
  "Havets kompas",
  "Måneportene",
  "Stjernestøvet",
  "Livs magiske fest",
] as const;

const RECIPES: readonly LevelRecipe[] = [
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
  {
    id: 11,
    moves: 30,
    objectives: [
      { kind: "leaf", target: 24 },
      { kind: "special", target: 2 },
    ],
    coral: [],
    sand: [],
    rocks: [27, 36],
    seed: 1111,
    tutorial: "De mørke sten bliver stående. Lav stråler og spil rundt om dem.",
  },
  {
    id: 12,
    moves: 30,
    objectives: [
      { kind: "coral", target: 4 },
      { kind: "star", target: 22 },
    ],
    coral: [18, 21, 42, 45],
    sand: [],
    rocks: [25, 38],
    seed: 1212,
  },
  {
    id: 13,
    moves: 30,
    objectives: [
      { kind: "sand", target: 10 },
      { kind: "drop", target: 20 },
    ],
    coral: [],
    sand: [...row(5, 1, 6), ...row(6, 2, 5)],
    rocks: [26, 29],
    seed: 1313,
  },
  {
    id: 14,
    moves: 32,
    objectives: [
      { kind: "special", target: 4 },
      { kind: "pearl", target: 24 },
    ],
    coral: [18, 21],
    sand: [],
    rocks: [34, 37],
    seed: 1414,
  },
  {
    id: 15,
    moves: 32,
    objectives: [
      { kind: "clam", target: 3 },
      { kind: "shell", target: 20 },
    ],
    coral: [],
    sand: [],
    clams: [26, 29, 43],
    seed: 1515,
    tutorial:
      "Muslinger åbner efter to træffere. Match ved siden af dem, eller ram dem med en specialbrik.",
  },
  {
    id: 16,
    moves: 32,
    objectives: [
      { kind: "pearl", target: 26 },
      { kind: "sand", target: 8 },
    ],
    coral: [],
    sand: [...row(5, 2, 5), ...row(6, 2, 5)],
    bubbles: [43, 46],
    seed: 1616,
    tutorial:
      "Bobler løfter en brik ét felt efter hvert træk. Brug løftet til at lave nye matches.",
  },
  {
    id: 17,
    moves: 32,
    objectives: [
      { kind: "clam", target: 4 },
      { kind: "leaf", target: 24 },
    ],
    coral: [],
    sand: [],
    clams: [25, 30, 33, 38],
    rocks: [3, 60],
    seed: 1717,
  },
  {
    id: 18,
    moves: 34,
    objectives: [
      { kind: "sand", target: 10 },
      { kind: "special", target: 4 },
    ],
    coral: [],
    sand: [...row(6, 1, 6), ...row(7, 2, 5)],
    bubbles: [35, 44],
    rocks: [26, 29],
    seed: 1818,
  },
  {
    id: 19,
    moves: 34,
    objectives: [
      { kind: "clam", target: 4 },
      { kind: "drop", target: 28 },
    ],
    coral: [],
    sand: [],
    clams: [18, 21, 42, 45],
    bubbles: [50, 53],
    seed: 1919,
  },
  {
    id: 20,
    moves: 34,
    objectives: [
      { kind: "star", target: 28 },
      { kind: "special", target: 4 },
    ],
    coral: [25, 30],
    sand: [],
    bubbles: [34, 37, 51],
    rocks: [27, 28],
    seed: 2020,
  },
  {
    id: 21,
    moves: 34,
    objectives: [
      { kind: "clam", target: 4 },
      { kind: "sand", target: 8 },
    ],
    coral: [],
    sand: [...row(5, 2, 5), ...row(6, 2, 5)],
    clams: [17, 22, 41, 46],
    rocks: [35, 36],
    seed: 2121,
  },
  {
    id: 22,
    moves: 36,
    objectives: [
      { kind: "pearl", target: 30 },
      { kind: "clam", target: 4 },
      { kind: "special", target: 3 },
    ],
    coral: [],
    sand: [],
    clams: [18, 21, 42, 45],
    bubbles: [51, 52],
    seed: 2222,
  },
  {
    id: 23,
    moves: 34,
    objectives: [
      { kind: "drop", target: 28 },
      { kind: "sand", target: 8 },
    ],
    coral: [],
    sand: [...row(5, 2, 5), ...row(6, 2, 5)],
    seed: 2323,
    gravity: "down",
    currentCycle: ["down", "left"],
    tutorial:
      "Pilen viser næste strøm. Efter dit bytte falder brikkerne i pilens retning — så vender strømmen igen.",
  },
  {
    id: 24,
    moves: 34,
    objectives: [
      { kind: "clam", target: 4 },
      { kind: "star", target: 28 },
    ],
    coral: [],
    sand: [],
    clams: [18, 21, 42, 45],
    rocks: [27, 36],
    seed: 2424,
    currentCycle: ["down", "right"],
  },
  {
    id: 25,
    moves: 36,
    objectives: [
      { kind: "sand", target: 12 },
      { kind: "leaf", target: 28 },
    ],
    coral: [17, 22],
    sand: [...row(5, 1, 6), ...row(6, 1, 6)],
    bubbles: [50, 53],
    seed: 2525,
    currentCycle: ["down", "up"],
  },
  {
    id: 26,
    moves: 36,
    objectives: [
      { kind: "clam", target: 4 },
      { kind: "special", target: 5 },
    ],
    coral: [],
    sand: [],
    clams: [25, 30, 41, 46],
    rocks: [19, 20],
    seed: 2626,
    currentCycle: ["down", "left", "up", "right"],
  },
  {
    id: 27,
    moves: 36,
    objectives: [
      { kind: "pearl", target: 32 },
      { kind: "coral", target: 6 },
    ],
    coral: [18, 21, 26, 29, 42, 45],
    sand: [],
    rocks: [35, 36],
    bubbles: [50, 53],
    seed: 2727,
    currentCycle: ["down", "left", "up", "right"],
  },
  {
    id: 28,
    moves: 38,
    objectives: [
      { kind: "clam", target: 4 },
      { kind: "sand", target: 10 },
    ],
    coral: [],
    sand: [...row(6, 1, 6), ...row(7, 2, 5)],
    clams: [17, 22, 41, 46],
    rocks: [27, 36],
    seed: 2828,
    currentCycle: ["down", "right", "up", "left"],
  },
  {
    id: 29,
    moves: 38,
    objectives: [
      { kind: "shell", target: 32 },
      { kind: "star", target: 32 },
      { kind: "special", target: 5 },
    ],
    coral: [],
    sand: [],
    clams: [25, 30],
    rocks: [27, 36],
    bubbles: [50, 53],
    seed: 2929,
    currentCycle: ["down", "left", "up", "right"],
  },
  {
    id: 30,
    moves: 40,
    objectives: [
      { kind: "clam", target: 4 },
      { kind: "sand", target: 12 },
      { kind: "special", target: 5 },
    ],
    coral: [],
    sand: [...row(5, 1, 6), ...row(6, 1, 6)],
    clams: [25, 30, 33, 38],
    rocks: [19, 20],
    bubbles: [50, 53],
    seed: 3030,
    currentCycle: ["down", "left", "up", "right"],
  },
];

export const LEVELS: readonly LevelDefinition[] = RECIPES.map(
  (recipe, index) => {
    const shape = SHAPES[index].replaceAll("/", "");
    if (shape.length !== 64)
      throw new Error(`Invalid shape for level ${recipe.id}`);
    return {
      ...recipe,
      title: TITLES[index],
      region:
        recipe.id <= 6
          ? "Solbugten"
          : recipe.id <= 14
            ? "Koralhaven"
            : recipe.id <= 22
              ? "Perlelagunen"
              : "Stjernedybet",
      voids: [...shape].flatMap((symbol, cell) =>
        symbol === "#" ? [cell] : [],
      ),
      rocks: recipe.rocks ?? [],
      clams: recipe.clams ?? [],
      bubbles: recipe.bubbles ?? [],
    };
  },
);

export function getLevel(id: number): LevelDefinition {
  const level = LEVELS[id - 1];
  if (!level || level.id !== id) throw new RangeError(`Ukendt bane: ${id}`);
  return level;
}
