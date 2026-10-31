// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { staleMenus } from "../answers";
import { transactionsArgs } from "../links";
import type { FilterState } from "../types";
import { drawTransactions, readTransactions, showFiltered } from "../ui/transactions";
import type { Part } from "./part";

type TransactionsPart = Part & { followFrom(pairs: Record<string, string>, from: HTMLElement): void };

export function transactionsPart(panel: HTMLElement, pairs: Record<string, string>): TransactionsPart {
  const state: FilterState = { filter: transactionsArgs(pairs) };
  let read = false;
  const follow = (next: Record<string, string>, from: HTMLElement | null): void => {
    const filter = transactionsArgs(next);
    if (!showFiltered(filter, from)) state.filter = filter;
  };
  return {
    load() {
      if (read) staleMenus();
      read = true;
      return readTransactions(state.filter).then((page) => {
        if (page !== null) drawTransactions(panel, page, state);
      });
    },
    link: () => state.filter as Record<string, unknown>,
    follow: (next) => follow(next, null),
    followFrom: follow,
  };
}
