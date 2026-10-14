export type Species = 'capybara' | 'tiger' | 'penguin';
export type Tool = 'path' | 'fence' | 'gate' | 'habitat' | 'move' | 'erase' | string;

export type Point = { x: number; y: number };
export type PlacedObject = { id: string; definitionId: string; gridPosition: Point; rotation: 0 | 1; paidPrice?: number };
export type Habitat = { id: string; speciesId: Species; seed: Point };
export type Animal = { id: string; speciesId: Species; name: string; missionOriginId: Species; habitatId: string | null };
export type MissionState = {
  missionId: Species;
  stageIndex: number;
  minigameState: Record<string, unknown>;
  safeCheckpoint: number;
};
export type AlbumEntry = { id: string; title: string; timestamp: string; emoji: string; image?: string };
export type GameState = {
  projectId: 'livs-dyreo';
  schemaVersion: 1;
  buildVersion: string;
  savedAt: string;
  chapterId: number;
  parkName: string;
  budget: number;
  placedObjects: PlacedObject[];
  fences: string[];
  gates: string[];
  paths: string[];
  habitats: Habitat[];
  animals: Animal[];
  completedMissionIds: Species[];
  claimedRewardIds: string[];
  album: AlbumEntry[];
  settings: { voice: boolean; music: boolean };
  mission: MissionState | null;
  servicePumpDone: boolean;
  servicePumpState: Record<string, unknown>;
  remodelCount: number;
  partyOpen: boolean;
  visitedHabitats: Species[];
  seed: number;
  rngPosition: number;
};

export type ObjectDef = {
  id: string;
  name: string;
  price: number;
  width: number;
  height: number;
  icon: string;
  category: 'natur' | 'dyr' | 'gæster' | 'fest';
  unlock: number;
};

export type HabitatCheck = {
  valid: boolean;
  cells: string[];
  area: number;
  water: number;
  access: boolean;
  missing: string[];
};
