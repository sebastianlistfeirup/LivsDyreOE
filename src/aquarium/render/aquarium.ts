import "./aquarium.css";

export type AquariumMode = "backdrop" | "decorate";
export type AquariumPlacement = { id: string; slot: number; rotation: number };
export type AquariumState = {
  fishIds: string[];
  placements: AquariumPlacement[];
  fishStyles?: Record<
    string,
    { name: string; color?: string; favorite?: string }
  >;
};

type XY = { x: number; y: number };
type FishId = "bobo" | "sky" | "glimt" | "plet";
type FishMotion = {
  element: HTMLButtonElement;
  id: FishId;
  from: XY;
  to: XY;
  point: XY;
  started: number;
  duration: number;
  curve: number;
  facing: 1 | -1;
  ringStep: number;
  activity: "none" | "cave-enter" | "cave-rest" | "ring-loop";
  cooldownUntil: number;
  restNext: boolean;
};

const FISH_IDS: FishId[] = ["bobo", "sky", "glimt", "plet"];
const FISH_COLORS: Record<FishId, string> = {
  bobo: "#f6a344",
  sky: "#4bbbe0",
  glimt: "#f6d45b",
  plet: "#aaca65",
};
const FISH_NAMES: Record<FishId, string> = {
  bobo: "Bobo",
  sky: "Sky",
  glimt: "Glimt",
  plet: "Plet",
};
const DECOR_NAMES: Record<string, string> = {
  seagrass: "Søgræs",
  cave: "Lille hule",
  ring: "Svømmering",
  arch: "Koralbue",
  clam: "Muslingeseng",
  bubbles: "Boblesten",
  wreck: "Trævrag",
  lantern: "Festlanterne",
};
const SLOTS: XY[] = [
  { x: 0.17, y: 0.56 },
  { x: 0.5, y: 0.56 },
  { x: 0.83, y: 0.56 },
  { x: 0.15, y: 0.68 },
  { x: 0.5, y: 0.68 },
  { x: 0.85, y: 0.68 },
  { x: 0.32, y: 0.8 },
  { x: 0.68, y: 0.8 },
];
const BACKDROP_LANES: Record<FishId, [number, number]> = {
  bobo: [0.31, 0.47],
  sky: [0.4, 0.55],
  glimt: [0.23, 0.38],
  plet: [0.54, 0.68],
};

function fallbackFish(id: FishId): string {
  const color = FISH_COLORS[id];
  const marks =
    id === "plet"
      ? '<ellipse cx="108" cy="53" rx="11" ry="7" fill="#557751" opacity=".77"/><ellipse cx="75" cy="70" rx="9" ry="6" fill="#557751" opacity=".7"/><ellipse cx="121" cy="78" rx="7" ry="5" fill="#557751" opacity=".7"/>'
      : id === "glimt"
        ? '<path d="M64 48 Q95 35 140 48" fill="none" stroke="#fff5bc" stroke-width="5" opacity=".6"/>'
        : id === "sky"
          ? '<path d="M70 82 Q105 91 151 75" fill="none" stroke="#dbf5ff" stroke-width="4" opacity=".65"/>'
          : '<path d="M70 58 Q99 49 133 62" fill="none" stroke="#ffe5a1" stroke-width="5" opacity=".55"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 130"><defs><radialGradient id="g"><stop stop-color="#fff8ce"/><stop offset=".38" stop-color="${color}"/><stop offset="1" stop-color="${color}"/></radialGradient><linearGradient id="fin" x2="0" y2="1"><stop stop-color="#fff4c8"/><stop offset="1" stop-color="${color}"/></linearGradient></defs><path d="M61 65 Q25 22 10 37 Q25 64 10 94 Q36 104 61 69" fill="url(#fin)" stroke="#f7eac1" stroke-width="3"/><path d="M91 43 Q93 12 119 15 Q135 27 139 42" fill="url(#fin)" stroke="#f7eac1" stroke-width="2"/><path d="M95 89 Q93 118 118 117 Q131 104 137 87" fill="url(#fin)" stroke="#f7eac1" stroke-width="2"/><path d="M152 68 Q184 91 166 103 Q145 101 136 79" fill="url(#fin)" opacity=".8"/><ellipse cx="111" cy="65" rx="76" ry="45" fill="url(#g)" stroke="#f9eecb" stroke-width="3"/>${marks}<circle cx="153" cy="55" r="9" fill="#fff7eb"/><circle cx="155" cy="55" r="5" fill="#173d45"/><circle cx="157" cy="52" r="2" fill="#fff"/><path d="M178 75 Q189 81 199 74" fill="none" stroke="#8e6946" stroke-linecap="round" stroke-width="3"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function decorArt(id: string, slot: number): string {
  const key = `aq-${slot}`;
  const defs = `<defs><linearGradient id="rock-${key}" x2=".2" y2="1"><stop stop-color="#b2b9a5"/><stop offset=".48" stop-color="#6a7e79"/><stop offset="1" stop-color="#4c5d61"/></linearGradient><linearGradient id="gold-${key}" x2=".6" y2="1"><stop stop-color="#ffe6a3"/><stop offset=".5" stop-color="#efaa57"/><stop offset="1" stop-color="#a3623f"/></linearGradient><linearGradient id="kelp-${key}" x2=".4" y2="1"><stop stop-color="#c5d975"/><stop offset=".5" stop-color="#75a75d"/><stop offset="1" stop-color="#356e62"/></linearGradient><radialGradient id="pink-${key}"><stop stop-color="#ffe0bf"/><stop offset=".55" stop-color="#ef957d"/><stop offset="1" stop-color="#bd6080"/></radialGradient><filter id="soft-${key}"><feGaussianBlur stdDeviation="1.5"/></filter></defs>`;
  const rock = `url(#rock-${key})`,
    gold = `url(#gold-${key})`,
    kelp = `url(#kelp-${key})`,
    pink = `url(#pink-${key})`;
  const floor = `<ellipse cx="64" cy="101" rx="57" ry="9" fill="#154956" opacity=".19"/><path d="M15 98 Q59 86 115 98 L120 108 L11 108 Z" fill="#d5c5a0"/>`;
  const pebbles = `<ellipse cx="28" cy="98" rx="12" ry="7" fill="${rock}"/><ellipse cx="102" cy="97" rx="13" ry="7" fill="${rock}"/><circle cx="42" cy="103" r="4" fill="#a8ab97"/><circle cx="87" cy="104" r="5" fill="#b0ad90"/>`;
  const grass = `<path d="M35 100 Q23 67 33 43 Q31 76 48 99 M50 99 Q62 70 56 37 Q71 76 65 101 M72 99 Q83 64 88 42 Q93 79 82 101 M90 100 Q103 68 111 54 Q107 86 100 103" stroke="${kelp}" stroke-width="9" stroke-linecap="round" fill="none"/>`;
  let shape = "";
  switch (id) {
    case "seagrass":
      shape = `${grass}<path d="M45 100 Q38 65 43 21 Q55 54 56 95 M66 99 Q75 57 68 14 Q90 61 80 100" fill="${kelp}" stroke="#dbe69c" stroke-width="2"/>${pebbles}`;
      break;
    case "cave":
      shape = `<path d="M17 92 Q12 51 38 28 Q64 9 91 31 Q117 54 113 96 Z" fill="${rock}" stroke="#d8d6b9" stroke-width="3"/><path d="M37 96 Q37 62 56 52 Q65 47 76 53 Q96 66 94 96 Z" fill="#133f51"/><path d="M40 97 Q46 67 62 59" fill="none" stroke="#7ba29b" stroke-width="3" opacity=".55"/><path d="M15 81 Q21 46 41 33 M91 31 Q111 50 114 75" fill="none" stroke="#e5d8ad" stroke-width="5" opacity=".5"/>${pebbles}<path d="M19 84 l-5 -22 m92 23 l7 -24" stroke="${kelp}" stroke-width="5" stroke-linecap="round"/>`;
      break;
    case "ring":
      shape = `<circle cx="65" cy="58" r="37" fill="none" stroke="#976548" stroke-width="15"/><circle cx="65" cy="58" r="37" fill="none" stroke="${gold}" stroke-width="10"/><circle cx="65" cy="58" r="30" fill="#85dfe5" opacity=".1"/><path d="M28 63 Q38 33 65 26" fill="none" stroke="#fff1be" stroke-width="4" stroke-linecap="round"/><path d="M65 95 L65 105" stroke="#8f6e55" stroke-width="6"/>${pebbles}<circle cx="102" cy="65" r="6" fill="${pink}"/><circle cx="26" cy="43" r="5" fill="${pink}"/>`;
      break;
    case "arch":
      shape = `<path d="M20 97 Q20 26 64 20 Q112 26 111 97" fill="none" stroke="${rock}" stroke-width="20" stroke-linecap="round"/><path d="M22 92 Q22 37 64 27 Q102 34 108 89" fill="none" stroke="${pink}" stroke-width="8" stroke-dasharray="15 7" stroke-linecap="round"/><path d="M21 83 l-13 -22 m18 1 l-9 -17 M105 80 l15 -22 M100 59 l8 -21 M62 24 l-8 -16" stroke="${pink}" stroke-width="6" stroke-linecap="round"/>${pebbles}`;
      break;
    case "clam":
      shape = `<path d="M25 83 Q28 40 62 30 Q96 41 102 83 Q65 106 25 83 Z" fill="${pink}" stroke="#fff1d5" stroke-width="3"/><path d="M31 82 L45 40 M45 87 L54 33 M63 90 L63 31 M80 88 L73 33 M97 81 L83 41" stroke="#ffd8bb" stroke-width="4" opacity=".7"/><path d="M21 79 Q61 100 107 79 Q91 104 66 106 Q39 103 21 79" fill="${gold}"/><circle cx="65" cy="73" r="14" fill="#fff7e5" stroke="#d3cabc" stroke-width="3"/>${pebbles}`;
      break;
    case "bubbles":
      shape = `<path d="M30 94 Q27 63 54 60 Q84 48 104 91 L89 100 L38 100 Z" fill="${rock}" stroke="#dfd8b9" stroke-width="3"/><circle cx="68" cy="77" r="7" fill="#66d4df" stroke="#e0fbf5" stroke-width="2"/><circle cx="48" cy="52" r="7" fill="#9eeaf1" opacity=".8" stroke="#ecfcfa" stroke-width="2"/><circle cx="83" cy="35" r="9" fill="#97e5ee" opacity=".65" stroke="#ecfcfa" stroke-width="2"/><circle cx="58" cy="18" r="5" fill="#9ae3ec" opacity=".7"/>${pebbles}`;
      break;
    case "wreck":
      shape = `<path d="M17 68 L105 62 L91 91 Q68 106 30 90 Z" fill="#80553e" stroke="#e0ac73" stroke-width="3"/><path d="M27 73 Q61 80 99 68 M34 84 Q66 91 94 80" stroke="#c18c5e" stroke-width="5" fill="none"/><path d="M58 67 L56 26 M56 31 L100 55 L58 59 Z" fill="#e7c9a1" stroke="#704e3e" stroke-width="4"/><path d="M55 27 L46 14 M55 26 L70 18" stroke="#7e6147" stroke-width="4"/><path d="M21 80 l-10 -21 M103 81 l9 -27" stroke="${kelp}" stroke-width="7" stroke-linecap="round"/>${pebbles}`;
      break;
    case "lantern":
      shape = `<path d="M42 100 L44 33 Q48 16 71 21 L89 31" fill="none" stroke="#997049" stroke-width="7" stroke-linecap="round"/><path d="M84 31 l-2 10" stroke="#997049" stroke-width="4"/><path d="M70 42 Q84 27 99 42 L96 65 Q85 75 73 63 Z" fill="${gold}" stroke="#fff2c2" stroke-width="3"/><ellipse cx="85" cy="54" rx="22" ry="25" fill="#ffd77c" opacity=".35" filter="url(#soft-${key})"/><path d="M71 52 L99 52 M85 34 L85 71" stroke="#fff2c0" stroke-width="3" opacity=".8"/>${grass}${pebbles}`;
      break;
    default:
      shape = `${grass}${pebbles}`;
  }
  return `<svg viewBox="0 0 130 112" aria-hidden="true" focusable="false">${defs}${floor}${shape}</svg>`;
}

const ease = (t: number) => t * t * (3 - 2 * t);
function hue(hex: string): number {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map(
    (start) => parseInt(value.slice(start, start + 2), 16) / 255,
  );
  const highest = Math.max(r, g, b),
    lowest = Math.min(r, g, b);
  if (highest === lowest) return 0;
  const spread = highest - lowest;
  let sector =
    highest === r
      ? (g - b) / spread
      : highest === g
        ? (b - r) / spread + 2
        : (r - g) / spread + 4;
  if (sector < 0) sector += 6;
  return sector * 60;
}

function styleFish(element: HTMLElement, id: FishId, color?: string): void {
  const valid =
    color && CSS.supports("color", color) && /^#[\da-f]{6}$/i.test(color)
      ? color
      : FISH_COLORS[id];
  element.style.setProperty("--fish-color", valid);
  element.style.setProperty(
    "--tint-shift",
    `${Math.round(hue(valid) - hue(FISH_COLORS[id]))}deg`,
  );
}
const bezier = (a: number, b: number, c: number, d: number, t: number) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

export class Aquarium {
  onFish: (id: string) => void = () => {};
  onSlot: (slot: number) => void = () => {};

  private readonly root: HTMLDivElement;
  private readonly fishLayer: HTMLDivElement;
  private readonly slotLayer: HTMLDivElement;
  private readonly burstLayer: HTMLDivElement;
  private readonly slots: HTMLButtonElement[] = [];
  private readonly fishes = new Map<FishId, FishMotion>();
  private readonly reduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  private readonly observer: ResizeObserver;
  private readonly assetRoot = `${import.meta.env.BASE_URL}aquarium/art/`;
  private state: AquariumState = { fishIds: ["bobo"], placements: [] };
  private mode: AquariumMode = "backdrop";
  private backdropBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null = null;
  private manualReducedMotion = false;
  private selected: string | null = null;
  private boboFocusSlot: number | null = null;
  private clock = 0;
  private lastFrame = 0;
  private raf = 0;
  private randomState = 27381;
  private disposed = false;
  private timers: number[] = [];

  constructor(private readonly host: HTMLElement) {
    host.classList.add("aq-host");
    this.root = document.createElement("div");
    this.root.className = "aq-scene aq-mode-backdrop";
    this.root.innerHTML = `<div class="aq-world"></div><div class="aq-depth"></div><div class="aq-rays"></div><div class="aq-caustics"></div><div class="aq-kelp aq-kelp-left" aria-hidden="true"></div><div class="aq-kelp aq-kelp-right" aria-hidden="true"></div><div class="aq-bubble-layer" aria-hidden="true"></div><div class="aq-slot-layer"></div><div class="aq-fish-layer"></div><div class="aq-burst-layer" aria-hidden="true"></div>`;
    host.appendChild(this.root);
    this.paintBackground();
    this.fishLayer = this.root.querySelector<HTMLDivElement>(".aq-fish-layer")!;
    this.slotLayer = this.root.querySelector<HTMLDivElement>(".aq-slot-layer")!;
    this.burstLayer =
      this.root.querySelector<HTMLDivElement>(".aq-burst-layer")!;
    this.buildBubbles();
    this.buildKelp();
    this.buildSlots();
    this.root.addEventListener("click", this.handleClick);
    this.observer = new ResizeObserver(() => this.paint());
    this.observer.observe(host);
    this.reduced.addEventListener("change", this.handleMotionChange);
    document.addEventListener("visibilitychange", this.handleVisibility);
    this.setState(this.state);
    this.syncReducedMotion();
  }

  setState(next: AquariumState): void {
    if (this.disposed) return;
    const previous = new Set(
      this.state.placements.map((p) => `${p.id}:${p.slot}`),
    );
    this.state = {
      fishIds: [...next.fishIds],
      placements: next.placements.map((p) => ({ ...p })),
      fishStyles: next.fishStyles ? { ...next.fishStyles } : undefined,
    };
    const added = this.state.placements.find(
      (p) => !previous.has(`${p.id}:${p.slot}`),
    );
    if (added) this.boboFocusSlot = added.slot;
    this.syncFish();
    this.paintSlots();
  }

  setMode(mode: AquariumMode): void {
    if (this.disposed || mode === this.mode) return;
    this.mode = mode;
    this.root.classList.toggle("aq-mode-decorate", mode === "decorate");
    this.root.classList.toggle("aq-mode-backdrop", mode === "backdrop");
    this.paintBackground();
    for (const fish of this.fishes.values()) {
      const lane = this.initialPoint(fish.id);
      fish.point = { ...lane };
      fish.from = { ...lane };
      fish.to = { ...lane };
      fish.started = this.clock - fish.duration;
      fish.activity = "none";
      fish.ringStep = 0;
      fish.restNext = false;
      fish.cooldownUntil = 0;
    }
    this.paint();
  }

  setSelected(id: string | null): void {
    if (this.disposed) return;
    this.selected = id;
    this.paintSlots();
  }

  setBackdropBounds(rect: DOMRectReadOnly): void {
    if (this.disposed) return;
    const host = this.host.getBoundingClientRect();
    if (!host.width || !host.height) return;
    this.backdropBounds = {
      x: (rect.left - host.left) / host.width,
      y: (rect.top - host.top) / host.height,
      width: rect.width / host.width,
      height: rect.height / host.height,
    };
    if (this.mode !== "backdrop") return;
    for (const fish of this.fishes.values()) {
      fish.point = this.initialPoint(fish.id);
      fish.from = { ...fish.point };
      fish.to = { ...fish.point };
      fish.started = this.clock - fish.duration;
      this.paintFish(fish, this.clock);
    }
  }

  setReducedMotion(reduced: boolean): void {
    if (this.disposed) return;
    this.manualReducedMotion = reduced;
    this.syncReducedMotion();
  }

  celebrate(): void {
    if (this.disposed) return;
    const burst = document.createElement("div");
    burst.className = "aq-celebration";
    for (let i = 0; i < 32; i++) {
      const bubble = document.createElement("span");
      bubble.style.setProperty("--x", `${8 + this.rand() * 84}%`);
      bubble.style.setProperty("--delay", `${(i % 8) * 0.08}s`);
      bubble.style.setProperty("--size", `${5 + this.rand() * 14}px`);
      burst.appendChild(bubble);
    }
    this.burstLayer.appendChild(burst);
    this.timers.push(window.setTimeout(() => burst.remove(), 3100));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.reduced.removeEventListener("change", this.handleMotionChange);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.root.removeEventListener("click", this.handleClick);
    for (const timer of this.timers) clearTimeout(timer);
    this.root.remove();
    this.host.classList.remove("aq-host");
  }

  private rand(): number {
    this.randomState =
      (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }

  private paintBackground(): void {
    const world = `${this.assetRoot}underwater-world.webp`;
    const image =
      this.mode === "decorate"
        ? `url("${this.assetRoot}underwater-aquarium.webp"), url("${world}")`
        : `url("${world}")`;
    this.root.querySelector<HTMLElement>(".aq-world")!.style.backgroundImage =
      `${image}, linear-gradient(160deg,#99e3e7,#1e728a 72%,#174b64)`;
  }

  private buildBubbles(): void {
    const layer = this.root.querySelector<HTMLElement>(".aq-bubble-layer")!;
    const columns = [5, 9, 15, 82, 88, 94];
    for (let i = 0; i < 25; i++) {
      const bubble = document.createElement("i");
      bubble.className = "aq-bubble";
      bubble.style.setProperty(
        "--x",
        `${columns[i % columns.length] + (this.rand() - 0.5) * 5}%`,
      );
      bubble.style.setProperty("--size", `${3 + this.rand() * 9}px`);
      bubble.style.setProperty("--duration", `${8 + this.rand() * 8}s`);
      bubble.style.setProperty("--delay", `${-this.rand() * 17}s`);
      layer.appendChild(bubble);
    }
  }

  private buildKelp(): void {
    const kelp = `<svg viewBox="0 0 170 390" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="aq-leaf" x2="1" y2="0"><stop stop-color="#174f58"/><stop offset=".5" stop-color="#2e8d78"/><stop offset="1" stop-color="#9bc27e"/></linearGradient></defs><path d="M17 390 Q2 298 35 227 Q54 170 30 73 Q65 156 58 237 Q39 317 63 390 Z" fill="url(#aq-leaf)"/><path d="M63 390 Q87 293 72 229 Q47 126 91 42 Q74 160 101 220 Q128 298 110 390 Z" fill="url(#aq-leaf)"/><path d="M102 390 Q105 312 131 256 Q152 210 135 126 Q170 221 149 284 Q128 344 151 390 Z" fill="url(#aq-leaf)"/></svg>`;
    this.root.querySelector<HTMLElement>(".aq-kelp-left")!.innerHTML = kelp;
    this.root.querySelector<HTMLElement>(".aq-kelp-right")!.innerHTML = kelp;
  }

  private buildSlots(): void {
    SLOTS.forEach((point, slot) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "aq-slot";
      button.dataset.slot = String(slot);
      button.style.setProperty("--x", `${point.x * 100}%`);
      button.style.setProperty("--y", `${point.y * 100}%`);
      button.style.setProperty(
        "--depth-scale",
        slot < 3 ? "0.82" : slot < 6 ? "1" : "1.1",
      );
      this.slotLayer.appendChild(button);
      this.slots.push(button);
    });
  }

  private paintSlots(): void {
    this.slots.forEach((button, slot) => {
      const placement = this.state.placements.find((p) => p.slot === slot);
      button.classList.toggle("aq-slot-empty", !placement);
      button.classList.toggle("aq-slot-ready", !placement && !!this.selected);
      button.classList.toggle("aq-slot-filled", !!placement);
      button.setAttribute(
        "aria-label",
        placement
          ? `${DECOR_NAMES[placement.id] ?? "Dekoration"} på plads ${slot + 1}. Tryk for at flytte eller undersøge.`
          : `Tom dekorationsplads ${slot + 1}${this.selected ? `: placér ${DECOR_NAMES[this.selected] ?? "dekoration"}` : ""}`,
      );
      const shown = placement?.id;
      button.style.setProperty(
        "--object-scale",
        shown === "cave" ? "1.28" : shown === "ring" ? "1.15" : "1",
      );
      const rotation = placement?.rotation ?? 0;
      const quarter = Number.isFinite(rotation)
        ? ((Math.round(rotation) % 4) + 4) % 4
        : 0;
      button.style.setProperty(
        "--decor-flip",
        quarter === 2 ? "-1" : quarter === 1 || quarter === 3 ? ".88" : "1",
      );
      button.style.setProperty(
        "--decor-skew",
        `${quarter === 1 ? -3 : quarter === 3 ? 3 : 0}deg`,
      );
      button.innerHTML = shown
        ? `<span class="aq-decor-art"><span class="aq-decor-svg">${decorArt(shown, slot)}</span><img class="aq-decor-sprite" src="${this.assetRoot}decor-${shown}.webp" alt="" draggable="false"></span>`
        : '<span class="aq-slot-empty-mark" aria-hidden="true">＋</span>';
      const sprite = button.querySelector<HTMLImageElement>(".aq-decor-sprite");
      if (sprite) {
        const finish = () => {
          if (!sprite.naturalWidth) {
            sprite.remove();
            return;
          }
          sprite.classList.add("aq-decor-sprite-ready");
          sprite.previousElementSibling?.classList.add("aq-decor-svg-hidden");
        };
        sprite.addEventListener("load", finish, { once: true });
        sprite.addEventListener("error", () => sprite.remove(), { once: true });
        if (sprite.complete) finish();
      }
    });
  }

  private initialPoint(id: FishId): XY {
    if (this.mode === "backdrop") {
      const [lo, hi] = BACKDROP_LANES[id];
      return this.backdropPoint({
        x: { bobo: 0.27, sky: 0.75, glimt: 0.52, plet: 0.24 }[id],
        y: (lo + hi) / 2,
      });
    }
    return {
      bobo: { x: 0.27, y: 0.37 },
      sky: { x: 0.74, y: 0.36 },
      glimt: { x: 0.62, y: 0.51 },
      plet: { x: 0.25, y: 0.66 },
    }[id];
  }

  private backdropArea(): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    if (this.backdropBounds) return this.backdropBounds;
    const landscape = this.host.clientWidth > this.host.clientHeight;
    return landscape
      ? { x: 0.02, y: 0.19, width: 0.41, height: 0.58 }
      : { x: 0.03, y: 0.075, width: 0.94, height: 0.31 };
  }

  private backdropPoint(local: XY): XY {
    const area = this.backdropArea();
    return {
      x: area.x + area.width * local.x,
      y: area.y + area.height * local.y,
    };
  }

  private syncFish(): void {
    const wanted = new Set(
      this.state.fishIds.filter((id): id is FishId =>
        FISH_IDS.includes(id as FishId),
      ),
    );
    for (const [id, fish] of this.fishes)
      if (!wanted.has(id)) {
        fish.element.remove();
        this.fishes.delete(id);
      }
    for (const id of wanted) {
      const style = this.state.fishStyles?.[id];
      const name = style?.name?.trim() || FISH_NAMES[id];
      const favorite = style?.favorite
        ? (DECOR_NAMES[style.favorite] ?? style.favorite)
        : null;
      const existing = this.fishes.get(id);
      if (existing) {
        existing.element.setAttribute(
          "aria-label",
          `Se ${name}${favorite ? `, kan lide ${favorite}` : ""}`,
        );
        styleFish(existing.element, id, style?.color);
        continue;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = `aq-fish aq-fish-${id}`;
      button.dataset.fish = id;
      button.setAttribute(
        "aria-label",
        `Se ${name}${favorite ? `, kan lide ${favorite}` : ""}`,
      );
      styleFish(button, id, style?.color);
      button.innerHTML = `<span class="aq-fish-figure"><img class="aq-fish-body" alt="" draggable="false"/><img class="aq-fish-tail" alt="" draggable="false"/><span class="aq-fish-fin" aria-hidden="true"></span></span>`;
      const source = `${this.assetRoot}fish-${id}.webp`;
      button.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
        img.src = source;
        img.addEventListener("error", () => {
          if (img.dataset.fallback) return;
          img.dataset.fallback = "true";
          img.src = fallbackFish(id);
        });
      });
      this.fishLayer.appendChild(button);
      const point = this.initialPoint(id);
      const motion: FishMotion = {
        element: button,
        id,
        from: { ...point },
        to: { ...point },
        point: { ...point },
        started: this.clock - 10,
        duration: 7,
        curve: 0,
        facing: id === "sky" || id === "plet" ? -1 : 1,
        ringStep: 0,
        activity: "none",
        cooldownUntil: 0,
        restNext: false,
      };
      this.fishes.set(id, motion);
      this.paintFish(motion, 0);
    }
  }

  private decoration(
    id: string,
  ): { placement: AquariumPlacement; point: XY } | null {
    const placement = this.state.placements.find(
      (p) =>
        p.id === id &&
        Number.isInteger(p.slot) &&
        p.slot >= 0 &&
        p.slot < SLOTS.length,
    );
    return placement ? { placement, point: SLOTS[placement.slot] } : null;
  }

  private nextTarget(fish: FishMotion): void {
    fish.from = { ...fish.point };
    fish.started = this.clock;
    fish.duration = 5 + this.rand() * 7;
    fish.curve =
      (this.rand() - 0.5) *
      (this.mode === "decorate" ? 0.13 : this.backdropArea().height * 0.13);
    if (this.mode === "backdrop") {
      const [lo, hi] = BACKDROP_LANES[fish.id];
      fish.to = this.backdropPoint({
        x: 0.24 + this.rand() * 0.52,
        y: lo + this.rand() * (hi - lo),
      });
      fish.activity = "none";
      return;
    }
    if (fish.activity === "cave-enter") {
      fish.activity = "cave-rest";
      fish.to = { ...fish.point };
      fish.duration = 1.4 + this.rand() * 1.2;
      fish.curve = 0;
      return;
    }
    if (fish.activity === "cave-rest") {
      fish.activity = "none";
      fish.cooldownUntil = this.clock + 10 + this.rand() * 8;
      const cave = this.decoration("cave");
      fish.to = cave
        ? {
            x: Math.max(
              0.18,
              Math.min(0.82, cave.point.x + (this.rand() < 0.5 ? -0.15 : 0.15)),
            ),
            y: Math.max(0.2, cave.point.y - 0.14),
          }
        : { x: 0.7, y: 0.37 };
      fish.duration = 2.8;
      return;
    }
    if (fish.activity === "ring-loop") {
      const ring = this.decoration("ring");
      if (ring && fish.ringStep < 4) {
        const pass = fish.ringStep++;
        fish.to = {
          x: ring.point.x + (pass % 2 ? 0.105 : -0.105),
          y: ring.point.y - 0.025,
        };
        fish.duration = 2.1;
        return;
      }
      fish.activity = "none";
      fish.cooldownUntil = this.clock + 10 + this.rand() * 8;
      fish.restNext = this.rand() < 0.35;
    }
    if (fish.restNext) {
      fish.restNext = false;
      fish.to = { ...fish.point };
      fish.duration = 1.2 + this.rand() * 1.3;
      fish.curve = 0;
      return;
    }
    if (fish.id === "bobo" && this.boboFocusSlot !== null) {
      const point = SLOTS[this.boboFocusSlot];
      fish.to = { x: point.x + 0.05, y: point.y - 0.09 };
      fish.duration = 4.5;
      fish.restNext = this.rand() < 0.72;
      this.boboFocusSlot = null;
      return;
    }
    const favorite = this.state.fishStyles?.[fish.id]?.favorite;
    const custom = favorite ? this.decoration(favorite) : null;
    if (custom && this.clock >= fish.cooldownUntil && this.rand() < 0.72) {
      fish.to = { x: custom.point.x + 0.045, y: custom.point.y - 0.075 };
      fish.duration = 4.2 + this.rand() * 1.8;
      fish.restNext = this.rand() < 0.7;
      fish.cooldownUntil = this.clock + 10 + this.rand() * 8;
      return;
    }
    if (!custom && fish.id === "bobo") {
      const arch = this.decoration("arch");
      if (arch && this.clock >= fish.cooldownUntil && this.rand() < 0.62) {
        fish.to = { x: arch.point.x + 0.04, y: arch.point.y - 0.075 };
        fish.duration = 4.5;
        fish.restNext = this.rand() < 0.7;
        fish.cooldownUntil = this.clock + 10 + this.rand() * 8;
        return;
      }
    }
    if (!custom && fish.id === "sky") {
      const cave = this.decoration("cave");
      if (cave && this.clock >= fish.cooldownUntil && this.rand() < 0.68) {
        fish.to = { x: cave.point.x, y: cave.point.y - 0.025 };
        fish.duration = 4.4;
        fish.activity = "cave-enter";
        return;
      }
    }
    if (!custom && fish.id === "glimt") {
      const ring = this.decoration("ring");
      if (ring && this.clock >= fish.cooldownUntil && this.rand() < 0.72) {
        fish.activity = "ring-loop";
        fish.ringStep = 1;
        fish.to = { x: ring.point.x - 0.105, y: ring.point.y - 0.025 };
        fish.duration = 2;
        return;
      }
    }
    if (!custom && fish.id === "plet") {
      const bubbles = this.decoration("bubbles");
      if (bubbles && this.clock >= fish.cooldownUntil && this.rand() < 0.72) {
        fish.to = { x: bubbles.point.x + 0.035, y: bubbles.point.y - 0.07 };
        fish.duration = 5.5;
        fish.restNext = this.rand() < 0.72;
        fish.cooldownUntil = this.clock + 10 + this.rand() * 8;
        return;
      }
    }
    fish.to = {
      x: 0.15 + this.rand() * 0.7,
      y:
        fish.id === "plet"
          ? 0.65 + this.rand() * 0.14
          : 0.29 + this.rand() * 0.38,
    };
  }

  private paintFish(fish: FishMotion, time: number): void {
    fish.element.style.left = `${fish.point.x * 100}%`;
    fish.element.style.top = `${fish.point.y * 100}%`;
    fish.element.style.setProperty("--facing", String(fish.facing));
    fish.element.style.setProperty(
      "--pitch",
      `${Math.sin(time * 2.1 + FISH_IDS.indexOf(fish.id)) * 2.2}deg`,
    );
    const cave = fish.id === "sky" ? this.decoration("cave") : null;
    const nearCave =
      !!cave &&
      this.mode === "decorate" &&
      (fish.activity === "cave-enter" || fish.activity === "cave-rest") &&
      Math.hypot(
        fish.point.x - cave.point.x,
        fish.point.y - (cave.point.y - 0.025),
      ) < 0.085;
    fish.element.classList.toggle("aq-fish-behind", nearCave);
  }

  private tick = (now: number): void => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.clock += dt;
    for (const fish of this.fishes.values()) {
      let t = (this.clock - fish.started) / fish.duration;
      if (t >= 1) {
        fish.point = { ...fish.to };
        this.nextTarget(fish);
        t = 0;
      }
      const eased = ease(Math.max(0, Math.min(1, t)));
      const dx = fish.to.x - fish.from.x,
        dy = fish.to.y - fish.from.y;
      const c1x = fish.from.x + dx * 0.34,
        c2x = fish.to.x - dx * 0.34;
      const c1y = fish.from.y + dy * 0.13 + fish.curve;
      const c2y = fish.to.y - dy * 0.13 - fish.curve;
      fish.point.x = bezier(fish.from.x, c1x, c2x, fish.to.x, eased);
      fish.point.y =
        bezier(fish.from.y, c1y, c2y, fish.to.y, eased) +
        Math.sin(this.clock * 2.2 + FISH_IDS.indexOf(fish.id)) * 0.003;
      if (Math.abs(dx) > 0.016) fish.facing = dx > 0 ? 1 : -1;
      this.paintFish(fish, this.clock);
    }
  };

  private start(): void {
    if (
      this.disposed ||
      document.hidden ||
      this.reduced.matches ||
      this.manualReducedMotion ||
      this.raf
    )
      return;
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private handleVisibility = (): void => {
    if (document.hidden) this.stop();
    else this.start();
  };

  private handleMotionChange = (): void => {
    this.syncReducedMotion();
  };

  private syncReducedMotion(): void {
    const reduced = this.reduced.matches || this.manualReducedMotion;
    this.root.classList.toggle("aq-static", reduced);
    if (reduced) this.stop();
    else this.start();
  }

  private handleClick = (event: MouseEvent): void => {
    const target = event.target as Element;
    const fish = target.closest<HTMLElement>("[data-fish]");
    if (fish?.dataset.fish) {
      fish.classList.remove("aq-fish-greeting");
      void fish.offsetWidth;
      fish.classList.add("aq-fish-greeting");
      this.timers.push(
        window.setTimeout(
          () => fish.classList.remove("aq-fish-greeting"),
          2000,
        ),
      );
      this.onFish(fish.dataset.fish);
      return;
    }
    const slot = target.closest<HTMLElement>("[data-slot]");
    if (slot?.dataset.slot !== undefined)
      this.onSlot(Number(slot.dataset.slot));
  };

  private paint(): void {
    for (const fish of this.fishes.values()) this.paintFish(fish, this.clock);
  }
}
