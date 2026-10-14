import type { Action, BoardEvent, BoardState, Tile } from "../core";
import { TYPE_NAMES } from "../content/catalog";
import { getLevel } from "../content/levels";
import { coralArt, gemArt, getGemColors } from "./gems";
import "./board-expansion.css";

type Snapshot = Pick<
  BoardState,
  | "tiles"
  | "blockers"
  | "sand"
  | "voids"
  | "rocks"
  | "clams"
  | "bubbles"
  | "gravity"
> &
  Partial<Pick<BoardState, "levelId">>;
const terrainArt = (name: string): string =>
  `${import.meta.env.BASE_URL}aquarium/art/terrain-${name}.webp`;
const rockArt = terrainArt("rock"),
  closedClamArt = terrainArt("clam-closed"),
  crackedClamArt = terrainArt("clam-cracked");
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  star: boolean;
};
type LightThread = {
  x: number;
  y: number;
  tx: number;
  ty: number;
  life: number;
  max: number;
};
// Keep a cascade at its current stage while the player switches apps.
// The persisted turn intent remains recoverable even if the browser is closed.
const pause = (ms: number) =>
  new Promise<void>((resolve) =>
    window.setTimeout(() => {
      if (!document.hidden) {
        resolve();
        return;
      }
      const resume = () => {
        if (!document.hidden) {
          document.removeEventListener("visibilitychange", resume);
          resolve();
        }
      };
      document.addEventListener("visibilitychange", resume);
    }, ms),
  );

export class BoardView {
  onAction: (action: Action) => void = () => {};
  onSelect: (cell: number | null) => void = () => {};
  onEffect: (kind: "match" | "cascade" | "special", chain: number) => void =
    () => {};
  onClear: (event: BoardEvent) => void = () => {};
  reducedMotion = false;
  private inputLocked = false;
  get locked(): boolean {
    return this.inputLocked;
  }
  set locked(value: boolean) {
    this.inputLocked = value;
    this.host.setAttribute("aria-busy", String(value));
    if (this.compass) this.showCurrent(this.snapshot);
  }
  private snapshot: Snapshot = { tiles: [], blockers: [], sand: [] };
  private pieces = new Map<number, HTMLButtonElement>();
  private cells: HTMLDivElement[] = [];
  private contour: SVGPathElement;
  private contourFill: SVGPathElement;
  private compass: HTMLDivElement;
  private terrainSignature = "";
  private levelId = 1;
  private layer: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private threads: LightThread[] = [];
  private selected: number | null = null;
  private frame = 0;
  private drag: {
    cell: number;
    x: number;
    y: number;
    pointerId: number;
    dx: number;
    dy: number;
  } | null = null;
  private gestureStarts = new Map<number, string>();
  private reactingNeighbour: number | null = null;
  private cellSize = 44;
  private resizeObserver: ResizeObserver;
  private lastTime = performance.now();

  constructor(private host: HTMLElement) {
    host.innerHTML =
      '<svg class="board-contour" viewBox="0 0 8 8" aria-hidden="true"><path class="contour-fill"/><path class="contour-edge"/></svg><div class="board-grid" aria-hidden="true"></div><div class="board-pieces" role="group" aria-label="Spilleplade, otte gange otte felter"></div><canvas class="board-effects" aria-hidden="true"></canvas><div class="board-current" hidden><span aria-hidden="true">↓</span><small>Strøm</small></div><div class="chain-label" aria-live="polite"></div>';
    this.contour = host.querySelector(".contour-edge")!;
    this.contourFill = host.querySelector(".contour-fill")!;
    this.compass = host.querySelector(".board-current")!;
    const grid = host.querySelector<HTMLElement>(".board-grid")!;
    for (let i = 0; i < 64; i++) {
      const cell = document.createElement("div");
      cell.className = "board-cell";
      grid.appendChild(cell);
      this.cells.push(cell);
    }
    this.layer = host.querySelector(".board-pieces")!;
    this.canvas = host.querySelector("canvas")!;
    this.context = this.canvas.getContext("2d")!;
    host.addEventListener("pointerdown", this.pointerDown);
    host.addEventListener("pointermove", this.pointerMove);
    host.addEventListener("pointerup", this.pointerUp);
    host.addEventListener("pointercancel", this.cancelDrag);
    host.addEventListener("lostpointercapture", this.cancelDrag);
    this.layer.addEventListener("keydown", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
        ".gem[data-cell]",
      );
      if (!target || this.locked) return;
      const cell = Number(target.dataset.cell);
      const offsets: Record<string, number> = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -8,
        ArrowDown: 8,
      };
      if (event.key in offsets) {
        event.preventDefault();
        this.onAction({
          kind: "swap",
          from: cell,
          to: cell + offsets[event.key],
        });
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.tap(cell);
      }
    });
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(host);
    this.resize();
    this.frame = requestAnimationFrame(this.tick);
  }

  private resize = (): void => {
    this.cellSize = this.host.clientWidth / 8;
    const ratio = Math.min(devicePixelRatio || 1, 1.5),
      size = this.host.clientWidth;
    this.canvas.width = size * ratio;
    this.canvas.height = size * ratio;
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.placePieces();
  };

  private placePieces(): void {
    this.snapshot.tiles.forEach((tile, cell) => {
      if (!tile) return;
      const node = this.pieces.get(tile.id);
      if (node) {
        node.style.width = `${this.cellSize}px`;
        node.style.height = `${this.cellSize}px`;
        node.style.transform = this.transform(cell);
      }
    });
  }
  private transform(cell: number, dx = 0, dy = 0): string {
    return `translate3d(${(cell % 8) * this.cellSize + dx}px,${Math.floor(cell / 8) * this.cellSize + dy}px,0)`;
  }

  private terrainAt(snapshot: Snapshot, cell: number): boolean {
    return (
      cell < 0 ||
      cell >= 64 ||
      Boolean(
        snapshot.voids?.[cell] ||
          snapshot.rocks?.[cell] ||
          snapshot.blockers[cell] ||
          snapshot.clams?.[cell],
      )
    );
  }

  private sourceTransform(cell: number, snapshot: Snapshot): string {
    const gravity = snapshot.gravity ?? "down";
    const step =
      gravity === "down"
        ? -8
        : gravity === "up"
          ? 8
          : gravity === "left"
            ? 1
            : -1;
    let source = cell;
    while (
      this.adjacent(source, source + step) &&
      !this.terrainAt(snapshot, source + step)
    )
      source += step;
    return this.transform(
      source,
      gravity === "left"
        ? this.cellSize
        : gravity === "right"
          ? -this.cellSize
          : 0,
      gravity === "down"
        ? -this.cellSize
        : gravity === "up"
          ? this.cellSize
          : 0,
    );
  }

  private showTerrain(snapshot: Snapshot): void {
    const shape = (snapshot.voids ?? []).map(Number).join("");
    if (shape !== this.terrainSignature) {
      this.terrainSignature = shape;
      const shaped = !!snapshot.voids?.some(Boolean);
      this.host.classList.toggle("board-shaped", shaped);
      this.host.parentElement?.classList.toggle("shaped-rim", shaped);
      const fill: string[] = [],
        edges: string[] = [];
      for (let cell = 0; cell < 64; cell++) {
        if (snapshot.voids?.[cell]) continue;
        const x = cell % 8,
          y = Math.floor(cell / 8);
        fill.push(`M${x} ${y}h1v1h-1Z`);
        if (y === 0 || snapshot.voids?.[cell - 8]) edges.push(`M${x} ${y}h1`);
        if (y === 7 || snapshot.voids?.[cell + 8])
          edges.push(`M${x} ${y + 1}h1`);
        if (x === 0 || snapshot.voids?.[cell - 1]) edges.push(`M${x} ${y}v1`);
        if (x === 7 || snapshot.voids?.[cell + 1])
          edges.push(`M${x + 1} ${y}v1`);
      }
      this.contour.setAttribute("d", edges.join(""));
      this.contourFill.setAttribute("d", fill.join(""));
    }
    const direction = snapshot.gravity ?? "down";
    if (this.host.dataset.gravity && this.host.dataset.gravity !== direction) {
      this.compass.classList.remove("current-changing");
      void this.compass.offsetWidth;
      this.compass.classList.add("current-changing");
    }
    this.host.dataset.gravity = direction;
    this.host.classList.toggle("board-reduced", this.reducedMotion);
    // The compass is useful once currents appear, and not another control to learn in early levels.
    const showCompass =
      direction !== "down" || !!getLevel(this.levelId).currentCycle;
    this.compass.hidden = !showCompass;
    this.showCurrent(snapshot);
    this.cells.forEach((node, i) => {
      const hp = snapshot.clams?.[i] ?? 0;
      const kind = snapshot.voids?.[i]
        ? "void"
        : snapshot.rocks?.[i]
          ? "rock"
          : hp
            ? `clam-${hp}`
            : snapshot.blockers[i]
              ? "coral"
              : snapshot.bubbles?.[i]
                ? "bubble"
                : "normal";
      node.classList.toggle("sand", !!snapshot.sand[i]);
      node.classList.toggle("blocked", !!snapshot.blockers[i]);
      node.classList.toggle("void-cell", kind === "void");
      node.classList.toggle("rock-cell", kind === "rock");
      node.classList.toggle("clam-cell", hp > 0);
      node.classList.toggle("clam-cracked", hp === 1);
      node.classList.toggle("bubble-cell", !!snapshot.bubbles?.[i]);
      node.dataset.cell = String(i);
      if (node.dataset.terrain === kind) return;
      node.dataset.terrain = kind;
      node.replaceChildren();
      const art =
        kind === "rock"
          ? rockArt
          : hp
            ? hp === 2
              ? closedClamArt
              : crackedClamArt
            : kind === "coral"
              ? coralArt
              : null;
      if (art) {
        const image = document.createElement("img");
        image.src = art;
        image.alt = "";
        node.appendChild(image);
      }
      if (hp) {
        const pips = document.createElement("span");
        pips.className = "clam-pips";
        pips.innerHTML = `<i></i>${hp > 1 ? "<i></i>" : ""}`;
        node.appendChild(pips);
      }
      if (kind === "bubble") {
        const stream = document.createElement("span");
        stream.className = "bubble-vent";
        stream.innerHTML = "<i></i><i></i><i></i>";
        node.appendChild(stream);
      }
    });
    this.layer.setAttribute(
      "aria-label",
      `Spilleplade med ${64 - (snapshot.voids?.filter(Boolean).length ?? 0)} felter, ${snapshot.rocks?.filter(Boolean).length ?? 0} faste sten og ${snapshot.clams?.filter(Boolean).length ?? 0} muslinger.`,
    );
  }

  private showCurrent(snapshot: Snapshot): void {
    const cycle = getLevel(this.levelId).currentCycle;
    const current = snapshot.gravity ?? "down";
    const preview = Boolean(cycle && !this.locked);
    const direction = preview
      ? cycle![(cycle!.indexOf(current) + 1) % cycle!.length]
      : current;
    this.compass.querySelector("span")!.textContent = {
      down: "↓",
      up: "↑",
      left: "←",
      right: "→",
    }[direction];
    this.compass.querySelector("small")!.textContent = preview
      ? "Næste strøm"
      : "Strøm";
    this.compass.dataset.direction = direction;
    this.compass.setAttribute(
      "aria-label",
      `${preview ? "Ved næste træk går strømmen" : "Strømmen går"} ${{ down: "ned", up: "op", left: "mod venstre", right: "mod højre" }[direction]}`,
    );
  }

  show(snapshot: Snapshot, falling = false): void {
    const previous = new Map(
      this.snapshot.tiles.flatMap((tile, cell) =>
        tile ? [[tile.id, cell] as const] : [],
      ),
    );
    this.snapshot = snapshot;
    if (snapshot.levelId !== undefined) this.levelId = snapshot.levelId;
    this.showTerrain(snapshot);
    const ids = new Set(
      snapshot.tiles.flatMap((tile) => (tile ? [tile.id] : [])),
    );
    for (const [id, node] of this.pieces)
      if (!ids.has(id)) {
        node.remove();
        this.pieces.delete(id);
      }
    snapshot.tiles.forEach((tile, cell) => {
      if (!tile) return;
      let node = this.pieces.get(tile.id);
      if (!node) {
        node = document.createElement("button");
        node.type = "button";
        node.className = "gem";
        node.innerHTML =
          '<img draggable="false" alt=""/><span class="gem-sheen"></span>';
        this.pieces.set(tile.id, node);
        this.layer.appendChild(node);
      }
      node.dataset.cell = String(cell);
      node.dataset.tileId = String(tile.id);
      node.setAttribute(
        "aria-label",
        `Række ${Math.floor(cell / 8) + 1}, felt ${(cell % 8) + 1}: ${tile.special === "color" ? "farveperle" : tile.special === "bomb" ? "boblebombe" : tile.special ? "stråle" : TYPE_NAMES[tile.type]}`,
      );
      node.classList.toggle("special", !!tile.special);
      node.classList.toggle("selected", cell === this.selected);
      node.querySelector("img")!.src = gemArt(tile);
      node.style.width = `${this.cellSize}px`;
      node.style.height = `${this.cellSize}px`;
      const end = this.transform(cell),
        oldCell = previous.get(tile.id);
      if (falling && !this.reducedMotion && oldCell !== cell) {
        const start =
          oldCell !== undefined
            ? this.transform(oldCell)
            : this.sourceTransform(cell, snapshot);
        const direction = snapshot.gravity ?? "down";
        const horizontal = direction === "left" || direction === "right";
        const stagger = horizontal
          ? direction === "left"
            ? 7 - (cell % 8)
            : cell % 8
          : direction === "up"
            ? 7 - Math.floor(cell / 8)
            : Math.floor(cell / 8);
        node.animate(
          [
            { transform: start, opacity: oldCell === undefined ? 0 : 1 },
            { transform: end, opacity: 1, offset: 0.82 },
            {
              transform: `${end} scale(${horizontal ? ".94,1.05" : "1.05,.94"})`,
              offset: 0.91,
            },
            { transform: end },
          ],
          {
            duration: 320 + stagger * 12,
            easing: "cubic-bezier(.25,.5,.4,1)",
          },
        );
      }
      node.style.transform = end;
    });
  }

  select(cell: number | null): void {
    this.selected = cell;
    for (const node of this.pieces.values()) {
      node.classList.toggle("selected", Number(node.dataset.cell) === cell);
      node.classList.remove("hint");
    }
    this.onSelect(cell);
  }
  hint(action: Action | null): void {
    for (const node of this.pieces.values()) node.classList.remove("hint");
    if (!action) return;
    const cells =
      action.kind === "swap" ? [action.from, action.to] : [action.cell];
    cells.forEach((cell) => {
      const tile = this.snapshot.tiles[cell];
      if (tile) this.pieces.get(tile.id)?.classList.add("hint");
    });
  }
  private tap(cell: number): void {
    if (this.selected === cell) this.select(null);
    else if (this.selected !== null && this.adjacent(this.selected, cell))
      this.onAction({ kind: "swap", from: this.selected, to: cell });
    else this.select(cell);
  }
  private adjacent(a: number, b: number): boolean {
    return (
      b >= 0 &&
      b < 64 &&
      Math.abs((a % 8) - (b % 8)) +
        Math.abs(Math.floor(a / 8) - Math.floor(b / 8)) ===
        1
    );
  }
  private pointerDown = (event: PointerEvent): void => {
    if (this.locked || this.drag) return;
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
      ".gem[data-cell]",
    );
    if (!target) return;
    event.preventDefault();
    this.host.setPointerCapture(event.pointerId);
    const cell = Number(target.dataset.cell);
    this.gestureStarts.clear();
    this.drag = {
      cell,
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      dx: 0,
      dy: 0,
    };
    target.classList.add("held");
  };
  private pointerMove = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.x,
      dy = event.clientY - drag.y;
    drag.dx = dx;
    drag.dy = dy;
    const tile = this.snapshot.tiles[drag.cell];
    if (!tile) return;
    const node = this.pieces.get(tile.id)!;
    const horizontal = Math.abs(dx) > Math.abs(dy);
    const offset = horizontal ? Math.sign(dx) : Math.sign(dy) * 8;
    const neighbour = drag.cell + offset;
    const neighbourTile =
      this.adjacent(drag.cell, neighbour) &&
      !this.terrainAt(this.snapshot, neighbour)
        ? this.snapshot.tiles[neighbour]
        : null;
    if (
      this.reactingNeighbour !== null &&
      this.reactingNeighbour !== neighbour
    ) {
      const old = this.snapshot.tiles[this.reactingNeighbour];
      const other = old ? this.pieces.get(old.id) : null;
      if (other) {
        other.style.transform = this.transform(this.reactingNeighbour);
        other.classList.remove("drag-neighbour");
      }
      this.reactingNeighbour = null;
    }
    const limit = neighbourTile ? this.cellSize : this.cellSize * 0.22;
    const travel = Math.max(-limit, Math.min(limit, horizontal ? dx : dy));
    node.style.transform = this.transform(
      drag.cell,
      horizontal ? travel : 0,
      horizontal ? 0 : travel,
    );
    if (neighbourTile) {
      this.reactingNeighbour = neighbour;
      const other = this.pieces.get(neighbourTile.id)!;
      other.classList.add("drag-neighbour");
      other.style.transform = this.transform(
        neighbour,
        horizontal ? -travel * 0.3 : 0,
        horizontal ? 0 : -travel * 0.3,
      );
    }
  };
  private pointerUp = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const held = this.snapshot.tiles[drag.cell];
    // Continue from the finger's exact position instead of snapping the jewel
    // back to its original cell for the first frame of the swap animation.
    if (held)
      this.gestureStarts.set(
        held.id,
        this.pieces.get(held.id)!.style.transform,
      );
    if (this.reactingNeighbour !== null) {
      const neighbour = this.snapshot.tiles[this.reactingNeighbour];
      if (neighbour)
        this.gestureStarts.set(
          neighbour.id,
          this.pieces.get(neighbour.id)!.style.transform,
        );
    }
    this.cancelDrag();
    if (Math.max(Math.abs(drag.dx), Math.abs(drag.dy)) >= 12) {
      const offset =
        Math.abs(drag.dx) > Math.abs(drag.dy)
          ? Math.sign(drag.dx)
          : Math.sign(drag.dy) * 8;
      if (this.adjacent(drag.cell, drag.cell + offset))
        this.onAction({
          kind: "swap",
          from: drag.cell,
          to: drag.cell + offset,
        });
    } else this.tap(drag.cell);
  };
  private cancelDrag = (): void => {
    const pointerId = this.drag?.pointerId;
    this.drag = null;
    this.reactingNeighbour = null;
    if (pointerId !== undefined && this.host.hasPointerCapture(pointerId))
      this.host.releasePointerCapture(pointerId);
    for (const node of this.pieces.values())
      node.classList.remove("held", "drag-neighbour");
    this.placePieces();
  };

  async invalid(action: Action): Promise<void> {
    if (action.kind !== "swap") return;
    const a = this.snapshot.tiles[action.from],
      b = this.snapshot.tiles[action.to];
    if (!a || !b || !this.adjacent(action.from, action.to)) return;
    for (const [tile, from, to] of [
      [a, action.from, action.to],
      [b, action.to, action.from],
    ] as const) {
      this.pieces.get(tile.id)?.animate(
        [
          {
            transform: this.gestureStarts.get(tile.id) ?? this.transform(from),
          },
          { transform: this.transform(to), offset: 0.45 },
          { transform: this.transform(from) },
        ],
        { duration: this.reducedMotion ? 120 : 330, easing: "ease-in-out" },
      );
    }
    this.gestureStarts.clear();
    await pause(this.reducedMotion ? 120 : 330);
  }

  async play(events: BoardEvent[]): Promise<void> {
    this.host.classList.toggle("board-reduced", this.reducedMotion);
    this.select(null);
    let chain = 0;
    for (const event of events) {
      if (event.kind === "swap") {
        const old = new Map(
          this.snapshot.tiles.flatMap((tile, cell) =>
            tile ? [[tile.id, cell] as const] : [],
          ),
        );
        this.show(event);
        event.tiles.forEach((tile, cell) => {
          if (tile && old.has(tile.id) && old.get(tile.id) !== cell)
            this.pieces.get(tile.id)?.animate(
              [
                {
                  transform:
                    this.gestureStarts.get(tile.id) ??
                    this.transform(old.get(tile.id)!),
                },
                { transform: this.transform(cell) },
              ],
              {
                duration: this.reducedMotion ? 60 : 170,
                easing: "cubic-bezier(.2,.7,.2,1)",
              },
            );
        });
        this.gestureStarts.clear();
        await pause(this.reducedMotion ? 60 : 175);
      } else if (event.kind === "clear") {
        chain++;
        const special = !!event.activated?.length;
        this.onEffect(
          special ? "special" : chain > 1 ? "cascade" : "match",
          chain,
        );
        this.terrainImpact(event);
        for (const { cell, tile } of event.removed ?? []) {
          this.burst(
            cell,
            getGemColors(this.levelId)[tile.type],
            special ? 10 : 6,
          );
          this.pieces.get(tile.id)?.animate(
            this.reducedMotion
              ? [{ opacity: 1 }, { opacity: 0 }]
              : [
                  { transform: `${this.transform(cell)} scale(1)` },
                  {
                    transform: `${this.transform(cell)} scale(1.2)`,
                    offset: 0.25,
                  },
                  {
                    transform: `${this.transform(cell)} scale(.1)`,
                    opacity: 0,
                  },
                ],
            {
              duration: this.reducedMotion ? 55 : 210,
              easing: "ease-in",
              fill: "forwards",
            },
          );
        }
        if (event.combo) this.comboEffect(event.combo);
        (event.activated ?? []).forEach(({ cell, tile }, index) => {
          if (!event.combo || index > 1)
            this.specialEffect(cell, tile, event.removed ?? []);
        });
        this.onClear(event);
        if (chain > 1 || special || event.created?.length)
          this.banner(
            event.combo?.kind === "rainbow"
              ? "Regnbuefest!"
              : event.combo?.kind === "cross-blast"
                ? "Tredobbelt bølge!"
                : event.combo?.kind === "cross"
                  ? "Lyskryds!"
                  : event.created?.some((c) => c.tile.special === "color")
                    ? "Farveperle!"
                    : event.created?.some((c) => c.tile.special === "bomb")
                      ? "Boblebombe!"
                      : event.created?.length
                        ? "En stråle!"
                        : special
                          ? "Boblebrag!"
                          : chain > 2
                            ? `${chain} × kaskade!`
                            : "Kædereaktion!",
          );
        await pause(
          this.reducedMotion ? 55 : event.combo ? 440 : special ? 300 : 190,
        );
        this.show(event);
        for (const { tile } of event.created ?? [])
          this.pieces.get(tile.id)?.animate(
            this.reducedMotion
              ? [{ opacity: 0.4 }, { opacity: 1 }]
              : [
                  { scale: ".3", filter: "brightness(3)" },
                  { scale: "1.22", offset: 0.55 },
                  { scale: "1", filter: "brightness(1)" },
                ],
            { duration: this.reducedMotion ? 70 : 380, easing: "ease-out" },
          );
      } else {
        if (event.kind === "shuffle") this.banner("Nye muligheder");
        if (event.lifted?.length) this.bubbleLiftEffect(event.lifted);
        this.show(event, true);
        await pause(this.reducedMotion ? 65 : 430);
      }
    }
  }

  private banner(text: string): void {
    const label = this.host.querySelector<HTMLElement>(".chain-label")!;
    label.textContent = text;
    label.animate(
      this.reducedMotion
        ? [
            { opacity: 0 },
            { opacity: 1, offset: 0.15 },
            { opacity: 1, offset: 0.8 },
            { opacity: 0 },
          ]
        : [
            { opacity: 0, transform: "translate(-50%,-50%) scale(.6)" },
            {
              opacity: 1,
              transform: "translate(-50%,-50%) scale(1.04)",
              offset: 0.18,
            },
            { opacity: 1, offset: 0.7 },
            { opacity: 0, transform: "translate(-50%,-80%) scale(1)" },
          ],
      { duration: 1000, easing: "ease-out" },
    );
  }
  private specialEffect(
    cell: number,
    tile: Tile,
    targets: { cell: number; tile: Tile }[],
  ): void {
    if (this.reducedMotion) return;
    const ring = document.createElement("div");
    ring.className = `special-wave ${tile.special ?? ""}`;
    ring.style.left = `${((cell % 8) + 0.5) * this.cellSize}px`;
    ring.style.top = `${(Math.floor(cell / 8) + 0.5) * this.cellSize}px`;
    ring.style.setProperty("--blast-size", `${this.cellSize * 3.6}px`);
    this.host.appendChild(ring);
    window.setTimeout(() => ring.remove(), 650);
    if (tile.special === "color" && !this.reducedMotion) {
      for (const target of targets.slice(0, 48))
        this.threads.push({
          x: ((cell % 8) + 0.5) * this.cellSize,
          y: (Math.floor(cell / 8) + 0.5) * this.cellSize,
          tx: ((target.cell % 8) + 0.5) * this.cellSize,
          ty: (Math.floor(target.cell / 8) + 0.5) * this.cellSize,
          life: 0.5,
          max: 0.5,
        });
    }
    if (!this.reducedMotion)
      this.host.animate(
        [
          { transform: "translate(0)" },
          { transform: "translate(-2px,2px)" },
          { transform: "translate(2px,-1px)" },
          { transform: "translate(0)" },
        ],
        { duration: 180 },
      );
  }

  private terrainImpact(event: BoardEvent): void {
    this.cells.forEach((node, cell) => {
      const oldHp = this.snapshot.clams?.[cell] ?? 0;
      const newHp = event.clams?.[cell] ?? 0;
      const coralHit = this.snapshot.blockers[cell] && !event.blockers[cell];
      if (!coralHit && oldHp <= newHp) return;
      this.burst(
        cell,
        coralHit ? "#ffb3af" : "#ffe3f4",
        oldHp && newHp === 0 ? 14 : 8,
      );
      node.animate(
        this.reducedMotion
          ? [{ opacity: 1 }, { opacity: 0.5 }, { opacity: 1 }]
          : [
              { transform: "scale(1)", filter: "brightness(1)" },
              {
                transform: "scale(1.12) rotate(-6deg)",
                filter: "brightness(1.8)",
                offset: 0.3,
              },
              { transform: "scale(.97) rotate(4deg)", offset: 0.65 },
              { transform: "scale(1)", filter: "brightness(1)" },
            ],
        { duration: this.reducedMotion ? 100 : 300, easing: "ease-out" },
      );
    });
  }

  private comboEffect(combo: NonNullable<BoardEvent["combo"]>): void {
    const footprint = document.createElement("div");
    footprint.className = `combo-footprint combo-${combo.kind}`;
    footprint.dataset.combo = combo.kind;
    const centerX = combo.cell % 8,
      centerY = Math.floor(combo.cell / 8);
    for (const cell of combo.cells) {
      const flash = document.createElement("i");
      flash.dataset.cell = String(cell);
      flash.style.left = `${(cell % 8) * 12.5}%`;
      flash.style.top = `${Math.floor(cell / 8) * 12.5}%`;
      flash.style.setProperty("--cell-hue", String((cell * 31) % 360));
      const distance =
        Math.abs((cell % 8) - centerX) +
        Math.abs(Math.floor(cell / 8) - centerY);
      flash.style.setProperty(
        "--cell-delay",
        `${this.reducedMotion ? 0 : distance * 17}ms`,
      );
      footprint.appendChild(flash);
      if (combo.kind === "rainbow" && !this.reducedMotion)
        this.threads.push({
          x: (centerX + 0.5) * this.cellSize,
          y: (centerY + 0.5) * this.cellSize,
          tx: ((cell % 8) + 0.5) * this.cellSize,
          ty: (Math.floor(cell / 8) + 0.5) * this.cellSize,
          life: 0.65,
          max: 0.65,
        });
    }
    if (!this.reducedMotion && combo.kind !== "rainbow") {
      const reach = combo.kind === "cross-blast" ? 1 : 0;
      for (let offset = -reach; offset <= reach; offset++) {
        for (const horizontal of [true, false]) {
          const coordinate = (horizontal ? centerY : centerX) + offset;
          if (coordinate < 0 || coordinate > 7) continue;
          const beam = document.createElement("span");
          beam.className = `combo-beam ${horizontal ? "horizontal" : "vertical"}`;
          beam.style.setProperty(
            "--beam-coordinate",
            `${(coordinate + 0.5) * 12.5}%`,
          );
          beam.style.setProperty(
            "--beam-width",
            `${this.cellSize * (reach ? 0.7 : 0.25)}px`,
          );
          footprint.appendChild(beam);
        }
      }
    }
    const bloom = document.createElement("span");
    bloom.className = "combo-bloom";
    bloom.style.left = `${(centerX + 0.5) * 12.5}%`;
    bloom.style.top = `${(centerY + 0.5) * 12.5}%`;
    footprint.appendChild(bloom);
    this.host.appendChild(footprint);
    window.setTimeout(() => footprint.remove(), this.reducedMotion ? 180 : 850);
    if (!this.reducedMotion)
      this.host.animate(
        [
          { transform: "translate(0)" },
          { transform: "translate(-2px,1px)", offset: 0.25 },
          { transform: "translate(2px,-1px)", offset: 0.5 },
          { transform: "translate(0)" },
        ],
        { duration: 210 },
      );
  }

  private bubbleLiftEffect(lifted: NonNullable<BoardEvent["lifted"]>): void {
    for (const lift of lifted) {
      const bubble = document.createElement("span");
      bubble.className = "lifting-bubble";
      bubble.style.width = `${this.cellSize * 0.82}px`;
      bubble.style.height = `${this.cellSize * 0.82}px`;
      bubble.style.left = `${((lift.from % 8) + 0.09) * this.cellSize}px`;
      bubble.style.top = `${(Math.floor(lift.from / 8) + 0.09) * this.cellSize}px`;
      this.host.appendChild(bubble);
      bubble.animate(
        this.reducedMotion
          ? [{ opacity: 0.6 }, { opacity: 0 }]
          : [
              { transform: "translateY(0) scale(.8)", opacity: 0.3 },
              {
                transform: `translateY(${-this.cellSize}px) scale(1.1)`,
                opacity: 0.85,
                offset: 0.8,
              },
              {
                transform: `translateY(${-this.cellSize}px) scale(1.3)`,
                opacity: 0,
              },
            ],
        {
          duration: this.reducedMotion ? 80 : 450,
          easing: "cubic-bezier(.22,.6,.3,1)",
        },
      );
      window.setTimeout(() => bubble.remove(), this.reducedMotion ? 90 : 460);
    }
  }
  private burst(cell: number, color: string, count: number): void {
    if (this.reducedMotion) return;
    for (let i = 0; i < count && this.particles.length < 180; i++) {
      const angle = Math.random() * Math.PI * 2,
        speed = 25 + Math.random() * 95;
      this.particles.push({
        x: ((cell % 8) + 0.5) * this.cellSize,
        y: (Math.floor(cell / 8) + 0.5) * this.cellSize,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: 0.45 + Math.random() * 0.35,
        max: 0.8,
        size: 1.5 + Math.random() * 3,
        color,
        star: i % 3 === 0,
      });
    }
  }
  private tick = (now: number): void => {
    this.frame = requestAnimationFrame(this.tick);
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    if (this.reducedMotion && (this.particles.length || this.threads.length)) {
      this.particles = [];
      this.threads = [];
      this.context.clearRect(
        0,
        0,
        this.host.clientWidth,
        this.host.clientHeight,
      );
      return;
    }
    if (document.hidden || (!this.particles.length && !this.threads.length))
      return;
    const ctx = this.context;
    ctx.clearRect(0, 0, this.host.clientWidth, this.host.clientHeight);
    this.particles = this.particles.filter((p) => p.life > 0);
    this.threads = this.threads.filter((thread) => thread.life > 0);
    ctx.globalCompositeOperation = "lighter";
    for (const thread of this.threads) {
      thread.life -= dt;
      ctx.globalAlpha = Math.max(0, thread.life / thread.max);
      const gradient = ctx.createLinearGradient(
        thread.x,
        thread.y,
        thread.tx || 0.01,
        thread.ty || 0.01,
      );
      gradient.addColorStop(0, "#fff6af");
      gradient.addColorStop(0.5, "#f3aaff");
      gradient.addColorStop(1, "#8df9ff");
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(thread.x, thread.y);
      ctx.quadraticCurveTo(
        (thread.x + thread.tx) / 2 + 16,
        (thread.y + thread.ty) / 2 - 22,
        thread.tx,
        thread.ty,
      );
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 90 * dt;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      if (p.star) {
        const r = p.size;
        ctx.moveTo(p.x, p.y - r * 2);
        ctx.lineTo(p.x + r * 0.5, p.y - r * 0.5);
        ctx.lineTo(p.x + r * 2, p.y);
        ctx.lineTo(p.x + r * 0.5, p.y + r * 0.5);
        ctx.lineTo(p.x, p.y + r * 2);
        ctx.lineTo(p.x - r * 0.5, p.y + r * 0.5);
        ctx.lineTo(p.x - r * 2, p.y);
        ctx.lineTo(p.x - r * 0.5, p.y - r * 0.5);
      } else ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (!this.particles.length && !this.threads.length)
      ctx.clearRect(0, 0, this.host.clientWidth, this.host.clientHeight);
  };
  dispose(): void {
    this.cancelDrag();
    this.host.removeEventListener("pointerdown", this.pointerDown);
    this.host.removeEventListener("pointermove", this.pointerMove);
    this.host.removeEventListener("pointerup", this.pointerUp);
    this.host.removeEventListener("pointercancel", this.cancelDrag);
    this.host.removeEventListener("lostpointercapture", this.cancelDrag);
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
  }
}
