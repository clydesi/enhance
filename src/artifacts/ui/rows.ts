// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import type { TransactionsPage, TransactionRow, TransactionsSort, TransactionsArgs } from "../types";

export function merge(pages: TransactionsPage[]): TransactionsPage {
  const seen = new Set<string>();
  const rows = pages.flatMap((page) => page.rows).filter((row) => !seen.has(row.id) && seen.add(row.id));
  const stamp = pages.every((page) => page.stamp === pages[0]!.stamp) ? pages[0]!.stamp : null;
  return { ...pages[0]!, stamp, rows, next: pages.at(-1)!.next };
}

export function sortedBy(filter: TransactionsArgs, key: TransactionsSort): TransactionsArgs {
  const { sort = "date", direction = "desc" } = filter;
  const next = key === sort ? (direction === "asc" ? "desc" : "asc") : key === "date" || key === "amount" ? "desc" : "asc";
  return { ...filter, sort: key, direction: next };
}

export function monthRuns(rows: TransactionRow[]): TransactionRow[][] {
  const runs: TransactionRow[][] = [];
  for (const row of rows) {
    const last = runs.at(-1);
    if (last?.[0]!.month === row.month) last.push(row);
    else runs.push([row]);
  }
  return runs;
}
