// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

export const TRANSACTION_SORTS = ["date", "account", "payee", "category", "tags", "notes", "amount"] as const;
export type TransactionsSort = (typeof TRANSACTION_SORTS)[number];
export const UNCATEGORIZED = "uncategorized";

export interface TransactionsArgs {
  account?: string;
  category?: string;
  exact?: boolean;
  owner?: string;
  month?: string;
  from?: string;
  to?: string;
  spending?: boolean;
  search?: string;
  sort?: TransactionsSort;
  direction?: "asc" | "desc";
  offset?: number;
}

export interface Cell {
  text: string;
  tone?: "positive" | "muted";
  mark?: "business" | "split" | "split_business";
}

export interface Column {
  key: string;
  header: string;
  align: "start" | "end";
}

const BADGE_MEANINGS = ["warning", "information", "neutral", "success", "error"] as const;
export type BadgeMeaning = (typeof BADGE_MEANINGS)[number];

export interface Badge {
  text: string;
  meaning: BadgeMeaning;
  key?: "new" | "possible_duplicate" | "flagged" | "pending";
}

export type FactSlot = "posted" | "account" | "statementDescription" | "for" | "statementAccount" | "transacted";

export interface Fact {
  slot: FactSlot;
  label: string;
  text: string;
  tone?: "muted";
}

export const FACT_COLUMNS: readonly (readonly FactSlot[])[] = [
  ["posted", "statementDescription", "statementAccount"],
  ["account", "for", "transacted"],
];

interface Splits {
  columns: Column[];
  rows: SplitLine[];
}

export interface SplitLine {
  cells: Record<string, Cell>;
  business: boolean;
  asset: boolean;
}

export interface Detail {
  badges: Badge[];
  splits: Splits | null;
  facts: Fact[];
}

export interface RowEdit {
  payee: string;
  category_id: string | null;
  scope_id: string | null;
  tags: string[];
  notes: string;
  split: boolean;
}

export interface TransactionRow {
  id: string;
  version: number;
  month: string;
  cells: Record<string, Cell>;
  detail: Detail;
  edit: RowEdit | null;
  business: boolean;
  asset: boolean;
}

export const CATEGORY_ROOTS = ["personal", "business", "transfers"] as const;
export type CategoryRoot = (typeof CATEGORY_ROOTS)[number];

export interface CategoryNode {
  id: string;
  name: string;
  root: CategoryRoot;
  parent_id: string | null;
}

interface Scope {
  id: string;
  name: string;
  business?: true;
  asset?: true;
}

export interface EditMenus {
  categories: CategoryNode[];
  scopes: Scope[];
  payees: string[];
}

export interface TransactionSave {
  id: string;
  version: number;
  payee?: string;
  category_id?: string | null;
  scope?: string;
  tags?: string[];
  notes?: string | null;
}

export interface PendingRow {
  key: string;
  month: string;
  cells: Record<string, Cell>;
}

export interface TransactionsPage {
  stamp: string | null;
  rows: TransactionRow[];
  pending: PendingRow[];
  heading: string;
  chip: string | null;
  next: number | null;
  grouped: boolean;
  pendingLast: boolean;
}

export interface FilterState {
  filter: TransactionsArgs;
}

export interface MonthState {
  month: string;
}

export type ColumnPrefs = { columns: { tags: boolean; notes: boolean }; pendingCollapsed: boolean };
export const DEFAULT_PREFS: ColumnPrefs = { columns: { tags: true, notes: true }, pendingCollapsed: false };

export interface AccountItem {
  id: string;
  name: string;
  type: string;
  balance: string;
  closed: boolean;
  empty: boolean;
  business: boolean;
  asset: boolean;
}
interface AccountsGroup {
  key: string;
  name: string;
  total: string;
  count: string;
  accounts: AccountItem[];
}
export interface AccountsSection {
  key: string;
  name: string;
  total: string;
  count: string;
  accounts: AccountItem[];
  groups: AccountsGroup[] | null;
}
export interface AccountOwner {
  key: string;
  name: string;
  business: boolean;
  total: string;
  count: string;
  sections: AccountsSection[];
}
interface ScopeTotal {
  id: string;
  name: string;
  kind: string;
  total: string;
  business: boolean;
  asset: boolean;
}
export interface ScopeCard {
  total: string;
  count: string;
  top: ScopeTotal[];
}
export interface AccountsView {
  stamp: string | null;
  totals: { net_worth: string; held: string; owed: string; accounts: string };
  owners: AccountOwner[];
  scope_card: ScopeCard | null;
}

export interface SpendingMonth {
  month: string;
  label: string;
  short: string;
  spent_cents: number;
  spent: string;
  income: string;
  purchases: string;
}
export interface CategoryTotal {
  id: string | null;
  name: string;
  spent: string;
  count: string;
  show: TransactionsArgs;
}
export interface CategoryParent extends CategoryTotal {
  categories: CategoryTotal[];
}
export interface SpendingOwner {
  key: string;
  name: string;
  business: boolean;
  asset: boolean;
  spent: string;
  count: string;
  parents: CategoryParent[];
}
export interface SpendingView {
  months: SpendingMonth[];
  own?: string;
  spending: Record<string, SpendingOwner[]>;
  failed?: Record<string, string>;
  stamp?: string | null;
}
