import type { MouseEvent, PointerEvent, TouchEvent } from "react";

// A tap that always gets through, for the kitchen's buttons. iPhones hold back a tap's click when something appears on
// screen at that very moment (a pizza out of the oven, a message): Safari takes it for a tap that opened a hover menu,
// and the player has to tap twice. Pointer events aren't held back, so a touch acts when the finger comes up, if it
// barely moved (otherwise it was a scroll). The click the browser may send after it is cancelled, and ignored if it
// comes anyway: once a button acted, what slides under the finger (the next pizza on the pass) must not be clicked
// too. A mouse and the keyboard still go through the click.

// Further than this between down and up, the finger was scrolling.
const MAX_MOVE_PX = 10;
// A click this soon after a tap acted is that tap's.
const SAME_TAP_MS = 600;

const downs = new WeakMap<Element, { x: number; y: number; pointerId: number }>();
let lastTapAt = -Infinity;

const isDisabled = (element: Element): boolean => (element as HTMLButtonElement).disabled === true;

export interface TapProps {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
  onTouchEnd: (event: TouchEvent<HTMLElement>) => void;
  onClick: (event: MouseEvent<HTMLElement>) => void;
}

/** Props for a button acting on tap: spread them in place of onClick. */
export const onTap = (action: () => void): TapProps => ({
  onPointerDown: (event) => {
    if (event.pointerType === "mouse") return;
    downs.set(event.currentTarget, { x: event.clientX, y: event.clientY, pointerId: event.pointerId });
  },
  onPointerUp: (event) => {
    const element = event.currentTarget;
    const down = downs.get(element);
    downs.delete(element);
    if (!down || down.pointerId !== event.pointerId || isDisabled(element)) return;
    if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > MAX_MOVE_PX) return;
    lastTapAt = event.timeStamp;
    action();
  },
  onPointerCancel: (event) => {
    downs.delete(event.currentTarget);
  },
  // The touch that just acted: no click after it (the touch events follow the pointer ones).
  onTouchEnd: (event) => {
    if (event.timeStamp - lastTapAt < SAME_TAP_MS && event.cancelable) event.preventDefault();
  },
  onClick: (event) => {
    if (event.timeStamp - lastTapAt < SAME_TAP_MS) return;
    action();
  },
});
