import {
  createBoard,
  isWon,
  playTurn,
  type Action,
  type BoardState,
} from "../core";
import { getLevel } from "../content/levels";
import { DECORATIONS, FISH } from "../content/catalog";

export type Placement = { id: string; slot: number; rotation: number };
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
  active: { board: BoardState; pending: Action | null; rewarded: boolean };
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
    !integers(s.completed, 1, 10) ||
    !integers(s.claimed, 1, 10)
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
        p.slot > 7 ||
        ![0, 1, 2, 3].includes(p.rotation),
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
    !validAction(s.active.pending)
  )
    return false;
  const b = s.active.board;
  if (
    !b ||
    !Number.isInteger(b.levelId) ||
    b.levelId < 1 ||
    b.levelId > 10 ||
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
  if (
    ![b.tiles, b.sand, b.blockers].every(
      (a) => Array.isArray(a) && a.length === 64,
    ) ||
    [...b.sand, ...b.blockers].some((v) => typeof v !== "boolean")
  )
    return false;
  if (
    b.tiles.some((t, i) =>
      b.blockers[i]
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
  if (
    b.blockers.some(
      (blocked, i) => blocked && (!definition.coral.includes(i) || b.sand[i]),
    ) ||
    b.sand.some((sand, i) => sand && !definition.sand.includes(i))
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
      if (validateSave(candidate)) backup = candidate;
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
  if (!save.claimed.includes(id)) save.claimed.push(id);
  if (!save.completed.includes(id)) save.completed.push(id);
  save.shells += reward;
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
  if (save.shells < item.price)
    return `Du mangler ${item.price - save.shells} skaller. Spil en bane for at samle flere.`;
  if (
    category === "decor" &&
    (!Number.isInteger(slot) ||
      slot! < 0 ||
      slot! > 7 ||
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
