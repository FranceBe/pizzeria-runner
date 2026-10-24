import { describe, it, expect, vi } from "vitest";
import type { MouseEvent, PointerEvent, TouchEvent } from "react";
import { onTap } from "./tap";

// Just enough of a browser's events for the handlers.
const button = (disabled = false) => ({ disabled }) as unknown as HTMLElement;
let clock = 1000;
const pointer = (target: HTMLElement, type: "touch" | "mouse", x = 10, y = 10, pointerId = 1) =>
  ({ currentTarget: target, pointerType: type, clientX: x, clientY: y, pointerId, timeStamp: (clock += 16) }) as unknown as PointerEvent<HTMLElement>;
const click = (target: HTMLElement, after = 16) => ({ currentTarget: target, timeStamp: (clock += after) }) as unknown as MouseEvent<HTMLElement>;
const touchEnd = (target: HTMLElement) => {
  const preventDefault = vi.fn();
  return { event: { currentTarget: target, timeStamp: (clock += 1), cancelable: true, preventDefault } as unknown as TouchEvent<HTMLElement>, preventDefault };
};

describe("a tap", () => {
  it("acts when the finger comes up, even if the click is held back (an iPhone, something appearing on screen)", () => {
    const action = vi.fn();
    const props = onTap(action);
    const target = button();
    props.onPointerDown(pointer(target, "touch"));
    props.onPointerUp(pointer(target, "touch"));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("cancels the click that would follow, and ignores it if it comes anyway, on that button or the next one", () => {
    const first = vi.fn();
    const next = vi.fn();
    const target = button();
    const props = onTap(first);
    props.onPointerDown(pointer(target, "touch"));
    props.onPointerUp(pointer(target, "touch"));
    const { event, preventDefault } = touchEnd(target);
    props.onTouchEnd(event);
    expect(preventDefault).toHaveBeenCalled();
    props.onClick(click(target));
    // The pizza served, the next one slid under the finger: its button gets the stray click.
    onTap(next).onClick(click(button()));
    expect(first).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  it("is a scroll when the finger moved, and nothing when the browser took the gesture over", () => {
    const action = vi.fn();
    const props = onTap(action);
    const target = button();
    props.onPointerDown(pointer(target, "touch", 10, 10));
    props.onPointerUp(pointer(target, "touch", 10, 40));
    props.onPointerDown(pointer(target, "touch"));
    props.onPointerCancel(pointer(target, "touch"));
    props.onPointerUp(pointer(target, "touch"));
    expect(action).not.toHaveBeenCalled();
  });

  it("does nothing on a disabled button, nor for another finger", () => {
    const action = vi.fn();
    const props = onTap(action);
    const disabled = button(true);
    props.onPointerDown(pointer(disabled, "touch"));
    props.onPointerUp(pointer(disabled, "touch"));
    const target = button();
    props.onPointerDown(pointer(target, "touch", 10, 10, 1));
    props.onPointerUp(pointer(target, "touch", 10, 10, 2));
    expect(action).not.toHaveBeenCalled();
  });

  it("leaves a mouse and the keyboard to the click, as before", () => {
    const action = vi.fn();
    const props = onTap(action);
    const target = button();
    props.onPointerDown(pointer(target, "mouse"));
    props.onPointerUp(pointer(target, "mouse"));
    expect(action).not.toHaveBeenCalled();
    props.onClick(click(target, 1000));
    expect(action).toHaveBeenCalledTimes(1);
    // A later tap, then quick taps one after the other: each acts once.
    props.onPointerDown(pointer(target, "touch"));
    props.onPointerUp(pointer(target, "touch"));
    props.onPointerDown(pointer(target, "touch"));
    props.onPointerUp(pointer(target, "touch"));
    expect(action).toHaveBeenCalledTimes(3);
  });
});
