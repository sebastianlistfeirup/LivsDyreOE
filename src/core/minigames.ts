import type { GameState } from './types';

type Mini = Record<string, unknown>;
export type MiniResult = { message: string; completed: boolean };
const result = (message: string, completed = false): MiniResult => ({ message, completed });
const clues = ['foot', 'reed', 'fur'];
const pipePieces = [5, 1, 2, 6, 10];
const pipeGoals = [3, 1, 2, 0, 0];
const cargoSolution: Record<string, { x: number; y: number; r: number }> = {
  a: { x: 0, y: 0, r: 0 }, b: { x: 3, y: 0, r: 0 }, med: { x: 1, y: 2, r: 0 }, gear: { x: 3, y: 2, r: 0 },
};

export function miniState(state: GameState, service = false): Mini {
  return service ? state.servicePumpState : state.mission?.minigameState ?? {};
}

export function cargoMetrics(mini: Mini): { loaded: number; balance: number; passage: boolean; valid: boolean; occupied: Record<string, string> } {
  const placements = (mini.placements ?? {}) as Record<string, { x: number; y: number; r: number }>;
  const occupied: Record<string, string> = {};
  let left = 0, right = 0, passage = true, valid = true;
  for (const [id, p] of Object.entries(placements)) {
    const animal = id === 'a' || id === 'b';
    const w = animal || p.r === 0 ? 2 : 1, h = animal || p.r === 1 ? 2 : 1;
    const weight = animal ? 2 : 1;
    for (let y = p.y; y < p.y + h; y++) for (let x = p.x; x < p.x + w; x++) {
      if (x >= 5 || x < 0 || y < 0 || y >= 4) { passage = false; valid = false; }
      const key = `${x},${y}`;
      if (occupied[key]) valid = false;
      occupied[key] = id;
      if (x < 3) left += weight / (w * h);
      else right += weight / (w * h);
    }
  }
  return { loaded: Object.keys(placements).length, balance: Math.round(Math.abs(left - right) * 10) / 10, passage, valid: valid && passage && Object.keys(placements).length === 4 && Math.abs(left - right) <= 1, occupied };
}

function placeCargo(mini: Mini, id: string, x: number, y: number): MiniResult {
  const placements = (mini.placements ?? {}) as Record<string, { x: number; y: number; r: number }>;
  if (!['a', 'b', 'med', 'gear'].includes(id)) return result('Vælg først en kasse.');
  const animal = id === 'a' || id === 'b', r = Number(mini.rotation ?? 0);
  const w = animal || r === 0 ? 2 : 1, h = animal || r === 1 ? 2 : 1;
  if (x + w > 5 || y + h > 4) return result('Her spærrer kassen den frie passage eller går ud over kanten.');
  for (const [other, p] of Object.entries(placements)) {
    if (other === id) continue;
    const otherAnimal = other === 'a' || other === 'b', ow = otherAnimal || p.r === 0 ? 2 : 1, oh = otherAnimal || p.r === 1 ? 2 : 1;
    if (x < p.x + ow && x + w > p.x && y < p.y + oh && y + h > p.y) return result('Kasserne kan ikke stå oven i hinanden.');
  }
  placements[id] = { x, y, r };
  mini.placements = placements;
  mini.selected = id;
  return result('Kassen står nu i lastrummet. Se på balancen.');
}

export function actMini(state: GameState, stage: string, action: string, value = '', service = false): MiniResult {
  const mini = miniState(state, service);
  if (action === 'solve') {
    if (service) state.servicePumpDone = true;
    return result('Redningsholdet viste resten af opgaven.', true);
  }
  if (stage === 'tracks') {
    const found = (mini.found ?? []) as string[], route = (mini.route ?? []) as string[];
    if (action === 'clue' && clues.includes(value)) {
      if (!found.includes(value)) found.push(value);
      mini.found = found;
      return result(found.length === 3 ? 'Alle tre spor er i feltbogen. Tegn nu ruten.' : `${found.length} af 3 spor fundet.`);
    }
    if (action === 'route') {
      if (found.length < 3) return result('Find først alle tre spor.');
      if (value !== clues[route.length]) return result('Prøv at følge sporene fra fodaftrykket.');
      route.push(value); mini.route = route;
      return result(route.length === 3 ? 'Ruten fører til kapivarerne!' : 'Godt! Find næste punkt.', route.length === 3);
    }
    if (action === 'help') {
      if (found.length < 3) { found.push(clues.find(c => !found.includes(c))!); mini.found = found; return result('Se her: et nyt spor er lagt i feltbogen.'); }
      route.push(clues[route.length]); mini.route = route;
      return result('Redningsholdet tegnede næste del af ruten.', route.length === 3);
    }
  }
  if (stage === 'pump') {
    const rotations = (mini.rotations ?? [0, 0, 0, 1, 2]) as number[];
    if (action === 'rotate') {
      const index = pipePieces.indexOf(Number(value));
      if (index < 0) return result('Dette rør sidder fast.');
      rotations[index] = (rotations[index] + 1) % 4;
      mini.rotations = rotations;
      return result('Røret drejede en kvart omgang.');
    }
    if (action === 'test') {
      const solved = rotations.every((r, i) => r % (i === 3 ? 2 : 4) === pipeGoals[i]);
      if (solved && service) state.servicePumpDone = true;
      return result(solved ? 'Vandet løber nu sikkert væk!' : 'Vandet stopper ved et forkert vendt rør. Prøv igen.', solved);
    }
    if (action === 'help') {
      const index = rotations.findIndex((r, i) => r % (i === 3 ? 2 : 4) !== pipeGoals[i]);
      if (index < 0) return result('Rørene ser rigtige ud. Tryk Prøv vandet.');
      rotations[index] = pipeGoals[index]; mini.rotations = rotations;
      return result('Et rør er vendt rigtigt.');
    }
  }
  if (stage === 'boat') {
    const step = Number(mini.step ?? 0);
    if (action === 'waypoint') {
      if (Number(value) !== step) return result('Sejl til den næste markerede bøje.');
      mini.step = step + 1;
      return result(step === 3 ? 'Båden ligger trygt ved kajen.' : 'Bøjen er rundet. Vælg næste sikre punkt.', step === 3);
    }
    if (action === 'help') { mini.step = step + 1; return result('Båden sejlede til næste sikre punkt.', step === 3); }
  }
  if (stage === 'cargo') {
    if (action === 'select') { mini.selected = value; return result('Tryk på et frit felt i lastrummet.'); }
    if (action === 'rotate') { mini.rotation = Number(mini.rotation ?? 0) ? 0 : 1; return result('Den valgte kasse er drejet.'); }
    if (action === 'place') {
      const [x, y] = value.split(',').map(Number);
      return placeCargo(mini, String(mini.selected ?? ''), x, y);
    }
    if (action === 'remove') { const p = (mini.placements ?? {}) as Record<string, unknown>; delete p[value]; mini.placements = p; return result('Kassen er tilbage på dækket.'); }
    if (action === 'test') {
      const metrics = cargoMetrics(mini);
      return result(metrics.valid ? 'Lasten er sikker og i balance!' : `Pak fire kasser, fri passage og en balanceforskel på højst 1. Forskel nu: ${metrics.balance}.`, metrics.valid);
    }
    if (action === 'help') {
      const placements = (mini.placements ?? {}) as Record<string, { x: number; y: number; r: number }>;
      const id = Object.keys(cargoSolution).find(k => !placements[k]);
      if (!id) return result('Alle kasser er om bord. Tryk Tjek last.');
      placements[id] = cargoSolution[id]; mini.placements = placements;
      return result('Redningsholdet placerede en kasse sikkert.');
    }
  }
  if (stage === 'clinic') {
    const cleaned = (mini.cleaned ?? []) as number[], scanned = (mini.scanned ?? []) as number[];
    if (action === 'clean') {
      if (!cleaned.includes(Number(value))) cleaned.push(Number(value)); mini.cleaned = cleaned;
      return result(cleaned.length === 3 ? 'Pelsen er ren. Find håndklædet.' : `${cleaned.length} af 3 mudderpletter væk.`);
    }
    if (action === 'dry') { if (cleaned.length < 3) return result('Rens først de tre markerede steder.'); mini.dried = true; return result('Dyret er tørt. Før scanneren over de tre zoner.'); }
    if (action === 'scan') {
      if (!mini.dried) return result('Brug først håndklædet.');
      if (!scanned.includes(Number(value))) scanned.push(Number(value)); mini.scanned = scanned;
      return result(scanned.length === 3 ? 'Alt ser godt ud. Vælg navneskilt.' : `${scanned.length} af 3 zoner scannet.`);
    }
    if (action === 'badge') return result(scanned.length === 3 ? 'Dyret er klar til sit nye hjem!' : 'Undersøg først alle zoner.', scanned.length === 3);
    if (action === 'help') {
      if (cleaned.length < 3) { cleaned.push([0, 1, 2].find(n => !cleaned.includes(n))!); mini.cleaned = cleaned; return result('En mudderplet er renset.'); }
      if (!mini.dried) { mini.dried = true; return result('Håndklædet er brugt.'); }
      if (scanned.length < 3) { scanned.push([0, 1, 2].find(n => !scanned.includes(n))!); mini.scanned = scanned; return result('En zone er scannet.'); }
      return result('Tryk på navneskiltet for at fortsætte.');
    }
  }
  if (stage === 'bridge') {
    const placed = (mini.placed ?? [0, 0, 0]) as number[];
    if (action === 'select') { mini.selected = Number(value); return result('Drej planken vandret, og vælg den tilsvarende åbning.'); }
    if (action === 'rotate') { mini.horizontal = !mini.horizontal; return result(mini.horizontal ? 'Planken ligger vandret.' : 'Planken står på tværs.'); }
    if (action === 'place') {
      const slot = Number(value), plank = Number(mini.selected ?? 0);
      if (!plank) return result('Vælg en planke først.');
      if (!mini.horizontal) return result('Drej planken, så den ligger vandret.');
      if (plank !== [2, 3, 4][slot]) return result('Denne planke passer ikke til åbningens længde.');
      placed[slot] = plank; mini.placed = placed; mini.selected = 0;
      return result('Planken ligger på understøtningerne.');
    }
    if (action === 'test') return result(placed.every((p, i) => p === [2, 3, 4][i]) ? 'Fodsporene når hele vejen over!' : 'Fodsporene stopper ved et hul. Læg de sidste planker.', placed.every((p, i) => p === [2, 3, 4][i]));
    if (action === 'help') { const slot = placed.findIndex(p => !p); if (slot >= 0) { placed[slot] = [2, 3, 4][slot]; mini.placed = placed; } return result('En planke blev lagt på plads.'); }
  }
  if (stage === 'lure') {
    const points = (mini.points ?? []) as number[];
    if (action === 'point') { const n = Number(value); if (n < 1 || n > 2) return result('Vælg et af de to rolige områder.'); if (!points.includes(n)) points.push(n); mini.points = points; return result('Interessepunktet er placeret.'); }
    if (action === 'gate') { const gates = (mini.gates ?? []) as number[]; const n = Number(value); if (n === 2 && Number(mini.safe ?? 0) < 1) return result('Dyrepasseren skal kontrollere første strækning.'); if (!gates.includes(n)) gates.push(n); mini.gates = gates; return result(`Port ${n} er åben.`); }
    if (action === 'test') {
      const safe = Number(mini.safe ?? 0), gates = (mini.gates ?? []) as number[];
      if (!points.includes(1) || !gates.includes(1)) return result('Placér første interessepunkt og åbn port 1.');
      if (safe === 0) { mini.safe = 1; return result('Tigrene følger roligt til første sikre område. Dyrepasseren kontrollerer vejen.'); }
      if (!points.includes(2) || !gates.includes(2)) return result('Placér andet interessepunkt, og åbn port 2.');
      mini.safe = 3; return result('Begge tigre følger dyrepasseren trygt til transporten.', true);
    }
    if (action === 'help') {
      if (!points.includes(1)) { points.push(1); mini.points = points; return result('Første interessepunkt er på plads.'); }
      const gates = (mini.gates ?? []) as number[];
      if (!gates.includes(1)) { gates.push(1); mini.gates = gates; return result('Port 1 er åben.'); }
      if (Number(mini.safe ?? 0) === 0) { mini.safe = 1; return result('Første strækning er sikker.'); }
      if (!points.includes(2)) { points.push(2); mini.points = points; return result('Andet interessepunkt er på plads.'); }
      if (!gates.includes(2)) { gates.push(2); mini.gates = gates; return result('Port 2 er åben.'); }
      mini.safe = 3; return result('Tigrene er klar til transport.', true);
    }
  }
  if (stage === 'net') {
    const rope = Number(mini.rope ?? 0), node = Number(mini.node ?? 0);
    if (action === 'knot') {
      const [r, n] = value.split(',').map(Number);
      if (r !== rope || n !== node) return result('Følg den frie ende. Den anden snor holder stadig.');
      if (node < 2) { mini.node = node + 1; return result('Løkken løsner sig. Følg snoren videre.'); }
      mini.rope = rope + 1; mini.node = 0;
      return result(rope === 2 ? 'Nettet er fri. Pingvinerne finder sammen!' : 'En snor er fri. Find den næste frie ende.', rope === 2);
    }
    if (action === 'help') { if (node < 2) { mini.node = node + 1; return result('Se på næste store knude.'); } mini.rope = rope + 1; mini.node = 0; return result('En snor er løsnet.', rope === 2); }
  }
  return result('Prøv et af de markerede felter.');
}

export const PIPE_PIECES = pipePieces;
export const PIPE_GOALS = pipeGoals;
