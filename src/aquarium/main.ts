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
import { getLevel } from "./content/levels";
import {
  adventureOf,
  spendableShells,
  regionForLevel,
  nextReef,
  canPlayLevel,
  restoreReef,
  upgradeDecoration,
  decorationRefund,
  rareStage,
  nextStory,
  claimStory,
  goalSummary,
  REGIONS,
  UPGRADES,
  type GoalId,
  type RegionId,
} from "./content/progression";
import { Aquarium } from "./render/aquarium";
import { BoardView } from "./render/board";
import { installTouchActions } from "./render/touch";
import { gemArt, coralArt, setGemTheme, getGemThemeName } from "./render/gems";
import { Soundscape } from "./audio/sound";
import {
  awardWin,
  freshSave,
  loadSave,
  persist,
  purchase,
  prepareSave,
  validateSave,
  type Save,
} from "./save/store";
import "./style.css";
import "./expansion.css";

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
  <main class="game-shell" aria-label="Livs magiske akvarie">
    <header class="game-header">
      <button class="circle-button settings-button" data-action="settings" aria-label="Indstillinger">${uiIcon("settings")}</button>
      <h1 class="game-logo"><small>Livs magiske</small><span>akvarie</span><i aria-hidden="true">✦</i></h1>
      <button class="shell-wallet" data-action="shop" aria-label="Skaller og butik"><img src="${gemArt({ type: 0 })}" alt=""/><strong id="shell-count"></strong></button>
    </header>
    <section class="aquarium-window" aria-label="Dit levende akvarium">
      <div class="level-badge" id="level-badge">Bane 1</div>
      <button class="sound-tap" data-action="toggle-sound" aria-label="Slå lyd til">♪</button>
      <button id="coach" class="fish-message" data-action="read-help"><span id="coach-text">Træk en brik hen til en nabo.</span><span aria-hidden="true">♬</span></button>
      <div id="special-tray" class="special-tray" hidden><span id="special-name"></span><button data-action="use-special">Brug <span>✦</span></button></div>
      <div class="aquarium-title"><span>DIT EGET LILLE HAV</span><h2>Plads til fantasi.</h2></div>
      <button id="project-chip" class="project-chip" data-action="projects" aria-label="Dit næste akvarieprojekt"></button>
      <div class="aquarium-actions"><button data-action="ambience" aria-label="Vælg område og lys">☀<span>Lys & hav</span></button><button data-action="postcard" aria-label="Lav et akvariepostkort">▣<span>Postkort</span></button></div>
    </section>
    <section class="goal-tray" aria-label="Banens mål">
      <div class="moves-counter"><strong id="moves-count">18</strong><span>TRÆK</span></div>
      <div id="objectives" class="objectives"></div>
      <button class="goal-help" data-action="help" aria-label="Forklar banens mål">?</button>
    </section>
    <section class="play-zone" aria-label="Match tre ens">
      <div class="board-rim"><div id="board" class="board"></div></div>
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
  if (kind === "clam")
    return `<img src="${art("terrain-clam-closed")}" alt=""/>`;
  return '<span class="sand-icon" aria-hidden="true">≋</span>';
}
function renderHud(): void {
  $("#shell-count").textContent = String(save.shells);
  const b = save.active.board;
  setGemTheme(b.levelId);
  document.body.dataset.gemTheme = String(b.levelId - 1);
  const p = adventureOf(save),
    goal = goalSummary(save);
  document.body.dataset.region = regionForLevel(b.levelId).id;
  $("#moves-count").textContent = String(b.movesRemaining);
  $(".moves-counter").classList.toggle("low", b.movesRemaining <= 5);
  $("#level-badge").innerHTML =
    `<span>Bane ${b.levelId} af 30</span><small>${getGemThemeName(b.levelId)}</small>`;
  $("#project-chip").innerHTML =
    `<img src="${art(goal.image)}" alt=""/><span><small>${goal.ready ? "KLAR TIL AT BYGGE" : "DIT NÆSTE ØNSKE"}</small><strong>${esc(goal.title)}</strong><i><b style="width:${goal.price ? Math.min(100, (goal.saved / goal.price) * 100) : 100}%"></b></i></span><em>${goal.ready ? "✦" : `${Math.min(goal.saved, goal.price)}/${goal.price}`}</em>`;
  $("#project-chip").classList.toggle("ready", goal.ready);
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
    reefStage: p.reefStage,
    upgrades: p.upgrades,
    lighting: p.lighting,
    region: mode === "play" ? regionForLevel(b.levelId).id : p.region,
  });
  audio.setRegion(mode === "play" ? regionForLevel(b.levelId).id : p.region);
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
  dialog.innerHTML = `<button class="modal-close circle-button" data-action="close-modal" aria-label="Luk">×</button><div class="modal-heading"><span class="eyebrow">LIVS MAGISKE AKVARIE</span><h2>${title}</h2></div>${body}${actions ? `<div class="modal-actions">${actions}</div>` : ""}`;
  if (!dialog.open) dialog.showModal();
}
function closeModal(): void {
  $<HTMLDialogElement>("#modal").close();
  lastInteraction = performance.now();
}
function art(name: string): string {
  return `${import.meta.env.BASE_URL}aquarium/art/${name}.webp`;
}
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
function undoDecoration(): void {
  if (!undoPlacements || busy) return;
  const previous = structuredClone(save);
  save.placements = structuredClone(undoPlacements);
  if (!commit()) {
    save = previous;
    renderHud();
    return;
  }
  undoPlacements = null;
  chosenDecor = null;
  aquarium.setSelected(null);
  renderHud();
  $("#decor-tools").hidden = true;
}
function mutateSave(change: () => string | null): boolean {
  const previous = structuredClone(save),
    error = change();
  if (error) {
    save = previous;
    toast(error);
    return false;
  }
  if (!commit()) {
    save = previous;
    renderHud();
    return false;
  }
  renderHud();
  return true;
}
function goalPreview(): string {
  const g = goalSummary(save);
  return `<div class="wish-preview" id="reward-goal"><img src="${art(g.image)}" alt=""/><div><small>${g.ready ? "NU KAN DU BYGGE" : "DU SPARER OP TIL"}</small><strong>${esc(g.title)}</strong><progress max="${Math.max(1, g.price)}" value="${Math.min(g.saved, g.price)}"></progress><span>${g.price ? `${Math.min(g.saved, g.price)} / ${g.price} skaller` : "Allerede din"}</span></div></div>`;
}
function flyReward(): void {
  if (save.settings.reducedMotion || !$<HTMLDialogElement>("#modal").open)
    return;
  const source = document.querySelector(".reward-orb"),
    destination = document.querySelector("#reward-goal");
  if (!source || !destination) return;
  const a = source.getBoundingClientRect(),
    b = destination.getBoundingClientRect(),
    dialog = $("#modal"),
    box = dialog.getBoundingClientRect();
  for (let i = 0; i < 7; i++) {
    const coin = document.createElement("img");
    coin.src = gemArt({ type: 0 });
    coin.className = "reward-flight";
    coin.style.left = `${a.x + a.width / 2 - box.x - 15}px`;
    coin.style.top = `${a.y + a.height / 2 - box.y + dialog.scrollTop - 15}px`;
    dialog.append(coin);
    const dx = b.x + 38 - a.x - a.width / 2,
      dy = b.y + b.height / 2 - a.y - a.height / 2;
    const animation = coin.animate(
      [
        { transform: "translate(0,0) scale(.5)", opacity: 0 },
        {
          transform: `translate(${(i - 3) * 15}px,-30px) scale(1.1)`,
          opacity: 1,
          offset: 0.3,
        },
        { transform: `translate(${dx}px,${dy}px) scale(.45)`, opacity: 0 },
      ],
      {
        duration: 760,
        delay: i * 70,
        easing: "cubic-bezier(.25,.65,.4,1)",
        fill: "both",
      },
    );
    void animation.finished
      .then(() => coin.remove())
      .catch(() => coin.remove());
  }
  destination.animate(
    [{ scale: "1" }, { scale: "1.035", offset: 0.6 }, { scale: "1" }],
    { duration: 900, delay: 500 },
  );
}
function projects(): void {
  const p = adventureOf(save),
    project = nextReef(save);
  const reef = project
    ? `<div class="reef-project"><div class="project-scene"><img src="${art(`region-${project.region}`)}" alt="${REGIONS.find((r) => r.id === project.region)!.name}"/><span>REVET · ETAPE ${p.reefStage + 1} AF 3</span></div><h3>${project.title}</h3><p>${project.detail}</p><progress max="${project.price}" value="${Math.min(p.reefSavings, project.price)}"></progress><div class="project-amount">${Math.min(p.reefSavings, project.price)} / ${project.price} revskaller <span>${save.completed.includes(project.after) ? "Banemålet er klaret ✓" : `Klar bane ${project.after}`}</span></div><button class="gold-button" data-action="restore-reef" ${p.reefSavings < project.price || !save.completed.includes(project.after) ? "disabled" : ""}>Væk revet · ${project.price} skaller</button></div>`
    : `<div class="reef-project completed-reef"><img src="${art("fish-glimt")}" alt="Glimt"/><h3>Hele revet er vågnet!</h3><p>Koraller, perlelys og stimefisk. Alle fire områder er dine.</p></div>`;
  const wishes: GoalId[] = ["reef", "cave", "ring", "pearl-tree", "moon-gate"];
  const choices = wishes
    .map((id) => {
      const savedGoal = p.goal;
      p.goal = id;
      const g = goalSummary(save);
      p.goal = savedGoal;
      const stage = rareStage(id),
        locked = stage > p.reefStage;
      return `<button class="wish-choice ${p.goal === id ? "selected" : ""}" data-action="choose-goal" data-id="${id}" aria-pressed="${p.goal === id}"><img src="${art(g.image)}" alt=""/><span><strong>${esc(g.title)}</strong><small>${locked ? `Åbner i ${REGIONS[stage].name}` : g.price ? `${Math.min(g.saved, g.price)} / ${g.price} skaller` : "Alle trin bygget ✓"}</small></span><b>${p.goal === id ? "✓" : "♡"}</b></button>`;
    })
    .join("");
  modal(
    "Små skaller. Store drømme.",
    `${reef}<p class="shell-explanation"><strong>${spendableShells(save)} frie skaller</strong> · ${p.reefSavings} til revet<br/>10 af hver ny banes 40 skaller gemmes til revet, indtil alle områder er åbne. Du kan bruge resten frit.</p><h3>Vælg dit næste ønske</h3><div class="wish-list">${choices}</div>${goalPreview()}`,
    `${goalSummary(save).ready ? `<button class="gold-button" data-action="${goalSummary(save).action}" data-id="${p.goal}">Byg dit ønske ✦</button>` : ""}<button class="soft-button" data-action="close-modal">Tilbage til mit hav</button>`,
  );
}
function ambience(): void {
  const p = adventureOf(save);
  modal(
    "Dit lys. Dit lille hav.",
    `<p>Stemningen ændrer kun udseendet. Fiskene har det altid godt.</p><div class="lighting-options">${(
      [
        ["day", "☀", "Solstrejf"],
        ["dawn", "✦", "Morgenglød"],
        ["moon", "☾", "Måneskin"],
      ] as const
    )
      .map(
        ([id, icon, name]) =>
          `<button data-action="lighting" data-id="${id}" class="${p.lighting === id ? "active" : ""}" aria-pressed="${p.lighting === id}"><b>${icon}</b>${name}</button>`,
      )
      .join(
        "",
      )}</div><h3>Besøg et område</h3><div class="region-choices">${REGIONS.map((r) => `<button data-action="view-region" data-id="${r.id}" ${r.stage > p.reefStage ? "disabled" : ""} class="${p.region === r.id ? "active" : ""}"><img src="${art(r.id === "sun" ? "underwater-world" : `region-${r.id}`)}" alt=""/><span>${r.name}<small>${r.stage > p.reefStage ? `Revprojekt ${r.stage}` : "Besøg"}</small></span></button>`).join("")}</div>`,
  );
}
function teachLevel(id: number): void {
  const level = getLevel(id),
    p = adventureOf(save);
  if (!level.tutorial || p.seenTutorials.includes(id)) return;
  const demo = level.clams.length
    ? `<img src="${art("terrain-clam-closed")}" alt="Lukket musling"/><b>→</b><img src="${art("terrain-clam-cracked")}" alt="Musling efter første match"/><b>→</b><span>✦</span>`
    : level.bubbles.length
      ? `<span>↑</span><img src="${gemArt({ type: 2 })}" alt="En brik løftes af boblen"/><span>↑</span>`
      : level.rocks.length
        ? `<img src="${art("terrain-rock")}" alt="En fast sten"/><span>↔</span><img src="${gemArt({ type: 1 })}" alt="Byt brikkerne omkring stenen"/>`
        : "<span>← ↓ → ↑</span>";
  modal(
    "En ny lille opdagelse",
    `<div class="mechanic-demo mechanic-${level.clams.length ? "clam" : level.bubbles.length ? "bubble" : level.rocks.length ? "rock" : "current"}">${demo}</div><h3>${level.title}</h3><p>${esc(level.tutorial)}</p>`,
    `<button class="gold-button" data-action="tutorial-done" data-id="${id}">Det prøver vi ✦</button>`,
  );
}
function showWin(reward: number): void {
  if (reward > 0) {
    aquarium.celebrate();
    audio.play("win");
  }
  const final = save.completed.length === 30,
    goal = goalSummary(save);
  const next = Math.min(30, save.active.board.levelId + 1),
    gated = !canPlayLevel(save, next);
  modal(
    final
      ? "Dit hav er fuldt af liv."
      : reward
        ? "En ny lille sejr."
        : "Klar til det næste eventyr?",
    `<div class="reward-orb"><img src="${gemArt({ type: 0 })}" alt="Muslingeskaller"/><strong>${reward ? `+${reward}` : "✓"}</strong></div><p>${final ? "Alle 30 baner er gennemført! Dit magiske hav lever videre — indret, besøg fiskene og gem et postkort." : reward === 40 ? `${adventureOf(save).reefStage < 3 ? "10 af dine 40 skaller er lagt trygt til side til revet. Resten kan du indrette med." : "40 nye skaller til dit eget magiske hav."}` : reward ? "10 nye skaller til dit næste ønske." : "Banen og dine skaller er gemt."}</p>${goalPreview()}`,
    `${goal.ready ? `<button class="gold-button" data-action="${goal.action}" data-id="${goal.id}">Byg ${esc(goal.title.toLowerCase())} ✦</button>` : ""}<button class="${goal.ready ? "soft" : "gold"}-button" data-action="${gated ? "projects" : "next-level"}">${gated ? "Væk revet · åbn næste område" : final ? "Spil sidste bane igen" : "Næste bane →"}</button><button class="text-button" data-action="win-decorate">Besøg dit akvarium</button>`,
  );
  if (reward) window.setTimeout(flyReward, 120);
}
function finishWin(): void {
  let reward = 0;
  if (
    !mutateSave(() => {
      reward = awardWin(save);
      return null;
    })
  )
    return;
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
  if (isWon(save.active.board)) {
    finishWin();
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
  $("#coach").hidden = !!tile?.special;
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
board.onEffect = (kind, chain) => {
  audio.play(kind, chain);
  if (!save.settings.reducedMotion && "vibrate" in navigator)
    navigator.vibrate(
      kind === "special" ? [10, 25, 14] : Math.min(12, 4 + chain),
    );
};
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
  board.select(null);
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
  renderHud();
}
function startLevel(id: number): void {
  if (busy) return;
  if (!canPlayLevel(save, id)) {
    projects();
    return;
  }
  const previous = structuredClone(save);
  save.active = { board: createBoard(id), pending: null, rewarded: false };
  if (!commit()) {
    save = previous;
    return;
  }
  closeModal();
  switchMode("play");
  renderHud();
  board.show(save.active.board);
  $("#coach-text").textContent =
    id === 3 || id === 7
      ? "Prøv at samle fire blade på række."
      : `Saml ${objectiveText()}.`;
  if (id === 1 || id === 3 || id === 7) board.hint(suggestedAction());
  teachLevel(id);
}
function levelMenu(): void {
  const p = adventureOf(save);
  modal(
    "30 små eventyr under vand.",
    `<p>Nye skatte og en ny baneform hver gang. Ingen tidspres — alle forsøg er gratis.</p>${REGIONS.map(
      (region) =>
        `<section class="level-region"><h3>${region.name}<small>${save.completed.filter((id) => id >= region.first && id <= region.last).length}/${region.last - region.first + 1}</small></h3>${region.stage > p.reefStage ? `<button class="region-lock" data-action="projects">✧ Åbn med revprojekt ${region.stage}</button>` : ""}<div class="level-grid">${Array.from(
          { length: region.last - region.first + 1 },
          (_, i) => {
            const id = region.first + i,
              level = getLevel(id),
              done = save.completed.includes(id),
              open = canPlayLevel(save, id);
            const shape = Array.from(
              { length: 64 },
              (_, c) =>
                `<i class="${level.voids.includes(c) ? "water" : level.rocks.includes(c) ? "stone" : ""}"></i>`,
            ).join("");
            return `<button class="level-choice ${done ? "done" : ""}" data-action="choose-level" data-id="${id}" ${open ? "" : "disabled"} aria-label="Bane ${id}: ${level.title}${done ? ", klaret" : ""}"><span>${id}</span><div class="mini-board" aria-hidden="true">${shape}</div><small>${done ? "✓" : open ? "Spil" : "Låst"}</small></button>`;
          },
        ).join("")}</div></section>`,
    ).join("")}`,
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
            `<button class="shop-item ${save.decorations.includes(d.id) ? "owned" : ""}" data-action="select-decor" data-id="${d.id}" ${rareStage(d.id) > adventureOf(save).reefStage ? "disabled" : ""}><img class="decor-shop-art" src="${art(`decor-${d.id}`)}" alt=""/><strong>${d.name}</strong><small>${save.decorations.includes(d.id) ? "Flyt · allerede din" : rareStage(d.id) > adventureOf(save).reefStage ? `Revprojekt ${rareStage(d.id)}` : `${d.price} skaller`}</small></button>`,
        ).join("")
      : FISH.map(
          (f) =>
            `<button class="shop-item fish-item ${save.fishIds.includes(f.id) ? "owned" : ""}" data-action="fish-card" data-id="${f.id}"><img src="${import.meta.env.BASE_URL}aquarium/art/fish-${f.id}.webp" alt="${f.name}"/><strong>${esc(save.fishStyles[f.id]?.name || f.name)}</strong><small>${save.fishIds.includes(f.id) ? f.personality : `${f.price} skaller`}</small></button>`,
        ).join("");
  modal(
    category === "decor"
      ? "Gør havet til dit."
      : "Små fisk. Store personligheder.",
    `<div class="shop-tabs"><button data-action="shop" class="${category === "decor" ? "active" : ""}">Indretning</button><button data-action="fish-shop" class="${category === "fish" ? "active" : ""}">Fisk</button><span>${spendableShells(save)} frie skaller</span></div><div class="shop-grid">${list}</div><button class="reserve-note" data-action="projects">✧ ${adventureOf(save).reefSavings} skaller er gemt til revet · Se projekter</button><p class="fine-print">Træk ting med fingeren for at flytte. Alle køb og opgraderinger kan sælges tilbage til fuld pris.</p>`,
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
  const upgrade =
    id === "cave" || id === "ring"
      ? UPGRADES[id][adventureOf(save).upgrades[id] ?? 0]
      : null;
  tools.hidden = false;
  tools.innerHTML = `<div><strong>${def.name}</strong><span>${owned ? "Træk med fingeren · eller vælg en tom plads." : `Tryk på en lysende plads · ${def.price} skaller`}</span></div>${owned ? `${upgrade ? `<button data-action="upgrade-preview" data-id="${id}">✦<small>Udvid</small></button>` : ""}<button data-action="rotate-decor" aria-label="Drej">↻</button><button data-action="sell-decor">Sælg</button>` : ""}<button data-action="cancel-decor" aria-label="Annuller placering">×</button>`;
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
    delete placed.x;
    delete placed.y;
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
aquarium.onMove = (id, x, y) => {
  const previous = structuredClone(save),
    placement = save.placements.find((p) => p.id === id);
  if (!placement) return;
  const undo = structuredClone(save.placements);
  placement.x = x;
  placement.y = y;
  if (!commit()) {
    save = previous;
    renderHud();
    return;
  }
  undoPlacements = undo;
  chosenDecor = null;
  aquarium.setSelected(null);
  renderHud();
  audio.play("pick");
  $("#decor-tools").hidden = false;
  $("#decor-tools").innerHTML =
    '<div><strong>Lige dér.</strong><span>Placeringen er gemt.</span></div><button data-action="undo-decor">Fortryd</button><button data-action="cancel-decor" aria-label="Luk">×</button>';
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
  const story = nextStory(save, id),
    storyHTML = owned
      ? `<div class="fish-story"><small>${story ? `FISKENS FORTÆLLING · ${story.chapter}/2` : "TO SMÅ EVENTYR · KLARET"}</small><h3>${story?.title ?? "Et hav af gode minder"}</h3><p>${story ? (story.ready ? story.line : story.need) : "Dit akvarium har givet denne ven nye steder at udforske."}</p>${story?.ready ? `<button class="gold-button" data-action="fish-story" data-id="${id}">Se det lille øjeblik ♡</button>` : ""}</div>`
      : "";
  modal(
    esc(style?.name || fish.name),
    `<img class="fish-portrait" src="${import.meta.env.BASE_URL}aquarium/art/fish-${id}.webp" alt="${fish.name}"/><p class="fish-personality">${fish.personality} · ${favorite.icon} ${favorite.name}</p><p>“${fish.line}”</p>${storyHTML}${owned ? `<label class="field-label">Dit navn til fisken<input id="fish-name" maxlength="24" value="${esc(style?.name || fish.name)}" /></label><label class="field-label">Yndlingsting<select id="fish-favorite">${DECORATIONS.map((d) => `<option value="${d.id}" ${favorite.id === d.id ? "selected" : ""}>${d.name}</option>`).join("")}</select></label><label class="field-label">Lille farveskær<input type="color" id="fish-color" value="${style?.color || fish.color}" /></label>` : `<p>Flytter ind for ${fish.price} skaller.</p>`}`,
    owned
      ? `<button class="gold-button" data-action="save-fish" data-id="${id}">Gem din fisk</button><button class="text-button" data-action="hear-fish" data-id="${id}">♬ Hør fisken</button>`
      : `<button class="gold-button" data-action="buy-fish" data-id="${id}" ${spendableShells(save) < fish.price ? "disabled" : ""}>Byd ${fish.name} velkommen · ${fish.price}</button>`,
  );
}
function help(): void {
  const combos = `<div class="combo-guide"><h3>To specialer = ekstra magi</h3><div><img src="${gemArt({ type: 0, special: "row" })}" alt="Stråle"/> + <img src="${gemArt({ type: 1, special: "column" })}" alt="Stråle"/><span><strong>Lysende kryds</strong>En hel række og kolonne.</span></div><div><img src="${gemArt({ type: 2, special: "bomb" })}" alt="Bombe"/> + <img src="${gemArt({ type: 0, special: "row" })}" alt="Stråle"/><span><strong>Bred boblebølge</strong>Tre rækker og tre kolonner.</span></div><div><img src="${gemArt({ type: 4, special: "color" })}" alt="Farveperle"/> + <img src="${gemArt({ type: 4, special: "color" })}" alt="Farveperle"/><span><strong>Regnbuekaskade</strong>Alle brikker på brættet.</span></div></div>`;
  modal(
    "En lille hjælpende boble.",
    `<p id="help-copy">Saml ${objectiveText()}. Træk en brik til en nabo, eller tryk på to naboer. Tre ens forsvinder. Et bytte uden match koster ingenting.</p><div class="special-guide"><div><img src="${gemArt({ type: 0, special: "row" })}" alt="Stråle"/><span><strong>4 på række</strong>En stråle rydder en hel linje.</span></div><div><img src="${gemArt({ type: 2, special: "bomb" })}" alt="Boblebombe"/><span><strong>L eller T</strong>En boblebombe rydder 3 × 3.</span></div><div><img src="${gemArt({ type: 4, special: "color" })}" alt="Farveperle"/><span><strong>5 på række</strong>Byt perlen med en farve og ryd den.</span></div></div>${combos}<p class="fine-print">Sand ryddes under en brik. Koraller ryddes ved et nabomatch eller en specialeffekt. Sten bliver stående. Muslinger åbner efter to træffere. Bobler løfter en brik, og strømpilen viser faldretningen.</p>`,
    '<button class="gold-button" data-action="show-hint">Vis mig et træk</button><button class="soft-button" data-action="speak-help">♬ Læs højt</button>',
  );
}
function settings(): void {
  modal(
    "Dit tempo. Dit hav.",
    `<div class="settings-list"><label><span>Lyd og små klange</span><input type="checkbox" data-setting="sound" ${save.settings.sound ? "checked" : ""}/></label><label><span>Vis et hint efter en pause</span><input type="checkbox" data-setting="hints" ${save.settings.hints ? "checked" : ""}/></label><label><span>Roligere bevægelser</span><input type="checkbox" data-setting="reducedMotion" ${save.settings.reducedMotion ? "checked" : ""}/></label></div><p class="fine-print">Spillet gemmes på denne enhed. Gem en kopi for at flytte dit akvarium til en anden telefon eller iPad.</p><div class="save-buttons"><button class="soft-button" data-action="export">Gem en kopi</button><button class="soft-button" data-action="import">Åbn en kopi</button></div><p class="fine-print">Livs magiske akvarie · ${__BUILD_VERSION__}<br/>Ingen reklamer, betaling, liv eller ventetid.<br/>Oplæsning bruger enhedens tilgængelige danske stemme.</p>`,
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
  else if (action === "projects") projects();
  else if (
    action === "choose-goal" &&
    id &&
    ["reef", "cave", "ring", "pearl-tree", "moon-gate"].includes(id)
  ) {
    if (
      mutateSave(() => {
        adventureOf(save).goal = id as GoalId;
        return null;
      })
    )
      projects();
  } else if (action === "restore-reef") {
    const project = nextReef(save);
    if (mutateSave(() => restoreReef(save))) {
      closeModal();
      switchMode("aquarium");
      aquarium.celebrate();
      audio.play("win");
      toast(project?.celebration || "Revet er vågnet.");
    }
  } else if (action === "goal-place" && id) selectDecor(id);
  else if (action === "upgrade-preview" && (id === "cave" || id === "ring")) {
    const upgrade = UPGRADES[id][adventureOf(save).upgrades[id] ?? 0];
    if (upgrade)
      modal(
        upgrade.title,
        `<img class="upgrade-portrait" src="${art(`decor-${id}`)}" alt=""/><p>${upgrade.detail}</p><p>${spendableShells(save)} frie skaller · fuld tilbagebetaling ved salg.</p>`,
        `<button class="gold-button" data-action="upgrade-decor" data-id="${id}" ${spendableShells(save) < upgrade.price ? "disabled" : ""}>Byg ud · ${upgrade.price} skaller</button>`,
      );
  } else if (action === "upgrade-decor" && id) {
    if (mutateSave(() => upgradeDecoration(save, id))) {
      closeModal();
      switchMode("aquarium");
      aquarium.celebrate();
      audio.play("buy");
      aquarium.playStory(id === "cave" ? "sky" : "glimt", 2);
      toast("En ny udvidelse — og en ny tur for fiskene.");
    }
  } else if (action === "fish-story" && id) {
    const story = nextStory(save, id);
    if (
      story?.ready &&
      mutateSave(() =>
        claimStory(save, id) ? null : "Det øjeblik er ikke klar endnu.",
      )
    ) {
      closeModal();
      switchMode("aquarium");
      aquarium.playStory(id, story.chapter);
      audio.play("buy");
      if (save.settings.sound) audio.speak(story.line);
      toast(story.line);
    }
  } else if (action === "ambience") ambience();
  else if (
    action === "lighting" &&
    (id === "day" || id === "dawn" || id === "moon")
  ) {
    if (
      mutateSave(() => {
        adventureOf(save).lighting = id;
        return null;
      })
    )
      ambience();
  } else if (action === "view-region" && id) {
    const region = REGIONS.find((r) => r.id === id);
    if (
      region &&
      region.stage <= adventureOf(save).reefStage &&
      mutateSave(() => {
        adventureOf(save).region = id as RegionId;
        return null;
      })
    ) {
      closeModal();
      switchMode("aquarium");
    }
  } else if (action === "postcard") {
    target.disabled = true;
    try {
      const blob = await aquarium.exportPostcard();
      downloadBlob(
        blob,
        `livs-magiske-akvarie-${new Date().toISOString().slice(0, 10)}.png`,
      );
      toast(
        "Dit postkort er klar som billede. Gem det i Fotos eller del det fra telefonens download.",
      );
    } catch {
      toast(
        "Billedet kunne ikke laves endnu. Vent til havet er indlæst, og prøv igen.",
      );
    } finally {
      target.disabled = false;
    }
  } else if (action === "tutorial-done" && id) {
    if (
      mutateSave(() => {
        const seen = adventureOf(save).seenTutorials;
        if (!seen.includes(Number(id))) seen.push(Number(id));
        return null;
      })
    )
      closeModal();
  } else if (action === "toggle-sound") {
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
    startLevel(Math.min(30, save.active.board.levelId + 1));
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
    toast("Tryk på dit ønske, en fisk eller Indret.");
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
    undoDecoration();
  } else if (action === "sell-decor" && chosenDecor) {
    const def = DECORATIONS.find((d) => d.id === chosenDecor)!;
    const refund = decorationRefund(save, def.id);
    modal(
      `Sælg ${def.name.toLowerCase()}?`,
      `<p>Du får alle ${refund} skaller tilbage, inklusive eventuelle udvidelser. Fiskene har det stadig godt.</p>`,
      `<button class="gold-button" data-action="confirm-sell" data-id="${def.id}">Sælg for ${refund}</button><button class="soft-button" data-action="close-modal">Behold</button>`,
    );
  } else if (action === "confirm-sell" && id && save.decorations.includes(id)) {
    if (
      !mutateSave(() => {
        save.shells += decorationRefund(save, id);
        delete adventureOf(save).upgrades[id];
        save.decorations = save.decorations.filter((d) => d !== id);
        save.placements = save.placements.filter((p) => p.id !== id);
        return null;
      })
    )
      return;
    undoPlacements = null;
    chosenDecor = null;
    aquarium.setSelected(null);
    $("#decor-tools").hidden = true;
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
    a.download = `livs-magiske-akvarie-${new Date().toISOString().slice(0, 10)}.json`;
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
          "Filen er ikke en gyldig Livs magiske akvarie-gemning i denne version. Dit nuværende spil er urørt.",
        );
      modal(
        "Åbn dette akvarium?",
        `<p>Livs magiske akvarie · ${new Date(imported.updatedAt).toLocaleString("da-DK")}<br/>${imported.completed.length} baner · ${imported.fishIds.length} fisk · ${imported.shells} skaller.</p><p>Det erstatter akvariet på denne enhed. Den nuværende gemning bevares som sikkerhedskopi.</p>`,
        '<button id="confirm-import" class="gold-button">Åbn kopien</button><button class="soft-button" data-action="close-modal">Annullér</button>',
      );
      $("#confirm-import").addEventListener(
        "click",
        () => {
          save = prepareSave(imported);
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

installTouchActions();
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
