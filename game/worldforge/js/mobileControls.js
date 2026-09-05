// Touch-only controls that stand in for keyboard-only input (Q/E height).
// Rotate (R) is wired in inputHandlers.js since it's shared with the desktop
// keydown handler; this file only owns what's genuinely touch-specific.
import { camera } from "./environment.js";

// Coarse pointer = finger/stylus rather than mouse. This is the standard way
// to detect "no keyboard, tapping instead of hovering" rather than guessing
// from screen width alone (a touch laptop is still a mouse-primary device;
// a small desktop window is still a mouse).
export const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
if (isTouchDevice) document.body.classList.add("touch-device");

// Height buttons behave like holding Q/E: nudge every frame while pressed,
// not just once per tap, so raising/lowering feels the same as the keyboard.
let heightHoldDirection = 0; // -1 down, 0 idle, 1 up

function bindHoldButton(id, direction) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = (e) => { e.preventDefault(); heightHoldDirection = direction; };
  const stop = () => { heightHoldDirection = 0; };
  el.addEventListener("pointerdown", start);
  el.addEventListener("pointerup", stop);
  el.addEventListener("pointerleave", stop);
  el.addEventListener("pointercancel", stop);
}

export function initMobileControls() {
  bindHoldButton("mobileUpBtn", 1);
  bindHoldButton("mobileDownBtn", -1);
}

export function applyMobileHeightHold(delta) {
  if (heightHoldDirection === 0) return;
  const vertSpeed = 0.45 * delta * 60; // matches the per-frame feel of the keyboard version
  camera.target.y = Math.max(0, camera.target.y + heightHoldDirection * vertSpeed);
}