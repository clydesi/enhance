// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { RETRACT } from "./connector";
import { text } from "./ui/components";
import { failureText, showNotice, word } from "./ui/dom";
import { PageError } from "./ui/reads";

function applyTheme(): void {
  const chosen = document.documentElement.dataset.theme;
  const dark = chosen === "dark" || (chosen !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}
applyTheme();
new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

export function showSubtitle(line: string | null): void {
  const sub = document.querySelector<HTMLElement>("[data-subtitle]")!;
  sub.textContent = line ?? "";
  sub.hidden = line === null;
}

interface Reading {
  run(read: () => Promise<void>): void;
  busy(): boolean;
  landedAt(): number;
}

export function startView(panels: HTMLElement[], load: () => Promise<void>): Reading {
  document.querySelector("header")!.after(text("", { "data-notice": "", role: "status", class: "mt-2", hidden: "" }));
  for (const panel of panels) panel.append(text(word("loading"), { "data-loading": "", class: "py-6 text-center" }));
  const showDrawn = (shown: boolean): void => {
    for (const part of document.querySelectorAll<HTMLElement>("[data-drawn]")) part.hidden = !shown;
  };
  let landedAt = 0;
  let running = 0;
  document.addEventListener("clyde:user-changed", () => {
    ended = true;
    showDrawn(false);
    showNotice(word("failUserChanged"));
  });

  const run = (read: () => Promise<void>): void => {
    if (ended) return;
    running++;
    read()
      .then(
        () => {
          landedAt = Date.now();
          for (const panel of panels) panel.querySelector("[data-loading]")?.remove();
          showDrawn(true);
          showNotice(null);
        },
        (err: unknown) => {
          if (ended) return;
          showNotice(failureText(err));
          const code = err instanceof PageError ? err.code : undefined;
          if (code !== undefined && RETRACT.has(code) && landedAt === 0) showDrawn(false);
        },
      )
      .finally(() => running--);
  };
  run(load);
  return { run, busy: () => running > 0, landedAt: () => landedAt };
}

let ended = false;

const POLL_MS = 30_000;
const FRESH_MS = 5_000;

export function keepCurrent(reading: Reading, check: (back: boolean) => Promise<void>): void {
  const inSight = (): boolean => document.visibilityState === "visible";
  let checking = false;
  const once = (back: boolean): void => {
    if (ended || checking || !inSight() || reading.busy()) return;
    checking = true;
    void check(back).finally(() => (checking = false));
  };
  const back = (): void => {
    if (Date.now() - reading.landedAt() > FRESH_MS) once(true);
  };
  document.addEventListener("visibilitychange", back);
  window.addEventListener("focus", back);
  setInterval(() => once(false), POLL_MS);
}
