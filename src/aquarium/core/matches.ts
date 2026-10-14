import type { Special, Tile } from "./types";

export type Run = {
  cells: number[];
  orientation: "horizontal" | "vertical";
  type: number;
};
export type MatchGroup = { cells: number[]; runs: Run[]; special?: Special };

/** Every simultaneous straight run, merged where L/T/cross arms intersect. */
export function findMatchGroups(tiles: readonly (Tile | null)[]): MatchGroup[] {
  const runs: Run[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; ) {
      const first = row * 8 + col;
      const tile = tiles[first];
      if (!tile || tile.special === "color") {
        col++;
        continue;
      }
      let end = col + 1;
      while (
        end < 8 &&
        tiles[row * 8 + end]?.type === tile.type &&
        tiles[row * 8 + end]?.special !== "color"
      )
        end++;
      if (end - col >= 3)
        runs.push({
          cells: Array.from(
            { length: end - col },
            (_, offset) => first + offset,
          ),
          orientation: "horizontal",
          type: tile.type,
        });
      col = end;
    }
  }
  for (let col = 0; col < 8; col++) {
    for (let row = 0; row < 8; ) {
      const first = row * 8 + col;
      const tile = tiles[first];
      if (!tile || tile.special === "color") {
        row++;
        continue;
      }
      let end = row + 1;
      while (
        end < 8 &&
        tiles[end * 8 + col]?.type === tile.type &&
        tiles[end * 8 + col]?.special !== "color"
      )
        end++;
      if (end - row >= 3)
        runs.push({
          cells: Array.from(
            { length: end - row },
            (_, offset) => first + offset * 8,
          ),
          orientation: "vertical",
          type: tile.type,
        });
      row = end;
    }
  }
  const parent = new Map<number, number>();
  const root = (cell: number): number => {
    const p = parent.get(cell) ?? cell;
    if (p === cell) return cell;
    const answer = root(p);
    parent.set(cell, answer);
    return answer;
  };
  for (const run of runs) {
    for (const cell of run.cells) parent.set(cell, cell);
  }
  for (const run of runs) {
    for (const cell of run.cells.slice(1))
      parent.set(root(cell), root(run.cells[0]));
  }
  // Two simultaneously matched runs of the same type are one connected
  // match group when their matched cells touch, even without a shared cell.
  // Never bridge through a same-colour tile that is not itself in a run.
  for (const cell of parent.keys()) {
    for (const neighbour of [
      cell % 8 < 7 ? cell + 1 : -1,
      cell < 56 ? cell + 8 : -1,
    ]) {
      if (parent.has(neighbour) && tiles[cell]?.type === tiles[neighbour]?.type)
        parent.set(root(neighbour), root(cell));
    }
  }
  const grouped = new Map<number, { cells: Set<number>; runs: Run[] }>();
  for (const run of runs) {
    const key = root(run.cells[0]);
    const entry = grouped.get(key) ?? { cells: new Set<number>(), runs: [] };
    for (const cell of run.cells) entry.cells.add(cell);
    entry.runs.push(run);
    grouped.set(key, entry);
  }
  return [...grouped.values()]
    .map(({ cells, runs }) => {
      const ordered = [...cells].sort((a, b) => a - b);
      const hasHorizontal = runs.some(
        (run) => run.orientation === "horizontal",
      );
      const hasVertical = runs.some((run) => run.orientation === "vertical");
      let special: Special | undefined;
      if (runs.some((run) => run.cells.length >= 5)) special = "color";
      else if (ordered.length >= 5 && hasHorizontal && hasVertical)
        special = "bomb";
      else if (runs.some((run) => run.cells.length >= 4))
        special =
          runs.find((run) => run.cells.length >= 4)?.orientation ===
          "horizontal"
            ? "row"
            : "column";
      return { cells: ordered, runs, special };
    })
    .sort((a, b) => a.cells[0] - b.cells[0]);
}
