import type { ObjectDef, Species } from '../core/types';

export const WIDTH = 24;
export const HEIGHT = 20;
export const DOCK = { x: 1, y: 17 };

export const SPECIES: Record<Species, { name: string; plural: string; icon: string; color: string; minimum: number; water: number; needs: string[]; names: [string, string] }> = {
  capybara: { name: 'Kapivar', plural: 'Kapivarerne', icon: '◕', color: '#a96840', minimum: 30, water: 4, needs: ['shade', 'shelter', 'feed'], names: ['Milo', 'Mira'] },
  tiger: { name: 'Tiger', plural: 'Tigrene', icon: '✦', color: '#e88c32', minimum: 36, water: 4, needs: ['cave', 'log', 'feed'], names: ['Tara', 'Tao'] },
  penguin: { name: 'Pingvin', plural: 'Pingvinerne', icon: '◆', color: '#263e56', minimum: 30, water: 8, needs: ['coolrock', 'feed'], names: ['Pip', 'Pax'] },
};

export const OBJECTS: ObjectDef[] = [
  { id: 'feed', name: 'Fodersted', price: 20, width: 1, height: 1, icon: '◌', category: 'dyr', unlock: 1 },
  { id: 'shade', name: 'Skyggetræ', price: 35, width: 1, height: 1, icon: '♣', category: 'natur', unlock: 1 },
  { id: 'shrub', name: 'Buskbed', price: 10, width: 1, height: 1, icon: '✿', category: 'natur', unlock: 1 },
  { id: 'pond', name: 'Lavt bassin', price: 50, width: 2, height: 2, icon: '≈', category: 'natur', unlock: 1 },
  { id: 'swim', name: 'Svømmebassin', price: 60, width: 2, height: 2, icon: '≈', category: 'natur', unlock: 5 },
  { id: 'cave', name: 'Tigerhule', price: 50, width: 2, height: 2, icon: '⌂', category: 'dyr', unlock: 3 },
  { id: 'log', name: 'Klatrestamme', price: 35, width: 2, height: 1, icon: '▬', category: 'dyr', unlock: 3 },
  { id: 'shelter', name: 'Læskur', price: 40, width: 2, height: 2, icon: '⌂', category: 'dyr', unlock: 1 },
  { id: 'coolrock', name: 'Kølig klippe', price: 40, width: 2, height: 1, icon: '▲', category: 'dyr', unlock: 5 },
  { id: 'ball', name: 'Legebold', price: 20, width: 1, height: 1, icon: '●', category: 'dyr', unlock: 1 },
  { id: 'bench', name: 'Bænk', price: 15, width: 1, height: 1, icon: '▰', category: 'gæster', unlock: 1 },
  { id: 'sign', name: 'Udsigtsskilt', price: 15, width: 1, height: 1, icon: '⚑', category: 'gæster', unlock: 2 },
  { id: 'portal', name: 'Blomsterportal', price: 30, width: 2, height: 1, icon: '✿', category: 'fest', unlock: 9 },
];

export const OBJECT_BY_ID = Object.fromEntries(OBJECTS.map(o => [o.id, o])) as Record<string, ObjectDef>;

export const CHAPTERS = [
  ['Ankomst til øen', 'Byg et hjem til kapivarerne, og forbind porten til kajen.'],
  ['Familien ved floden', 'Red kapivarparret ved floden.'],
  ['Livet i parken', 'Se kapivarerne hjemme, og placér et udsigtsskilt.'],
  ['Stien i skoven', 'Byg tigerhjemmet, og red tigerparret.'],
  ['Din egen dyreø', 'Giv parken et navn, og forbind områderne med stier.'],
  ['Ved den kolde kyst', 'Byg pingvinhjemmet, og red makkerparret.'],
  ['Vandet i parken', 'Løs pumpegåden ved servicebygningen.'],
  ['Et nyt blik', 'Flyt en detalje, og tag et foto til albummet.'],
  ['Gør klar til fest', 'Forbind alle porte, og placér blomsterportalen.'],
  ['Åbningsfest', 'Besøg alle tre hjem, og åbn parken.'],
] as const;

export const MISSIONS: Record<Species, { title: string; area: string; stages: string[] }> = {
  capybara: { title: 'Familien ved floden', area: 'Flodbredden', stages: ['tracks', 'pump', 'boat', 'cargo', 'clinic'] },
  tiger: { title: 'Tigrene på den afskårne sti', area: 'Skoven', stages: ['bridge', 'lure', 'cargo', 'clinic'] },
  penguin: { title: 'Pingvinerne ved kysten', area: 'Kysten', stages: ['boat', 'net', 'cargo', 'clinic'] },
};

export const STAGE_TITLE: Record<string, string> = {
  tracks: 'Sporjagt', pump: 'Pump vandet væk', boat: 'Redningsbåden', cargo: 'Pak redningsbåden',
  clinic: 'Dyreklinikken', bridge: 'Byg gangbroen', lure: 'Lok og led', net: 'Fri af nettet',
};
