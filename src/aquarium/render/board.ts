import type { Action, BoardEvent, BoardState, Tile } from "../core";
import { TYPE_NAMES } from "../content/catalog";
import { coralArt, gemArt } from "./gems";

type Snapshot = Pick<BoardState, "tiles" | "blockers" | "sand">;
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
const colors = ["#d59aff", "#ffe577", "#7dedff", "#b4f27f", "#fff2da"];
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
  }
  private snapshot: Snapshot = { tiles: [], blockers: [], sand: [] };
  private pieces = new Map<number, HTMLButtonElement>();
  private cells: HTMLDivElement[] = [];
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
  private cellSize = 44;
  private resizeObserver: ResizeObserver;
  private lastTime = performance.now();

  constructor(private host: HTMLElement) {
    host.innerHTML =
      '<div class="board-grid" aria-hidden="true"></div><div class="board-pieces" role="group" aria-label="Spilleplade, otte gange otte felter"></div><canvas class="board-effects" aria-hidden="true"></canvas><div class="chain-label" aria-live="polite"></div>';
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
    this.layer.addEventListener("keydown", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
        "[data-cell]",
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

  show(snapshot: Snapshot, falling = false): void {
    const previous = new Map(
      this.snapshot.tiles.flatMap((tile, cell) =>
        tile ? [[tile.id, cell] as const] : [],
      ),
    );
    this.snapshot = snapshot;
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
            : this.transform(
                cell % 8,
                0,
                -this.cellSize * (1 + Math.floor(cell / 8)),
              );
        node.animate(
          [
            { transform: start },
            { transform: end, offset: 0.82 },
            { transform: `${end} scale(1.05,.94)`, offset: 0.91 },
            { transform: end },
          ],
          {
            duration: 340 + Math.floor(cell / 8) * 12,
            easing: "cubic-bezier(.25,.5,.4,1)",
          },
        );
      }
      node.style.transform = end;
    });
    this.cells.forEach((node, i) => {
      node.classList.toggle("sand", !!snapshot.sand[i]);
      node.classList.toggle("blocked", !!snapshot.blockers[i]);
      if (snapshot.blockers[i] && !node.firstChild) {
        const coral = document.createElement("img");
        coral.src = coralArt;
        coral.alt = "";
        node.appendChild(coral);
      }
      if (!snapshot.blockers[i]) node.replaceChildren();
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
      "[data-cell]",
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
    node.style.transform = this.transform(
      drag.cell,
      Math.abs(dx) > Math.abs(dy)
        ? Math.max(-this.cellSize, Math.min(this.cellSize, dx))
        : 0,
      Math.abs(dy) >= Math.abs(dx)
        ? Math.max(-this.cellSize, Math.min(this.cellSize, dy))
        : 0,
    );
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
    this.drag = null;
    for (const node of this.pieces.values()) node.classList.remove("held");
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
      this.pieces
        .get(tile.id)
        ?.animate(
          [
            {
              transform:
                this.gestureStarts.get(tile.id) ?? this.transform(from),
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
            this.pieces
              .get(tile.id)
              ?.animate(
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
        for (const { cell, tile } of event.removed ?? []) {
          this.burst(cell, colors[tile.type], special ? 10 : 6);
          this.pieces
            .get(tile.id)
            ?.animate(
              [
                { transform: `${this.transform(cell)} scale(1)` },
                {
                  transform: `${this.transform(cell)} scale(1.2)`,
                  offset: 0.25,
                },
                { transform: `${this.transform(cell)} scale(.1)`, opacity: 0 },
              ],
              { duration: 210, easing: "ease-in" },
            );
        }
        for (const { cell, tile } of event.activated ?? [])
          this.specialEffect(cell, tile, event.removed ?? []);
        this.onClear(event);
        if (chain > 1 || special || event.created?.length)
          this.banner(
            event.created?.some((c) => c.tile.special === "color")
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
        await pause(this.reducedMotion ? 55 : special ? 300 : 190);
        this.show(event);
        for (const { tile } of event.created ?? [])
          this.pieces.get(tile.id)?.animate(
            [
              { scale: ".3", filter: "brightness(3)" },
              { scale: "1.22", offset: 0.55 },
              { scale: "1", filter: "brightness(1)" },
            ],
            { duration: 380, easing: "ease-out" },
          );
      } else {
        if (event.kind === "shuffle") this.banner("Nye muligheder");
        this.show(event, true);
        await pause(this.reducedMotion ? 65 : 430);
      }
    }
  }

  private banner(text: string): void {
    const label = this.host.querySelector<HTMLElement>(".chain-label")!;
    label.textContent = text;
    label.animate(
      [
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
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
  }
}
