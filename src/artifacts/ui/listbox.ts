// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { listboxButton, menu as menuPanel, menuItem } from "./components";
import { popup, scrollToLine } from "./popup";

interface ListboxOption {
  value: string;
  label: string;
}

export interface Listbox {
  readonly button: HTMLButtonElement;
  value: string;
  options: ListboxOption[];
}

export function listbox(attrs: { id: string } & Record<string, string>, { pick = () => {}, placeholder = "" }: { pick?: (value: string) => void; placeholder?: string } = {}): Listbox {
  const button = listboxButton({ ...attrs, role: "combobox", "aria-haspopup": "listbox" });
  const [shown, empty] = [...button.children] as HTMLElement[];
  empty!.textContent = placeholder;
  const menu = menuPanel({ id: `${attrs.id}-menu`, role: "listbox" });
  let options: ListboxOption[] = [];
  let value = "";
  let lines: HTMLElement[] = [];
  let at = -1;
  const pop = popup(button, menu, () => {
    at = -1;
  });

  function label(): void {
    const chosen = options.find((option) => option.value === value);
    shown!.textContent = chosen?.label ?? "";
    shown!.hidden = chosen === undefined;
    empty!.hidden = chosen !== undefined;
  }
  function open(index = -1): void {
    lines = options.map((option, i) => menuItem(option.label, { id: `${menu.id}-${i}`, role: "option" }));
    menu.replaceChildren(...lines);
    if (lines.length === 0) return pop.close();
    menu.setAttribute("aria-label", button.getAttribute("aria-label") ?? button.labels[0]?.textContent ?? "");
    pop.open();
    menu.scrollTop = 0;
    at = -1;
    highlight(index === -1 ? Math.max(0, options.findIndex((option) => option.value === value)) : Math.min(index, lines.length - 1));
  }
  function highlight(next: number): void {
    lines[at]?.removeAttribute("aria-selected");
    at = next;
    lines[at]!.setAttribute("aria-selected", "true");
    button.setAttribute("aria-activedescendant", lines[at]!.id);
    scrollToLine(menu, lines[at]!);
  }
  function choose(index: number): void {
    value = options[index]!.value;
    label();
    pop.close();
    pick(value);
  }

  button.addEventListener("click", () => (pop.isOpen ? pop.close() : open()));
  button.addEventListener("blur", () =>
    setTimeout(() => {
      if (document.activeElement !== button) pop.close();
    }),
  );
  button.addEventListener("keydown", (event) => {
    const key = event.key === " " ? "Enter" : event.key;
    if (!pop.isOpen) {
      const on = { Enter: -1, ArrowDown: -1, ArrowUp: -1, Home: 0, End: options.length - 1 }[key];
      if (on !== undefined) {
        event.preventDefault();
        open(on);
      }
      return;
    }
    const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: lines.length - 1 }[key];
    if (to !== undefined) {
      event.preventDefault();
      highlight(Math.min(lines.length - 1, Math.max(0, to)));
    } else if (key === "Enter") {
      event.preventDefault();
      choose(at);
    } else if (key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      pop.close();
    }
  });
  button.addEventListener("keyup", (event) => {
    if (event.key === " ") event.preventDefault();
  });
  menu.addEventListener("mousedown", (event) => event.preventDefault());
  menu.addEventListener("click", (event) => {
    const index = lines.indexOf((event.target as Element).closest<HTMLElement>('[role="option"]')!);
    if (index !== -1) choose(index);
  });

  label();
  return {
    button,
    get value() {
      return value;
    },
    set value(next: string) {
      value = next;
      label();
    },
    get options() {
      return options;
    },
    set options(next: ListboxOption[]) {
      const kept = options[at]?.value;
      options = next;
      label();
      if (pop.isOpen) open(next.findIndex((option) => option.value === kept));
    },
  };
}
