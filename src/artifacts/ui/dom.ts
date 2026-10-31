// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { PageError } from "./reads";

const words = JSON.parse(document.getElementById("words")?.textContent ?? "{}") as Record<string, string>;

export function word(key: string, slots: Record<string, string | number> = {}): string {
  return (words[key] ?? "").replace(/:([A-Za-z]+)/g, (match, name: string) => (name in slots ? String(slots[name]) : match));
}

export const failureText = (err: unknown): string => (err instanceof PageError ? err.message : word("failed"));

export function showNotice(text: string | null): void {
  const notice = document.querySelector<HTMLElement>("[data-notice]")!;
  notice.hidden = text === null;
  notice.textContent = text ?? "";
}

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const made = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) made.setAttribute(name, value);
  made.append(...children);
  return made;
}

export function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: Node[]): SVGElementTagNameMap[K] {
  const made = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attrs)) made.setAttribute(name, value);
  made.append(...children);
  return made;
}
