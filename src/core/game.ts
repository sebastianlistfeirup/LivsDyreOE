import { CHAPTERS, DOCK, HEIGHT, MISSIONS, OBJECT_BY_ID, SPECIES, WIDTH } from '../content/data';
import type { GameState, Habitat, HabitatCheck, PlacedObject, Point, Species } from './types';

export const cellKey = (x: number, y: number) => `${x},${y}`;
export const inBounds = (x: number, y: number) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT;
export const edgeKey = (x: number, y: number, side: number) => side === 0 ? `h:${x}:${y}` : side === 1 ? `v:${x + 1}:${y}` : side === 2 ? `h:${x}:${y + 1}` : `v:${x}:${y}`;
const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
const isServiceCell = (x: number, y: number) => (x <= 1 && y >= 16 && !(x === DOCK.x && y === DOCK.y)) || (x === 12 && y === 16);

export function createGame(): GameState {
  return {
    projectId: 'livs-dyreo', schemaVersion: 1, buildVersion: __BUILD_VERSION__, savedAt: new Date().toISOString(),
    chapterId: 1, parkName: 'Livs Dyreø', budget: 1250, placedObjects: [], fences: [], gates: [], paths: [cellKey(DOCK.x, DOCK.y)],
    habitats: [], animals: [], completedMissionIds: [], claimedRewardIds: [], album: [],
    settings: { voice: false, music: false }, mission: null, servicePumpDone: false, servicePumpState: {}, remodelCount: 0,
    partyOpen: false, visitedHabitats: [], seed: 18321, rngPosition: 0,
  };
}

export function clone(state: GameState): GameState { return structuredClone(state); }
export function nextId(state: GameState, prefix: string): string { state.rngPosition += 1; return `${prefix}-${state.rngPosition}`; }

export function footprint(object: PlacedObject): Point[] {
  const def = OBJECT_BY_ID[object.definitionId];
  if (!def) return [];
  const w = object.rotation ? def.height : def.width;
  const h = object.rotation ? def.width : def.height;
  const cells: Point[] = [];
  for (let y = object.gridPosition.y; y < object.gridPosition.y + h; y++)
    for (let x = object.gridPosition.x; x < object.gridPosition.x + w; x++) cells.push({ x, y });
  return cells;
}

export function placementProblem(state: GameState, definitionId: string, at: Point, rotation: 0 | 1 = 0, ignoreId?: string): string | null {
  const def = OBJECT_BY_ID[definitionId];
  if (!def) return 'Ukendt byggeobjekt.';
  if (def.unlock > state.chapterId) return `Åbnes i kapitel ${def.unlock}.`;
  const draft = { id: ignoreId ?? '', definitionId, gridPosition: at, rotation };
  const cells = footprint(draft);
  if (cells.some(p => !inBounds(p.x, p.y))) return 'Objektet går uden for øens byggefelt.';
  if (cells.some(p => (p.x <= 1 && p.y >= 16) || (p.x === 12 && p.y === 16))) return 'Her står en fast servicebygning.';
  if (cells.some(p => state.paths.includes(cellKey(p.x, p.y)))) return 'Her går en sti. Vælg et frit felt.';
  if (state.placedObjects.some(o => o.id !== ignoreId && footprint(o).some(p => cells.some(c => c.x === p.x && c.y === p.y)))) return 'Et andet objekt står på feltet.';
  if (['bench', 'sign', 'portal'].includes(definitionId)) {
    const paths = reachedPaths(state);
    if (!cells.some(p => directions.some(([dx, dy]) => paths.has(cellKey(p.x + dx, p.y + dy)))))
      return 'Placér dette ved en sti, der er forbundet til kajen.';
  }
  return null;
}

export function placeObject(state: GameState, definitionId: string, at: Point, rotation: 0 | 1 = 0): string | null {
  const problem = placementProblem(state, definitionId, at, rotation);
  if (problem) return problem;
  const def = OBJECT_BY_ID[definitionId];
  const freePortal = definitionId === 'portal' && state.chapterId >= 9 && !state.claimedRewardIds.includes('free-portal');
  const price = freePortal ? 0 : def.price;
  if (state.budget < price) return `Du mangler ${price - state.budget} budgetpoint.`;
  state.budget -= price;
  if (freePortal) state.claimedRewardIds.push('free-portal');
  state.placedObjects.push({ id: nextId(state, definitionId), definitionId, gridPosition: at, rotation, paidPrice: price });
  return null;
}

export function moveObject(state: GameState, id: string, at: Point, rotation: 0 | 1): string | null {
  const object = state.placedObjects.find(o => o.id === id);
  if (!object) return 'Objektet findes ikke længere.';
  if (object.gridPosition.x === at.x && object.gridPosition.y === at.y && object.rotation === rotation)
    return 'Vælg et nyt felt eller drej objektet.';
  const problem = placementProblem(state, object.definitionId, at, rotation, id);
  if (problem) return problem;
  object.gridPosition = at;
  object.rotation = rotation;
  state.remodelCount += 1;
  return null;
}

export function placePath(state: GameState, at: Point): string | null {
  if (!inBounds(at.x, at.y)) return 'Feltet er uden for øen.';
  const key = cellKey(at.x, at.y);
  if (state.paths.includes(key)) return 'Der er allerede en sti på dette felt.';
  if (isServiceCell(at.x, at.y)) return 'Her står en fast servicebygning.';
  if (state.placedObjects.some(o => footprint(o).some(p => p.x === at.x && p.y === at.y))) return 'Et objekt står på feltet.';
  state.paths.push(key);
  state.remodelCount += 1;
  return null;
}

export function placeEdge(state: GameState, at: Point, side: number, type: 'fence' | 'gate'): string | null {
  if (!inBounds(at.x, at.y) || !Number.isInteger(side) || side < 0 || side > 3) return 'Vælg en feltkant på øen.';
  const key = edgeKey(at.x, at.y, side);
  const own = type === 'fence' ? state.fences : state.gates;
  const other = type === 'fence' ? state.gates : state.fences;
  if (own.includes(key)) return 'Den kant er allerede bygget.';
  const price = type === 'fence' ? 5 : 20;
  const refund = other.includes(key) ? (type === 'fence' ? 20 : 5) : 0;
  if (state.budget + refund < price) return 'Der er ikke budget til denne kant.';
  state.budget += refund - price;
  if (other.includes(key)) other.splice(other.indexOf(key), 1);
  own.push(key);
  return null;
}

export function eraseAt(state: GameState, at: Point, side?: number): string | null {
  if (!inBounds(at.x, at.y) || (side !== undefined && (!Number.isInteger(side) || side < 0 || side > 3))) return 'Vælg et felt på øen.';
  if (side !== undefined) {
    const key = edgeKey(at.x, at.y, side);
    const fence = state.fences.indexOf(key), gate = state.gates.indexOf(key);
    if (fence >= 0) { state.fences.splice(fence, 1); state.budget += 5; return null; }
    if (gate >= 0) { state.gates.splice(gate, 1); state.budget += 20; return null; }
  }
  const object = state.placedObjects.find(o => footprint(o).some(p => p.x === at.x && p.y === at.y));
  if (object) {
    state.placedObjects.splice(state.placedObjects.indexOf(object), 1);
    state.budget += object.paidPrice ?? OBJECT_BY_ID[object.definitionId].price;
    return null;
  }
  const path = state.paths.indexOf(cellKey(at.x, at.y));
  if (path >= 0 && !(at.x === DOCK.x && at.y === DOCK.y)) { state.paths.splice(path, 1); state.remodelCount += 1; return null; }
  return 'Der er ikke noget at fjerne her.';
}

export function addHabitat(state: GameState, species: Species, seed: Point): string | null {
  if (!inBounds(seed.x, seed.y)) return 'Vælg et felt på øen.';
  const existing = state.habitats.find(h => h.speciesId === species);
  if (existing) { existing.seed = seed; return null; }
  state.habitats.push({ id: nextId(state, `home-${species}`), speciesId: species, seed });
  return null;
}

function reachedPaths(state: GameState): Set<string> {
  const paths = new Set(state.paths), reached = new Set<string>();
  const start = cellKey(DOCK.x, DOCK.y), queue = [start];
  if (!paths.has(start)) return reached;
  reached.add(start);
  while (queue.length) {
    const [x, y] = queue.shift()!.split(',').map(Number);
    for (let side = 0; side < directions.length; side++) {
      if (state.fences.includes(edgeKey(x, y, side))) continue;
      const [dx, dy] = directions[side];
      const key = cellKey(x + dx, y + dy);
      if (paths.has(key) && !reached.has(key)) { reached.add(key); queue.push(key); }
    }
  }
  return reached;
}

export function validateHabitat(state: GameState, habitat: Habitat): HabitatCheck {
  const missing: string[] = [];
  const blocked = new Set([...state.fences, ...state.gates]);
  const seen = new Set<string>();
  const queue = [habitat.seed];
  let leaks = false;
  while (queue.length) {
    const point = queue.shift()!;
    if (!inBounds(point.x, point.y)) { leaks = true; continue; }
    const key = cellKey(point.x, point.y);
    if (seen.has(key)) continue;
    seen.add(key);
    for (let side = 0; side < 4; side++) {
      if (blocked.has(edgeKey(point.x, point.y, side))) continue;
      const [dx, dy] = directions[side];
      queue.push({ x: point.x + dx, y: point.y + dy });
    }
  }
  if (leaks) missing.push('Luk hegnet hele vejen rundt.');
  if (state.habitats.some(h => h.id !== habitat.id && h.speciesId !== habitat.speciesId && seen.has(cellKey(h.seed.x, h.seed.y))))
    missing.push('Dette område er allerede markeret til en anden dyreart.');
  const spec = SPECIES[habitat.speciesId];
  if (seen.size < spec.minimum) missing.push(`Mindst ${spec.minimum} felter (${seen.size} nu).`);
  const insideObjects = state.placedObjects.filter(o => footprint(o).every(p => seen.has(cellKey(p.x, p.y))));
  const wet = new Set<string>();
  for (const object of insideObjects) if (object.definitionId === 'pond' || object.definitionId === 'swim')
    footprint(object).forEach(p => wet.add(cellKey(p.x, p.y)));
  if (wet.size < spec.water) missing.push(`Mindst ${spec.water} vandfelter (${wet.size} nu).`);
  for (const need of spec.needs) if (!insideObjects.some(o => o.definitionId === need))
    missing.push(`${OBJECT_BY_ID[need].name} mangler.`);
  const reachable = reachedPaths(state);
  const gateEntries: Point[] = [];
  for (const key of state.gates) {
    const [direction, xs, ys] = key.split(':');
    const x = Number(xs), y = Number(ys);
    const first = direction === 'v' ? { x: x - 1, y } : { x, y: y - 1 };
    const second = direction === 'v' ? { x, y } : { x, y };
    const inFirst = seen.has(cellKey(first.x, first.y)), inSecond = seen.has(cellKey(second.x, second.y));
    if (inFirst === inSecond) continue;
    const inner = inFirst ? first : second, outer = inFirst ? second : first;
    if (reachable.has(cellKey(outer.x, outer.y))) gateEntries.push(inner);
  }
  const access = gateEntries.length > 0;
  if (!access) missing.push('Porten skal nås via sti fra kajen.');
  if (access && !leaks) {
    const dry = new Set([...seen].filter(k => !wet.has(k)));
    const visited = new Set<string>(), steps = gateEntries.filter(p => dry.has(cellKey(p.x, p.y)));
    while (steps.length) {
      const point = steps.shift()!, key = cellKey(point.x, point.y);
      if (visited.has(key)) continue;
      visited.add(key);
      for (let side = 0; side < directions.length; side++) {
        if (state.fences.includes(edgeKey(point.x, point.y, side))) continue;
        const [dx, dy] = directions[side];
        const n = cellKey(point.x + dx, point.y + dy);
        if (dry.has(n) && !visited.has(n)) steps.push({ x: point.x + dx, y: point.y + dy });
      }
    }
    const targets = insideObjects.filter(o => spec.needs.includes(o.definitionId));
    if (targets.some(o => !footprint(o).some(p => directions.some(([dx, dy]) => visited.has(cellKey(p.x + dx, p.y + dy))))))
      missing.push('Lav en tør rute fra port til foder og aktivitet.');
  }
  return { valid: missing.length === 0, cells: [...seen], area: seen.size, water: wet.size, access, missing: missing.slice(0, 5) };
}

export function home(state: GameState, species: Species): { habitat: Habitat | null; check: HabitatCheck | null } {
  const habitat = state.habitats.find(h => h.speciesId === species) ?? null;
  return { habitat, check: habitat ? validateHabitat(state, habitat) : null };
}

const standard: Record<Species, { x: number; y: number; w: number; h: number; gateX: number; objects: [string, number, number][] }> = {
  capybara: { x: 2, y: 10, w: 6, h: 5, gateX: 4, objects: [['pond', 3, 11], ['shade', 5, 11], ['shelter', 5, 13], ['feed', 3, 13]] },
  tiger: { x: 9, y: 2, w: 6, h: 6, gateX: 11, objects: [['pond', 10, 3], ['cave', 12, 3], ['log', 10, 5], ['feed', 12, 6]] },
  penguin: { x: 16, y: 9, w: 6, h: 5, gateX: 18, objects: [['swim', 17, 10], ['swim', 19, 10], ['coolrock', 17, 12], ['feed', 19, 12]] },
};

export function buildStandard(state: GameState, species: Species): string | null {
  if (home(state, species).habitat) return 'Dette hjem er allerede oprettet. Du kan bygge videre selv.';
  const site = standard[species];
  const edges: string[] = [];
  for (let x = site.x; x < site.x + site.w; x++) {
    edges.push(edgeKey(x, site.y, 0));
    edges.push(edgeKey(x, site.y + site.h - 1, 2));
  }
  for (let y = site.y; y < site.y + site.h; y++) {
    edges.push(edgeKey(site.x, y, 3));
    edges.push(edgeKey(site.x + site.w - 1, y, 1));
  }
  const gate = edgeKey(site.gateX, site.y + site.h - 1, 2);
  const neededEdges = edges.filter(e => e !== gate && !state.fences.includes(e));
  if (edges.some(e => e !== gate && state.gates.includes(e)) || state.fences.includes(gate)) return 'Et eksisterende hegn eller en port spærrer for forslaget.';
  for (const [id, x, y] of site.objects) {
    const problem = placementProblem(state, id, { x, y });
    if (problem) return `Forslaget kan ikke placeres: ${problem}`;
  }
  const proposedPaths = new Set<string>();
  for (let x = 1; x <= 18; x++) proposedPaths.add(cellKey(x, 17));
  for (let y = site.y + site.h; y <= 17; y++) proposedPaths.add(cellKey(site.gateX, y));
  const blockingObject = state.placedObjects.find(o => footprint(o).some(p => proposedPaths.has(cellKey(p.x, p.y))));
  if (blockingObject) return `Flyt ${OBJECT_BY_ID[blockingObject.definitionId].name} fra den foreslåede sti først.`;
  const cost = neededEdges.length * 5 + (state.gates.includes(gate) ? 0 : 20) + site.objects.reduce((sum, [id]) => sum + OBJECT_BY_ID[id].price, 0);
  if (state.budget < cost) return `Forslaget koster ${cost} point; der mangler ${cost - state.budget}.`;
  const draft = clone(state);
  draft.budget -= cost;
  draft.fences.push(...neededEdges);
  if (!draft.gates.includes(gate)) draft.gates.push(gate);
  for (const [definitionId, x, y] of site.objects) draft.placedObjects.push({ id: nextId(draft, definitionId), definitionId, gridPosition: { x, y }, rotation: 0, paidPrice: OBJECT_BY_ID[definitionId].price });
  addHabitat(draft, species, { x: site.x, y: site.y });
  for (let x = 1; x <= 18; x++) if (!draft.paths.includes(cellKey(x, 17))) draft.paths.push(cellKey(x, 17));
  const yBottom = site.y + site.h;
  for (let y = yBottom; y <= 17; y++) if (!draft.paths.includes(cellKey(site.gateX, y))) draft.paths.push(cellKey(site.gateX, y));
  const check = home(draft, species).check;
  if (!check?.valid) return `Forslaget kræver en fri adgang og et gyldigt hjem: ${check?.missing.join(' ') ?? 'Kontrollér området.'}`;
  Object.assign(state, draft);
  return null;
}

export function canStartMission(state: GameState, species: Species): string | null {
  if (state.mission) return 'Afslut den igangværende mission først.';
  const required = species === 'capybara' ? 2 : species === 'tiger' ? 4 : 6;
  if (state.chapterId < required) return `Missionen åbner i kapitel ${required}.`;
  if (!home(state, species).check?.valid) return 'Byg først et gyldigt hjem til dyrene.';
  return null;
}

export function startMission(state: GameState, species: Species): string | null {
  const problem = canStartMission(state, species);
  if (problem) return problem;
  state.mission = { missionId: species, stageIndex: 0, minigameState: {}, safeCheckpoint: 0 };
  return null;
}

export function stageId(state: GameState): string | null {
  if (!state.mission) return null;
  return MISSIONS[state.mission.missionId].stages[state.mission.stageIndex] ?? null;
}

export function completeStage(state: GameState): void {
  if (!state.mission) return;
  const mission = state.mission;
  mission.stageIndex += 1;
  mission.safeCheckpoint = mission.stageIndex;
  mission.minigameState = {};
  if (mission.stageIndex < MISSIONS[mission.missionId].stages.length) return;
  const species = mission.missionId;
  if (!state.completedMissionIds.includes(species)) state.completedMissionIds.push(species);
  const reward = `mission-${species}`;
  if (!state.claimedRewardIds.includes(reward)) { state.claimedRewardIds.push(reward); state.budget += 200; }
  const habitat = home(state, species);
  for (let n = 0; n < 2; n++) {
    const id = `${species}-${n + 1}`;
    if (!state.animals.some(a => a.id === id)) state.animals.push({
      id, speciesId: species, name: SPECIES[species].names[n], missionOriginId: species,
      habitatId: habitat.check?.valid ? habitat.habitat?.id ?? null : null,
    });
  }
  if (!state.album.some(a => a.id === reward)) state.album.push({ id: reward, title: `${SPECIES[species].plural} er reddet`, timestamp: new Date().toISOString(), emoji: SPECIES[species].icon });
  state.mission = null;
}

export function syncAnimalHomes(state: GameState): void {
  for (const animal of state.animals) {
    const { habitat, check } = home(state, animal.speciesId);
    animal.habitatId = check?.valid ? habitat!.id : null;
  }
}

export function chapterReady(state: GameState): boolean {
  switch (state.chapterId) {
    case 1: return !!home(state, 'capybara').check?.valid;
    case 2: return state.completedMissionIds.includes('capybara');
    case 3: return state.placedObjects.some(o => o.definitionId === 'sign') && !!home(state, 'capybara').check?.valid;
    case 4: return state.completedMissionIds.includes('tiger');
    case 5: return state.parkName.trim().length >= 3 && state.parkName !== 'Livs Dyreø' && !!home(state, 'tiger').check?.valid;
    case 6: return state.completedMissionIds.includes('penguin');
    case 7: return state.servicePumpDone;
    case 8: return state.remodelCount > 0 && state.album.some(a => a.id === 'after-photo');
    case 9: return state.placedObjects.some(o => o.definitionId === 'portal') && (['capybara', 'tiger', 'penguin'] as Species[]).every(s => home(state, s).check?.access);
    case 10: return state.album.some(a => a.id === 'final-photo') && state.visitedHabitats.length === 3;
    default: return false;
  }
}

export function advanceChapter(state: GameState): string | null {
  if (!chapterReady(state)) return 'Gør kapitlets opgave færdig først.';
  const key = `chapter-${state.chapterId}`;
  if (!state.claimedRewardIds.includes(key)) {
    state.claimedRewardIds.push(key);
    state.budget += 30 + 10 * (['capybara', 'tiger', 'penguin'] as Species[]).filter(s => home(state, s).check?.valid).length;
  }
  if (state.chapterId === CHAPTERS.length) state.partyOpen = true;
  else state.chapterId += 1;
  return null;
}

export function addPhoto(state: GameState, final = false, image?: string): void {
  const id = final ? 'final-photo' : 'after-photo';
  const photo = state.album.find(a => a.id === id);
  if (photo) { photo.image = image; photo.timestamp = new Date().toISOString(); }
  else state.album.push({ id, title: final ? `${state.parkName} åbner` : 'Et nyt blik på parken', timestamp: new Date().toISOString(), emoji: final ? '✦' : '▧', image });
}

declare const __BUILD_VERSION__: string;
