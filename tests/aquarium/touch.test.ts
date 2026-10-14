import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installTouchActions } from "../../src/aquarium/render/touch";

type ButtonKind = "action" | "slot" | "fish" | "confirm" | "other";
type FakeEvent = {
  target: FakeTarget | null;
  pointerType: string;
  pointerId: number;
  isPrimary: boolean;
  clientX: number;
  clientY: number;
  isTrusted: boolean;
  detail: number;
  defaultPrevented: boolean;
  stopped: boolean;
  preventDefault(): void;
  stopImmediatePropagation(): void;
};
type Listener = (event: FakeEvent) => void;

/** Minimal event surface: no DOM dependency and no simulated browser timing. */
class FakeRoot {
  listeners = new Map<string, Set<Listener>>();
  registrations: Array<{ type: string; capture: boolean }> = [];

  addEventListener(type: string, listener: Listener, capture: boolean): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
    this.registrations.push({ type, capture });
  }

  removeEventListener(type: string, listener: Listener, capture: boolean): void {
    expect(capture).toBe(true);
    this.listeners.get(type)?.delete(listener);
  }

  fire(type: string, target: FakeTarget | null, overrides: Partial<FakeEvent> = {}, legacyMouseEvent = false): FakeEvent {
    const event: FakeEvent = {
      target, pointerType: "touch", pointerId: 7, isPrimary: true,
      clientX: 100, clientY: 100, isTrusted: true, detail: 1,
      defaultPrevented: false, stopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopImmediatePropagation() { this.stopped = true; },
      ...overrides,
    };
    if (legacyMouseEvent) Reflect.deleteProperty(event, "pointerType");
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
      if (event.stopped) break;
    }
    // Represents the application's delegated click handler, after capture.
    const button = target?.closest() ?? null;
    if (type === "click" && !event.stopped && !event.defaultPrevented && button && !button.disabled) {
      button.activations++;
    }
    return event;
  }
}

class FakeTarget {
  constructor(readonly button: FakeButton) {}
  closest(): FakeButton | null { return this.button.kind === "other" ? null : this.button; }
}

class FakeButton extends FakeTarget {
  disabled = false;
  isConnected = true;
  activations = 0;
  syntheticClicks = 0;
  constructor(readonly root: FakeRoot, readonly kind: ButtonKind = "action") {
    // FakeTarget only reads this pointer after construction.
    super(undefined as unknown as FakeButton);
    Object.defineProperty(this, "button", { value: this });
  }
  matches(): boolean { return this.kind === "slot" || this.kind === "fish"; }
  contains(target: FakeTarget | null): boolean { return target?.button === this; }
  click(): void {
    this.syntheticClicks++;
    this.root.fire("click", this, { isTrusted: false, detail: 0 });
  }
}

let now = 100;
const cleanups: Array<() => void> = [];
beforeEach(() => {
  now = 100;
  vi.spyOn(performance, "now").mockImplementation(() => now);
});
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.restoreAllMocks();
});

function setup(kind: ButtonKind = "action") {
  const root = new FakeRoot();
  const button = new FakeButton(root, kind);
  const cleanup = installTouchActions(root as unknown as Document);
  cleanups.push(cleanup);
  return { root, button, cleanup };
}

describe("one-shot mobile touch actions", () => {
  it.each<ButtonKind>(["action", "slot", "fish", "confirm"])("activates a stationary %s tap once, including descendant targets", (kind) => {
    const { root, button } = setup(kind);
    const icon = new FakeTarget(button);
    root.fire("pointerdown", icon);
    now += 60;
    root.fire("pointerup", icon);
    expect(button.syntheticClicks).toBe(1);
    expect(button.activations).toBe(1);
    // Browsers may emit this trusted compatibility click after pointerup.
    const native = root.fire("click", icon);
    expect(native.defaultPrevented).toBe(true);
    expect(native.stopped).toBe(true);
    expect(button.activations).toBe(1);
  });

  it("does not rely on a browser compatibility click arriving", () => {
    const { root, button } = setup();
    root.fire("pointerdown", button);
    root.fire("pointerup", button);
    expect(button.activations).toBe(1);
  });

  it("leaves native mouse and keyboard input intact", () => {
    const { root, button } = setup();
    root.fire("pointerdown", button, { pointerType: "mouse" });
    root.fire("pointerup", button, { pointerType: "mouse" });
    expect(button.syntheticClicks).toBe(0);
    expect(root.fire("click", button).defaultPrevented).toBe(false);
    expect(root.fire("click", button, { detail: 0 }).defaultPrevented).toBe(false);
    expect(button.activations).toBe(2);
  });

  it("does not suppress keyboard or programmatic clicks during the compatibility window", () => {
    const { root, button } = setup();
    root.fire("pointerdown", button);
    root.fire("pointerup", button);
    expect(root.fire("click", button, { detail: 0 }).stopped).toBe(false);
    expect(root.fire("click", button, { isTrusted: false, detail: 1 }).stopped).toBe(false);
    expect(button.activations).toBe(3);
  });

  it("allows an explicit hybrid mouse click immediately after touch without allowing its touch duplicate", () => {
    const { root, button } = setup();
    root.fire("pointerdown", button);
    root.fire("pointerup", button);
    now += 20;
    const mouse = root.fire("click", button, { pointerType: "mouse" });
    expect(mouse.defaultPrevented).toBe(false);
    expect(mouse.stopped).toBe(false);
    expect(button.activations).toBe(2);
    const touchDuplicate = root.fire("click", button, { pointerType: "touch" });
    expect(touchDuplicate.defaultPrevented).toBe(true);
    expect(touchDuplicate.stopped).toBe(true);
    expect(button.activations).toBe(2);
  });

  it("still suppresses Safari compatibility clicks with no pointerType property", () => {
    const { root, button } = setup();
    root.fire("pointerdown", button);
    root.fire("pointerup", button);
    const compatibility = root.fire("click", button, {}, true);
    expect("pointerType" in compatibility).toBe(false);
    expect(compatibility.defaultPrevented).toBe(true);
    expect(compatibility.stopped).toBe(true);
    expect(button.activations).toBe(1);
  });

  it("suppresses a compatibility click retargeted through a closed dialog to another button or the body", () => {
    const { root, button } = setup();
    const underneath = new FakeButton(root);
    root.fire("pointerdown", button);
    root.fire("pointerup", button);
    button.isConnected = false;
    expect(root.fire("click", underneath).stopped).toBe(true);
    expect(root.fire("click", null, {}, true).stopped).toBe(true);
    expect(underneath.activations).toBe(0);
    expect(button.activations).toBe(1);
  });

  it("lets the next fresh touch gesture activate immediately, without double activation", () => {
    const { root, button } = setup();
    const next = new FakeButton(root);
    root.fire("pointerdown", button);
    root.fire("pointerup", button);
    now += 30;
    root.fire("pointerdown", next);
    root.fire("pointerup", next);
    expect(next.activations).toBe(1);
    expect(root.fire("click", next).stopped).toBe(true);
    expect(next.activations).toBe(1);
    expect(button.activations).toBe(1);
  });

  it("a new mouse gesture clears suppression even for a legacy native MouseEvent", () => {
    const { root, button } = setup();
    root.fire("pointerdown", button);
    root.fire("pointerup", button);
    now += 30;
    root.fire("pointerdown", button, { pointerType: "mouse" });
    root.fire("pointerup", button, { pointerType: "mouse" });
    expect(root.fire("click", button, {}, true).stopped).toBe(false);
    expect(button.activations).toBe(2);
  });

  it("suppression expires after 800 ms", () => {
    const { root, button } = setup();
    const other = new FakeButton(root);
    root.fire("pointerdown", button);
    root.fire("pointerup", button);
    expect(root.fire("click", other).stopped).toBe(true);
    now += 799;
    expect(root.fire("click", button).stopped).toBe(true);
    now += 1;
    expect(root.fire("click", button).stopped).toBe(false);
    expect(button.activations).toBe(2);
  });

  it.each<ButtonKind>(["action", "slot", "fish"])("rejects a %s gesture after crossing its threshold, even when returning to start", (kind) => {
    const { root, button } = setup(kind);
    const threshold = kind === "action" ? 8 : 5;
    root.fire("pointerdown", button);
    root.fire("pointermove", button, { clientX: 100 + threshold + 1 });
    root.fire("pointermove", button);
    root.fire("pointerup", button);
    expect(button.syntheticClicks).toBe(0);
  });

  it.each<ButtonKind>(["action", "slot", "fish"])("allows motion exactly at the %s threshold", (kind) => {
    const { root, button } = setup(kind);
    const threshold = kind === "action" ? 8 : 5;
    root.fire("pointerdown", button);
    root.fire("pointerup", button, { clientX: 100 + threshold });
    expect(button.activations).toBe(1);
  });

  it("checks movement at pointerup even if the browser omitted pointermove", () => {
    const { root, button } = setup();
    root.fire("pointerdown", button);
    root.fire("pointerup", button, { clientX: 109 });
    expect(button.syntheticClicks).toBe(0);
  });

  it("uses radial rather than independent-axis movement distance", () => {
    const { root, button } = setup();
    root.fire("pointerdown", button);
    root.fire("pointerup", button, { clientX: 106, clientY: 106 });
    expect(button.syntheticClicks).toBe(0);
  });

  it("cancels the pending action on pointercancel", () => {
    const { root, button } = setup();
    root.fire("pointerdown", button);
    root.fire("pointercancel", button);
    root.fire("pointerup", button);
    expect(button.activations).toBe(0);
  });

  it("rejects long presses but accepts the 1500 ms boundary", () => {
    const { root, button } = setup();
    root.fire("pointerdown", button);
    now += 1501;
    root.fire("pointerup", button);
    expect(button.syntheticClicks).toBe(0);
    root.fire("pointerdown", button);
    now += 1500;
    root.fire("pointerup", button);
    expect(button.syntheticClicks).toBe(1);
  });

  it("does not arm a disabled button, or activate one disabled or detached before release", () => {
    const { root, button } = setup();
    button.disabled = true;
    root.fire("pointerdown", button);
    button.disabled = false;
    root.fire("pointerup", button);
    expect(button.syntheticClicks).toBe(0);

    root.fire("pointerdown", button);
    button.disabled = true;
    root.fire("pointerup", button);
    expect(button.syntheticClicks).toBe(0);

    button.disabled = false;
    root.fire("pointerdown", button);
    button.isConnected = false;
    root.fire("pointerup", button);
    expect(button.syntheticClicks).toBe(0);
  });

  it("requires release inside the same button and the same pointer", () => {
    const { root, button } = setup();
    const other = new FakeButton(root);
    root.fire("pointerdown", button);
    root.fire("pointerup", button, { pointerId: 99 });
    expect(button.syntheticClicks).toBe(0);
    root.fire("pointerup", other);
    expect(button.syntheticClicks).toBe(0);
    expect(other.syntheticClicks).toBe(0);
  });

  it("ignores non-primary touches, unrelated targets and unrelated pointer motion", () => {
    const { root, button } = setup();
    root.fire("pointerdown", button, { isPrimary: false });
    root.fire("pointerup", button);
    root.fire("pointerdown", new FakeButton(root, "other"));
    root.fire("pointerup", button);
    root.fire("pointerdown", null);
    root.fire("pointerup", button);
    expect(button.syntheticClicks).toBe(0);
    root.fire("pointerdown", button);
    root.fire("pointermove", button, { pointerId: 99, clientX: 200 });
    root.fire("pointerup", button);
    expect(button.syntheticClicks).toBe(1);
  });

  it("registers in capture phase and cleanup removes every handler and pending tap", () => {
    const { root, button, cleanup } = setup();
    expect(root.registrations.map(({ type }) => type)).toEqual([
      "pointerdown", "pointermove", "pointerup", "pointercancel", "click",
    ]);
    expect(root.registrations.every(({ capture }) => capture)).toBe(true);
    root.fire("pointerdown", button);
    cleanup();
    expect([...root.listeners.values()].every((listeners) => listeners.size === 0)).toBe(true);
    root.fire("pointerup", button);
    expect(button.syntheticClicks).toBe(0);
    expect(root.fire("click", button).stopped).toBe(false);
    expect(button.activations).toBe(1);
  });
});
