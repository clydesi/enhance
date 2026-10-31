// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { type Column, type Detail, FACT_COLUMNS } from "../types";
import { badge, FIELD_TABLE_CELL, FIELD_TABLE_HEADER, icon, linkButton, mark, TONE } from "./components";
import { element } from "./dom";

const DETAIL_RULE = "border-t border-mist-950/5 dark:border-white/5";

export function factsOf(detail: Detail): HTMLElement[] {
  if (detail.facts.length === 0) return [];
  return [
    element(
      "div",
      { "data-facts": "", class: `grid grid-cols-2 gap-x-4 ${DETAIL_RULE} pt-4.5 text-base/6 sm:pt-4 sm:text-sm/6` },
      ...FACT_COLUMNS.map((slots, column) =>
        element(
          "dl",
          { class: `flex min-w-0 flex-col gap-y-2${column === 1 ? " text-end" : ""}` },
          ...slots.flatMap((slot) =>
            detail.facts
              .filter((fact) => fact.slot === slot)
              .map((fact) =>
                element(
                  "div",
                  { class: "min-w-0" },
                  element("dt", { class: "text-mist-500 dark:text-mist-400" }, fact.label),
                  element("dd", { class: `mt-1 min-w-0 wrap-anywhere tabular-nums ${fact.tone === undefined ? "text-mist-950 dark:text-white" : TONE[fact.tone]}` }, fact.text),
                ),
              ),
          ),
        ),
      ),
    ),
  ];
}

export function badgesOf(detail: Detail): HTMLElement[] {
  if (detail.badges.length === 0) return [];
  return [element("p", { "data-badges": "", class: "flex flex-wrap justify-end gap-1.5" }, ...detail.badges.map((item) => badge(item.text, item.key === undefined ? {} : { "data-badge": item.key }, item.meaning)))];
}

const ALIGN: Readonly<Record<Column["align"], string>> = { start: "text-left", end: "text-right" };

export function splitsOf({ splits: table }: Detail): HTMLElement[] {
  if (table === null) return [];
  const head = element(
    "thead",
    {},
    element(
      "tr",
      {},
      ...table.columns.map((column) => element("th", { class: `${FIELD_TABLE_HEADER} ${ALIGN[column.align]}` }, column.header)),
    ),
  );
  const rows = table.rows.map((row) => {
    return element(
      "tr",
      {},
      ...table.columns.map((column) => {
        const cell = row.cells[column.key];
        const tone = cell?.tone === undefined ? "" : ` ${TONE[cell.tone]}`;
        if (column.key !== "category") return element("td", { "data-key": column.key, class: `${FIELD_TABLE_CELL} tabular-nums ${ALIGN[column.align]}${tone}` }, cell?.text ?? "");
        const marked = cell?.mark === undefined ? [] : [mark(cell.mark, { "data-mark-icon": "" }, "flush")];
        return element("td", { "data-key": column.key, class: `${FIELD_TABLE_CELL} w-full max-w-0 truncate ${ALIGN[column.align]}${tone}` }, ...marked, cell?.text ?? "");
      }),
    );
  });
  return [
    element(
      "div",
      { "data-splits": "", class: `${DETAIL_RULE} pt-4.5 sm:pt-4` },
      element("table", { class: "min-w-full text-left text-sm/6 whitespace-nowrap text-mist-950 [--gutter:0px] dark:text-white" }, head, element("tbody", {}, ...rows)),
    ),
  ];
}

const ASK_ICON = ["M4 4.5h12a1.5 1.5 0 0 1 1.5 1.5v6.5A1.5 1.5 0 0 1 16 14h-5.5L7 17v-3H4a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 4 4.5Z", "M6.5 8.5h7M6.5 11h4.5"];
const ASKED_ICON = ["m4.5 10.5 3.5 3.5 7.5-8"];

export function askButton(label: string): { line: HTMLElement; button: HTMLButtonElement } {
  const made = linkButton({ "data-ask": "", class: "group min-w-0" });
  made.append(
    icon(ASK_ICON, { viewBox: "0 0 20 20", "stroke-width": "1.6", class: "group-data-asked:hidden" }),
    icon(ASKED_ICON, { viewBox: "0 0 20 20", "stroke-width": "1.8", class: "hidden group-data-asked:block" }),
    element("span", { "aria-live": "polite", class: "truncate" }, label),
  );
  return { line: element("div", { class: "flex min-w-0 me-auto" }, made), button: made };
}
