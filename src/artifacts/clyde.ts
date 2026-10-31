// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import type { Badge, CategoryNode, Cell, TransactionsArgs } from "./types.ts";

export interface RowText {
  date: string;
  account: string;
  payee: string;
  tags: string;
  notes: string;
  amount: string;
  direction?: "in" | "out";
}

export type Mark = NonNullable<Cell["mark"]>;

export interface PostedText extends RowText, Scoped {
  category_name: string;
  mark?: Mark;
}

export type FactKey = "posted" | "account" | "statement_description" | "for" | "statement_account" | "transacted";

export interface EditValues {
  payee: string;
  category_id: string | null;
  scope_id: string | null;
  tags: string[];
  notes: string;
}

export interface Scoped {
  business?: true;
  asset?: true;
}

export type TransactionBadge = Badge & { key: NonNullable<Badge["key"]> };

export interface SplitLine extends Scoped {
  category_name: string;
  mark?: "business";
  amount: string;
  direction?: "in" | "out";
}

export interface SplitLines {
  columns: { key: "category" | "amount"; label: string; type: string }[];
  rows: SplitLine[];
}

export interface PostedListRow extends PostedText {
  number: string;
  id: string;
  version: number;
  badges?: TransactionBadge[];
}

export interface PendingListRow extends RowText {
  pending: true;
  number: string;
  category: string;
  statement_description: string;
  seen: string;
}

export type ListSection = { label: string | null; rows: (PostedListRow | PendingListRow)[] };

export type ListAnswer = {
  stamp: string;
  heading: string;
  chip: string | null;
  next: { offset: number } | null;
} & ({ sections: ListSection[]; empty?: undefined } | { empty: string; sections?: ListSection[] });

export interface TransactionAnswer {
  stamp: string;
  row: PostedText & { id: string; version: number };
  badges: TransactionBadge[];
  facts: { key: FactKey; value: string }[];
  edit: EditValues;
  splits: SplitLines | null;
}

export interface MenusAnswer {
  stamp: string;
  menus: {
    categories: CategoryNode[];
    scopes: { id: string; name: string; business?: true; asset?: true }[];
    payees: string[];
  };
}

export interface StampAnswer {
  stamp: string;
}

export interface AccountRow extends Scoped {
  id: string;
  name: string;
  type: string;
  balance: string;
  closed?: true;
  empty?: true;
}

interface Counted {
  name: string;
  total: string;
  number: string;
}

export interface AccountsAnswer {
  stamp: string;
  totals: { key: "net_worth" | "held" | "owed"; value: string }[];
  accounts: string;
  businesses_and_assets: { total: string; count: string; top: (Scoped & { id: string; name: string; kind: string; total: string })[] };
  owners: (Counted & { id: string; business: boolean; sections: (Counted & { rows?: AccountRow[]; groups?: (Counted & { rows: AccountRow[] })[] })[] })[];
}

export interface MonthRow {
  month: string;
  spent: string;
  income: string;
  shown: boolean;
  key: string;
  short: string;
  spent_cents: number;
}

export interface SpendingRow {
  id: string | null;
  parent_id?: string | null;
  category: string;
  transactions: string;
  spent: string;
  parent: boolean;
  show: TransactionsArgs & { category: string; owner: string };
}

export interface SpendingAnswer {
  stamp: string;
  stats: { key: "spent" | "income" | "purchases"; value: string }[];
  owners: { id: string; name: string; spent: string; count: string; business: boolean; asset?: true; rows: SpendingRow[] }[];
  months: { rows: MonthRow[] };
}

export interface ScopeShare {
  name: string | null;
}

export interface EditAnswer {
  confirm_required?: true;
  confirm_token?: string;
  scope_changes?: { before: ScopeShare[]; after: ScopeShare[] }[];
}

export interface Refusal {
  error: string;
  message: string;
  details?: Record<string, number>;
}
