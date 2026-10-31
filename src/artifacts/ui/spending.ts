// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import type { MonthState, SpendingView } from "../types";
import { chartGeometry } from "./chart";
import { card, stat, subheading, text, TONE } from "./components";
import { element, word } from "./dom";
import { spendingOwners } from "./ledger";
import { ledgerList, swapLedger } from "./ledger-list";
import { type Listbox, listbox } from "./listbox";

let panel: HTMLElement;
let state: MonthState;
let summary: SpendingView;
let picker: Listbox;
let tiles: HTMLElement;
let chart: HTMLElement;
let plot: SVGSVGElement;
let tip: HTMLElement;
let heading: HTMLElement;
let empty: HTMLElement;
let listedMonths = "";

const shownMonth = (): string => (summary.months.some((m) => m.month === state.month) ? state.month : (summary.own ?? ""));

const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, text = ""): SVGElementTagNameMap[K] => {
  const made = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attrs)) made.setAttribute(name, String(value));
  made.textContent = text;
  return made;
};

const GRIDLINE = "stroke-mist-950/10 dark:stroke-white/10";
const LABEL = "fill-mist-500 dark:fill-mist-400";
const BAR = "cursor-pointer fill-mist-300 hover:fill-mist-400 dark:fill-mist-600 dark:hover:fill-mist-500";
const SELECTED_BAR = "cursor-pointer fill-teal-700 dark:fill-teal";
const SELECTED_LABEL = "fill-mist-950 dark:fill-white";

function drawChart(): void {
  const [width, height] = [chart.clientWidth, chart.clientHeight];
  if (width === 0) return;
  const selected = shownMonth();
  const { ticks, bars, labelEvery } = chartGeometry(summary.months, width, height);
  if (bars.length === 0) return void plot.replaceChildren();
  const chosen = bars.findIndex((bar) => bar.month === selected);
  const labeled = (i: number): boolean => i === chosen || (i % labelEvery === 0 && (chosen === -1 || Math.abs(i - chosen) >= labelEvery));
  plot.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const pad = bars[0]!.w / 3;
  const [left, right] = [bars[0]!.x - pad, bars.at(-1)!.x + bars.at(-1)!.w + pad];
  plot.replaceChildren(
    ...ticks.flatMap((t) => [svg("line", { x1: left, x2: right, y1: t.y, y2: t.y, class: GRIDLINE }), svg("text", { x: left - 8, y: t.y, dy: "0.32em", "text-anchor": "end", class: LABEL }, t.label)]),
    ...bars.flatMap((bar, i) => {
      const on = bar.month === selected;
      const mark: Record<string, string> = on ? { "data-selected": "" } : {};
      const rect = svg("rect", { x: bar.x, y: bar.y, width: bar.w, height: bar.h, rx: Math.min(4, bar.h / 2), "data-month": bar.month, class: on ? SELECTED_BAR : BAR, ...mark });
      if (!labeled(i)) return [rect];
      return [rect, svg("text", { x: bar.x + bar.w / 2, y: height - 6, "text-anchor": "middle", class: on ? SELECTED_LABEL : LABEL, ...mark }, summary.months[i]!.short)];
    }),
  );
}

function showTip(event: PointerEvent): void {
  const at = summary.months.find((m) => m.month === (event.target as Element).closest("rect")?.dataset.month);
  tip.hidden = at === undefined;
  if (at === undefined) return;
  tip.replaceChildren(element("div", { class: TONE.muted }, at.label), ...[word("tipSpent", { amount: at.spent }), word("tipIncome", { amount: at.income })].map((line) => element("div", {}, line)));
  const box = chart.getBoundingClientRect();
  const [x, y] = [event.clientX - box.left, event.clientY - box.top];
  tip.style.left = `${Math.max(0, x + 12 + tip.offsetWidth <= box.width ? x + 12 : x - 12 - tip.offsetWidth)}px`;
  tip.style.top = `${Math.max(0, Math.min(y - 48, box.height - tip.offsetHeight))}px`;
}

function show(): void {
  const month = shownMonth();
  const at = summary.months.find((m) => m.month === month);
  const months = summary.months.map((m) => `${m.month} ${m.label}`).join();
  if (months !== listedMonths) picker.options = [...summary.months].reverse().map((m) => ({ value: m.month, label: m.label }));
  listedMonths = months;
  picker.value = month;
  tiles.replaceChildren(stat(word("spent"), at?.spent ?? ""), stat(word("income"), at?.income ?? ""), stat(word("purchases"), at?.purchases ?? ""));
  drawChart();
  const owners = summary.spending[month] ?? [];
  heading.textContent = word("byCategory", { month: at?.label ?? "" });
  swapLedger(panel.querySelector("[data-ledger]")!, ledgerList(spendingOwners(owners)));
  const unread = summary.spending[month] === undefined;
  const failed = summary.failed?.[month];
  empty.hidden = owners.length > 0 && !unread;
  empty.textContent = failed ?? (unread ? word("loading") : word("noSpending", { month: at?.label ?? "" }));
}

function choose(month: string): void {
  state.month = month;
  show();
  panel.dispatchEvent(new Event("state", { bubbles: true }));
}

const titled = (title: HTMLElement, note: string): HTMLElement[] => [element("div", { class: "pb-3" }, title), text(note, { class: "mb-4" })];

export function drawSpending(root: HTMLElement, next: SpendingView, pageState: MonthState): void {
  summary = next;
  state = pageState;
  if (panel === undefined) {
    panel = root;
    picker = listbox({ id: "spending-month", "aria-label": word("month") }, { pick: choose });
    plot = svg("svg", { role: "img", "aria-label": word("byMonth"), class: "block size-full text-xs" });
    tip = element("div", {
      "data-tip": "",
      hidden: "",
      class: "pointer-events-none absolute z-10 rounded-lg bg-white px-2.5 py-1.5 text-sm/6 whitespace-nowrap text-mist-950 shadow-lg ring-1 ring-mist-950/10 dark:bg-mist-800 dark:text-white dark:ring-white/10",
    });
    chart = element("div", { "data-chart": "", class: "relative h-60" }, plot, tip);
    plot.addEventListener("click", (event) => {
      const month = (event.target as Element).closest("rect")?.dataset.month;
      if (month !== undefined) choose(month);
    });
    plot.addEventListener("pointermove", showTip);
    plot.addEventListener("pointerleave", () => (tip.hidden = true));
    new ResizeObserver(drawChart).observe(chart);
    heading = subheading(2, "");
    tiles = element("div", { class: "grid grid-cols-1 gap-4 sm:grid-cols-3" });
    empty = text("", { "data-empty": "", hidden: "", class: "px-2 pt-3" });
    const pickerBox = element("div", { class: "sm:w-48" }, picker.button.parentElement!);
    panel.append(
      element(
        "div",
        { class: "flex flex-col gap-10" },
        element("div", { class: "flex flex-col gap-8" }, pickerBox, tiles),
        element("div", {}, ...titled(subheading(2, word("byMonth")), word("byMonthNote")), card({ class: "p-4" }, chart)),
        element("div", {}, ...titled(heading, word("byCategoryNote")), element("div", { "data-ledger": "" }), empty),
      ),
    );
  }
  show();
}
