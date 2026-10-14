import { describe, expect, it } from 'vitest';
import { buildStandard, canStartMission, completeStage, createGame, eraseAt, home, placeEdge, startMission, advanceChapter, stageId } from '../src/core/game';
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

  it('refunds an edge replacement without creating money', () => {
    const state = createGame();
    const start = state.budget;
    expect(placeEdge(state, { x: 4, y: 4 }, 1, 'fence')).toBeNull();
    expect(placeEdge(state, { x: 4, y: 4 }, 1, 'gate')).toBeNull();
    expect(state.budget).toBe(start - 20);
    expect(eraseAt(state, { x: 4, y: 4 }, 1)).toBeNull();
    expect(state.budget).toBe(start);
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
