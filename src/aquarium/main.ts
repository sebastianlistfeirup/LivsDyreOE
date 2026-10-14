import {
  createBoard,
  getHint,
  grantMoves,
  isWon,
  playTurn,
  type Action,
  type TileType,
} from "./core";
import { DECORATIONS, FISH, KIND_NAMES } from "./content/catalog";
import { Aquarium } from "./render/aquarium";
import { BoardView } from "./render/board";
import { gemArt, coralArt, setGemTheme, getGemThemeName } from "./render/gems";
import { Soundscape } from "./audio/sound";
import {
  awardWin,
  freshSave,
  loadSave,
  persist,
  purchase,
  validateSave,
  type Save,
} from "./save/store";
import "./style.css";

declare const __BUILD_VERSION__: string;

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T =>
  document.querySelector<T>(selector)!;
const esc = (text: string): string =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function uiIcon(
  kind: "aquarium" | "hint" | "levels" | "play" | "add" | "fish" | "settings",
): string {
  const paths = {
    aquarium:
      '<path d="M7 4h18M9 4 6 10a13 13 0 0 0 4 17h12a13 13 0 0 0 4-17l-3-6M6 12q5-3 10 0t10 0"/><path d="M11 19q4-5 9 0-5 5-9 0Zm9 0 4-3v6Z"/>',
    hint: '<path d="m16 3 3.5 9.5L29 16l-9.5 3.5L16 29l-3.5-9.5L3 16l9.5-3.5Z"/><path d="m25 3 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" fill="currentColor" stroke="none"/>',
    levels:
      '<circle cx="8" cy="6" r="3"/><circle cx="24" cy="16" r="3"/><circle cx="8" cy="26" r="3"/><path d="M11 6h9a5 5 0 0 1 1 10h-9a5 5 0 0 0-1 10h9"/>',
    play: '<path d="m10 4 17 12-17 12Z" fill="currentColor" stroke="none"/>',
    add: '<path d="M16 5v22M5 16h22" stroke-width="3"/>',
    fish: '<path d="M4 16q9-13 20 0Q13 29 4 16Zm20 0 6-6v12ZM11 10l5-6 3 7"/><circle cx="10" cy="15" r="1.5" fill="currentColor" stroke="none"/>',
    settings:
      '<path d="m13 3-1 4-3 2-4-1-2 5 4 3v3l-2 4 4 4 4-2h4l3 3 5-3-1-4 2-4 3-2-2-5-4 1-3-2-1-4Z"/><circle cx="16" cy="16" r="5"/>',
  };
  return `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind]}</svg>`;
}
const loaded = loadSave();
let save = loaded.save;
let saveBlocked = !!loaded.warning;
let mode: "play" | "aquarium" = "play";
let busy = false,
  selectedCell: number | null = null,
  chosenDecor: string | null = null;
let lastInteraction = performance.now();
let toastTimer = 0;
let undoPlacements: Save["placements"] | null = null;
const audio = new Soundscape();
audio.enabled = save.settings.sound;

$("#app").innerHTML = `
  <div id="aquarium-scene"></div>
  <main class="game-shell" aria-label="Livs akvarie">
    <header class="game-header">
      <button class="circle-button settings-button" data-action="settings" aria-label="Indstillinger">${uiIcon("settings")}</button>
      <h1 class="game-logo">Livs <span>akvarie</span><i aria-hidden="true">✦</i></h1>
      <button class="shell-wallet" data-action="shop" aria-label="Skaller og butik"><img src="${gemArt({ type: 0 })}" alt=""/><strong id="shell-count"></strong></button>
    </header>
    <section class="aquarium-window" aria-label="Dit levende akvarium">
      <div class="level-badge" id="level-badge">Bane 1</div>
      <button class="sound-tap" data-action="toggle-sound" aria-label="Slå lyd til">♪</button>
      <button id="coach" class="fish-message" data-action="read-help"><span id="coach-text">Træk en brik hen til en nabo.</span><span aria-hidden="true">♬</span></button>
      <div class="aquarium-title"><span>DIT EGET LILLE HAV</span><h2>Plads til fantasi.</h2></div>
    </section>
    <section class="goal-tray" aria-label="Banens mål">
      <div class="moves-counter"><strong id="moves-count">18</strong><span>TRÆK</span></div>
      <div id="objectives" class="objectives"></div>
      <button class="goal-help" data-action="help" aria-label="Forklar banens mål">?</button>
    </section>
    <section class="play-zone" aria-label="Match tre ens">
      <div class="board-rim"><div id="board" class="board"></div></div>
      <div id="special-tray" class="special-tray" hidden><span id="special-name"></span><button data-action="use-special">Brug <span>✦</span></button></div>
    </section>
    <div id="decor-tools" class="decor-tools" hidden></div>
    <nav class="game-toolbar" aria-label="Spilknapper">
      <button data-action="aquarium" id="aquarium-button"><span class="toolbar-icon">${uiIcon("aquarium")}</span><span>Akvarium</span></button>
      <button data-action="hint" id="hint-button" class="primary-tool"><span class="toolbar-icon">${uiIcon("hint")}</span><span>Et lille hint</span></button>
      <button data-action="levels" id="levels-button"><span class="toolbar-icon">${uiIcon("levels")}</span><span>Baner</span></button>
    </nav>
  </main>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
  <dialog id="modal" class="game-modal"></dialog>
  <input id="import-file" type="file" accept="application/json,.json" hidden />`;

const aquarium = new Aquarium($("#aquarium-scene"));
const aquariumBounds = new ResizeObserver(() =>
  aquarium.setBackdropBounds($(".aquarium-window").getBoundingClientRect()),
);
aquariumBounds.observe($(".aquarium-window"));
const board = new BoardView($("#board"));
board.reducedMotion = save.settings.reducedMotion;

function commit(): boolean {
  if (saveBlocked) return false;
  try {
    persist(save);
    return true;
  } catch {
    toast(
      "Spillet kunne ikke gemmes på denne enhed. Eksportér en kopi under indstillinger.",
    );
    return false;
  }
}
function toast(message: string): void {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => node.classList.remove("visible"), 3500);
}
function objectiveText(): string {
  return save.active.board.objectives
    .map((o) => `${Math.max(0, o.target - o.collected)} ${KIND_NAMES[o.kind]}`)
    .join(" og ");
}
function suggestedAction(): Action | null {
  const current = save.active.board;
  // These two introductions have a deliberately authored four-leaf opening.
  // Keep the visual hint consistent with the coach's instruction.
  return current.turnId === 0 &&
    (current.levelId === 3 || current.levelId === 7)
    ? { kind: "swap", from: 11, to: 3 }
    : getHint(current);
}
function goalArt(kind: string): string {
  const type = ["shell", "star", "drop", "leaf", "pearl"].indexOf(kind);
  if (type >= 0)
    return `<img src="${gemArt({ type: type as TileType })}" alt=""/>`;
  if (kind === "special")
    return `<img src="${gemArt({ type: 2, special: "bomb" })}" alt=""/>`;
  if (kind === "coral") return `<img src="${coralArt}" alt=""/>`;
  return '<span class="sand-icon" aria-hidden="true">≋</span>';
}
function renderHud(): void {
  $("#shell-count").textContent = String(save.shells);
  const b = save.active.board;
  setGemTheme(b.levelId);
  document.body.dataset.gemTheme = String(Math.floor((b.levelId - 1) / 2));
  $("#moves-count").textContent = String(b.movesRemaining);
  $(".moves-counter").classList.toggle("low", b.movesRemaining <= 5);
  $("#level-badge").innerHTML =
    `<span>Bane ${b.levelId} af 10</span><small>${getGemThemeName(b.levelId)}</small>`;
  $("#objectives").innerHTML = b.objectives
    .map(
      (o) =>
        `<div class="objective ${o.collected >= o.target ? "complete" : ""}" data-kind="${o.kind}" aria-label="${Math.min(o.collected, o.target)} af ${o.target} ${KIND_NAMES[o.kind]}">${goalArt(o.kind)}<span><strong>${o.collected >= o.target ? "✓" : Math.max(0, o.target - o.collected)}</strong><small>${KIND_NAMES[o.kind]}</small></span><i style="--progress:${Math.min(1, o.collected / o.target) * 100}%"></i></div>`,
    )
    .join("");
  aquarium.setState({
    fishIds: save.fishIds,
    placements: save.placements,
    fishStyles: save.fishStyles,
  });
  document.body.classList.toggle("reduced-motion", save.settings.reducedMotion);
  aquarium.setReducedMotion(save.settings.reducedMotion);
  $(".sound-tap").textContent = save.settings.sound ? "♫" : "♪";
  $(".sound-tap").setAttribute(
    "aria-label",
    save.settings.sound ? "Slå lyd fra" : "Slå lyd til",
  );
  $(".sound-tap").classList.toggle("muted", !save.settings.sound);
  board.reducedMotion = save.settings.reducedMotion;
}
function modal(title: string, body: string, actions = ""): void {
  const dialog = $<HTMLDialogElement>("#modal");
  dialog.innerHTML = `<button class="modal-close circle-button" data-action="close-modal" aria-label="Luk">×</button><div class="modal-heading"><span class="eyebrow">LIVS AKVARIE</span><h2>${title}</h2></div>${body}${actions ? `<div class="modal-actions">${actions}</div>` : ""}`;
  if (!dialog.open) dialog.showModal();
}
function closeModal(): void {
  $<HTMLDialogElement>("#modal").close();
  lastInteraction = performance.now();
}
function showWin(reward: number): void {
  if (reward > 0) {
    aquarium.celebrate();
    audio.play("win");
  }
  const final = save.completed.length === 10;
  modal(
    final
      ? "Dit hav er fuldt af liv."
      : reward
        ? "En ny lille sejr."
        : "Klar til det næste eventyr?",
    `<div class="reward-orb"><img src="${gemArt({ type: 0 })}" alt="Muslingeskaller"/><strong>${reward ? `+${reward}` : "✓"}</strong></div><p>${final ? "Alle ti baner er gennemført. Fiskene holder fest — og du kan stadig spille og indrette videre." : reward ? "Du har samlet skaller til dit akvarium. Hvad skal fiskene udforske nu?" : "Banen er klaret, og dine skaller er gemt. Du kan indrette videre eller tage den næste bane."}</p>`,
    `<button class="gold-button" data-action="win-decorate">Indret akvariet <span>→</span></button><button class="soft-button" data-action="next-level">${save.active.board.levelId < 10 ? "Næste bane" : "Spil igen"}</button>`,
  );
}
function finishWin(): void {
  const reward = awardWin(save);
  if (!commit()) return;
  renderHud();
  if (reward) showWin(reward);
}
function noMoves(): void {
  modal(
    "Der er altid en vej videre.",
    "<p>Du kan få lidt mere plads til at prøve. Alle muligheder er gratis.</p>",
    '<button class="gold-button" data-action="extra-moves">Få fem træk ✦</button><button class="soft-button" data-action="retry-level">Prøv banen igen</button><button class="text-button" data-action="suggest-after-loss">Vis et forslag</button>',
  );
}

board.onAction = async (action: Action) => {
  if (busy || mode !== "play" || saveBlocked) return;
  lastInteraction = performance.now();
  if (save.active.rewarded) {
    showWin(0);
    return;
  }
  if (save.active.board.movesRemaining <= 0) {
    noMoves();
    return;
  }
  busy = true;
  board.locked = true;
  board.select(null);
  const result = playTurn(save.active.board, action);
  if (!result.valid) {
    audio.play("invalid");
    await board.invalid(action);
    busy = false;
    board.locked = false;
    return;
  }
  // Persist the deterministic start point + intent before the visual cascade.
  // A reload replays this exact action once, rather than charging a second move.
  save.active.pending = action;
  if (!commit()) {
    save.active.pending = null;
    busy = false;
    board.locked = false;
    return;
  }
  audio.play("swap");
  if (!save.settings.reducedMotion && "vibrate" in navigator)
    navigator.vibrate(10);
  $("#coach-text").textContent = "Se, hvad der sker, når brikkerne falder.";
  $("#moves-count").textContent = String(result.state.movesRemaining);
  await board.play(result.events);
  save.active.board = result.state;
  save.active.pending = null;
  save.tutorialSeen = true;
  commit();
  renderHud();
  board.show(result.state);
  busy = false;
  board.locked = false;
  lastInteraction = performance.now();
  $("#coach-text").textContent = isWon(result.state)
    ? "Se, hvad du har samlet til dit hav."
    : "Fire på række bliver til en stråle.";
  if (isWon(result.state)) finishWin();
  else if (!result.state.movesRemaining) noMoves();
};
board.onSelect = (cell) => {
  selectedCell = cell;
  const tile = cell === null ? null : save.active.board.tiles[cell];
  const tray = $("#special-tray");
  tray.hidden = !tile?.special;
  if (tile?.special) {
    $("#special-name").textContent =
      tile.special === "color"
        ? "Farveperle · byt med en farve"
        : tile.special === "bomb"
          ? "Boblebombe · ryd 3 × 3"
          : "Stråle · ryd en hel linje";
    tray.querySelector<HTMLButtonElement>("button")!.hidden =
      tile.special === "color";
  }
  if (cell !== null) {
    audio.play("pick");
    lastInteraction = performance.now();
  }
};
board.onEffect = (kind, chain) => audio.play(kind, chain);
board.onClear = (event) => {
  if (save.settings.reducedMotion || document.hidden) return;
  const rect = $("#board").getBoundingClientRect(),
    size = rect.width / 8;
  for (const objective of save.active.board.objectives) {
    const type = ["shell", "star", "drop", "leaf", "pearl"].indexOf(
      objective.kind,
    );
    const target = document.querySelector<HTMLImageElement>(
      `.objective[data-kind="${objective.kind}"] img`,
    );
    if (type < 0 || !target || objective.collected >= objective.target)
      continue;
    const destination = target.getBoundingClientRect();
    for (const { cell, tile } of (event.removed ?? [])
      .filter((item) => item.tile.type === type)
      .slice(0, 2)) {
      const image = document.createElement("img");
      image.src = gemArt(tile);
      image.className = "collection-flight";
      const x = rect.x + ((cell % 8) + 0.5) * size - 14,
        y = rect.y + (Math.floor(cell / 8) + 0.5) * size - 14;
      const dx = destination.x + destination.width / 2 - 14 - x,
        dy = destination.y + destination.height / 2 - 14 - y;
      image.style.left = `${x}px`;
      image.style.top = `${y}px`;
      document.body.appendChild(image);
      const flight = image.animate(
        [
          { transform: "translate(0,0) scale(1)", opacity: 0.8 },
          {
            transform: `translate(${dx * 0.4 - 20}px,${dy * 0.65}px) scale(.9)`,
            opacity: 1,
            offset: 0.55,
          },
          { transform: `translate(${dx}px,${dy}px) scale(.45)`, opacity: 0.1 },
        ],
        { duration: 560, easing: "cubic-bezier(.4,0,.5,1)" },
      );
      void flight.finished.then(() => {
        image.remove();
        target.animate(
          [{ scale: "1" }, { scale: "1.22", offset: 0.4 }, { scale: "1" }],
          { duration: 240 },
        );
      });
    }
  }
};

function switchMode(next: "play" | "aquarium"): void {
  if (busy) {
    toast("Lad lige brikkerne lande.");
    return;
  }
  mode = next;
  chosenDecor = null;
  document.body.classList.toggle("aquarium-mode", mode === "aquarium");
  aquarium.setMode(mode === "aquarium" ? "decorate" : "backdrop");
  aquarium.setSelected(null);
  $("#aquarium-button").innerHTML =
    `<span class="toolbar-icon">${uiIcon(mode === "aquarium" ? "play" : "aquarium")}</span><span>${mode === "aquarium" ? "Spil" : "Akvarium"}</span>`;
  $("#hint-button").innerHTML =
    `<span class="toolbar-icon">${uiIcon(mode === "aquarium" ? "add" : "hint")}</span><span>${mode === "aquarium" ? "Indret" : "Et lille hint"}</span>`;
  $("#levels-button").innerHTML =
    `<span class="toolbar-icon">${uiIcon(mode === "aquarium" ? "fish" : "levels")}</span><span>${mode === "aquarium" ? "Mine fisk" : "Baner"}</span>`;
  $("#decor-tools").hidden = true;
  if (next === "play") {
    board.show(save.active.board);
    if (save.active.rewarded)
      toast("Banen er klaret. Vælg næste bane under Baner.");
  }
}
function startLevel(id: number): void {
  if (busy) return;
  save.active = { board: createBoard(id), pending: null, rewarded: false };
  commit();
  closeModal();
  switchMode("play");
  renderHud();
  board.show(save.active.board);
  $("#coach-text").textContent =
    id === 3 || id === 7
      ? "Prøv at samle fire blade på række."
      : `Saml ${objectiveText()}.`;
  if (id === 1 || id === 3 || id === 7) board.hint(suggestedAction());
}
function levelMenu(): void {
  const unlocked = Math.min(10, Math.max(0, ...save.completed) + 1);
  modal(
    "En lille rejse under vand.",
    `<p>Ti baner. Ingen tidspres. Alle forsøg er gratis.</p><div class="level-grid">${Array.from({ length: 10 }, (_, i) => `<button class="level-choice ${save.completed.includes(i + 1) ? "done" : ""}" data-action="choose-level" data-id="${i + 1}" ${i + 1 > unlocked ? "disabled" : ""}><span>${i + 1}</span><small>${save.completed.includes(i + 1) ? "✓" : i + 1 > unlocked ? "Låst" : "Spil"}</small></button>`).join("")}</div>`,
  );
}
function requestLevel(id: number): void {
  if (id === save.active.board.levelId && !save.active.rewarded) {
    closeModal();
    switchMode("play");
    return;
  }
  if (save.active.board.turnId > 0 && !save.active.rewarded) {
    modal(
      "Skifte bane?",
      "<p>Dit akvarium og dine skaller bliver. Fremgangen i den igangværende bane bliver erstattet.</p>",
      `<button class="gold-button" data-action="start-level" data-id="${id}">Start bane ${id}</button><button class="soft-button" data-action="close-modal">Fortsæt her</button>`,
    );
  } else startLevel(id);
}
function shop(category: "decor" | "fish" = "decor"): void {
  const list =
    category === "decor"
      ? DECORATIONS.map(
          (d) =>
            `<button class="shop-item ${save.decorations.includes(d.id) ? "owned" : ""}" data-action="select-decor" data-id="${d.id}"><span class="shop-art">${d.icon}</span><strong>${d.name}</strong><small>${save.decorations.includes(d.id) ? "Flyt · allerede din" : `${d.price} skaller`}</small></button>`,
        ).join("")
      : FISH.map(
          (f) =>
            `<button class="shop-item fish-item ${save.fishIds.includes(f.id) ? "owned" : ""}" data-action="fish-card" data-id="${f.id}"><img src="${import.meta.env.BASE_URL}aquarium/art/fish-${f.id}.webp" alt="${f.name}"/><strong>${esc(save.fishStyles[f.id]?.name || f.name)}</strong><small>${save.fishIds.includes(f.id) ? f.personality : `${f.price} skaller`}</small></button>`,
        ).join("");
  modal(
    category === "decor"
      ? "Gør havet til dit."
      : "Små fisk. Store personligheder.",
    `<div class="shop-tabs"><button data-action="shop" class="${category === "decor" ? "active" : ""}">Indretning</button><button data-action="fish-shop" class="${category === "fish" ? "active" : ""}">Fisk</button><span>${save.shells} skaller</span></div><div class="shop-grid">${list}</div><p class="fine-print">Flyt gratis. Dekorationer kan sælges tilbage til fuld pris.</p>`,
  );
}
function selectDecor(id: string): void {
  const def = DECORATIONS.find((d) => d.id === id);
  if (!def) return;
  closeModal();
  if (mode !== "aquarium") switchMode("aquarium");
  chosenDecor = id;
  aquarium.setSelected(id);
  const owned = save.decorations.includes(id),
    tools = $("#decor-tools");
  tools.hidden = false;
  tools.innerHTML = `<div><strong>${def.name}</strong><span>${owned ? "Tryk på en tom plads for at flytte." : `Vælg en tom plads · ${def.price} skaller`}</span></div>${owned ? '<button data-action="rotate-decor" aria-label="Drej">↻</button><button data-action="sell-decor">Sælg</button>' : ""}<button data-action="cancel-decor" aria-label="Annuller placering">×</button>`;
}
aquarium.onSlot = (slot) => {
  const existing = save.placements.find((p) => p.slot === slot);
  if (!chosenDecor) {
    if (existing) selectDecor(existing.id);
    else shop();
    return;
  }
  if (existing && existing.id !== chosenDecor) {
    toast("Den plads er optaget. Vælg en tom cirkel.");
    return;
  }
  const placed = save.placements.find((p) => p.id === chosenDecor);
  const previous = structuredClone(save);
  if (placed) {
    undoPlacements = structuredClone(save.placements);
    placed.slot = slot;
  } else {
    const error = purchase(save, "decor", chosenDecor, slot);
    if (error) {
      toast(error);
      return;
    }
    undoPlacements = null;
  }
  if (!commit()) {
    save = previous;
    return;
  }
  audio.play("buy");
  aquarium.celebrate();
  renderHud();
  toast(placed ? "Flyttet. Du kan fortryde." : "Et nyt sted at udforske.");
  chosenDecor = null;
  aquarium.setSelected(null);
  $("#decor-tools").hidden = !undoPlacements;
  if (undoPlacements)
    $("#decor-tools").innerHTML =
      '<div><strong>Sådan.</strong><span>Indretningen er gemt.</span></div><button data-action="undo-decor">Fortryd</button><button data-action="cancel-decor" aria-label="Luk">×</button>';
};
aquarium.onFish = (id) => fishCard(id);
function fishCard(id: string): void {
  const fish = FISH.find((f) => f.id === id);
  if (!fish) return;
  const owned = save.fishIds.includes(id),
    style = save.fishStyles[id];
  const favorite = DECORATIONS.find(
    (d) => d.id === (style?.favorite || fish.favorite),
  )!;
  modal(
    esc(style?.name || fish.name),
    `<img class="fish-portrait" src="${import.meta.env.BASE_URL}aquarium/art/fish-${id}.webp" alt="${fish.name}"/><p class="fish-personality">${fish.personality} · ${favorite.icon} ${favorite.name}</p><p>“${fish.line}”</p>${owned ? `<label class="field-label">Dit navn til fisken<input id="fish-name" maxlength="24" value="${esc(style?.name || fish.name)}" /></label><label class="field-label">Yndlingsting<select id="fish-favorite">${DECORATIONS.map((d) => `<option value="${d.id}" ${favorite.id === d.id ? "selected" : ""}>${d.name}</option>`).join("")}</select></label><label class="field-label">Lille farveskær<input type="color" id="fish-color" value="${style?.color || fish.color}" /></label>` : `<p>Flytter ind for ${fish.price} skaller.</p>`}`,
    owned
      ? `<button class="gold-button" data-action="save-fish" data-id="${id}">Gem din fisk</button><button class="text-button" data-action="hear-fish" data-id="${id}">♬ Hør fisken</button>`
      : `<button class="gold-button" data-action="buy-fish" data-id="${id}" ${save.shells < fish.price ? "disabled" : ""}>Byd ${fish.name} velkommen · ${fish.price}</button>`,
  );
}
function help(): void {
  modal(
    "En lille hjælpende boble.",
    `<p id="help-copy">Saml ${objectiveText()}. Træk en brik til en nabo, eller tryk på to naboer. Tre ens forsvinder. Et bytte uden match koster ingenting.</p><div class="special-guide"><div><img src="${gemArt({ type: 0, special: "row" })}" alt="Stråle"/><span><strong>4 på række</strong>En stråle rydder en hel linje.</span></div><div><img src="${gemArt({ type: 2, special: "bomb" })}" alt="Boblebombe"/><span><strong>L eller T</strong>En boblebombe rydder 3 × 3.</span></div><div><img src="${gemArt({ type: 4, special: "color" })}" alt="Farveperle"/><span><strong>5 på række</strong>Byt perlen med en farve og ryd den.</span></div></div><p class="fine-print">Sand ryddes under en brik. Koraller ryddes ved et match lige ved siden af eller en specialeffekt.</p>`,
    '<button class="gold-button" data-action="show-hint">Vis mig et træk</button><button class="soft-button" data-action="speak-help">♬ Læs højt</button>',
  );
}
function settings(): void {
  modal(
    "Dit tempo. Dit hav.",
    `<div class="settings-list"><label><span>Lyd og små klange</span><input type="checkbox" data-setting="sound" ${save.settings.sound ? "checked" : ""}/></label><label><span>Vis et hint efter en pause</span><input type="checkbox" data-setting="hints" ${save.settings.hints ? "checked" : ""}/></label><label><span>Roligere bevægelser</span><input type="checkbox" data-setting="reducedMotion" ${save.settings.reducedMotion ? "checked" : ""}/></label></div><p class="fine-print">Spillet gemmes på denne enhed. Gem en kopi for at flytte dit akvarium til en anden telefon eller iPad.</p><div class="save-buttons"><button class="soft-button" data-action="export">Gem en kopi</button><button class="soft-button" data-action="import">Åbn en kopi</button></div><p class="fine-print">Livs akvarie · ${__BUILD_VERSION__}<br/>Ingen reklamer, køb, liv eller ventetid.<br/>Oplæsning bruger enhedens tilgængelige danske stemme.</p>`,
  );
}

document.addEventListener("click", async (event) => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
    "[data-action]",
  );
  if (!target || target.disabled) return;
  const action = target.dataset.action,
    id = target.dataset.id;
  if (busy && action !== "toggle-sound") {
    toast("Lad lige brikkerne lande.");
    return;
  }
  lastInteraction = performance.now();
  if (action !== "settings") void audio.unlock();
  if (action === "close-modal") closeModal();
  else if (action === "toggle-sound") {
    save.settings.sound = !save.settings.sound;
    audio.enabled = save.settings.sound;
    if (audio.enabled) void audio.unlock().then(() => audio.play("buy"));
    else audio.pause();
    commit();
    renderHud();
  } else if (action === "settings") settings();
  else if (action === "aquarium")
    switchMode(mode === "play" ? "aquarium" : "play");
  else if (action === "hint") {
    if (mode === "aquarium") shop();
    else {
      board.hint(suggestedAction());
      audio.play("pick");
      toast("De funklende brikker viser ét muligt træk.");
    }
  } else if (action === "levels") {
    if (mode === "aquarium") shop("fish");
    else levelMenu();
  } else if (action === "choose-level" && id) requestLevel(Number(id));
  else if (action === "start-level" && id) startLevel(Number(id));
  else if (action === "next-level")
    startLevel(Math.min(10, save.active.board.levelId + 1));
  else if (action === "retry-level") startLevel(save.active.board.levelId);
  else if (action === "extra-moves" || action === "suggest-after-loss") {
    save.active.board = grantMoves(save.active.board);
    commit();
    renderHud();
    closeModal();
    if (action === "suggest-after-loss") board.hint(suggestedAction());
  } else if (action === "win-decorate") {
    closeModal();
    switchMode("aquarium");
    shop();
  } else if (action === "help") help();
  else if (action === "show-hint") {
    closeModal();
    board.hint(suggestedAction());
  } else if (action === "read-help" || action === "speak-help")
    audio.speak(
      `Saml ${objectiveText()}. Byt to brikker ved siden af hinanden. Tre ens forsvinder. Fire på række giver en stråle. Fem giver en farveperle.`,
    );
  else if (action === "use-special" && selectedCell !== null)
    void board.onAction({ kind: "use", cell: selectedCell });
  else if (action === "shop") shop();
  else if (action === "fish-shop") shop("fish");
  else if (action === "select-decor" && id) selectDecor(id);
  else if (action === "cancel-decor") {
    chosenDecor = null;
    aquarium.setSelected(null);
    $("#decor-tools").hidden = true;
  } else if (action === "rotate-decor" && chosenDecor) {
    const p = save.placements.find((p) => p.id === chosenDecor);
    if (p) {
      undoPlacements = structuredClone(save.placements);
      p.rotation = (p.rotation + 1) % 4;
      commit();
      renderHud();
    }
  } else if (action === "undo-decor" && undoPlacements) {
    save.placements = undoPlacements;
    undoPlacements = null;
    commit();
    renderHud();
    $("#decor-tools").hidden = true;
  } else if (action === "sell-decor" && chosenDecor) {
    const def = DECORATIONS.find((d) => d.id === chosenDecor)!;
    modal(
      `Sælg ${def.name.toLowerCase()}?`,
      `<p>Du får alle ${def.price} skaller tilbage. Fiskene har det stadig godt.</p>`,
      `<button class="gold-button" data-action="confirm-sell" data-id="${def.id}">Sælg for ${def.price}</button><button class="soft-button" data-action="close-modal">Behold</button>`,
    );
  } else if (action === "confirm-sell" && id && save.decorations.includes(id)) {
    save.shells += DECORATIONS.find((d) => d.id === id)!.price;
    save.decorations = save.decorations.filter((d) => d !== id);
    save.placements = save.placements.filter((p) => p.id !== id);
    undoPlacements = null;
    chosenDecor = null;
    aquarium.setSelected(null);
    $("#decor-tools").hidden = true;
    commit();
    renderHud();
    closeModal();
  } else if (action === "fish-card" && id) fishCard(id);
  else if (action === "hear-fish" && id)
    audio.speak(FISH.find((f) => f.id === id)?.line || "");
  else if (action === "buy-fish" && id) {
    const previous = structuredClone(save),
      error = purchase(save, "fish", id);
    if (error) toast(error);
    else if (commit()) {
      renderHud();
      closeModal();
      switchMode("aquarium");
      aquarium.celebrate();
      audio.play("buy");
    } else save = previous;
  } else if (action === "save-fish" && id) {
    save.fishStyles[id] = {
      name:
        $<HTMLInputElement>("#fish-name").value.trim().slice(0, 24) ||
        FISH.find((f) => f.id === id)!.name,
      favorite: $<HTMLSelectElement>("#fish-favorite").value,
      color: $<HTMLInputElement>("#fish-color").value,
    };
    commit();
    renderHud();
    closeModal();
    toast("Din fisk er gemt.");
  } else if (action === "export") {
    const blob = new Blob([JSON.stringify(save, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `livs-akvarie-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else if (action === "import") $<HTMLInputElement>("#import-file").click();
  else if (action === "recover-backup" && loaded.backup) {
    save = loaded.backup;
    saveBlocked = false;
    commit();
    location.reload();
  } else if (action === "fresh-after-error") {
    save = freshSave();
    saveBlocked = false;
    commit();
    location.reload();
  }
});

document.addEventListener("change", (event) => {
  const input = event.target as HTMLInputElement;
  const setting = input.dataset.setting as keyof Save["settings"] | undefined;
  if (!setting) return;
  save.settings[setting] = input.checked;
  audio.enabled = save.settings.sound;
  if (setting === "sound") {
    if (input.checked) {
      void audio.unlock().then(() => audio.play("buy"));
    } else audio.pause();
  }
  commit();
  renderHud();
});
$<HTMLInputElement>("#import-file").addEventListener(
  "change",
  async (event) => {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      if (file.size > 1_000_000)
        throw new Error("Filen er for stor til at være et gemt akvarium.");
      const imported: unknown = JSON.parse(await file.text());
      if (!validateSave(imported))
        throw new Error(
          "Filen er ikke en gyldig Livs akvarie-gemning i denne version. Dit nuværende spil er urørt.",
        );
      modal(
        "Åbn dette akvarium?",
        `<p>Livs akvarie · ${new Date(imported.updatedAt).toLocaleString("da-DK")}<br/>${imported.completed.length} baner · ${imported.fishIds.length} fisk · ${imported.shells} skaller.</p><p>Det erstatter akvariet på denne enhed. Den nuværende gemning bevares som sikkerhedskopi.</p>`,
        '<button id="confirm-import" class="gold-button">Åbn kopien</button><button class="soft-button" data-action="close-modal">Annullér</button>',
      );
      $("#confirm-import").addEventListener(
        "click",
        () => {
          save = imported;
          saveBlocked = false;
          if (commit()) location.reload();
        },
        { once: true },
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "Filen kunne ikke åbnes.");
    }
  },
);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    audio.pause();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  } else {
    lastInteraction = performance.now();
    if (save.settings.sound) void audio.unlock();
  }
});
window.setInterval(() => {
  if (
    !busy &&
    mode === "play" &&
    save.settings.hints &&
    !document.hidden &&
    !$<HTMLDialogElement>("#modal").open &&
    performance.now() - lastInteraction > 5000
  ) {
    board.hint(suggestedAction());
    lastInteraction = performance.now();
  }
}, 1000);

renderHud();
board.show(save.active.board);
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  void navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .catch(() => {
      // Network play and local saves remain usable when offline caching is unavailable.
    });
}
if (loaded.warning)
  modal(
    "Dit gemte spil er bevaret.",
    `<p>${loaded.warning}</p>`,
    `${loaded.backup ? '<button class="gold-button" data-action="recover-backup">Gendan sikkerhedskopien</button>' : ""}<button class="soft-button" data-action="fresh-after-error">Start et nyt akvarium</button>`,
  );
else {
  if (isWon(save.active.board) && !save.active.rewarded) finishWin();
  else if (save.active.rewarded) showWin(0);
  else if (!save.tutorialSeen) board.hint(suggestedAction());
  commit();
}
