/** Reliable one-shot activation after a drag, including browsers that suppress
 * the following compatibility click. Native mouse and keyboard behaviour stays intact. */
export function installTouchActions(root: Document = document): () => void {
  const selector =
    "button[data-action],button.aq-slot,button.aq-fish,button#confirm-import";
  type Touch = {
    id: number;
    x: number;
    y: number;
    began: number;
    button: HTMLButtonElement;
    moved: boolean;
  };
  let touch: Touch | null = null;
  let suppressUntil = 0;
  const targetButton = (target: EventTarget | null) =>
    (target as Element | null)?.closest?.<HTMLButtonElement>(selector) ?? null;
  const down = (event: PointerEvent) => {
    // A new physical gesture is intentional, even within the previous tap's
    // compatibility window. Do not make rapid successive taps feel sluggish.
    suppressUntil = 0;
    const button = targetButton(event.target);
    touch =
      event.pointerType === "touch" &&
      event.isPrimary &&
      button &&
      !button.disabled
        ? {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            began: performance.now(),
            button,
            moved: false,
          }
        : null;
  };
  const move = (event: PointerEvent) => {
    if (!touch || event.pointerId !== touch.id) return;
    const limit = touch.button.matches(".aq-slot,.aq-fish") ? 5 : 8;
    if (Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > limit)
      touch.moved = true;
  };
  const cancel = () => {
    touch = null;
  };
  const up = (event: PointerEvent) => {
    const current = touch;
    if (!current || current.id !== event.pointerId) return;
    move(event);
    touch = null;
    if (
      current.moved ||
      current.button.disabled ||
      !current.button.isConnected ||
      performance.now() - current.began > 1500 ||
      !current.button.contains(event.target as Node)
    )
      return;
    suppressUntil = performance.now() + 800;
    current.button.click();
  };
  const click = (event: MouseEvent) => {
    // .click() above has isTrusted=false; keyboard clicks have detail=0.
    // Closing a dialog can retarget the native compatibility click to the page
    // underneath. Suppress it regardless of target, not just on the old button.
    // Modern mouse clicks are explicit; older Safari may omit pointerType.
    const explicitMouse =
      "pointerType" in event && event.pointerType === "mouse";
    if (
      !explicitMouse &&
      event.isTrusted &&
      event.detail > 0 &&
      suppressUntil > performance.now()
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  root.addEventListener("pointerdown", down, true);
  root.addEventListener("pointermove", move, true);
  root.addEventListener("pointerup", up, true);
  root.addEventListener("pointercancel", cancel, true);
  root.addEventListener("click", click, true);
  return () => {
    root.removeEventListener("pointerdown", down, true);
    root.removeEventListener("pointermove", move, true);
    root.removeEventListener("pointerup", up, true);
    root.removeEventListener("pointercancel", cancel, true);
    root.removeEventListener("click", click, true);
    touch = null;
    suppressUntil = 0;
  };
}
