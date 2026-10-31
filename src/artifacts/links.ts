// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { TRANSACTION_SORTS, type TransactionsArgs } from "./types";

const FIELDS = ["account", "category", "exact", "owner", "month", "from", "to", "spending", "search", "sort", "direction"] as const;

export function fragmentOf(args: Record<string, unknown>): string {
  const parts = Object.entries(args).flatMap(([name, value]) => (value === undefined || value === false || value === "" ? [] : [value === true ? encodeURIComponent(name) : `${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`]));
  return parts.length === 0 ? "" : `#${parts.join("&")}`;
}

let toTransactions = (args: TransactionsArgs): string => fragmentOf({ tab: "transactions", ...args });

export const transactionsLink = (args: TransactionsArgs): string => toTransactions(args);

export function useTransactionsLink(link: (args: TransactionsArgs) => string): void {
  toTransactions = link;
}

export function fragment(): Record<string, string> {
  try {
    const text = location.hash.slice(1);
    if (text === "") return {};
    return Object.fromEntries(
      text.split("&").map((part) => {
        const at = part.indexOf("=");
        return at === -1 ? [decodeURIComponent(part), "true"] : [decodeURIComponent(part.slice(0, at)), decodeURIComponent(part.slice(at + 1))];
      }),
    );
  } catch {
    return {};
  }
}

const VALID: Partial<Record<(typeof FIELDS)[number], (value: string) => boolean>> = {
  month: (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value),
  from: (value) => /^\d{4}-\d{2}-\d{2}$/.test(value),
  to: (value) => /^\d{4}-\d{2}-\d{2}$/.test(value),
  sort: (value) => (TRANSACTION_SORTS as readonly string[]).includes(value),
  direction: (value) => value === "asc" || value === "desc",
};

export function transactionsArgs(pairs: Record<string, string>): TransactionsArgs {
  const args: Record<string, unknown> = {};
  for (const field of FIELDS) {
    const value = pairs[field];
    if (value === undefined || value === "" || VALID[field]?.(value) === false) continue;
    args[field] = field === "exact" || field === "spending" ? value === "true" || value === "1" : value;
  }
  if (args.month !== undefined) {
    delete args.from;
    delete args.to;
  }
  return args as TransactionsArgs;
}

export function keepFragment(args: Record<string, unknown>): void {
  const next = fragmentOf(args);
  if (next === location.hash || (next === "" && location.hash === "")) return;
  try {
    history.replaceState(null, "", `${location.pathname}${location.search}${next}`);
  } catch {
  }
}
