// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import categoryList from "../../../categories/categories.json" with { type: "json" };
import type { AccountRow, AccountsAnswer, EditAnswer, EditValues, FactKey, ListAnswer, MenusAnswer, MonthRow, PendingListRow, PostedListRow, PostedText, Refusal, RowText, Scoped, SpendingAnswer, SpendingRow, SplitLines, StampAnswer, TransactionAnswer, TransactionBadge } from "../clyde.ts";
import { type CategoryNode, type CategoryRoot, UNCATEGORIZED } from "../types.ts";
import { ACCOUNTS, type AccountDescription, BUSINESSES, type Entry, MERCHANTS, NEW_SINCE, NOW, PATTERNS_END, PENDING, SHOWCASE, START, TRANSFERS, type When } from "./ledger.ts";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthOf = (date: string): number => Number(date.slice(5, 7)) - 1;
const dateText = (date: string): string => `${MONTHS[monthOf(date)]!.slice(0, 3)} ${Number(date.slice(8, 10))}, ${date.slice(0, 4)}`;
const monthText = (month: string): string => `${MONTHS[monthOf(month)]} ${month.slice(0, 4)}`;
const count = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const money = (cents: number): string => `${cents < 0 ? "-" : ""}$${count(Math.floor(Math.abs(cents) / 100))}.${String(Math.abs(cents) % 100).padStart(2, "0")}`;
const amountText = (cents: number): string => (cents > 0 ? `+${money(cents)}` : money(-cents));
const counted = (n: number, one: string, many: string): string => `${count(n)} ${n === 1 ? one : many}`;
const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const DAY = 86_400_000;
const dayOf = (date: string): number => Date.UTC(Number(date.slice(0, 4)), monthOf(date), Number(date.slice(8, 10))) / DAY;
const dateOf = (day: number): string => new Date(day * DAY).toISOString().slice(0, 10);
const monthLength = (month: string): number => new Date(Date.UTC(Number(month.slice(0, 4)), monthOf(month) + 1, 0)).getUTCDate();
function monthPlus(month: string, n: number): string {
  const at = Number(month.slice(0, 4)) * 12 + monthOf(month) + n;
  return `${Math.floor(at / 12)}-${String((at % 12) + 1).padStart(2, "0")}`;
}
const CURRENT = new Date(NOW).toISOString().slice(0, 7);
const PATTERN_MONTHS = (() => {
  const months = [START.slice(0, 7)];
  while (months.at(-1)! < PATTERNS_END.slice(0, 7)) months.push(monthPlus(months.at(-1)!, 1));
  return months;
})();

function random(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function datesOf(when: When, next: () => number): string[] {
  const inRange = (date: string): boolean => date >= START && date <= PATTERNS_END;
  if ("every" in when) {
    const dates: string[] = [];
    for (let day = dayOf(START) + when.from - 1; day <= dayOf(PATTERNS_END); day += when.every) dates.push(dateOf(day));
    return dates;
  }
  return PATTERN_MONTHS.flatMap((month) => {
    if ("perMonth" in when) {
      const days = new Set<number>();
      while (days.size < when.perMonth) days.add(1 + Math.floor(next() * monthLength(month)));
      return [...days].sort((a, b) => a - b).map((day) => `${month}-${String(day).padStart(2, "0")}`);
    }
    if (when.months !== undefined && !when.months.includes(monthOf(month) + 1)) return [];
    return when.days.map((day) => `${month}-${String(Math.min(day, monthLength(month))).padStart(2, "0")}`);
  }).filter(inRange);
}

interface Category {
  id: string;
  root: CategoryRoot;
  parent_id: string | null;
  name: string;
  type: "expense" | "income" | "transfer";
  schedule_c_line: string | null;
  schedule_e_line: string | null;
}
const CATEGORIES = new Map((categoryList as Category[]).map((category) => [category.id, category]));
const categoryOf = (id: string): Category => {
  const category = CATEGORIES.get(id);
  if (category === undefined) throw new Error(`preview ledger: no category ${id}`);
  return category;
};
const topOf = (id: string): Category => {
  const category = categoryOf(id);
  return category.parent_id === null ? category : topOf(category.parent_id);
};
const under = (id: string, ancestor: string): boolean => {
  const { parent_id } = categoryOf(id);
  return id === ancestor || (parent_id !== null && under(parent_id, ancestor));
};

interface Line {
  category: string | null;
  cents: number;
  scope?: string;
}

interface Transaction {
  id: string;
  version: number;
  date: string;
  account: string;
  payee: string;
  statement: string;
  lines: Line[];
  tags: string[];
  notes: string;
  isNew: boolean;
  flagged: boolean;
  duplicate: boolean;
  link?: string;
  opening?: true;
}

const ACCOUNT = new Map(ACCOUNTS.map((account) => [account.id, account]));
const accountOf = (id: string): AccountDescription => {
  const account = ACCOUNT.get(id);
  if (account === undefined) throw new Error(`preview ledger: no account ${id}`);
  return account;
};
const BUSINESS = new Map(BUSINESSES.map((business) => [business.id, business]));
const centsOf = (transaction: { lines: Line[] }): number => transaction.lines.reduce((sum, line) => sum + line.cents, 0);

type Draft = Omit<Transaction, "id" | "version"> & { rank: number; seq: number };

function buildTransactions(): Transaction[] {
  const drafts: Draft[] = [];
  const add = (draft: Omit<Draft, "seq" | "tags" | "notes" | "isNew" | "flagged" | "duplicate"> & Partial<Pick<Draft, "tags" | "notes" | "isNew" | "flagged" | "duplicate">>): void => {
    drafts.push({ tags: [], notes: "", isNew: draft.date >= NEW_SINCE, flagged: false, duplicate: false, ...draft, seq: drafts.length });
  };

  for (const merchant of MERCHANTS) {
    const next = random(`${merchant.payee} ${merchant.account}`);
    for (const date of datesOf(merchant.when, next)) {
      const size = typeof merchant.cents === "number" ? merchant.cents : merchant.cents[0] + Math.round(next() * (merchant.cents[1] - merchant.cents[0]));
      const sign = merchant.in === true ? 1 : -1;
      const lines: Line[] = merchant.lines?.map((line) => ({ category: line.category, cents: -line.cents, ...(line.scope === undefined ? {} : { scope: line.scope }) })) ?? [{ category: merchant.category, cents: sign * size, ...(merchant.scope === undefined ? {} : { scope: merchant.scope }) }];
      add({ date, account: merchant.account, payee: merchant.payee, statement: merchant.statement, lines, rank: 100, ...(merchant.tags === undefined ? {} : { tags: [...merchant.tags] }), ...(merchant.notes === undefined ? {} : { notes: merchant.notes }) });
      const mirror = merchant.mirror;
      if (mirror !== undefined) add({ date, account: mirror.account, payee: mirror.payee, statement: mirror.statement, lines: [{ category: mirror.category, cents: mirror.cents }], rank: 100 });
    }
  }

  const charges = (card: string, month: string): number => -drafts.filter((d) => d.account === card && d.date.startsWith(month) && d.link === undefined).reduce((sum, d) => sum + centsOf(d), 0);
  for (const transfer of TRANSFERS) {
    for (const month of PATTERN_MONTHS) {
      for (const day of transfer.days) {
        const date = `${month}-${String(Math.min(day, monthLength(month))).padStart(2, "0")}`;
        if (date < START || date > PATTERNS_END) continue;
        const cents = transfer.cents === "card" ? charges(transfer.to, monthPlus(month, -1)) : transfer.cents;
        if (cents <= 0) continue;
        const link = (other: string) => (transfer.linked ? { link: other } : {});
        add({ date, account: transfer.from, payee: transfer.out.payee ?? accountOf(transfer.to).name, statement: transfer.out.statement, lines: [{ category: transfer.out.category, cents: -cents }], rank: 100, ...link(transfer.to) });
        add({ date, account: transfer.to, payee: transfer.into.payee ?? accountOf(transfer.from).name, statement: transfer.into.statement, lines: [{ category: transfer.into.category, cents }], rank: 100, ...link(transfer.from) });
      }
    }
  }

  SHOWCASE.forEach((entry: Entry, i) => {
    const lines = entry.lines.map((line) => ({ category: line.category, cents: line.cents, ...(line.scope === undefined ? {} : { scope: line.scope }) }));
    const flags = { isNew: entry.new === true, flagged: entry.flagged === true, duplicate: entry.duplicate === true };
    add({ date: entry.date, account: entry.account, payee: entry.payee, statement: entry.statement, lines, rank: i, ...flags, tags: [...(entry.tags ?? [])], notes: entry.notes ?? "", ...(entry.transfer === undefined ? {} : { link: entry.transfer.to }) });
    const other = entry.transfer;
    if (other !== undefined) add({ date: entry.date, account: other.to, payee: other.payee, statement: other.statement, lines: [{ category: "transfers.transfer.transfer_in", cents: -lines[0]!.cents }], rank: SHOWCASE.length, isNew: false, link: entry.account });
  });

  for (const account of ACCOUNTS) {
    if (account.balance === undefined || account.empty === true) continue;
    const moved = drafts.filter((d) => d.account === account.id).reduce((sum, d) => sum + centsOf(d), 0);
    add({ date: START, account: account.id, payee: "Opening balance", statement: "Opening balance", lines: [{ category: "transfers.opening_balance", cents: account.balance - moved }], rank: 1000, isNew: false, opening: true });
  }

  for (const draft of drafts) for (const line of draft.lines) if (line.category !== null) categoryOf(line.category);
  drafts.sort((a, b) => byText(b.date, a.date) || a.rank - b.rank || a.seq - b.seq);
  return drafts.map(({ rank: _rank, seq: _seq, ...draft }, i) => ({ id: `txn_${i + 1}`, version: 1, ...draft, tags: [...draft.tags].sort(byText) }));
}

const businessLine = (line: Line): boolean => line.category !== null && categoryOf(line.category).root === "business";
const lineName = (line: Line): string => (line.category === null ? "Uncategorized" : categoryOf(line.category).name);
const scopedOf = (lines: Line[]): Scoped => ({
  ...(lines.some((line) => line.scope !== undefined && BUSINESS.has(line.scope)) ? { business: true as const } : {}),
  ...(lines.some((line) => line.scope !== undefined && !BUSINESS.has(line.scope)) ? { asset: true as const } : {}),
});
const directionOf = (cents: number): Pick<RowText, "direction"> => (cents === 0 ? {} : { direction: cents > 0 ? "in" : "out" });

const ownerOf = (transaction: Transaction, line: Line): string => line.scope ?? accountOf(transaction.account).owner ?? "personal";

function scopeText(scope: string, category: string | null): string {
  const business = BUSINESS.get(scope);
  const name = business?.name ?? accountOf(scope).name;
  const form = business?.form ?? "E";
  const line = category === null ? null : form === "C" ? categoryOf(category).schedule_c_line : categoryOf(category).schedule_e_line;
  return line === null ? name : `${name} (Sch ${form} L${line})`;
}

function rowText(transaction: Transaction): PostedText {
  const { lines } = transaction;
  const cents = centsOf(transaction);
  const split = lines.length > 1;
  const mark = split ? (lines.some(businessLine) ? "split_business" : "split") : businessLine(lines[0]!) ? "business" : undefined;
  return {
    date: dateText(transaction.date),
    account: accountOf(transaction.account).name,
    payee: transaction.payee,
    category_name: split ? "Split" : transaction.link !== undefined ? accountOf(transaction.link).name : lineName(lines[0]!),
    ...(mark === undefined ? {} : { mark }),
    tags: transaction.tags.join(", "),
    notes: transaction.notes,
    amount: amountText(cents),
    ...directionOf(cents),
    ...scopedOf(lines),
  };
}

function badgesOf(transaction: Transaction): TransactionBadge[] {
  return [
    ...(transaction.isNew ? [{ key: "new" as const, text: "New", meaning: "information" as const }] : []),
    ...(transaction.duplicate ? [{ key: "possible_duplicate" as const, text: "Possible duplicate", meaning: "warning" as const }] : []),
    ...(transaction.flagged ? [{ key: "flagged" as const, text: "Flagged", meaning: "warning" as const }] : []),
  ];
}

function factsOf(transaction: Transaction): { key: FactKey; value: string }[] {
  const account = accountOf(transaction.account);
  const scopes = [...new Set(transaction.lines.flatMap((line) => (line.scope === undefined ? [] : [scopeText(line.scope, line.category)])))];
  return [
    { key: "posted" as const, value: dateText(transaction.date) },
    { key: "statement_description" as const, value: transaction.statement },
    ...(account.sourceName === undefined ? [] : [{ key: "statement_account" as const, value: account.sourceName }]),
    { key: "account" as const, value: account.name },
    ...(scopes.length === 0 ? [] : [{ key: "for" as const, value: scopes.join(", ") }]),
    ...(account.cardDates === true && transaction.opening !== true ? [{ key: "transacted" as const, value: dateText(dateOf(dayOf(transaction.date) - 1)) }] : []),
  ];
}

const splitsOf = (transaction: Transaction): SplitLines | null =>
  transaction.lines.length < 2
    ? null
    : {
        columns: [
          { key: "category", label: "Category", type: "text" },
          { key: "amount", label: "Amount", type: "money" },
        ],
        rows: transaction.lines.map((line) => ({ category_name: lineName(line), ...(businessLine(line) ? { mark: "business" as const } : {}), amount: amountText(line.cents), ...directionOf(line.cents), ...scopedOf([line]) })),
      };

function editOf(transaction: Transaction): EditValues {
  const one = transaction.lines.length === 1 ? transaction.lines[0]! : null;
  return { payee: transaction.payee, category_id: one?.category ?? null, scope_id: one?.scope ?? null, tags: [...transaction.tags], notes: transaction.notes };
}

export class Refused extends Error {
  override name = "Refused";
  readonly refusal: Refusal;
  constructor(refusal: Refusal) {
    super(refusal.message);
    this.refusal = refusal;
  }
}
const refuse = (error: string, message: string, details?: Record<string, number>): never => {
  throw new Refused({ error, message, ...(details === undefined ? {} : { details }) });
};

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const checkMonth = (month: string): void => {
  if (!MONTH.test(month)) refuse("validation", `${month} is not a month: use YYYY-MM.`);
};
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isAsset = (id: string): boolean => ACCOUNTS.some((a) => a.id === id && a.asset === true);
const knownOwner = (id: string): boolean => id === "personal" || BUSINESS.has(id) || isAsset(id);

interface Filter {
  account?: string;
  category?: string;
  exact?: boolean;
  owner?: string;
  month?: string;
  from?: string;
  to?: string;
  spending?: boolean;
  search?: string;
  sort?: string;
  direction?: "asc" | "desc";
  limit?: number;
  offset?: number;
}
const FILTERS = ["account", "category", "owner", "month", "from", "to", "spending"] as const;
const SORTS = ["date", "account", "payee", "category", "tags", "notes", "amount"];

const CONFIRM_TOKEN = "preview-confirm";

export interface Preview {
  call(tool: string, input: Record<string, unknown>): unknown;
  change(id: string, payee: string): void;
}

export function preview(): Preview {
  const transactions = buildTransactions();
  const byId = new Map(transactions.map((t) => [t.id, t]));
  let stamp = 1;
  const stamped = <T extends object>(answer: T): T & { stamp: string } => ({ ...answer, stamp: String(stamp) });

  const ownerId = (owner: string): string => (owner.toLowerCase() === "personal" ? "personal" : (BUSINESSES.find((b) => b.id === owner || b.name === owner)?.id ?? ACCOUNTS.find((a) => a.asset === true && (a.id === owner || a.name === owner))?.id ?? owner));
  const ownerName = (owner: string): string => (owner === "personal" ? "Personal" : (BUSINESS.get(owner)?.name ?? accountOf(owner).name));
  const accountId = (account: string): string => ACCOUNTS.find((a) => a.id === account || a.name === account)?.id ?? account;
  const isSpending = (line: Line): boolean => (line.category === null ? line.cents < 0 : categoryOf(line.category).type === "expense");
  const isIncome = (line: Line): boolean => (line.category === null ? line.cents > 0 : categoryOf(line.category).type === "income");

  function lineMatches(transaction: Transaction, line: Line, filter: Filter): boolean {
    if (filter.spending === true && !isSpending(line)) return false;
    if (filter.owner !== undefined && ownerOf(transaction, line) !== ownerId(filter.owner)) return false;
    if (filter.category === undefined) return true;
    if (filter.category === UNCATEGORIZED) return line.category === null;
    if (line.category === null) return false;
    return filter.exact === true ? line.category === filter.category : under(line.category, filter.category);
  }

  const searchText = (transaction: Transaction): string => {
    const row = rowText(transaction);
    return [row.payee, transaction.statement, row.notes, row.tags, row.category_name, row.account, row.amount].join(" ").toLowerCase();
  };

  function matches(transaction: Transaction, filter: Filter, query: string): boolean {
    if (filter.account !== undefined && transaction.account !== accountId(filter.account)) return false;
    if (filter.month !== undefined && !transaction.date.startsWith(filter.month)) return false;
    if (filter.from !== undefined && transaction.date < filter.from) return false;
    if (filter.to !== undefined && transaction.date > filter.to) return false;
    if ((filter.category !== undefined || filter.owner !== undefined || filter.spending === true) && !transaction.lines.some((line) => lineMatches(transaction, line, filter))) return false;
    return query === "" || searchText(transaction).includes(query);
  }

  function chipOf(filter: Filter): string | null {
    if (filter.account !== undefined) return accountOf(accountId(filter.account)).name;
    if (filter.category !== undefined) return filter.category === UNCATEGORIZED ? "Uncategorized" : categoryOf(filter.category).name;
    if (filter.owner !== undefined) return ownerName(ownerId(filter.owner));
    if (filter.month !== undefined) return monthText(filter.month);
    if (filter.spending === true) return "Spending";
    return null;
  }

  function sorted(rows: Transaction[], sort: string, direction: "asc" | "desc"): Transaction[] {
    if (sort === "date") return direction === "asc" ? [...rows].reverse() : rows;
    const at = new Map(rows.map((row, i) => [row.id, i]));
    const value = (t: Transaction): string | number => {
      if (sort === "amount") return Math.abs(centsOf(t));
      const row = rowText(t);
      return (sort === "category" ? row.category_name : row[sort as "account" | "payee" | "tags" | "notes"]).toLowerCase();
    };
    const sign = direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const [x, y] = [value(a), value(b)];
      if (x === "" || y === "") return x === y ? at.get(a.id)! - at.get(b.id)! : x === "" ? 1 : -1;
      return sign * (typeof x === "number" ? x - (y as number) : byText(x, y as string)) || at.get(a.id)! - at.get(b.id)!;
    });
  }

  function listRow(transaction: Transaction, number: number): PostedListRow {
    const badges = badgesOf(transaction);
    return { number: count(number), ...rowText(transaction), id: transaction.id, version: transaction.version, ...(badges.length === 0 ? {} : { badges }) };
  }

  const pendingRows: { held: string; row: PendingListRow }[] = PENDING.map((p, i) => ({
    held: p.account,
    row: {
      pending: true,
      number: `P${i + 1}`,
      date: dateText(p.date),
      account: accountOf(p.account).name,
      payee: p.statement,
      category: "Pending",
      statement_description: p.statement,
      tags: "",
      notes: "",
      amount: amountText(-p.cents),
      direction: "out",
      seen: dateText(p.seen),
    },
  }));

  function list(input: Filter): ListAnswer {
    const { limit = 20, offset = 0, search = "", sort = "date", direction = sort === "date" || sort === "amount" ? "desc" : "asc" } = input;
    if (!SORTS.includes(sort)) refuse("validation", `There is no sort ${sort}.`);
    if (input.month !== undefined && (input.from !== undefined || input.to !== undefined)) refuse("validation", "Choose a month or a range of days, not both.");
    if (typeof search !== "string") refuse("validation", "A search is text.");
    if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(offset) || offset < 0) refuse("validation", "limit is a whole number from 1, and offset one from 0.");
    if (input.month !== undefined) checkMonth(input.month);
    for (const day of [input.from, input.to]) if (day !== undefined && !DATE.test(day)) refuse("validation", `${day} is not a day: use YYYY-MM-DD.`);
    if (input.direction !== undefined && input.direction !== "asc" && input.direction !== "desc") refuse("validation", "direction is asc or desc.");
    if (input.account !== undefined && !ACCOUNTS.some((a) => a.id === input.account || a.name === input.account)) refuse("not_found", `There is no account ${input.account}.`);
    if (input.category !== undefined && input.category !== UNCATEGORIZED && !CATEGORIES.has(input.category)) refuse("not_found", `There is no category ${input.category}.`);
    if (input.owner !== undefined && !knownOwner(ownerId(input.owner))) refuse("not_found", `There is no owner ${input.owner}.`);
    const query = search.trim().toLowerCase();
    const rows = sorted(transactions.filter((t) => matches(t, input, query)), sort, direction);
    const set = (key: (typeof FILTERS)[number]): boolean => input[key] !== undefined && input[key] !== false;
    const pendingOn = offset === 0 && !FILTERS.some((key) => key !== "account" && set(key));
    const pending = pendingOn
      ? pendingRows.filter(({ held, row }) => (input.account === undefined || held === accountId(input.account)) && (query === "" || [row.payee, row.account, row.amount].join(" ").toLowerCase().includes(query))).map(({ row }) => row)
      : [];
    const page = rows.slice(offset, offset + limit);
    const posted: ListAnswer["sections"] = [];
    page.forEach((t, i) => {
      const label = sort === "date" ? monthText(t.date.slice(0, 7)) : null;
      const last = posted.at(-1);
      if (last !== undefined && last.label === label) last.rows.push(listRow(t, offset + i + 1));
      else posted.push({ label, rows: [listRow(t, offset + i + 1)] });
    });
    const pendingSection = pending.length === 0 ? [] : [{ label: "Pending", rows: pending }];
    const head = {
      heading: FILTERS.some(set) || query !== "" ? counted(rows.length, "match", "matches") : `Transactions \u00b7 ${count(rows.length)}`,
      chip: chipOf(input),
      next: offset + limit < rows.length ? { offset: offset + limit } : null,
    };
    if (posted.length === 0 && pendingSection.length === 0) return stamped({ ...head, sections: [], empty: "There are no transactions to show." });
    return stamped({ ...head, sections: sort === "date" && direction === "asc" ? [...posted, ...pendingSection] : [...pendingSection, ...posted] });
  }

  const found = (id: unknown): Transaction => byId.get(String(id)) ?? refuse("not_found", `There is no transaction ${String(id)}.`);

  function one(id: unknown): TransactionAnswer {
    const transaction = found(id);
    return stamped({ row: { ...rowText(transaction), id: transaction.id, version: transaction.version }, badges: badgesOf(transaction), facts: factsOf(transaction), edit: editOf(transaction), splits: splitsOf(transaction) });
  }

  function menus(): MenusAnswer {
    const used = new Set(transactions.flatMap((t) => t.lines.flatMap((line) => (line.category === null ? [] : [line.category, topOf(line.category).id]))));
    const live = [...CATEGORIES.values()].filter((category) => used.has(category.id));
    const categories: CategoryNode[] = [];
    for (const root of ["personal", "business", "transfers"] as const) {
      for (const top of live.filter((c) => c.root === root && c.parent_id === null).sort((a, b) => byText(a.name, b.name))) {
        categories.push({ id: top.id, name: top.name, root, parent_id: null });
        for (const child of live.filter((c) => c.parent_id === top.id).sort((a, b) => byText(a.name, b.name))) categories.push({ id: child.id, name: child.name, root, parent_id: top.id });
      }
    }
    const scopes = [...[...BUSINESSES].sort((a, b) => byText(a.name, b.name)).map((b) => ({ id: b.id, name: b.name, business: true as const })), ...ACCOUNTS.filter((a) => a.asset === true && a.closed !== true).sort((a, b) => byText(a.name, b.name)).map((a) => ({ id: a.id, name: a.name, asset: true as const }))];
    const uses = new Map<string, number>();
    for (const t of transactions) if (t.opening !== true && t.payee !== "") uses.set(t.payee, (uses.get(t.payee) ?? 0) + 1);
    const payees = [...uses].sort(([a, x], [b, y]) => y - x || byText(a, b)).map(([payee]) => payee);
    return stamped({ menus: { categories, scopes, payees } });
  }

  function transactionsAnswer(input: Record<string, unknown>): ListAnswer | TransactionAnswer | MenusAnswer | StampAnswer {
    const alone = (field: string): void => {
      if (Object.keys(input).some((key) => key !== field)) refuse("validation", `${field} takes no other field.`);
    };
    if (input.stamp === true) {
      alone("stamp");
      return { stamp: String(stamp) };
    }
    if (input.menus === true) {
      alone("menus");
      return menus();
    }
    if (input.transaction !== undefined) {
      alone("transaction");
      return one(input.transaction);
    }
    return list(input as Filter);
  }

  const balanceOf = (account: AccountDescription): number => (account.empty === true ? (account.balance ?? 0) : transactions.filter((t) => t.account === account.id).reduce((sum, t) => sum + centsOf(t), 0));

  const PLACES: Record<AccountDescription["type"], [section: string, group: string]> = {
    Checking: ["Banking", "Cash and checking"],
    "Credit Card": ["Banking", "Credit"],
    Savings: ["Banking", "Savings"],
    Brokerage: ["Investments", "Brokerage"],
    IRA: ["Investments", "Retirement"],
    "Real Estate": ["Assets", "Real Estate"],
    Mortgage: ["Loans", "Mortgage"],
  };
  const SECTIONS = ["Banking", "Investments", "Assets", "Loans"];
  const GROUPS = [...new Set(Object.values(PLACES).map(([, group]) => group))];

  function accounts(): AccountsAnswer {
    const balances = new Map(ACCOUNTS.map((a) => [a.id, balanceOf(a)]));
    const sum = (list: AccountDescription[]): number => list.reduce((s, a) => s + balances.get(a.id)!, 0);
    const rowOf = (account: AccountDescription): AccountRow => ({
      id: account.id,
      name: account.name,
      type: account.type,
      balance: account.balance === undefined && account.empty === true ? "" : money(balances.get(account.id)!),
      ...(account.closed === true ? { closed: true as const } : {}),
      ...(account.empty === true ? { empty: true as const } : {}),
      ...(account.owner === undefined ? {} : { business: true as const }),
      ...(account.asset === true ? { asset: true as const } : {}),
    });
    const owners = [{ id: undefined, name: "Personal", business: false }, ...[...BUSINESSES].sort((a, b) => byText(a.name, b.name)).map((b) => ({ id: b.id, name: b.name, business: true }))].flatMap((owner) => {
      const held = ACCOUNTS.filter((a) => a.owner === owner.id);
      if (held.length === 0) return [];
      const sections: AccountsAnswer["owners"][number]["sections"] = SECTIONS.flatMap((name): AccountsAnswer["owners"][number]["sections"] => {
        const inSection = held.filter((a) => PLACES[a.type][0] === name).sort((a, b) => GROUPS.indexOf(PLACES[a.type][1]) - GROUPS.indexOf(PLACES[b.type][1]) || byText(a.name, b.name));
        if (inSection.length === 0) return [];
        const head = { name, total: money(sum(inSection)), number: count(inSection.length) };
        if (inSection.length <= 6) return [{ ...head, rows: inSection.map(rowOf) }];
        const groups = GROUPS.flatMap((group) => {
          const inGroup = inSection.filter((a) => PLACES[a.type][1] === group);
          return inGroup.length === 0 ? [] : [{ name: group, total: money(sum(inGroup)), number: count(inGroup.length), rows: inGroup.map(rowOf) }];
        });
        return [{ ...head, groups }];
      });
      return [{ id: owner.id ?? "personal", name: owner.name, business: owner.business, total: money(sum(held)), number: count(held.length), sections }];
    });
    const all = [...balances.values()];
    const scoped = [
      ...BUSINESSES.flatMap((b) => {
        const open = ACCOUNTS.filter((a) => a.owner === b.id && a.closed !== true);
        return open.length === 0 ? [] : [{ id: b.id, name: b.name, kind: "Business", cents: sum(open), business: true as const }];
      }),
      ...ACCOUNTS.filter((a) => a.asset === true && a.owner === undefined && a.closed !== true).map((a) => ({ id: a.id, name: a.name, kind: a.type, cents: balances.get(a.id)!, asset: true as const })),
    ];
    const top = [...scoped].sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents)).slice(0, 2);
    return stamped({
      totals: [
        { key: "net_worth" as const, value: money(all.reduce((s, c) => s + c, 0)) },
        { key: "held" as const, value: money(all.filter((c) => c > 0).reduce((s, c) => s + c, 0)) },
        { key: "owed" as const, value: money(-all.filter((c) => c < 0).reduce((s, c) => s + c, 0)) },
      ],
      accounts: counted(ACCOUNTS.length, "account", "accounts"),
      businesses_and_assets: { total: money(scoped.reduce((s, x) => s + x.cents, 0)), count: count(scoped.length), top: top.map(({ cents, ...rest }) => ({ ...rest, total: money(cents) })) },
      owners,
    });
  }

  type Spent = { transaction: Transaction; line: Line; owner: string };
  const tally = (items: Spent[]): { cents: number; transactions: number } => ({ cents: -items.reduce((s, x) => s + x.line.cents, 0), transactions: new Set(items.map((x) => x.transaction.id)).size });
  const nameOf = (id: string): string => (id === UNCATEGORIZED ? "Uncategorized" : categoryOf(id).name);
  const idOf = (id: string): string | null => (id === UNCATEGORIZED ? null : id);

  function tallyMonth(month: string): { spent: Spent[]; income: number } {
    const spent: Spent[] = [];
    let income = 0;
    for (const t of transactions) {
      if (!t.date.startsWith(month)) continue;
      for (const line of t.lines) {
        if (isSpending(line)) spent.push({ transaction: t, line, owner: ownerOf(t, line) });
        else if (isIncome(line)) income += line.cents;
      }
    }
    return { spent, income };
  }

  function spending(input: Record<string, unknown>): SpendingAnswer {
    if (input.from !== undefined || input.to !== undefined) refuse("validation", "The preview has spending by month only.");
    const asked = typeof input.month === "string" ? input.month : undefined;
    const month = asked ?? monthPlus(CURRENT, -1);
    checkMonth(month);
    const through = asked === undefined ? CURRENT : month;
    const { spent, income } = tallyMonth(month);
    const { cents: total, transactions: purchases } = tally(spent);
    const bySpent = <T extends { name: string; cents: number }>(a: T, b: T): number => b.cents - a.cents || byText(a.name, b.name);
    const groupBy = (items: Spent[], key: (x: Spent) => string): Map<string, Spent[]> => {
      const groups = new Map<string, Spent[]>();
      for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
      return groups;
    };
    const owners = [...groupBy(spent, (x) => x.owner)]
      .map(([owner, items]) => ({ owner, items, name: ownerName(owner), ...tally(items) }))
      .sort((a, b) => (a.owner === "personal" ? -1 : b.owner === "personal" ? 1 : byText(a.name, b.name)))
      .map(({ owner, items, name, cents, transactions: n }) => {
        const parents = [...groupBy(items, (x) => (x.line.category === null ? UNCATEGORIZED : topOf(x.line.category).id))].map(([id, under]) => ({ id, under, name: nameOf(id), ...tally(under) })).sort(bySpent);
        const rows: SpendingRow[] = parents.flatMap((parent) => [
          { id: idOf(parent.id), category: parent.name, transactions: count(parent.transactions), spent: money(parent.cents), parent: true, show: { category: parent.id, owner, month, spending: true } },
          ...[...groupBy(parent.under, (x) => x.line.category ?? UNCATEGORIZED)]
            .map(([id, under]) => ({ id, name: nameOf(id), ...tally(under) }))
            .sort(bySpent)
            .map((child) => ({ id: idOf(child.id), parent_id: idOf(parent.id), category: child.name, transactions: count(child.transactions), spent: money(child.cents), parent: false, show: { category: child.id, exact: true, owner, month, spending: true } })),
        ]);
        return { id: owner, name, spent: money(cents), count: counted(n, "transaction", "transactions"), business: BUSINESS.has(owner), ...(owner !== "personal" && !BUSINESS.has(owner) ? { asset: true as const } : {}), rows };
      });
    const months: MonthRow[] = Array.from({ length: 12 }, (_, i) => monthPlus(through, i - 11)).map((key) => {
      const m = tallyMonth(key);
      const cents = tally(m.spent).cents;
      return { month: monthText(key), spent: money(cents), income: money(m.income), shown: key === month, key, short: MONTHS[monthOf(key)]!.slice(0, 3), spent_cents: cents };
    });
    return stamped({
      stats: [
        { key: "spent" as const, value: money(total) },
        { key: "income" as const, value: money(income) },
        { key: "purchases" as const, value: count(purchases) },
      ],
      owners,
      months: { rows: months },
    });
  }

  const shareOf = (scope: string | null): { name: string | null } => ({ name: scope === null ? null : ownerName(scope) });

  function edit(input: Record<string, unknown>): EditAnswer {
    const given: unknown[] = Array.isArray(input.ops) ? input.ops : [];
    if (given.length === 0) refuse("validation", "edit needs ops.");
    if (!given.every(isRecord)) refuse("validation", "Each op is an object.");
    const ops = given as Record<string, unknown>[];
    if (ops.some((op) => typeof op.version !== "number")) refuse("validation", "Each op needs the version it was read at.");
    const transaction = found(ops[0]!.id);
    if (ops.some((op) => op.id !== transaction.id)) refuse("validation", "The preview edits one transaction at a time.");
    if (ops.some((op) => op.version !== transaction.version)) refuse("conflict", "This transaction changed since you read it.", { [transaction.id]: transaction.version });
    let payee: string | undefined;
    let notes: string | undefined;
    let reviewed = false;
    let line: { category: string | null; entity_id?: string; asset_id?: string } | undefined;
    let tags: string[] | undefined;
    for (const op of ops) {
      if (op.op === "update_transaction") {
        if (op.payee !== undefined) payee = typeof op.payee === "string" && op.payee.trim() !== "" ? op.payee : refuse("validation", "A payee can't be empty.");
        if (op.notes !== undefined) notes = op.notes === null ? "" : typeof op.notes === "string" ? op.notes : refuse("validation", "A note is text.");
        if (op.review_status !== undefined) reviewed = op.review_status === "reviewed" ? true : refuse("validation", "review_status is reviewed.");
      } else if (op.op === "set_splits") {
        const splits: unknown[] = Array.isArray(op.splits) ? op.splits : [];
        if (splits.length !== 1) refuse("validation", "The preview saves one line.");
        if (!isRecord(splits[0])) refuse("validation", "A line is an object.");
        line = splits[0] as NonNullable<typeof line>;
        if (line.category !== null && !CATEGORIES.has(line.category)) refuse("not_found", `There is no category ${String(line.category)}.`);
        if (line.entity_id !== undefined && line.asset_id !== undefined) refuse("validation", "A line is for a business or an asset, not both.");
        if (line.entity_id !== undefined && !BUSINESS.has(line.entity_id)) refuse("not_found", `There is no business ${line.entity_id}.`);
        if (line.asset_id !== undefined && !isAsset(line.asset_id)) refuse("not_found", `There is no asset ${line.asset_id}.`);
      } else if (op.op === "set_tags") {
        if (!Array.isArray(op.tags) || op.tags.some((tag) => typeof tag !== "string" || tag.trim() === "")) refuse("validation", "Tags are words.");
        tags = [...new Set(op.tags as string[])].sort(byText);
      } else refuse("validation", `The preview can't ${String(op.op)}.`);
    }
    const before = [...new Set(transaction.lines.flatMap((l) => (l.scope === undefined ? [] : [l.scope])))];
    const kept = before.length === 1 ? before[0]! : null;
    const after = line === undefined ? kept : (line.entity_id ?? line.asset_id ?? (line.category !== null && categoryOf(line.category).root === "business" ? kept : null));
    if (line !== undefined && !transaction.isNew && before.length > 0 && !(before.length === 1 && kept === after) && input.confirm_token !== CONFIRM_TOKEN)
      return { confirm_required: true, confirm_token: CONFIRM_TOKEN, scope_changes: [{ before: before.map(shareOf), after: [shareOf(after)] }] };
    if (payee !== undefined) transaction.payee = payee;
    if (notes !== undefined) transaction.notes = notes;
    if (reviewed) transaction.isNew = false;
    if (line !== undefined) transaction.lines = [{ category: line.category, cents: centsOf(transaction), ...(after === null ? {} : { scope: after }) }];
    if (tags !== undefined) transaction.tags = tags;
    transaction.version++;
    stamp++;
    return {};
  }

  const answers: Record<string, (input: Record<string, unknown>) => unknown> = {
    show_transactions: transactionsAnswer,
    show_accounts: accounts,
    show_spending: spending,
    edit,
  };
  return {
    call(tool, input) {
      const answer = answers[tool];
      if (answer === undefined) refuse("not_found", `There is no tool ${tool}.`);
      return answer!(input);
    },
    change(id, payee) {
      const transaction = found(id);
      transaction.payee = payee;
      transaction.version++;
      stamp++;
    },
  };
}
