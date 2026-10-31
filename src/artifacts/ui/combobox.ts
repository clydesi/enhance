// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { menuHeading, menuItem } from "./components";
import { popup, scrollToLine } from "./popup";

type MenuLine = { band: string } | { text: string; value: string; depth?: 0 | 1 };
type Option = Extract<MenuLine, { value: string }>;

export function combobox(input: HTMLInputElement, menu: HTMLElement, lines: (query: string) => MenuLine[], pick: (option: Option) => void, current: () => string | null = () => null): void {
  let options: { line: Option; element: HTMLElement }[] = [];
  let at = -1;
  let typed = false;
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  menu.setAttribute("role", "listbox");
  const pop = popup(input, menu, () => {
    at = -1;
  });

  function draw(): void {
    options = [];
    at = -1;
    input.removeAttribute("aria-activedescendant");
    menu.replaceChildren(
      ...lines(typed ? input.value.trim() : "").map((line) => {
        if ("band" in line) return menuHeading(line.band, { "data-menu-root": "" });
        const depth = line.depth ?? 0;
        const made = menuItem(line.text, { id: `${menu.id}-${options.length}`, role: "option", "data-depth": String(depth), ...(depth === 1 ? { class: "[&>span]:ps-2.5" } : {}) });
        options.push({ line, element: made });
        return made;
      }),
    );
    if (options.length === 0) return pop.close();
    pop.open();
    menu.scrollTop = 0;
    if (!typed) openOn(options.findIndex(({ line }) => line.value === current()));
  }
  function openOn(index: number): void {
    if (index === -1) return;
    highlight(index);
    const option = options[index]!.element;
    let root: Element | null = null;
    let parent: Element | null = null;
    for (let line = option.previousElementSibling; line !== null && root === null; line = line.previousElementSibling) {
      if (line.hasAttribute("data-menu-root")) root = line;
      else if (parent === null && option.dataset.depth === "1" && (line as HTMLElement).dataset.depth === "0") parent = line;
    }
    const bottom = option.offsetTop + option.offsetHeight;
    const top = [root, parent, option].find((line): line is HTMLElement => line !== null && bottom - (line as HTMLElement).offsetTop <= menu.clientHeight);
    menu.scrollTop = top === undefined ? bottom - menu.clientHeight : top.offsetTop;
  }
  function highlight(next: number): void {
    options[at]?.element.removeAttribute("aria-selected");
    at = next;
    const { element } = options[at]!;
    element.setAttribute("aria-selected", "true");
    input.setAttribute("aria-activedescendant", element.id);
    scrollToLine(menu, element);
  }
  function choose(option: Option): void {
    pick(option);
    typed = false;
    pop.close();
  }

  input.addEventListener("focus", () => {
    if (!pop.isOpen) typed = false;
    draw();
  });
  input.addEventListener("input", () => {
    typed = true;
    draw();
  });
  input.addEventListener("click", () => {
    if (!pop.isOpen) draw();
  });
  input.addEventListener("blur", () =>
    setTimeout(() => {
      if (document.activeElement !== input) pop.close();
    }),
  );
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!pop.isOpen) draw();
      if (options.length === 0) return;
      const query = typed ? input.value.trim().toLowerCase() : "";
      const first = Math.max(0, options.findIndex(({ line }) => line.text.toLowerCase().includes(query)));
      const down = event.key === "ArrowDown";
      highlight(at === -1 ? (down ? first : options.length - 1) : Math.min(options.length - 1, Math.max(0, at + (down ? 1 : -1))));
    } else if (event.key === "Enter" && pop.isOpen) {
      event.preventDefault();
      if (at === -1) pop.close();
      else choose(options[at]!.line);
    } else if (event.key === "Escape" && pop.isOpen) {
      event.preventDefault();
      event.stopPropagation();
      pop.close();
    }
  });
  menu.addEventListener("mousedown", (event) => event.preventDefault());
  menu.addEventListener("click", (event) => {
    const chosen = options.find(({ element }) => element === (event.target as Element).closest('[role="option"]'));
    if (chosen !== undefined) choose(chosen.line);
  });
}
