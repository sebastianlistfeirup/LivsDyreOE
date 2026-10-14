export type {
  Action,
  BoardEvent,
  BoardState,
  CellTile,
  Objective,
  Special,
  Tile,
  TileType,
  TurnResult,
  Gravity,
} from "./types";
export { normalizeBoard, isOccupied } from "./terrain";
export { createBoard } from "./generator";
export {
  getLegalMoves,
  getHint,
  grantMoves,
  isWon,
  playTurn,
  reshuffle,
} from "./engine";
