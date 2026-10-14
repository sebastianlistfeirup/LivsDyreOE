import {
  createBoard,
  isWon,
  playTurn,
  type Action,
  type BoardState,
} from "../core";
import { getLevel } from "../content/levels";
import { DECORATIONS, FISH } from "../content/catalog";
import {
  emptyAdventure,
  adventureOf,
  reserveFirstWin,
  spendableShells,
  rareStage,
  REGIONS,
  REEF_PROJECTS,
  type Adventure,
} from "../content/progression";

export type Placement = {
  id: string;
  slot: number;
  rotation: number;
  x?: number;
  y?: number;
};
export type Save = {
  project: "livs-akvarie";
  version: 1;
  updatedAt: string;
  shells: number;
  completed: number[];
  claimed: number[];
  fishIds: string[];
  decorations: string[];
  placements: Placement[];
  fishStyles: Record<
    string,
    { name: string; favorite?: string; color?: string }
  >;
  settings: { sound: boolean; hints: boolean; reducedMotion: boolean };
  active: {
    board: BoardState;
    pending: Action | null;
    rewarded: boolean;
    legacy?: boolean;
  };
  adventure?: Adventure;
  tutorialSeen: boolean;
};

export const SAVE_KEY = "livs-akvarie.save.v1";
const BACKUP_KEY = `${SAVE_KEY}.backup`;
export function freshSave(): Save {
  return {
    project: "livs-akvarie",
    version: 1,
    updatedAt: new Date().toISOString(),
    shells: 40,
    completed: [],
    claimed: [],
    fishIds: ["bobo"],
    decorations: [],
    placements: [],
    fishStyles: {},
    settings: {
      sound: false,
      hints: true,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches,
    },
    active: { board: createBoard(1), pending: null, rewarded: false },
    tutorialSeen: false,
    adventure: emptyAdventure(),
  };
}

function integers(
  values: unknown,
  min: number,
  max: number,
): values is number[] {
  return (
    Array.isArray(values) &&
    values.every((v) => Number.isInteger(v) && v >= min && v <= max) &&
    new Set(values).size === values.length
  );
}
function validAction(value: unknown): value is Action | null {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const a = value as Action;
  const cell = (n: number) => Number.isInteger(n) && n >= 0 && n < 64;
  return a.kind === "swap"
    ? cell(a.from) && cell(a.to)
    : a.kind === "use" && cell(a.cell);
}

function validAdventure(save: Save): boolean {
  const p = save.adventure;
  if (
    !p ||
    typeof p !== "object" ||
    ![0, 1, 2, 3].includes(p.reefStage) ||
    !Number.isSafeInteger(p.reefSavings) ||
    p.reefSavings < 0 ||
    p.reefSavings > save.shells
  )
    return false;
  const spent = REEF_PROJECTS.slice(0, p.reefStage).reduce(
    (n, project) => n + project.price,
    0,
  );
  if (
    p.reefSavings > 220 - spent ||
    REEF_PROJECTS.slice(0, p.reefStage).some(
      (project) => !save.completed.includes(project.after),
    )
  )
    return false;
  if (
    !["reef", "cave", "ring", "pearl-tree", "moon-gate"].includes(p.goal) ||
    !["day", "dawn", "moon"].includes(p.lighting) ||
    !REGIONS.some((r) => r.id === p.region && r.stage <= p.reefStage)
  )
    return false;
  if (!integers(p.seenTutorials, 1, 30)) return false;
  if (
    !p.upgrades ||
    Array.isArray(p.upgrades) ||
    typeof p.upgrades !== "object" ||
    Object.entries(p.upgrades).some(
      ([id, n]) =>
        !["cave", "ring"].includes(id) ||
        !save.decorations.includes(id) ||
        !Number.isInteger(n) ||
        n < 0 ||
        n > 2,
    )
  )
    return false;
  if (
    !p.stories ||
    Array.isArray(p.stories) ||
    typeof p.stories !== "object" ||
    Object.entries(p.stories).some(
      ([id, n]) =>
        !save.fishIds.includes(id) || !Number.isInteger(n) || n < 0 || n > 2,
    )
  )
    return false;
  return true;
}

/** Additive upgrade: keep the old board, wallet, fish, and any pending intent. */
export function prepareSave(save: Save): Save {
  if (!save.adventure) {
    save.adventure = emptyAdventure();
    // Previously earned shells stay spendable. Existing players receive the
    // missing earmarked savings exactly once, recorded in this same save.
    save.adventure.reefSavings = Math.min(220, save.completed.length * 10);
    save.shells += save.adventure.reefSavings;
  }
  if (save.active.board.voids === undefined && save.active.board.levelId <= 10)
    save.active.legacy = true;
  return save;
}

export function validateSave(value: unknown): value is Save {
  if (!value || typeof value !== "object") return false;
  const s = value as Save;
  if (
    s.project !== "livs-akvarie" ||
    s.version !== 1 ||
    typeof s.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(s.updatedAt))
  )
    return false;
  if (
    !Number.isSafeInteger(s.shells) ||
    s.shells < 0 ||
    s.shells > 1e8 ||
    !integers(s.completed, 1, 30) ||
    !integers(s.claimed, 1, 30)
  )
    return false;
  if (
    s.claimed.some((id) => !s.completed.includes(id)) ||
    s.completed.some((id) => !s.claimed.includes(id))
  )
    return false;
  const ids = (v: unknown, allowed: readonly string[]) =>
    Array.isArray(v) &&
    v.every((id) => typeof id === "string" && allowed.includes(id)) &&
    new Set(v).size === v.length;
  if (
    !ids(
      s.fishIds,
      FISH.map((f) => f.id),
    ) ||
    !s.fishIds.includes("bobo") ||
    !ids(
      s.decorations,
      DECORATIONS.map((d) => d.id),
    )
  )
    return false;
  if (
    !Array.isArray(s.placements) ||
    s.placements.length !== s.decorations.length ||
    s.placements.some(
      (p) =>
        !p ||
        !s.decorations.includes(p.id) ||
        !Number.isInteger(p.slot) ||
        p.slot < 0 ||
        p.slot > 11 ||
        ![0, 1, 2, 3].includes(p.rotation) ||
        ((p.x !== undefined || p.y !== undefined) &&
          (!Number.isFinite(p.x) ||
            !Number.isFinite(p.y) ||
            p.x! < 0.1 ||
            p.x! > 0.9 ||
            p.y! < 0.38 ||
            p.y! > 0.84)),
    )
  )
    return false;
  if (
    new Set(s.placements.map((p) => p.slot)).size !== s.placements.length ||
    new Set(s.placements.map((p) => p.id)).size !== s.placements.length
  )
    return false;
  if (
    !s.settings ||
    ["sound", "hints", "reducedMotion"].some(
      (k) => typeof s.settings[k as keyof Save["settings"]] !== "boolean",
    ) ||
    typeof s.tutorialSeen !== "boolean"
  )
    return false;
  if (
    !s.fishStyles ||
    typeof s.fishStyles !== "object" ||
    Object.entries(s.fishStyles).some(
      ([id, style]) =>
        !s.fishIds.includes(id) ||
        !style ||
        typeof style.name !== "string" ||
        style.name.length > 30 ||
        (style.favorite !== undefined &&
          !DECORATIONS.some((d) => d.id === style.favorite)) ||
        (style.color !== undefined && !/^#[0-9a-f]{6}$/i.test(style.color)),
    )
  )
    return false;
  if (
    !s.active ||
    typeof s.active.rewarded !== "boolean" ||
    (s.active.legacy !== undefined && typeof s.active.legacy !== "boolean") ||
    !validAction(s.active.pending)
  )
    return false;
  const b = s.active.board;
  if (
    !b ||
    !Number.isInteger(b.levelId) ||
    b.levelId < 1 ||
    b.levelId > 30 ||
    !Number.isInteger(b.movesRemaining) ||
    b.movesRemaining < 0 ||
    b.movesRemaining > 10000 ||
    !Number.isInteger(b.rngState) ||
    !Number.isSafeInteger(b.nextId) ||
    b.nextId < 1 ||
    !Number.isSafeInteger(b.turnId) ||
    b.turnId < 0
  )
    return false;
  if (s.adventure !== undefined && !validAdventure(s)) return false;
  for (const values of [b.voids, b.rocks, b.bubbles]) {
    if (
      values !== undefined &&
      (!Array.isArray(values) ||
        values.length !== 64 ||
        values.some((v) => typeof v !== "boolean"))
    )
      return false;
  }
  if (
    b.clams !== undefined &&
    (!Array.isArray(b.clams) ||
      b.clams.length !== 64 ||
      b.clams.some((v) => !Number.isInteger(v) || v < 0 || v > 2))
  )
    return false;
  if (
    b.gravity !== undefined &&
    !["down", "up", "left", "right"].includes(b.gravity)
  )
    return false;
  if (
    ![b.tiles, b.sand, b.blockers].every(
      (a) => Array.isArray(a) && a.length === 64,
    ) ||
    [...b.sand, ...b.blockers].some((v) => typeof v !== "boolean")
  )
    return false;
  if (
    b.tiles.some((t, i) =>
      b.blockers[i] || b.voids?.[i] || b.rocks?.[i] || (b.clams?.[i] ?? 0) > 0
        ? t !== null
        : !t ||
          !Number.isSafeInteger(t.id) ||
          t.id < 1 ||
          t.id >= b.nextId ||
          !Number.isInteger(t.type) ||
          t.type < 0 ||
          t.type > 4 ||
          (t.special !== undefined &&
            !["row", "column", "bomb", "color"].includes(t.special)),
    )
  )
    return false;
  const tileIds = b.tiles.flatMap((t) => (t ? [t.id] : []));
  if (
    new Set(tileIds).size !== tileIds.length ||
    !Array.isArray(b.objectives) ||
    b.objectives.length < 1 ||
    b.objectives.length > 3
  )
    return false;
  const definition = getLevel(b.levelId);
  const legacy = b.levelId <= 10 && (s.active.legacy || b.voids === undefined);
  const legacyCoral =
    b.levelId === 5
      ? [18, 21, 26, 29, 34, 37]
      : b.levelId === 9
        ? [24, 25, 26, 27, 28, 29, 30, 31]
        : [];
  const legacySand =
    b.levelId === 4
      ? [56, 57, 58, 59, 60, 61, 62, 63]
      : b.levelId === 6
        ? [48, 49, 50, 51, 52, 53, 54, 55]
        : [8, 10].includes(b.levelId)
          ? [42, 43, 44, 45, 50, 51, 52, 53, 58, 59, 60, 61]
          : [];
  if (
    b.blockers.some(
      (blocked, i) =>
        blocked &&
        (!(legacy ? legacyCoral : definition.coral).includes(i) ||
          b.sand[i] ||
          b.voids?.[i] ||
          b.rocks?.[i] ||
          b.clams?.[i]),
    ) ||
    b.sand.some(
      (sand, i) =>
        sand &&
        (!(legacy ? legacySand : definition.sand).includes(i) ||
          b.voids?.[i] ||
          b.rocks?.[i] ||
          b.clams?.[i]),
    ) ||
    b.voids?.some(
      (hole, i) => hole && (b.rocks?.[i] || b.clams?.[i] || b.bubbles?.[i]),
    ) ||
    b.rocks?.some((rock, i) => rock && (b.clams?.[i] || b.bubbles?.[i]))
  )
    return false;
  if (
    b.objectives.length !== definition.objectives.length ||
    !b.objectives.every(
      (o, i) =>
        o &&
        o.kind === definition.objectives[i].kind &&
        o.target === definition.objectives[i].target &&
        Number.isInteger(o.collected) &&
        o.collected >= 0 &&
        o.collected <= o.target,
    )
  )
    return false;
  if (s.active.rewarded && (!isWon(b) || !s.claimed.includes(b.levelId)))
    return false;
  if (
    s.active.pending &&
    (s.active.rewarded || !playTurn(b, s.active.pending).valid)
  )
    return false;
  return true;
}

export function persist(save: Save): void {
  save.updatedAt = new Date().toISOString();
  const previous = localStorage.getItem(SAVE_KEY);
  if (previous) {
    try {
      if (validateSave(JSON.parse(previous)))
        localStorage.setItem(BACKUP_KEY, previous);
    } catch {
      /* Keep the last valid backup. */
    }
  }
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function loadSave(): { save: Save; warning?: string; backup?: Save } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { save: freshSave() };
    const parsed: unknown = JSON.parse(raw);
    if (!validateSave(parsed))
      throw new Error("Denne gemning har et ukendt format.");
    prepareSave(parsed);
    if (parsed.active.pending) {
      parsed.active.board = playTurn(
        parsed.active.board,
        parsed.active.pending,
      ).state;
      parsed.active.pending = null;
      persist(parsed);
    }
    return { save: parsed };
  } catch {
    let backup: Save | undefined;
    try {
      const candidate: unknown = JSON.parse(
        localStorage.getItem(BACKUP_KEY) || "null",
      );
      if (validateSave(candidate)) {
        prepareSave(candidate);
        backup = candidate;
      }
    } catch {
      /* Report, never erase the broken save. */
    }
    return {
      save: freshSave(),
      backup,
      warning:
        "Det gemte spil kunne ikke åbnes. Det er bevaret; vælg en sikkerhedskopi eller start et nyt spil.",
    };
  }
}

export function awardWin(save: Save): number {
  if (save.active.rewarded || !isWon(save.active.board)) return 0;
  const id = save.active.board.levelId;
  const reward = save.claimed.includes(id) ? 10 : 40;
  const first = !save.claimed.includes(id);
  if (!save.claimed.includes(id)) save.claimed.push(id);
  if (!save.completed.includes(id)) save.completed.push(id);
  save.shells += reward;
  if (first) reserveFirstWin(save);
  save.active.rewarded = true;
  return reward;
}

export function purchase(
  save: Save,
  category: "fish" | "decor",
  id: string,
  slot?: number,
): string | null {
  const item =
    category === "fish"
      ? FISH.find((f) => f.id === id)
      : DECORATIONS.find((d) => d.id === id);
  if (!item) return "Den ting findes ikke.";
  if ((category === "fish" ? save.fishIds : save.decorations).includes(id))
    return "Den har du allerede.";
  if (category === "decor" && adventureOf(save).reefStage < rareStage(id))
    return "Åbn først området gennem revprojektet.";
  if (spendableShells(save) < item.price)
    return `Du mangler ${item.price - spendableShells(save)} frie skaller. Revopsparingen er beskyttet.`;
  if (
    category === "decor" &&
    (!Number.isInteger(slot) ||
      slot! < 0 ||
      slot! > 11 ||
      save.placements.some((p) => p.slot === slot))
  )
    return "Vælg en ledig plads først.";
  save.shells -= item.price;
  if (category === "fish") save.fishIds.push(id);
  else {
    save.decorations.push(id);
    save.placements.push({ id, slot: slot!, rotation: 0 });
  }
  return null;
}
