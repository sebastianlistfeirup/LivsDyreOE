import { describe, expect, it } from 'vitest';
import { addHabitat, buildStandard, canStartMission, completeStage, createGame, eraseAt, home, moveObject, placeEdge, placeObject, placePath, startMission, advanceChapter, stageId } from '../src/core/game';
import { actMini, cargoMetrics } from '../src/core/minigames';
import { MISSIONS } from '../src/content/data';
import type { Species } from '../src/core/types';
import { validateSave } from '../src/save/store';

describe('park, economy, and access', () => {
  it('builds the three specification homes for exactly 865 points and validates each one', () => {
    const state = createGame();
    expect(buildStandard(state, 'capybara')).toBeNull();
    expect(state.budget).toBe(980);
    state.chapterId = 3;
    expect(buildStandard(state, 'tiger')).toBeNull();
    expect(state.budget).toBe(690);
    state.chapterId = 5;
    expect(buildStandard(state, 'penguin')).toBeNull();
    expect(state.budget).toBe(385);
    for (const species of ['capybara', 'tiger', 'penguin'] as Species[]) expect(home(state, species).check?.valid).toBe(true);
  });

  it('blocks a mission when the connected path to its gate is removed', () => {
    const state = createGame();
    buildStandard(state, 'capybara');
    state.chapterId = 2;
    expect(canStartMission(state, 'capybara')).toBeNull();
    expect(eraseAt(state, { x: 4, y: 15 })).toBeNull();
    expect(home(state, 'capybara').check?.access).toBe(false);
    expect(canStartMission(state, 'capybara')).toMatch(/gyldigt hjem/);
  });

  it('treats a fence crossing a path as a real barrier to the gate', () => {
    const state = createGame();
    expect(buildStandard(state, 'capybara')).toBeNull();
    expect(home(state, 'capybara').check?.access).toBe(true);
    expect(placeEdge(state, { x: 2, y: 17 }, 1, 'fence')).toBeNull();
    expect(home(state, 'capybara').check?.access).toBe(false);
    expect(home(state, 'capybara').check?.missing).toContain('Porten skal nås via sti fra kajen.');
    expect(placeEdge(state, { x: 2, y: 17 }, 1, 'gate')).toBeNull();
    expect(home(state, 'capybara').check?.access).toBe(true);
  });

  it('does not charge or claim a standard home if a previous fence blocks its access path', () => {
    const state = createGame();
    expect(placeEdge(state, { x: 2, y: 17 }, 1, 'fence')).toBeNull();
    const before = structuredClone(state);
    expect(buildStandard(state, 'capybara')).toMatch(/Porten skal nås via sti/);
    expect(state).toEqual(before);
    expect(eraseAt(state, { x: 2, y: 17 }, 1)).toBeNull();
    expect(buildStandard(state, 'capybara')).toBeNull();
  });

  it('refunds an edge replacement without creating money', () => {
    const state = createGame();
    const start = state.budget;
    expect(placeEdge(state, { x: 4, y: 4 }, 1, 'fence')).toBeNull();
    expect(placeEdge(state, { x: 4, y: 4 }, 1, 'gate')).toBeNull();
    expect(state.budget).toBe(start - 20);
    expect(eraseAt(state, { x: 4, y: 4 }, 1)).toBeNull();
    expect(state.budget).toBe(start);
  });

  it('keeps service buildings clear while preserving the dock path', () => {
    const state = createGame();
    expect(placePath(state, { x: 12, y: 16 })).toMatch(/servicebygning/);
    expect(placePath(state, { x: 1, y: 16 })).toMatch(/servicebygning/);
    expect(placePath(state, { x: 1, y: 17 })).toMatch(/allerede en sti/);
    expect(state.paths).toEqual(['1,17']);
    expect(placeEdge(state, { x: 4, y: 4 }, 9, 'fence')).toMatch(/feltkant/);
    expect(state.fences).toHaveLength(0);
  });

  it('rejects a standard-home path conflict without changing the park, then permits a free move', () => {
    const state = createGame();
    expect(placeObject(state, 'shrub', { x: 7, y: 17 })).toBeNull();
    const before = structuredClone(state);
    expect(buildStandard(state, 'capybara')).toMatch(/Flyt Buskbed/);
    expect(state).toEqual(before);
    expect(moveObject(state, state.placedObjects[0].id, { x: 7, y: 18 }, 0)).toBeNull();
    expect(state.budget).toBe(before.budget);
    expect(moveObject(state, state.placedObjects[0].id, { x: 7, y: 18 }, 0)).toMatch(/nyt felt/);
    expect(state.remodelCount).toBe(1);
    expect(buildStandard(state, 'capybara')).toBeNull();
    expect(home(state, 'capybara').check?.valid).toBe(true);
  });

  it('counts a newly extended free path as a remodel, but not a repeated tap', () => {
    const state = createGame();
    expect(placePath(state, { x: 2, y: 17 })).toBeNull();
    expect(state.remodelCount).toBe(1);
    expect(placePath(state, { x: 2, y: 17 })).toMatch(/allerede en sti/);
    expect(state.remodelCount).toBe(1);
  });

  it('does not count the same fenced area as two species homes', () => {
    const state = createGame();
    expect(buildStandard(state, 'capybara')).toBeNull();
    expect(addHabitat(state, 'tiger', { x: 3, y: 11 })).toBeNull();
    expect(home(state, 'capybara').check?.missing).toContain('Dette område er allerede markeret til en anden dyreart.');
    expect(home(state, 'tiger').check?.valid).toBe(false);
  });
});

describe('rescue progress and save invariants', () => {
  it('replays a mission without duplicating animals or its 200 point reward', () => {
    const state = createGame();
    buildStandard(state, 'capybara');
    state.chapterId = 2;
    expect(startMission(state, 'capybara')).toBeNull();
    const before = state.budget;
    for (const _ of MISSIONS.capybara.stages) completeStage(state);
    expect(state.animals).toHaveLength(2);
    expect(state.budget).toBe(before + 200);
    expect(startMission(state, 'capybara')).toBeNull();
    for (const _ of MISSIONS.capybara.stages) completeStage(state);
    expect(state.animals).toHaveLength(2);
    expect(state.budget).toBe(before + 200);
    expect(state.album).toHaveLength(1);
    expect(validateSave(state)).toBe(true);
  });

  it('keeps stages separate and preserves partially completed clues', () => {
    const state = createGame();
    buildStandard(state, 'capybara');
    advanceChapter(state);
    startMission(state, 'capybara');
    expect(stageId(state)).toBe('tracks');
    actMini(state, 'tracks', 'clue', 'foot');
    expect(state.mission?.minigameState.found).toEqual(['foot']);
    expect(stageId(structuredClone(state))).toBe('tracks');
  });

  it('has a balanced cargo arrangement with the final column free', () => {
    const state = createGame();
    state.mission = { missionId: 'capybara', stageIndex: 3, minigameState: {}, safeCheckpoint: 3 };
    for (const [id, cell] of Object.entries({ a: '0,0', b: '3,0', med: '1,2', gear: '3,2' })) {
      actMini(state, 'cargo', 'select', id);
      actMini(state, 'cargo', 'place', cell);
    }
    const metrics = cargoMetrics(state.mission.minigameState);
    expect(metrics.valid).toBe(true);
    expect(metrics.balance).toBe(0);
    expect(actMini(state, 'cargo', 'test').completed).toBe(true);
  });

  it('lets the pipe puzzle be solved with taps and retains the service result', () => {
    const state = createGame();
    state.chapterId = 7;
    for (let i = 0; i < 8; i++) actMini(state, 'pump', 'help', '', true);
    expect(actMini(state, 'pump', 'test', '', true).completed).toBe(true);
    expect(state.servicePumpDone).toBe(true);
  });
});
