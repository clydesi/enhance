// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import type { Badge } from "../types";
import { badge, card, countBadge, GUTTER, HEADER_RULE, styled, SUBHEADING, subheading, TABLE_BAND, TONE } from "./components";
import { element, word } from "./dom";
import type { LedgerGroup, LedgerLine, LedgerOwner, LedgerSubgroup } from "./ledger";

const SPREAD = "flex w-full min-w-0 items-center justify-between gap-4 text-left";

const ROW = `${SPREAD} px-(--gutter)`;

const INSET_RING = "focus-visible:-outline-offset-2";

const amount = (text: string): HTMLElement => element("span", { class: "shrink-0 tabular-nums" }, text);

function named(name: string, count: string | undefined, muted = false, detail = "", badges: Badge[] = []): HTMLElement {
  const text = element("span", muted ? { "data-tone": "muted", class: `truncate ${TONE.muted}` } : { class: "truncate" }, name);
  return element(
    "span",
    { "data-name": "", class: "flex min-w-0 items-center gap-2" },
    text,
    ...(detail === "" ? [] : [element("span", { "data-account-type": "", class: `min-w-0 shrink-1000 truncate text-sm/5 sm:text-xs/5 ${TONE.muted}` }, detail)]),
    ...(count === undefined ? [] : [countBadge(count)]),
    ...badges.map((item) => badge(item.text, { class: "shrink-0" }, item.meaning)),
  );
}

export const ownerHead = (owner: { name: string; business: boolean; asset?: boolean }, attrs: Record<string, string>, ...more: HTMLElement[]): HTMLElement => {
  const kind = owner.business ? "business" : owner.asset === true ? "asset" : null;
  return element("div", styled("flex min-w-0 items-center gap-3", attrs), subheading(3, owner.name, { class: "min-w-0 truncate" }), ...(kind === null ? [] : [badge(word(kind), { class: "shrink-0" })]), ...more);
};

export const summaryLine = (name: string, count: string | undefined, total: string, detail = ""): HTMLElement =>
  element("li", { class: `${SPREAD} border-t border-mist-950/5 py-2.5 dark:border-white/5` }, named(name, count, false, detail), amount(total));

function linked(attr: string, href: string, kit: string, ...children: HTMLElement[]): HTMLAnchorElement {
  return element("a", { href, [attr]: "", "data-target": href, class: `${kit} ${INSET_RING}` }, ...children);
}

const TABLE_HEAD_ROW = `${ROW} ${HEADER_RULE} py-2.5 font-medium sm:py-2 ${TONE.muted}`;
const PARENT_HEAD = `${TABLE_HEAD_ROW} hover:text-mist-950 dark:hover:text-white`;
const PLAIN_LINE = `${ROW} border-b border-mist-950/5 py-2.5 text-mist-950 dark:border-white/5 dark:text-white`;
const LINE = `${PLAIN_LINE} hover:bg-mist-950/2.5 dark:hover:bg-white/2.5`;

function lineOf(line: LedgerLine): HTMLElement {
  const name = named(line.name, line.count, line.muted, line.detail, line.badges);
  const children = [line.nested === true ? element("span", { class: "flex min-w-0 ps-3" }, name) : name, amount(line.amount)];
  return line.href === undefined ? element("div", { "data-line": "", class: PLAIN_LINE }, ...children) : linked("data-line", line.href, LINE, ...children);
}

const subgroupOf = (subgroup: LedgerSubgroup): HTMLElement =>
  element(
    "div",
    { "data-subgroup": "" },
    element("div", { "data-subgroup-head": "", class: TABLE_HEAD_ROW }, named(subgroup.title, subgroup.count), amount(subgroup.total)),
    ...subgroup.lines.map(lineOf),
  );

function groupOf(group: LedgerGroup): HTMLElement[] {
  const lines = group.lines.map(lineOf);
  const head = [named(group.title, group.count, false, group.detail, group.badges), amount(group.total)];
  if (group.href !== undefined) return [linked("data-parent-head", group.href, PARENT_HEAD, ...head), ...lines];
  if (group.head) return [element("div", { "data-parent-head": "", class: TABLE_HEAD_ROW }, ...head), ...lines];
  const band = element("div", { "data-group-head": "", class: `${SPREAD} ${TABLE_BAND}` }, element("span", { class: "min-w-0 truncate" }, group.title), amount(group.total));
  return [element("div", { "data-group": "" }, band, ...lines, ...(group.subgroups ?? []).map(subgroupOf))];
}

export function ledgerList(owners: LedgerOwner[]): HTMLElement {
  return element(
    "div",
    { "data-ledger": "", class: "flex flex-col gap-8" },
    ...owners.map((owner) =>
      element(
        "section",
        { class: "min-w-0" },
        ownerHead(owner, { class: "pb-3" }, element("span", { class: `${SUBHEADING} ms-auto shrink-0 tabular-nums` }, owner.total)),
        card({ class: `overflow-hidden text-sm/6 ${GUTTER}` }, ...owner.groups.flatMap(groupOf)),
      ),
    ),
  );
}

export function swapLedger(old: Element, next: HTMLElement): void {
  const focused = old.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.target : undefined;
  old.replaceWith(next);
  if (focused !== undefined) [...next.querySelectorAll<HTMLElement>("[data-target]")].find((link) => link.dataset.target === focused)?.focus({ preventScroll: true });
}
