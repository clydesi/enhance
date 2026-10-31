// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { noteStamp, readDefault, readMonth } from "../answers";
import type { MonthState, SpendingView } from "../types";
import { failureText } from "../ui/dom";
import { drawSpending } from "../ui/spending";
import type { Part } from "./part";

export function spendingPart(panel: HTMLElement, pairs: Record<string, string>): Part & { view(): SpendingView | null } {
  const state: MonthState = { month: pairs.month ?? "" };
  let view: SpendingView = { months: [], spending: {} };
  let read = false;
  const draw = (): void => {
    drawSpending(panel, view, state);
    noteStamp("spending", view.stamp ?? null);
  };

  async function load(): Promise<void> {
    const next: SpendingView = { months: [], spending: {} };
    await readDefault(next);
    const month = next.months.some((m) => m.month === state.month) ? state.month : (next.own ?? "");
    if (month !== "" && next.spending[month] === undefined)
      await readMonth(next, month).catch((err: unknown) => {
        next.failed = { ...next.failed, [month]: failureText(err) };
      });
    view = next;
    read = true;
    draw();
    if (state.month !== month && view.months.some((m) => m.month === state.month)) panel.dispatchEvent(new Event("state"));
  }

  panel.addEventListener("state", () => {
    const month = state.month;
    if (month === "" || view.spending[month] !== undefined) return;
    if (view.failed?.[month] !== undefined) {
      delete view.failed[month];
      draw();
    }
    readMonth(view, month).then(
      () => {
        if (state.month === month) draw();
      },
      (err: unknown) => {
        view.failed = { ...view.failed, [month]: failureText(err) };
        if (state.month === month) draw();
      },
    );
  });

  return {
    load,
    link: () => ({ month: state.month }),
    follow(next) {
      const month = next.month ?? "";
      if (month === state.month) return;
      state.month = month;
      if (!read) return;
      draw();
      panel.dispatchEvent(new Event("state"));
    },
    view: () => (read ? view : null),
  };
}
