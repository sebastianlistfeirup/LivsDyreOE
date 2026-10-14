import type { GameState } from '../core/types';
import { createGame } from '../core/game';

const PRIMARY = 'livs-dyreo.save.v1';
const BACKUP = 'livs-dyreo.backup.v1';

export function validateSave(input: unknown): input is GameState {
  if (!input || typeof input !== 'object') return false;
  const s = input as Partial<GameState>;
  return s.projectId === 'livs-dyreo' && s.schemaVersion === 1 &&
    typeof s.chapterId === 'number' && s.chapterId >= 1 && s.chapterId <= 10 &&
    typeof s.budget === 'number' && s.budget >= 0 &&
    typeof s.parkName === 'string' && Array.isArray(s.placedObjects) &&
    Array.isArray(s.fences) && Array.isArray(s.gates) && Array.isArray(s.paths) &&
    Array.isArray(s.habitats) && Array.isArray(s.animals) &&
    Array.isArray(s.completedMissionIds) && Array.isArray(s.claimedRewardIds) &&
    Array.isArray(s.album) && typeof s.settings?.voice === 'boolean' &&
    typeof s.servicePumpDone === 'boolean' && typeof s.remodelCount === 'number' &&
    typeof s.servicePumpState === 'object' && Array.isArray(s.visitedHabitats) &&
    typeof s.rngPosition === 'number';
}

function parse(raw: string | null): GameState | null {
  if (!raw) return null;
  try { const data: unknown = JSON.parse(raw); return validateSave(data) ? data : null; }
  catch { return null; }
}

export function loadGame(): { state: GameState; warning: string | null; backup: GameState | null } {
  try {
    const raw = localStorage.getItem(PRIMARY);
    const primary = parse(raw);
    const backup = parse(localStorage.getItem(BACKUP));
    if (primary) return { state: primary, warning: null, backup };
    if (raw) return { state: createGame(), warning: 'Den seneste gemning kunne ikke læses. En sikkerhedskopi kan gendannes i Indstillinger.', backup };
    return { state: createGame(), warning: null, backup };
  } catch {
    return { state: createGame(), warning: 'Browseren tillader ikke lokal gemning lige nu.', backup: null };
  }
}

export function saveGame(state: GameState): string | null {
  try {
    state.savedAt = new Date().toISOString();
    const previous = localStorage.getItem(PRIMARY);
    if (parse(previous)) localStorage.setItem(BACKUP, previous!);
    localStorage.setItem(PRIMARY, JSON.stringify(state));
    return null;
  } catch { return 'Kunne ikke gemme lokalt. Kontrollér browserens lagerplads.'; }
}

export function restoreBackup(): GameState | null {
  try {
    const backup = parse(localStorage.getItem(BACKUP));
    if (!backup) return null;
    localStorage.setItem(PRIMARY, JSON.stringify(backup));
    return backup;
  } catch { return null; }
}

export function exportGame(state: GameState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'livs-dyreo-gemning.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readImport(file: File): Promise<GameState> {
  if (file.size > 2_000_000) throw new Error('Filen er for stor til en spilgemning.');
  let data: unknown;
  try { data = JSON.parse(await file.text()); }
  catch { throw new Error('Filen er ikke gyldig JSON.'); }
  if (typeof data === 'object' && data && 'schemaVersion' in data && (data as { schemaVersion: unknown }).schemaVersion !== 1)
    throw new Error('Gemningen kommer fra en nyere spilversion og kan ikke importeres endnu.');
  if (!validateSave(data)) throw new Error('Filen er ikke en gyldig gemning til Livs Dyreø.');
  return data;
}
