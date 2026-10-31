// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import type { AccountRow, AccountsAnswer, EditAnswer, FactKey, ListAnswer, MenusAnswer, PendingListRow, PostedListRow, PostedText, RowText, ScopeShare, SpendingAnswer, SplitLine, SplitLines, StampAnswer, TransactionAnswer } from "./clyde";
import { read, write } from "./connector";
import { word } from "./ui/dom";
import { PageError } from "./ui/reads";
import type {
  AccountItem,
  AccountOwner,
  AccountsSection,
  AccountsView,
  Badge,
  CategoryParent,
  CategoryTotal,
  Cell,
  Column,
  Detail,
  EditMenus,
  Fact,
  FactSlot,
  PendingRow,
  SpendingMonth,
  SpendingOwner,
  SpendingView,
  SplitLine as SplitLineView,
  TransactionRow,
  TransactionsArgs,
  TransactionSave,
  TransactionsPage,
} from "./types";

type Area = "transactions" | "accounts" | "spending";

const stamps: Record<Area, string | null> = { transactions: null, accounts: null, spending: null };


const stampIn = (answer: unknown): string | null => {
  const stamp = (answer as { stamp?: unknown } | null)?.stamp;
  return typeof stamp === "string" ? stamp : null;
};

export function noteStamp(area: Area, stamp: string | null): void {
  stamps[area] = stamp;
}

export const stampOf = (area: Area): string | null => stamps[area];

export const ledgerStamp = (): Promise<string> => read<StampAnswer>("show_transactions", { stamp: true }).then((answer) => answer.stamp);

const cellsOf = (row: RowText, category: Cell): Record<string, Cell> => ({
  date: { text: row.date },
  account: { text: row.account },
  payee: { text: row.payee },
  category,
  tags: { text: row.tags },
  notes: { text: row.notes },
  amount: { text: row.amount, ...(row.direction === "in" ? { tone: "positive" as const } : {}) },
});

const FACTS: readonly { slot: FactSlot; key: FactKey; label: string }[] = [
  { slot: "posted", key: "posted", label: "labelPosted" },
  { slot: "account", key: "account", label: "columnAccount" },
  { slot: "statementDescription", key: "statement_description", label: "labelStatementDescription" },
  { slot: "for", key: "for", label: "labelFor" },
  { slot: "statementAccount", key: "statement_account", label: "labelStatementAccount" },
  { slot: "transacted", key: "transacted", label: "labelTransacted" },
];

const lineOf = (line: SplitLine): SplitLineView => ({
  cells: {
    category: { text: line.category_name, ...(line.mark === undefined ? {} : { mark: line.mark }) },
    amount: { text: line.amount, ...(line.direction === "in" ? { tone: "positive" as const } : {}) },
  },
  business: line.business === true,
  asset: line.asset === true,
});

function detailOf(badges: Badge[], given: { key: FactKey; value: string }[], splits: SplitLines | null): Detail {
  const values = new Map(given.map((fact) => [fact.key, fact.value]));
  const facts: Fact[] = FACTS.flatMap(({ slot, key, label }): Fact[] => {
    const value = values.get(key);
    if (value === undefined) return slot === "for" ? [] : [{ slot, label: word(label), text: word("detailNone"), tone: "muted" }];
    return [{ slot, label: word(label), text: value, ...(slot === "transacted" ? { tone: "muted" as const } : {}) }];
  });
  return {
    badges,
    facts,
    splits: splits === null ? null : { columns: splits.columns.map((column): Column => ({ key: column.key, header: column.label, align: column.type === "money" ? "end" : "start" })), rows: splits.rows.map(lineOf) },
  };
}

const categoryCell = (row: PostedText): Cell => ({ text: row.category_name, ...(row.mark === undefined ? {} : { mark: row.mark }) });

const listedOf = (row: PostedListRow, month: string): TransactionRow => ({
  id: row.id,
  version: row.version,
  month,
  cells: cellsOf(row, categoryCell(row)),
  detail: { badges: row.badges ?? [], splits: null, facts: [] },
  edit: null,
  business: row.business === true,
  asset: row.asset === true,
});

const wholeOf = ({ row, badges, facts, splits, edit }: TransactionAnswer): TransactionRow => ({
  id: row.id,
  version: row.version,
  month: "",
  cells: cellsOf(row, categoryCell(row)),
  detail: detailOf(badges, facts, splits),
  edit: { ...edit, split: splits !== null },
  business: row.business === true,
  asset: row.asset === true,
});

const pendingOf = (row: PendingListRow): PendingRow => ({ key: row.number, month: "pending", cells: cellsOf(row, { text: row.category }) });

const isPending = (row: PostedListRow | PendingListRow): row is PendingListRow => "pending" in row && row.pending === true;

function pageOf(answer: ListAnswer): TransactionsPage {
  const rows: TransactionRow[] = [];
  const pending: PendingRow[] = [];
  let grouped = false;
  let pendingLast = false;
  for (const section of answer.empty === undefined ? answer.sections : []) {
    for (const row of section.rows) {
      if (isPending(row)) {
        pending.push(pendingOf(row));
        pendingLast ||= rows.length > 0;
      } else rows.push(listedOf(row, section.label ?? ""));
    }
    if (section.label !== null && section.rows.some((row) => !isPending(row))) grouped = true;
  }
  return { stamp: stampIn(answer), rows, pending, heading: answer.heading, chip: answer.chip, next: answer.next?.offset ?? null, grouped, pendingLast };
}

export async function transactionRow(id: string): Promise<TransactionRow> {
  return wholeOf(await read<TransactionAnswer>("show_transactions", { transaction: id }));
}

let menusRead: Promise<EditMenus> | null = null;

export function staleMenus(): void {
  menusRead = null;
}

export const menusCurrent = (): boolean => menusRead !== null;

export function editMenus(): Promise<EditMenus> {
  menusRead ??= read<MenusAnswer>("show_transactions", { menus: true }).then(
    (answer) => answer.menus,
    (err: unknown) => {
      menusRead = null;
      throw err;
    },
  );
  return menusRead;
}

export class SavedUnread extends Error {
  override name = "SavedUnread";
}

export class ConfirmNeeded extends Error {
  override name = "ConfirmNeeded";
  constructor(
    readonly token: string,
    readonly from: string[],
    readonly to: string[],
  ) {
    super("confirm");
  }
}

export async function saveTransaction(save: TransactionSave, scopes: EditMenus["scopes"], confirm?: string): Promise<TransactionRow> {
  const { id, version } = save;
  const ops: Record<string, unknown>[] = [
    { op: "update_transaction", id, version, review_status: "reviewed", ...(save.payee === undefined ? {} : { payee: save.payee }), ...(save.notes === undefined ? {} : { notes: save.notes }) },
  ];
  if (save.category_id !== undefined) {
    const named = scopes.find((s) => s.id === save.scope);
    if (save.scope !== undefined && named?.business !== true && named?.asset !== true) throw new PageError(word("failRefused"));
    const scope = named?.business === true ? { entity_id: named.id } : named?.asset === true ? { asset_id: named.id } : {};
    ops.push({ op: "set_splits", id, version, splits: [{ category: save.category_id, ...scope }] });
  }
  if (save.tags !== undefined) ops.push({ op: "set_tags", id, version, tags: save.tags });
  const answer = await write<EditAnswer>("edit", { reason: "transaction_edit", ops, ...(confirm === undefined ? {} : { confirm_token: confirm }) });
  if (answer.confirm_required === true && answer.confirm_token !== undefined) {
    const [change] = answer.scope_changes ?? [];
    const names = (shares: ScopeShare[] | undefined): string[] => (shares ?? []).flatMap((share) => (share.name === null ? [] : [share.name]));
    throw new ConfirmNeeded(answer.confirm_token, names(change?.before), names(change?.after));
  }
  menusRead = null;
  noteStamp("transactions", null);
  return transactionRow(id).catch(() => {
    throw new SavedUnread();
  });
}

export async function transactionsPage(args: TransactionsArgs, size: number): Promise<TransactionsPage> {
  return pageOf(await read<ListAnswer>("show_transactions", { ...args, limit: size }));
}

const accountOf = (row: AccountRow): AccountItem => ({
  id: row.id,
  name: row.name,
  type: row.type,
  balance: row.balance === "" ? word("detailNone") : row.balance,
  closed: row.closed === true,
  empty: row.empty === true,
  business: row.business === true,
  asset: row.asset === true,
});

export async function accountsView(): Promise<AccountsView> {
  const answer = await read<AccountsAnswer>("show_accounts", {});
  const total = (key: AccountsAnswer["totals"][number]["key"]): string => answer.totals.find((t) => t.key === key)?.value ?? "";
  const owners: AccountOwner[] = answer.owners.map((owner) => ({
    key: owner.id,
    name: owner.name,
    business: owner.business,
    total: owner.total,
    count: owner.number,
    sections: owner.sections.map(
      (section): AccountsSection => ({
        key: section.name,
        name: section.name,
        total: section.total,
        count: section.number,
        accounts: [...(section.rows ?? []), ...(section.groups ?? []).flatMap((group) => group.rows)].map(accountOf),
        groups: section.groups === undefined ? null : section.groups.map((group) => ({ key: group.name, name: group.name, total: group.total, count: group.number, accounts: group.rows.map(accountOf) })),
      }),
    ),
  }));
  const scopes = answer.businesses_and_assets;
  return {
    stamp: stampIn(answer),
    totals: { net_worth: total("net_worth"), held: total("held"), owed: total("owed"), accounts: answer.accounts },
    owners,
    scope_card: scopes.top.length === 0 ? null : { total: scopes.total, count: scopes.count, top: scopes.top.map((top) => ({ id: top.id, name: top.name, kind: top.kind, total: top.total, business: top.business === true, asset: top.asset === true })) },
  };
}

function ownersOf(answer: SpendingAnswer): SpendingOwner[] {
  return answer.owners.map((owner) => {
    const parents: CategoryParent[] = [];
    for (const row of owner.rows) {
      const total: CategoryTotal = { id: row.id, name: row.category, spent: row.spent, count: row.transactions, show: row.show };
      if (row.parent) parents.push({ ...total, categories: [] });
      else parents.find((parent) => parent.id === row.parent_id)?.categories.push(total);
    }
    return { key: owner.id, name: owner.name, business: owner.business, asset: owner.asset === true, spent: owner.spent, count: owner.count, parents };
  });
}

const statOf = (answer: SpendingAnswer, key: SpendingAnswer["stats"][number]["key"]): string | undefined => answer.stats.find((stat) => stat.key === key)?.value;

function monthsOf(answer: SpendingAnswer, shown: string): SpendingMonth[] {
  const purchases = statOf(answer, "purchases") ?? "";
  return answer.months.rows.map((row) => ({ month: row.key, label: row.month, short: row.short, spent_cents: row.spent_cents, spent: row.spent, income: row.income, purchases: row.key === shown ? purchases : "" }));
}

function joinStamp(view: SpendingView, answer: unknown): void {
  const stamp = stampIn(answer);
  view.stamp = view.stamp === undefined || view.stamp === stamp ? stamp : null;
}

export async function readMonth(view: SpendingView, month: string): Promise<void> {
  const answer = await read<SpendingAnswer>("show_spending", { month });
  joinStamp(view, answer);
  view.spending[month] = ownersOf(answer);
  const line = view.months.find((m) => m.month === month);
  if (line !== undefined) Object.assign(line, { spent: statOf(answer, "spent") ?? line.spent, income: statOf(answer, "income") ?? line.income, purchases: statOf(answer, "purchases") ?? "" });
}

export async function readDefault(view: SpendingView): Promise<void> {
  const answer = await read<SpendingAnswer>("show_spending", {});
  joinStamp(view, answer);
  const shown = answer.months.rows.find((row) => row.shown)?.key ?? "";
  view.months = monthsOf(answer, shown);
  view.spending[shown] = ownersOf(answer);
  view.own = shown;
}
