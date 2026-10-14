import type { ObjectiveKind } from "../content/levels";

export type TileType = 0 | 1 | 2 | 3 | 4;
export type Special = "row" | "column" | "bomb" | "color";
export type Tile = { id: number; type: TileType; special?: Special };
export type Objective = {
  kind: ObjectiveKind;
  target: number;
  collected: number;
};
export type BoardState = {
  levelId: number;
  tiles: (Tile | null)[];
  blockers: boolean[];
  sand: boolean[];
  rngState: number;
  movesRemaining: number;
  objectives: Objective[];
  nextId: number;
  turnId: number;
};
export type Action =
  | { kind: "swap"; from: number; to: number }
  | { kind: "use"; cell: number };
export type CellTile = { cell: number; tile: Tile };
export type BoardEvent = {
  kind: "swap" | "clear" | "fall" | "shuffle";
  tiles: (Tile | null)[];
  blockers: boolean[];
  sand: boolean[];
  removed?: CellTile[];
  activated?: CellTile[];
  created?: CellTile[];
};
export type TurnResult = {
  valid: boolean;
  state: BoardState;
  events: BoardEvent[];
};
