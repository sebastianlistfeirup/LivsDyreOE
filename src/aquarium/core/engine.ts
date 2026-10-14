import { findMatchGroups, type MatchGroup } from "./matches";
import { applyGravity } from "./gravity";
import { randomInt } from "./rng";
import { getLevel } from "../content/levels";
import { isOccupied, normalizeBoard } from "./terrain";
import type {
  Action,
  BoardEvent,
  BoardState,
  CellTile,
  Special,
  Tile,
  TileType,
  TurnResult,
} from "./types";

const KIND_BY_TYPE = ["shell", "star", "drop", "leaf", "pearl"] as const;

function inside(cell: number): boolean {
  return Number.isInteger(cell) && cell >= 0 && cell < 64;
}
function adjacent(a: number, b: number): boolean {
  return (
    inside(a) &&
    inside(b) &&
    (Math.abs(a - b) === 8 ||
      (Math.floor(a / 8) === Math.floor(b / 8) && Math.abs(a - b) === 1))
  );
}
function clone(board: BoardState): BoardState {
  return normalizeBoard(board);
}
function event(
  board: BoardState,
  kind: BoardEvent["kind"],
  extra: Partial<BoardEvent> = {},
): BoardEvent {
  return {
    kind,
    tiles: board.tiles.map((tile) => (tile ? { ...tile } : null)),
    blockers: [...board.blockers],
    sand: [...board.sand],
    voids: [...(board.voids ?? Array(64).fill(false))],
    rocks: [...(board.rocks ?? Array(64).fill(false))],
    clams: [...(board.clams ?? Array(64).fill(0))],
    bubbles: [...(board.bubbles ?? Array(64).fill(false))],
    gravity: board.gravity ?? "down",
    ...extra,
  };
}
function count(board: BoardState, kind: string): void {
  for (const objective of board.objectives)
    if (objective.kind === kind)
      objective.collected = Math.min(objective.target, objective.collected + 1);
}
function orthogonalNeighbours(cell: number): number[] {
  const row = Math.floor(cell / 8),
    col = cell % 8;
  return [
    row > 0 ? cell - 8 : -1,
    row < 7 ? cell + 8 : -1,
    col > 0 ? cell - 1 : -1,
    col < 7 ? cell + 1 : -1,
  ].filter(inside);
}

/** Public action list includes the non-drag 'Use' option for rays and bombs. */
export function getLegalMoves(board: BoardState): Action[] {
  if (board.movesRemaining <= 0 || isWon(board)) return [];
  const moves: Action[] = [];
  for (let a = 0; a < 64; a++) {
    const tile = board.tiles[a];
    if (!tile || isOccupied(board, a)) continue;
    if (
      tile.special === "row" ||
      tile.special === "column" ||
      tile.special === "bomb"
    )
      moves.push({ kind: "use", cell: a });
    for (const b of [a + 1, a + 8]) {
      if (!adjacent(a, b) || isOccupied(board, b) || !board.tiles[b]) continue;
      if (tile.special || board.tiles[b]?.special) {
        moves.push({ kind: "swap", from: a, to: b });
        continue;
      }
      const swapped = [...board.tiles];
      [swapped[a], swapped[b]] = [swapped[b], swapped[a]];
      if (findMatchGroups(swapped).length)
        moves.push({ kind: "swap", from: a, to: b });
    }
  }
  return moves;
}

/** A visible hint should advance Liv's current goals, not just return row-major's first swap. */
export function getHint(board: BoardState): Action | null {
  const legal = getLegalMoves(board);
  if (!legal.length) return null;
  let best = legal[0],
    bestScore = -Infinity;
  const wantsSand = board.objectives.some(
    (objective) =>
      objective.kind === "sand" && objective.collected < objective.target,
  );
  const wantsCoral = board.objectives.some(
    (objective) =>
      objective.kind === "coral" && objective.collected < objective.target,
  );
  const wantsSpecial = board.objectives.some(
    (objective) =>
      objective.kind === "special" && objective.collected < objective.target,
  );
  const wantsClams = board.objectives.some(
    (objective) =>
      objective.kind === "clam" && objective.collected < objective.target,
  );
  for (const action of legal) {
    const result = playTurn(board, action);
    if (isWon(result.state)) return action;
    let score = 0;
    for (let index = 0; index < board.objectives.length; index++) {
      const objective = board.objectives[index];
      const gained =
        result.state.objectives[index].collected - objective.collected;
      score += (gained * 100) / objective.target;
    }
    const removed = result.events.flatMap((stage) => stage.removed ?? []);
    const created = result.events.flatMap((stage) => stage.created ?? []);
    score += created.length * (wantsSpecial ? 8 : 3);
    score += removed.length * 0.12;
    if (wantsSand)
      score +=
        removed.filter((item) => Math.floor(item.cell / 8) >= 5).length * 0.45;
    if (wantsCoral)
      score +=
        removed.filter((item) =>
          board.blockers.some(
            (blocked, cell) => blocked && adjacent(cell, item.cell),
          ),
        ).length * 0.6;
    if (wantsClams) {
      // Cracking the first half of a shell is real progress even before its objective increments.
      score +=
        (board.clams ?? []).reduce(
          (sum, hp, cell) => sum + hp - (result.state.clams?.[cell] ?? 0),
          0,
        ) * 8;
    }
    if (score > bestScore) {
      best = action;
      bestScore = score;
    }
  }
  return best;
}
export function isWon(board: BoardState): boolean {
  return (
    board.objectives.length > 0 &&
    board.objectives.every(
      (objective) => objective.collected >= objective.target,
    )
  );
}
export function grantMoves(board: BoardState, count = 5): BoardState {
  if (!Number.isSafeInteger(count) || count <= 0)
    throw new RangeError("Extra moves must be a positive integer.");
  const next = clone(board);
  next.movesRemaining += count;
  return next;
}

function mostCommonNormalType(board: BoardState): TileType {
  const totals = [0, 0, 0, 0, 0];
  for (const tile of board.tiles)
    if (tile && !tile.special) totals[tile.type]++;
  let best: TileType = 0;
  for (let type = 1; type < 5; type++)
    if (totals[type] > totals[best]) best = type as TileType;
  return best;
}

function resolveWave(
  board: BoardState,
  groups: MatchGroup[],
  seeds: { cell: number; targetType?: TileType }[],
  destination?: number,
  combo?: BoardEvent["combo"],
): BoardEvent {
  const clear = new Set<number>();
  const coralHits = new Set<number>();
  const clamHits = new Set<number>();
  const creations: { cell: number; special: Special }[] = [];
  const queue = [...seeds];
  const visited = new Set<number>();
  const activated: CellTile[] = [];

  for (const group of groups) {
    const anchor =
      group.special && !combo
        ? destination !== undefined && group.cells.includes(destination)
          ? destination
          : group.cells[0]
        : -1;
    if (group.special && !combo)
      creations.push({ cell: anchor, special: group.special });
    for (const cell of group.cells) {
      for (const neighbour of orthogonalNeighbours(cell))
        if (board.blockers[neighbour]) coralHits.add(neighbour);
        else if (board.clams?.[neighbour]) clamHits.add(neighbour);
      const tile = board.tiles[cell];
      if (cell !== anchor || tile?.special) clear.add(cell);
      if (tile?.special) queue.push({ cell });
    }
  }

  const hit = (cell: number): void => {
    if (!inside(cell)) return;
    if (board.voids?.[cell] || board.rocks?.[cell]) return;
    if (board.blockers[cell]) {
      coralHits.add(cell);
      return;
    }
    if (board.clams?.[cell]) {
      clamHits.add(cell);
      return;
    }
    const tile = board.tiles[cell];
    if (!tile) return;
    clear.add(cell);
    if (tile.special && !visited.has(tile.id)) queue.push({ cell });
  };
  if (combo) {
    // The combined effect replaces each source's individual effect. Chained
    // third-party specials still activate normally, once per identity.
    for (const seed of seeds) {
      const tile = board.tiles[seed.cell];
      if (!tile?.special || visited.has(tile.id)) continue;
      visited.add(tile.id);
      activated.push({ cell: seed.cell, tile: { ...tile } });
      clear.add(seed.cell);
    }
    for (const cell of combo.cells) hit(cell);
  }
  while (queue.length) {
    const activation = queue.shift()!;
    const tile = board.tiles[activation.cell];
    if (!tile?.special || visited.has(tile.id)) continue;
    visited.add(tile.id);
    activated.push({ cell: activation.cell, tile: { ...tile } });
    clear.add(activation.cell);
    const row = Math.floor(activation.cell / 8),
      col = activation.cell % 8;
    if (tile.special === "row") for (let c = 0; c < 8; c++) hit(row * 8 + c);
    else if (tile.special === "column")
      for (let r = 0; r < 8; r++) hit(r * 8 + col);
    else if (tile.special === "bomb") {
      for (let r = Math.max(0, row - 1); r <= Math.min(7, row + 1); r++)
        for (let c = Math.max(0, col - 1); c <= Math.min(7, col + 1); c++)
          hit(r * 8 + c);
    } else {
      const type = activation.targetType ?? mostCommonNormalType(board);
      for (let cell = 0; cell < 64; cell++)
        if (board.tiles[cell]?.type === type && !board.tiles[cell]?.special)
          hit(cell);
    }
  }

  const removed: CellTile[] = [];
  for (const cell of [...clear].sort((a, b) => a - b)) {
    const tile = board.tiles[cell];
    if (!tile) continue;
    removed.push({ cell, tile: { ...tile } });
    if (!tile.special) count(board, KIND_BY_TYPE[tile.type]);
    if (board.sand[cell]) {
      board.sand[cell] = false;
      count(board, "sand");
    }
    board.tiles[cell] = null;
  }
  for (const cell of [...coralHits].sort((a, b) => a - b)) {
    if (board.blockers[cell]) {
      board.blockers[cell] = false;
      count(board, "coral");
    }
  }
  for (const cell of [...clamHits].sort((a, b) => a - b)) {
    if (board.clams?.[cell]) {
      board.clams[cell]--;
      if (board.clams[cell] === 0) count(board, "clam");
    }
  }
  for (let index = 0; index < activated.length; index++)
    count(board, "special");
  const created: CellTile[] = [];
  for (const creation of creations) {
    const old = board.tiles[creation.cell];
    const tile: Tile = old
      ? { ...old, special: creation.special }
      : {
          id: board.nextId++,
          type: groups.find((group) => group.cells.includes(creation.cell))!
            .runs[0].type as TileType,
          special: creation.special,
        };
    board.tiles[creation.cell] = tile;
    created.push({ cell: creation.cell, tile: { ...tile } });
  }
  return event(board, "clear", {
    removed,
    activated,
    created,
    ...(combo ? { combo } : {}),
  });
}

function createsMatch(tiles: readonly (Tile | null)[]): boolean {
  return findMatchGroups(tiles).length > 0;
}
function hasMoveIgnoringMoves(board: BoardState): boolean {
  return (
    getLegalMoves({
      ...board,
      movesRemaining: Math.max(1, board.movesRemaining),
      objectives: [{ kind: "shell", target: 1, collected: 0 }],
    }).length > 0
  );
}

/** Reorders existing tile identities; a rare impossible permutation is recoloured. */
export function reshuffle(board: BoardState): BoardEvent {
  const cells = Array.from({ length: 64 }, (_, cell) => cell).filter(
    (cell) => !isOccupied(board, cell),
  );
  const original = cells
    .map((cell) => board.tiles[cell])
    .filter((tile): tile is Tile => tile !== null)
    .map((tile) => ({ ...tile }));
  if (original.length !== cells.length)
    throw new Error("Cannot reshuffle an unsettled board.");
  for (let attempt = 0; attempt < 1024; attempt++) {
    const pool = original.map((tile) => ({ ...tile }));
    for (let i = pool.length - 1; i > 0; i--) {
      const [j, next] = randomInt(board.rngState, i + 1);
      board.rngState = next;
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    cells.forEach((cell, index) => {
      board.tiles[cell] = pool[index];
    });
    if (!createsMatch(board.tiles) && hasMoveIgnoringMoves(board))
      return event(board, "shuffle");
  }
  for (let attempt = 0; attempt < 2048; attempt++) {
    cells.forEach((cell, index) => {
      const [type, next] = randomInt(board.rngState, 5);
      board.rngState = next;
      board.tiles[cell] = { ...original[index], type: type as TileType };
    });
    if (!createsMatch(board.tiles) && hasMoveIgnoringMoves(board))
      return event(board, "shuffle");
  }
  throw new Error("Could not restore a legal board.");
}

export function playTurn(board: BoardState, action: Action): TurnResult {
  if (board.movesRemaining <= 0 || isWon(board))
    return { valid: false, state: board, events: [] };
  const next = clone(board);
  const events: BoardEvent[] = [];
  let groups: MatchGroup[];
  const seeds: { cell: number; targetType?: TileType }[] = [];
  let destination: number | undefined;
  let combo: BoardEvent["combo"];
  if (action.kind === "swap") {
    const { from, to } = action;
    if (
      !adjacent(from, to) ||
      isOccupied(next, from) ||
      isOccupied(next, to) ||
      !next.tiles[from] ||
      !next.tiles[to]
    )
      return { valid: false, state: board, events: [] };
    [next.tiles[from], next.tiles[to]] = [next.tiles[to], next.tiles[from]];
    destination = to;
    const moved = next.tiles[to]!,
      displaced = next.tiles[from]!;
    const isRay = (special?: Special): boolean =>
      special === "row" || special === "column";
    const comboKind =
      moved.special === "color" && displaced.special === "color"
        ? "rainbow"
        : isRay(moved.special) && isRay(displaced.special)
          ? "cross"
          : (moved.special === "bomb" && isRay(displaced.special)) ||
              (displaced.special === "bomb" && isRay(moved.special))
            ? "cross-blast"
            : undefined;
    if (comboKind) {
      const row = Math.floor(to / 8),
        col = to % 8;
      const cells = Array.from({ length: 64 }, (_, cell) => cell).filter(
        (cell) =>
          !next.voids?.[cell] &&
          !next.rocks?.[cell] &&
          (comboKind === "rainbow" ||
            (comboKind === "cross"
              ? Math.floor(cell / 8) === row || cell % 8 === col
              : Math.abs(Math.floor(cell / 8) - row) <= 1 ||
                Math.abs((cell % 8) - col) <= 1)),
      );
      combo = { kind: comboKind, cell: to, cells };
    }
    if (moved.special)
      seeds.push({
        cell: to,
        targetType:
          moved.special === "color" && !displaced.special
            ? displaced.type
            : undefined,
      });
    if (displaced.special)
      seeds.push({
        cell: from,
        targetType:
          displaced.special === "color" && !moved.special
            ? moved.type
            : undefined,
      });
    groups = findMatchGroups(next.tiles);
    if (!groups.length && !seeds.length)
      return { valid: false, state: board, events: [] };
    events.push(event(next, "swap"));
  } else {
    const cell = action.cell;
    const special =
      inside(cell) && !isOccupied(next, cell)
        ? next.tiles[cell]?.special
        : undefined;
    if (special !== "row" && special !== "column" && special !== "bomb")
      return { valid: false, state: board, events: [] };
    seeds.push({ cell });
    groups = [];
  }
  next.movesRemaining--;
  next.turnId++;
  const cycle = getLevel(next.levelId).currentCycle;
  if (cycle?.length)
    next.gravity =
      cycle[(cycle.indexOf(next.gravity ?? "down") + 1) % cycle.length];
  let bubblesPulsed = false;
  for (let cascade = 0; cascade < 128; cascade++) {
    events.push(resolveWave(next, groups, seeds.splice(0), destination, combo));
    combo = undefined;
    applyGravity(next);
    events.push(event(next, "fall"));
    destination = undefined;
    groups = findMatchGroups(next.tiles);
    if (!groups.length) {
      if (!bubblesPulsed) {
        bubblesPulsed = true;
        const lifted: NonNullable<BoardEvent["lifted"]> = [];
        const touched = new Set<number>();
        for (let from = 8; from < 64; from++) {
          const to = from - 8;
          if (
            !next.bubbles?.[from] ||
            isOccupied(next, from) ||
            isOccupied(next, to) ||
            !next.tiles[from] ||
            !next.tiles[to] ||
            touched.has(from) ||
            touched.has(to)
          )
            continue;
          lifted.push({ from, to, tile: { ...next.tiles[from]! } });
          [next.tiles[from], next.tiles[to]] = [
            next.tiles[to],
            next.tiles[from],
          ];
          touched.add(from);
          touched.add(to);
        }
        if (lifted.length) {
          events.push(event(next, "fall", { lifted }));
          groups = findMatchGroups(next.tiles);
          if (groups.length) continue;
        }
      }
      if (!isWon(next) && !hasMoveIgnoringMoves(next))
        events.push(reshuffle(next));
      return { valid: true, state: next, events };
    }
  }
  throw new Error("Cascade exceeded safe limit.");
}
