// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

const ASKED_MS = 3000;
const ASKING_MS = 15_000;

export function startAsk(button: HTMLElement): boolean {
  if (button.hasAttribute("data-asking") || button.hasAttribute("data-asked")) return false;
  button.dataset.asking = String(setTimeout(() => endAsk(button), ASKING_MS));
  return true;
}

export function endAsk(button: HTMLElement): void {
  clearTimeout(Number(button.dataset.asking));
  delete button.dataset.asking;
}

const showing = new WeakMap<HTMLElement, { label: string; timer: ReturnType<typeof setTimeout> }>();

export function showAsked(button: HTMLElement, text: string): void {
  endAsk(button);
  const label = button.querySelector("[aria-live]")!;
  const was = showing.get(button);
  if (was !== undefined) clearTimeout(was.timer);
  const before = was?.label ?? label.textContent ?? "";
  label.textContent = text;
  button.dataset.asked = "";
  const timer = setTimeout(() => {
    showing.delete(button);
    label.textContent = before;
    delete button.dataset.asked;
  }, ASKED_MS);
  showing.set(button, { label: before, timer });
}
