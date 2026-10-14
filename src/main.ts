import './style.css';
import { CHAPTERS, MISSIONS, OBJECTS, OBJECT_BY_ID, SPECIES, STAGE_TITLE } from './content/data';
import { addHabitat, addPhoto, advanceChapter, buildStandard, canStartMission, chapterReady, clone, completeStage, eraseAt, home, moveObject, placeEdge, placeObject, placePath, placementProblem, stageId, startMission, syncAnimalHomes } from './core/game';
import { actMini, cargoMetrics, miniState, PIPE_PIECES } from './core/minigames';
import type { GameState, Point, Species, Tool } from './core/types';
import { ParkScene } from './render/park';
import { exportGame, loadGame, readImport, restoreBackup, saveGame } from './save/store';

type Tab = 'park' | 'build' | 'animals' | 'missions' | 'album' | 'settings';
type Preview = { at: Point; side: number; valid: boolean; definitionId: string | null; rotation: 0 | 1 } | null;

const loaded = loadGame();
let game: GameState = loaded.state;
let backup = loaded.backup;
let tab: Tab = 'park';
let tool: Tool = 'none';
let selectedSpecies: Species = 'capybara';
let rotation: 0 | 1 = 0;
let preview: Preview = null;
let movingId: string | null = null;
let missionVisible = !!game.mission;
let serviceVisible = false;
let pendingImport: GameState | null = null;
let notice = loaded.warning ?? '';
let toastTimer: number | undefined;
const history: GameState[] = [];

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<div class="app-shell">
  <header class="topbar">
    <button class="brand" data-action="tab" data-value="park" aria-label="Til parken"><span class="brand-mark">✦</span><span class="brand-text">Livs <em>Dyreø</em></span></button>
    <div class="topbar-right"><span class="hud-pill budget-pill"><span aria-hidden="true">◈</span> <span id="budget"></span></span><span class="hud-pill animal-pill"><span aria-hidden="true">◕</span> <span id="animal-count"></span></span><button class="icon-btn top-settings" data-action="tab" data-value="settings" aria-label="Indstillinger">⚙</button></div>
  </header>
  <main class="workspace">
    <section class="world-panel" aria-label="Parkens byggefelt">
      <div id="park-canvas" class="park-canvas"></div>
      <div class="world-shade"></div>
      <div id="celebration" class="celebration" aria-hidden="true"></div>
      <div class="world-top"><span class="island-label"><span class="island-dot"></span> <span id="park-name-label"></span></span><span class="chapter-label" id="chapter-label"></span></div>
      <div class="world-bottom"><div class="focus-buttons"><button data-action="focus" data-value="dock">Kaj</button><button data-action="focus" data-value="capybara">Flod</button><button data-action="focus" data-value="tiger">Skov</button><button data-action="focus" data-value="penguin">Kyst</button></div><div class="zoom-buttons"><button data-action="zoom-out" aria-label="Zoom ud">−</button><button data-action="zoom-in" aria-label="Zoom ind">+</button></div></div>
      <div id="preview-bar" class="preview-bar"></div>
    </section>
    <aside id="side-panel" class="side-panel" aria-live="polite"></aside>
  </main>
  <nav class="tabbar" aria-label="Hovedmenu">
    <button data-action="tab" data-value="park"><span>◈</span>Park</button>
    <button data-action="tab" data-value="build"><span>▧</span>Byg</button>
    <button data-action="tab" data-value="animals"><span>◕</span>Dyr</button>
    <button data-action="tab" data-value="missions"><span>⚑</span>Missioner</button>
    <button data-action="tab" data-value="album"><span>▣</span>Album</button>
  </nav>
  <div id="overlay-root"></div><div id="notice" role="status" aria-live="polite"></div>
  <input id="import-file" type="file" accept="application/json,.json" hidden />
</div>`;

const scene = new ParkScene(document.querySelector<HTMLElement>('#park-canvas')!);
scene.onCell = (at, side) => {
  if (tool === 'none' && !movingId) {
    const object = game.placedObjects.find(o => {
      const def = OBJECT_BY_ID[o.definitionId], w = o.rotation ? def.height : def.width, h = o.rotation ? def.width : def.height;
      return at.x >= o.gridPosition.x && at.x < o.gridPosition.x + w && at.y >= o.gridPosition.y && at.y < o.gridPosition.y + h;
    });
    if (object) { tab = 'build'; movingId = object.id; tool = 'move'; say(`Flyt ${OBJECT_BY_ID[object.definitionId].name} gratis ved at trykke på et nyt felt.`); render(); }
    else say(`Felt ${at.x + 1}, ${at.y + 1}. Vælg Byg for at placere noget her.`);
    return;
  }
  const definitionId = movingId ? game.placedObjects.find(o => o.id === movingId)?.definitionId ?? null : OBJECT_BY_ID[tool] ? tool : null;
  preview = { at, side, valid: definitionId ? !placementProblem(game, definitionId, at, rotation, movingId ?? undefined) : true, definitionId, rotation };
  render();
};

const esc = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const button = (action: string, value: string, text: string, cls = '') => `<button class="${cls}" data-action="${action}" data-value="${esc(value)}">${text}</button>`;
const speciesList: Species[] = ['capybara', 'tiger', 'penguin'];

function speak(text: string): void {
  if (!game.settings.voice || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const voice = new SpeechSynthesisUtterance(text);
  voice.lang = 'da-DK'; voice.rate = 0.9;
  speechSynthesis.speak(voice);
}

function say(text: string): void {
  notice = text;
  const target = document.querySelector<HTMLElement>('#notice')!;
  target.textContent = text;
  target.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => target.classList.remove('visible'), 5500);
  speak(text);
}

function celebrateOpening(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const confetti = document.querySelector<HTMLElement>('#celebration')!;
  confetti.innerHTML = Array.from({ length: 30 }, (_, i) =>
    `<i style="--x:${(i * 37 + 9) % 100}%;--delay:${(i * 17) % 13 / 10}s;--spin:${i % 2 ? 1 : -1};--hue:${(i * 43) % 360}deg"></i>`
  ).join('');
  confetti.classList.add('playing');
  window.setTimeout(() => { confetti.classList.remove('playing'); confetti.replaceChildren(); }, 4300);
}

function commit(change: (draft: GameState) => string | null, success?: string): boolean {
  const draft = clone(game);
  const problem = change(draft);
  if (problem) { say(problem); return false; }
  history.push(game);
  if (history.length > 25) history.shift();
  syncAnimalHomes(draft);
  game = draft;
  const saveError = saveGame(game);
  if (saveError) say(saveError);
  else if (success) say(success);
  render();
  return true;
}

function chapterCard(): string {
  const chapter = CHAPTERS[Math.min(game.chapterId, 10) - 1];
  const ready = chapterReady(game);
  return `<section class="chapter-card"><div class="eyebrow">KAPITEL ${game.chapterId} AF 10</div><h2>${chapter[0]}</h2><p>${chapter[1]}</p><div class="chapter-progress"><span class="progress-track"><span style="width:${game.partyOpen ? 100 : (game.chapterId - 1) * 10}%"></span></span><span>${game.chapterId}/10</span></div>${ready && !game.partyOpen ? button('advance', '', game.chapterId === 10 ? 'Åbn parken ✦' : 'Fortsæt historien →', 'primary wide') : `<div class="gentle-hint">${game.partyOpen ? 'Parken er åben. Byg frit videre!' : 'Du bestemmer selv tempoet.'}</div>`}</section>`;
}

function homeCard(species: Species): string {
  const info = SPECIES[species], { check } = home(game, species);
  const rescued = game.animals.filter(a => a.speciesId === species).length;
  const status = check?.valid ? 'Hjem klar' : check ? 'Mangler noget' : 'Ikke bygget';
  return `<article class="home-card ${check?.valid ? 'is-ready' : ''}"><div class="home-icon" style="--animal-color:${info.color}"><img src="${import.meta.env.BASE_URL}art/${species}.webp" alt="" /></div><div class="home-copy"><strong>${info.plural}</strong><small>${status} · ${rescued}/2 reddet</small></div>${button('focus', species, 'Se ↗', 'small-link')}</article>`;
}

function renderPark(): string {
  return `<div class="panel-hero" style="background-image:linear-gradient(0deg,#103f3be8,#103f3b22 82%),url('${import.meta.env.BASE_URL}art/island-vision.webp')"><div class="eyebrow">VELKOMMEN TIL ØEN</div><h1>Et sted, du gør til dit eget.</h1><p>Byg trygge hjem. Tag på redning. Se øen komme til live.</p></div>
    ${chapterCard()}
    <div class="section-row"><h3>Levesteder</h3><span class="subtle">${game.animals.length} af 6 dyr hjemme</span></div>
    <div class="home-list">${speciesList.map(homeCard).join('')}</div>
    <div class="action-grid">${button('tab', 'build', '▧ Byg på øen', 'action-tile')}${button('tab', 'missions', '⚑ Tag på redning', 'action-tile')}</div>
    ${game.mission ? button('resume', '', 'Fortsæt redningen →', 'primary wide') : ''}
    ${game.chapterId === 7 && !game.servicePumpDone ? button('service', '', 'Løs pumpens serviceproblem', 'secondary wide') : ''}
    ${game.chapterId === 3 && !game.placedObjects.some(o => o.definitionId === 'sign') ? button('suggest-sign', '', 'Find plads til et udsigtsskilt · 15 ◈', 'secondary wide') : ''}
    ${game.chapterId === 8 ? button('photo', '', 'Tag før/efter-foto', 'secondary wide') : ''}
    ${game.chapterId === 8 && game.remodelCount === 0 ? button('suggest-remodel', '', 'Flyt en detalje gratis', 'secondary wide') : ''}
    ${game.chapterId === 9 && !game.placedObjects.some(o => o.definitionId === 'portal') ? button('suggest-portal', '', 'Vælg plads til en gratis blomsterportal', 'secondary wide') : ''}
    ${game.chapterId === 10 ? button('final-photo', '', 'Tag afslutningsfoto', 'secondary wide') : ''}`;
}

function renderBuild(): string {
  const options = speciesList.map(s => {
    const info = SPECIES[s], { check, habitat } = home(game, s);
    const unlock = s === 'capybara' ? 1 : s === 'tiger' ? 3 : 5;
    return `<article class="blueprint ${selectedSpecies === s ? 'selected' : ''}"><div class="blueprint-top"><span class="blueprint-icon" style="--animal-color:${info.color}">${info.icon}</span><div><strong>${info.plural}</strong><small>${habitat ? check?.valid ? 'Gyldigt hjem' : 'Under opbygning' : `Åbnes i kapitel ${unlock}`}</small></div></div><div class="blueprint-actions">${button('select-species', s, 'Vælg', 'ghost compact')}${!habitat && game.chapterId >= unlock ? button('standard', s, `Byg forslag · ${s === 'capybara' ? 270 : s === 'tiger' ? 290 : 305} ◈`, 'secondary compact') : ''}</div>${selectedSpecies === s && check && !check.valid ? `<p class="missing">${check.missing.map(esc).join(' · ')}</p>` : ''}</article>`;
  }).join('');
  const tools = [
    ['path', '⌁', 'Sti', '0'], ['fence', '▤', 'Hegn', '5'], ['gate', '⚐', 'Port', '20'], ['habitat', '◇', 'Habitat', '0'],
    ['move', '✥', 'Flyt', '0'], ['erase', '⌫', 'Fjern', 'retur'],
  ].map(([id, icon, name, price]) => button('tool', id, `<span class="tool-icon">${icon}</span><span>${name}</span><small>${price}</small>`, `tool-button ${tool === id ? 'selected' : ''}`)).join('');
  const catalog = OBJECTS.filter(o => o.unlock <= game.chapterId).map(o => button('tool', o.id, `<span class="tool-icon">${o.icon}</span><span>${o.name}</span><small>${o.price} ◈</small>`, `tool-button ${tool === o.id ? 'selected' : ''}`)).join('');
  return `<div class="panel-head"><div class="eyebrow">DIT BYGGEBORD</div><h1>Byg en levende park.</h1><p>Vælg et værktøj, tryk på øen, og bekræft placeringen. Træk kortet for at se mere.</p></div>
    <div class="section-row"><h3>Hurtig start</h3><span class="subtle">Kan bygges om senere</span></div><div class="blueprint-list">${options}</div>
    <div class="section-row"><h3>Byg selv</h3>${button('undo', '', '↶ Fortryd', 'small-link')}</div><div class="tool-grid">${tools}</div>
    <div class="section-row"><h3>Objekter</h3><span class="subtle">Pris pr. placering</span></div><div class="tool-grid">${catalog}</div>
    <p class="microcopy">Hegn ligger langs feltkanter. Vend objekter med Drej. Flytning er gratis; salg giver hele købsprisen tilbage.</p>`;
}

function renderAnimals(): string {
  return `<div class="panel-head"><div class="eyebrow">DYRELIV</div><h1>De nye øboere.</h1><p>Hvert dyr får sit eget navn og et trygt hjem.</p></div>
    ${speciesList.map(s => {
      const info = SPECIES[s], { check } = home(game, s), animals = game.animals.filter(a => a.speciesId === s);
      return `<section class="animal-section"><div class="animal-section-head"><span class="species-medal" style="--animal-color:${info.color}"><img src="${import.meta.env.BASE_URL}art/${s}.webp" alt="" /></span><div><h3>${info.plural}</h3><small>${check?.valid ? 'Hjemmet er klar' : 'Hjemmet mangler noget'}</small></div></div>${animals.length ? animals.map(a => `<div class="animal-row"><div><strong>${esc(a.name)}</strong><small>${a.habitatId ? 'I levestedet' : 'Trygt på klinikken'}</small></div><div class="rename-row"><input id="name-${esc(a.id)}" maxlength="18" aria-label="Nyt navn til ${esc(a.name)}" placeholder="Nyt navn" />${button('rename-animal', a.id, 'Gem', 'ghost compact')}</div></div>`).join('') : `<p class="empty-note">De venter på en redningsmission.</p>`}${check && !check.valid ? `<p class="missing">${check.missing.map(esc).join(' · ')}</p>` : ''}</section>`;
    }).join('')}`;
}

function renderMissions(): string {
  return `<div class="panel-head"><div class="eyebrow">REDNINGSHOLDET</div><h1>Tre steder kalder på hjælp.</h1><p>Ingen tidspres. Du kan altid få hjælp til næste trin.</p></div>
    ${game.mission ? `<div class="resume-card"><span>IGANGVÆRENDE REDNING</span><strong>${MISSIONS[game.mission.missionId].title}</strong>${button('resume', '', 'Fortsæt →', 'primary wide')}</div>` : ''}
    ${speciesList.map((s, i) => {
      const m = MISSIONS[s], completed = game.completedMissionIds.includes(s), locked = canStartMission(game, s);
      return `<article class="mission-card mission-${s}"><img class="mission-animal" src="${import.meta.env.BASE_URL}art/${s}.webp" alt="" /><div class="mission-number">0${i + 1}</div><div class="mission-text"><span class="eyebrow">${m.area.toUpperCase()}</span><h3>${m.title}</h3><p>${s === 'capybara' ? 'Følg spor, få vandet væk, og hent familien hjem.' : s === 'tiger' ? 'Byg en bro, og led tigerparret ad en sikker rute.' : 'Løsn nettet, og hjælp makkerparret til vandet.'}</p><div class="mission-chips">${m.stages.map(id => `<span>${STAGE_TITLE[id]}</span>`).join('')}</div>${button('start-mission', s, completed ? 'Besøg igen ↗' : locked ? `Låst · ${esc(locked)}` : 'Start redning →', `mission-start ${locked ? 'is-locked' : ''}`)}</div></article>`;
    }).join('')}`;
}

function renderAlbum(): string {
  return `<div class="panel-head"><div class="eyebrow">DIN HISTORIE</div><h1>Små øjeblikke, store redninger.</h1><p>Her samler du minder fra parken.</p></div>
    <div class="album-grid">${game.album.length ? game.album.map(a => {
      const species = a.id.startsWith('mission-') ? a.id.slice(8) : '';
      const art = speciesList.includes(species as Species) ? `<div class="album-animal album-${species}"><img src="${import.meta.env.BASE_URL}art/${species}.webp" alt="${esc(SPECIES[species as Species].plural)}" /></div>` : `<div class="album-art">${esc(a.emoji)}</div>`;
      return `<article class="album-card">${a.image ? `<img src="${esc(a.image)}" alt="Foto af ${esc(a.title)}" />` : art}<div><strong>${esc(a.title)}</strong><small>${new Date(a.timestamp).toLocaleDateString('da-DK')}</small></div></article>`;
    }).join('') : `<p class="empty-note">Dit første redningsminde dukker op her.</p>`}</div>
    ${game.chapterId >= 8 ? button('photo', '', 'Tag et nyt parkfoto', 'secondary wide') : ''}`;
}

function renderSettings(): string {
  return `<div class="panel-head"><div class="eyebrow">INDSTILLINGER</div><h1>Din ø, dit tempo.</h1></div>
    <section class="setting-card"><h3>Parkens navn</h3><div class="field-row"><input id="park-name-input" maxlength="28" value="${esc(game.parkName)}" aria-label="Parkens navn" />${button('rename-park', '', 'Gem navn', 'secondary')}</div></section>
    <section class="setting-card"><h3>Oplæsning</h3><p>Telefonens danske stemme kan læse korte beskeder højt. Alle opgaver kan også løses uden lyd.</p>${button('voice', '', game.settings.voice ? 'Oplæsning: til' : 'Oplæsning: fra', 'secondary wide')}${button('repeat', '', 'Gentag kapitlets opgave', 'ghost wide')}</section>
    <section class="setting-card"><h3>Gemning</h3><p>Spillet gemmer på denne enhed efter hver handling. Eksportér en fil for at fortsætte på en anden telefon eller iPad.</p><div class="settings-actions">${button('export', '', 'Eksportér gemning', 'secondary')}${button('import', '', 'Importér gemning', 'ghost')}${backup ? button('restore', '', 'Gendan sikkerhedskopi', 'ghost') : ''}</div></section>
    <p class="microcopy">Version ${esc(game.buildVersion)} · Lokal gemning · Ingen ventetider eller daglige straffe.</p>`;
}

const stageHelp: Record<string, string> = {
  tracks: 'Find tre spor ved floden. Tryk på dem, og tegn så ruten i feltbogen.',
  pump: 'Drej rørene, så vandet kan løbe fra indløb til afløb.',
  boat: 'Sejl gennem bøjerne i rækkefølge og hen til den sikre kaj.',
  cargo: 'Pak fire kasser på 6×4 felter. Sidste kolonne skal være fri, og vægten i balance.',
  clinic: 'Rens tre steder, tør pelsen, scan tre zoner, og vælg navneskilt.',
  bridge: 'Vælg, drej og læg de tre planker i de rigtige åbninger.',
  lure: 'Placér to interessepunkter. Åbn portene, og prøv ruten trin for trin.',
  net: 'Følg de frie ender af tre snore, én knude ad gangen.',
};

function renderMiniBoard(stage: string, mini: Record<string, unknown>): string {
  if (stage === 'tracks') {
    const found = (mini.found ?? []) as string[], route = (mini.route ?? []) as string[];
    const labels: Record<string, [string, string]> = { foot: ['Fodaftryk', '✧'], reed: ['Afbidte siv', '⌁'], fur: ['Våd pelsrest', '◌'] };
    return `<div class="mini-scene tracks-scene"><div class="river"></div><div class="riverbank"></div>${['foot', 'reed', 'fur'].map((id, i) => `<button class="clue clue-${i} ${found.includes(id) ? 'found' : ''}" data-mini="clue" data-value="${id}" aria-label="Undersøg ${labels[id][0]}"><span>${labels[id][1]}</span><small>${found.includes(id) ? labels[id][0] : 'Undersøg'}</small></button>`).join('')}</div><div class="fieldbook"><strong>Feltbog · ${found.length}/3 spor</strong><div class="route-points">${['foot', 'reed', 'fur'].map((id, i) => `<button data-mini="route" data-value="${id}" class="${route.includes(id) ? 'done' : ''}" ${found.length < 3 ? 'disabled' : ''}><span>${i + 1}</span>${labels[id][0]}</button>`).join('<b>→</b>')}</div></div>`;
  }
  if (stage === 'pump') {
    const rotations = (mini.rotations ?? [0, 0, 0, 1, 2]) as number[];
    const map: Record<number, [string, number]> = Object.fromEntries(PIPE_PIECES.map((id, i) => [id, [i === 3 ? 'straight' : 'corner', rotations[i]]]));
    return `<div class="pipe-header"><span>INDLØB →</span><span>→ SIKKERT AFLØB</span></div><div class="pipe-grid">${Array.from({ length: 16 }, (_, index) => {
      const item = map[index];
      if (index === 4 || index === 11) return `<div class="pipe-fixed">${index === 4 ? '→' : '⇥'}</div>`;
      if (!item) return `<div class="pipe-rock">◇</div>`;
      return `<button data-mini="rotate" data-value="${index}" aria-label="Drej rør i felt ${index + 1}"><svg viewBox="0 0 100 100" style="transform:rotate(${item[1] * 90}deg)"><path d="${item[0] === 'straight' ? 'M50 0 L50 100' : 'M50 0 L50 50 L100 50'}" /></svg></button>`;
    }).join('')}</div>${buttonMini('test', '', 'Prøv vandet →', 'primary wide')}`;
  }
  if (stage === 'boat') {
    const step = Number(mini.step ?? 0);
    return `<div class="mini-scene boat-scene"><div class="boat-river"></div><span class="boat-vessel">⛵</span>${['Bøje 1', 'Bøje 2', 'Bøje 3', 'Sikker kaj'].map((label, i) => `<button class="waypoint point-${i} ${i < step ? 'done' : ''} ${i === step ? 'current' : ''}" data-mini="waypoint" data-value="${i}" aria-label="Sejl til ${label}"><span>${i < step ? '✓' : i + 1}</span><small>${label}</small></button>`).join('')}<div class="boat-rock rock-a">◆</div><div class="boat-rock rock-b">◆</div></div><div class="mini-status">${step} af 4 sikre punkter nået · sten stopper kun båden et øjeblik</div>`;
  }
  if (stage === 'cargo') {
    const placements = (mini.placements ?? {}) as Record<string, unknown>, metrics = cargoMetrics(mini), selected = String(mini.selected ?? '');
    const labels: Record<string, string> = { a: 'Dyr 1', b: 'Dyr 2', med: 'Medicin', gear: 'Udstyr' };
    return `<div class="cargo-board"><div class="cargo-items">${Object.keys(labels).map(id => `<button data-mini="select" data-value="${id}" class="${selected === id ? 'selected' : ''}"><strong>${labels[id]}</strong><small>${placements[id] ? 'Placeret · tryk for at flytte' : id === 'a' || id === 'b' ? '2×2 · vægt 2' : '1×2 · vægt 1'}</small></button>`).join('')}</div><div class="cargo-grid">${Array.from({ length: 24 }, (_, index) => {
      const x = index % 6, y = Math.floor(index / 6), occupied = metrics.occupied[`${x},${y}`];
      return `<button data-mini="place" data-value="${x},${y}" class="${x === 5 ? 'passage' : ''} ${occupied ? 'occupied' : ''}" aria-label="Lastfelt ${x + 1}, ${y + 1}${occupied ? `: ${labels[occupied]}` : ''}">${x === 5 ? '↕' : occupied ? occupied === 'a' || occupied === 'b' ? '◕' : '✚' : ''}</button>`;
    }).join('')}</div><div class="balance"><span>Venstre ⚖ Højre</span><strong>Forskel ${metrics.balance} / maks. 1</strong><small>${metrics.loaded}/4 kasser · passage ${metrics.passage ? 'fri' : 'spærret'}</small></div><div class="mini-actions">${buttonMini('rotate', '', 'Drej kasse', 'secondary')}${selected && placements[selected] ? buttonMini('remove', selected, 'Tag op igen', 'ghost') : ''}${buttonMini('test', '', 'Tjek last →', 'primary')}</div></div>`;
  }
  if (stage === 'clinic') {
    const cleaned = (mini.cleaned ?? []) as number[], scanned = (mini.scanned ?? []) as number[], dried = !!mini.dried;
    return `<div class="clinic-scene"><div class="clinic-halo"></div><img class="clinic-sprite" src="${import.meta.env.BASE_URL}art/${game.mission?.missionId ?? 'capybara'}.webp" alt="Dyret på klinikken" />${cleaned.length < 3 ? [0, 1, 2].map(i => `<button class="mud mud-${i} ${cleaned.includes(i) ? 'cleared' : ''}" data-mini="clean" data-value="${i}" aria-label="Rens mudderplet ${i + 1}">${cleaned.includes(i) ? '✓' : '✦'}</button>`).join('') : !dried ? `<button class="towel-action" data-mini="dry" data-value="">▧ Tør med håndklædet</button>` : [0, 1, 2].map(i => `<button class="scan scan-${i} ${scanned.includes(i) ? 'cleared' : ''}" data-mini="scan" data-value="${i}" aria-label="Scan zone ${i + 1}">${scanned.includes(i) ? '✓' : '◌'}</button>`).join('')}</div><div class="mini-status">${cleaned.length < 3 ? `Rens mudder · ${cleaned.length}/3` : !dried ? 'Gør pelsen tør' : `Scan kroppen · ${scanned.length}/3`}</div>${scanned.length === 3 ? buttonMini('badge', '', 'Vælg navneskilt →', 'primary wide') : ''}`;
  }
  if (stage === 'bridge') {
    const placed = (mini.placed ?? [0, 0, 0]) as number[];
    return `<div class="bridge-scene"><div class="bridge-stream"></div><div class="bridge-slots">${[2, 3, 4].map((length, i) => `<button data-mini="place" data-value="${i}" class="${placed[i] ? 'filled' : ''}"><small>Åbning ${i + 1} · ${length} felter</small><strong>${placed[i] ? '━━━━━━━━' : '··········'}</strong></button>`).join('')}</div></div><div class="plank-tray"><strong>Planker på bredden</strong><div>${[2, 3, 4].map(n => buttonMini('select', String(n), `▰ ${n} felter`, Number(mini.selected) === n ? 'selected' : '')).join('')}</div></div><div class="mini-actions">${buttonMini('rotate', '', `Drej planke ${mini.horizontal ? '↔' : '↕'}`, 'secondary')}${buttonMini('test', '', 'Prøv broen →', 'primary')}</div>`;
  }
  if (stage === 'lure') {
    const points = (mini.points ?? []) as number[], gates = (mini.gates ?? []) as number[];
    return `<div class="lure-map"><div class="lure-zone">Trygt sted <strong>0</strong></div>${[1, 2].map(n => `<div class="lure-zone"><small>OMRÅDE ${n}</small><strong>${Number(mini.safe ?? 0) >= n ? '◕ Tigrene er her' : points.includes(n) ? '✿ Interessepunkt' : 'Roligt område'}</strong>${buttonMini('point', String(n), points.includes(n) ? 'Punkt sat ✓' : 'Placér punkt', 'secondary')}${buttonMini('gate', String(n), gates.includes(n) ? `Port ${n} åben ✓` : `Åbn port ${n}`, 'ghost')}</div>`).join('')}</div><div class="mini-status">Sikkert område: ${Number(mini.safe ?? 0)} / 3</div>${buttonMini('test', '', 'Prøv ruten →', 'primary wide')}`;
  }
  if (stage === 'net') {
    const rope = Number(mini.rope ?? 0), node = Number(mini.node ?? 0);
    return `<div class="net-scene"><div class="net-water"></div><div class="net-penguins">◆ ◆</div>${[0, 1, 2].map(r => `<div class="rope-row ${r < rope ? 'released' : ''}"><span>Snor ${r + 1}</span><div>${[0, 1, 2].map(n => buttonMini('knot', `${r},${n}`, r < rope ? '✓' : n === 0 ? '◉' : '○', r === rope && n === node ? 'next-knot' : '')).join('<i></i>')}</div></div>`).join('')}</div><div class="mini-status">${rope} af 3 snore frigjort · følg den frie ende</div>`;
  }
  return '';
}

function buttonMini(action: string, value: string, label: string, cls = ''): string {
  return `<button class="${cls}" data-mini="${action}" data-value="${esc(value)}">${label}</button>`;
}

function renderOverlay(): string {
  if (pendingImport) return `<div class="modal-scrim"><div class="confirm-card"><span class="eyebrow">IMPORTÉR GEMNING</span><h2>Erstat denne ø?</h2><p>Filen indeholder <strong>${esc(pendingImport.parkName)}</strong>, gemt ${new Date(pendingImport.savedAt).toLocaleString('da-DK')}. Den nuværende ø <strong>${esc(game.parkName)}</strong> bliver erstattet på denne enhed.</p><div class="modal-actions">${button('cancel-import', '', 'Annuller', 'ghost')}${button('confirm-import', '', 'Importér øen', 'primary')}</div></div></div>`;
  const service = serviceVisible;
  if (!service && (!missionVisible || !game.mission)) return '';
  const stage = service ? 'pump' : stageId(game);
  if (!stage) return '';
  const mini = miniState(game, service), mission = game.mission;
  const title = service ? 'Parkens vandinstallation' : MISSIONS[mission!.missionId].title;
  const index = service ? 1 : mission!.stageIndex + 1;
  const total = service ? 1 : MISSIONS[mission!.missionId].stages.length;
  return `<div class="mission-overlay"><div class="mission-shell"><header class="mission-header"><button class="back-button" data-action="close-mission" aria-label="Tilbage til parken">← Park</button><div><span class="eyebrow">${service ? 'SERVICEOPGAVE' : `REDNING · ${index}/${total}`}</span><strong>${title}</strong></div><span class="mission-progress">${index}/${total}</span></header><div class="mission-body"><div class="mission-intro"><div class="eyebrow">${STAGE_TITLE[stage].toUpperCase()}</div><h2>${STAGE_TITLE[stage]}</h2><p>${stageHelp[stage]}</p></div><div class="mini-board">${renderMiniBoard(stage, mini)}</div></div><footer class="mission-footer">${buttonMini('help', '', '✦ Hjælp til ét trin', 'secondary')}${buttonMini('solve', '', 'Løs med hjælp', 'ghost')}${button('repeat', '', '◁ Gentag opgaven', 'ghost')}</footer></div></div>`;
}

function render(): void {
  document.querySelector<HTMLElement>('#budget')!.textContent = `${game.budget.toLocaleString('da-DK')} Budget`;
  document.querySelector<HTMLElement>('#animal-count')!.textContent = `${game.animals.length}/6 dyr`;
  document.querySelector<HTMLElement>('#park-name-label')!.textContent = game.parkName;
  document.querySelector<HTMLElement>('#chapter-label')!.textContent = game.partyOpen ? 'Parken er åben' : `Kapitel ${game.chapterId}`;
  document.querySelector<HTMLElement>('#side-panel')!.innerHTML = tab === 'park' ? renderPark() : tab === 'build' ? renderBuild() : tab === 'animals' ? renderAnimals() : tab === 'missions' ? renderMissions() : tab === 'album' ? renderAlbum() : renderSettings();
  document.querySelectorAll<HTMLButtonElement>('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.value === tab));
  const previewBar = document.querySelector<HTMLElement>('#preview-bar')!;
  previewBar.innerHTML = preview ? `<div><strong>${preview.definitionId ? OBJECT_BY_ID[preview.definitionId]?.name ?? 'Objekt' : tool === 'habitat' ? `${SPECIES[selectedSpecies].name} hjem` : tool === 'path' ? 'Stisegment' : tool === 'fence' ? 'Hegnssegment' : tool === 'gate' ? 'Port' : 'Fjern'}</strong><small>Felt ${preview.at.x + 1}, ${preview.at.y + 1}${preview.definitionId ? ` · ${OBJECT_BY_ID[preview.definitionId]?.price ?? 0} ◈` : ''}</small></div><div class="preview-actions">${preview.definitionId ? button('rotate', '', 'Drej', 'ghost compact') : ''}${button('cancel-preview', '', 'Annuller', 'ghost compact')}${button('confirm-preview', '', 'Placér ✓', 'primary compact')}</div>` : '';
  previewBar.classList.toggle('visible', !!preview);
  document.querySelector<HTMLElement>('#overlay-root')!.innerHTML = renderOverlay();
  scene.setBuildMode(tab === 'build');
  scene.draw(game, preview);
}

function confirmPreview(): void {
  if (!preview) return;
  const p = preview;
  const success = tool === 'habitat' ? `${SPECIES[selectedSpecies].name} hjem er markeret.` : tool === 'erase' ? 'Ombygningen er gemt.' : 'Placeret og gemt.';
  const okay = commit(draft => {
    if (movingId) return moveObject(draft, movingId, p.at, rotation);
    if (tool === 'path') return placePath(draft, p.at);
    if (tool === 'fence' || tool === 'gate') return placeEdge(draft, p.at, p.side, tool);
    if (tool === 'erase') return eraseAt(draft, p.at, p.side);
    if (tool === 'habitat') return addHabitat(draft, selectedSpecies, p.at);
    return placeObject(draft, tool, p.at, rotation);
  }, success);
  if (okay) { preview = null; movingId = null; render(); }
}

app.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!target) return;
  const miniAction = target.dataset.mini;
  if (miniAction) {
    const service = serviceVisible, stage = service ? 'pump' : stageId(game);
    if (!stage) return;
    commit(draft => {
      const outcome = actMini(draft, stage, miniAction, target.dataset.value ?? '', service);
      if (outcome.completed && !service) completeStage(draft);
      if (outcome.completed && service) draft.servicePumpDone = true;
      notice = outcome.message;
      return null;
    });
    say(notice);
    if (service && game.servicePumpDone) { serviceVisible = false; render(); }
    if (!game.mission) { missionVisible = false; tab = 'park'; render(); }
    return;
  }
  const action = target.dataset.action, value = target.dataset.value ?? '';
  if (action === 'tab') { tab = value as Tab; if (tab === 'build') scene.focus(selectedSpecies); render(); }
  else if (action === 'focus') {
    scene.focus(value as Species | 'all' | 'dock');
    if (game.chapterId === 10 && speciesList.includes(value as Species) && !game.visitedHabitats.includes(value as Species))
      commit(draft => { draft.visitedHabitats.push(value as Species); return null; }, `${SPECIES[value as Species].plural} er besøgt.`);
  }
  else if (action === 'zoom-in') scene.changeZoom(0.5);
  else if (action === 'zoom-out') scene.changeZoom(-0.5);
  else if (action === 'tool') { tool = value; movingId = null; preview = null; tab = 'build'; render(); say(tool === 'fence' || tool === 'gate' ? 'Tryk nær en feltkant på øen.' : 'Tryk på et felt på øen for at se placeringen.'); }
  else if (action === 'select-species') { selectedSpecies = value as Species; scene.focus(selectedSpecies); render(); }
  else if (action === 'standard') {
    const s = value as Species;
    if (commit(draft => buildStandard(draft, s), `${SPECIES[s].plural} har et bygget hjem. Du kan ændre det frit.`)) { selectedSpecies = s; scene.focus(s); tab = 'build'; render(); }
  }
  else if (action === 'suggest-sign' || action === 'suggest-portal') {
    const portal = action === 'suggest-portal';
    tool = portal ? 'portal' : 'sign'; tab = 'build'; movingId = null;
    preview = { at: portal ? { x: 7, y: 18 } : { x: 8, y: 16 }, side: 0, valid: true, definitionId: tool, rotation: 0 };
    scene.focus('dock'); render(); say('Her er et forslag. Tryk Placér, eller tryk et andet felt på øen.');
  }
  else if (action === 'suggest-remodel') {
    const object = game.placedObjects.find(o => o.definitionId === 'sign') ?? game.placedObjects[0];
    if (!object) { say('Byg først et objekt, du kan flytte.'); return; }
    movingId = object.id; tool = 'move'; tab = 'build'; rotation = object.rotation;
    const at = object.definitionId === 'sign' ? { x: 9, y: 16 } : { x: object.gridPosition.x + 1, y: object.gridPosition.y };
    preview = { at, side: 0, valid: !placementProblem(game, object.definitionId, at, rotation, movingId), definitionId: object.definitionId, rotation };
    scene.focus('dock'); render(); say('Her er et nyt sted. Tryk Placér eller vælg et andet felt. Flytning er gratis.');
  }
  else if (action === 'undo') {
    const previous = history.pop();
    if (!previous) say('Der er ikke mere at fortryde.');
    else { game = previous; saveGame(game); preview = null; movingId = null; render(); say('Sidste ændring er fortrudt.'); }
  }
  else if (action === 'rotate') { rotation = rotation ? 0 : 1; if (preview) { preview.rotation = rotation; preview.valid = preview.definitionId ? !placementProblem(game, preview.definitionId, preview.at, rotation, movingId ?? undefined) : true; } render(); }
  else if (action === 'cancel-preview') { preview = null; render(); }
  else if (action === 'confirm-preview') confirmPreview();
  else if (action === 'start-mission') {
    if (commit(draft => startMission(draft, value as Species))) { missionVisible = true; render(); speak(stageHelp[stageId(game)!]); }
  }
  else if (action === 'resume') { missionVisible = true; serviceVisible = false; render(); }
  else if (action === 'service') { serviceVisible = true; missionVisible = false; render(); }
  else if (action === 'close-mission') { missionVisible = false; serviceVisible = false; render(); }
  else if (action === 'advance') { if (commit(draft => advanceChapter(draft), 'Et nyt kapitel er åbnet!')) { tab = 'park'; if (game.partyOpen) { say(`${game.parkName} er åben! Alle seks dyr er her.`); celebrateOpening(); } render(); } }
  else if (action === 'photo' || action === 'final-photo') { const image = action === 'final-photo' ? scene.captureOverview() : scene.capture(); commit(draft => { addPhoto(draft, action === 'final-photo', image); return null; }, 'Et billede af din park er gemt i albummet.'); }
  else if (action === 'rename-park') {
    const name = (document.querySelector<HTMLInputElement>('#park-name-input')?.value ?? '').trim();
    if (name.length < 3) say('Parkens navn skal være mindst tre tegn.');
    else commit(draft => { draft.parkName = name; return null; }, 'Parkens nye navn er gemt.');
  }
  else if (action === 'rename-animal') {
    const name = (document.getElementById(`name-${value}`) as HTMLInputElement | null)?.value.trim() ?? '';
    if (!name) say('Skriv et navn først.');
    else commit(draft => { const animal = draft.animals.find(a => a.id === value); if (animal) animal.name = name.slice(0, 18); return null; }, 'Dyrets navn er gemt.');
  }
  else if (action === 'voice') commit(draft => { draft.settings.voice = !draft.settings.voice; return null; }, game.settings.voice ? 'Oplæsning er slået fra.' : 'Oplæsning er slået til.');
  else if (action === 'repeat') { const text = game.mission && missionVisible ? stageHelp[stageId(game)!] : CHAPTERS[game.chapterId - 1][1]; say(text); }
  else if (action === 'export') exportGame(game);
  else if (action === 'import') document.querySelector<HTMLInputElement>('#import-file')!.click();
  else if (action === 'restore') { const restored = restoreBackup(); if (restored) { game = restored; backup = null; render(); say('Sikkerhedskopien er gendannet.'); } else say('Ingen læsbar sikkerhedskopi fundet.'); }
  else if (action === 'cancel-import') { pendingImport = null; render(); }
  else if (action === 'confirm-import' && pendingImport) { history.push(game); game = pendingImport; pendingImport = null; saveGame(game); render(); say('Øen er importeret og gemt på denne enhed.'); }
});

document.querySelector<HTMLInputElement>('#import-file')!.addEventListener('change', async event => {
  const input = event.target as HTMLInputElement, file = input.files?.[0]; input.value = '';
  if (!file) return;
  try { pendingImport = await readImport(file); render(); }
  catch (error) { say(error instanceof Error ? error.message : 'Filen kunne ikke importeres.'); }
});

document.addEventListener('visibilitychange', () => { if (document.hidden && 'speechSynthesis' in window) speechSynthesis.cancel(); });

render();
if (notice) say(notice);
