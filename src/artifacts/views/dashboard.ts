// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { ledgerStamp, stampOf, staleMenus } from "../answers";
import { fragment, fragmentOf, keepFragment, useTransactionsLink } from "../links";
import { keepCurrent, showSubtitle, startView } from "../page";
import { accountsPart } from "../parts/accounts";
import type { Part } from "../parts/part";
import { spendingPart } from "../parts/spending";
import { transactionsPart } from "../parts/transactions";
import { tab } from "../ui/components";
import { RETRACT } from "../connector";
import { unsaved } from "../ui/details";
import { failureText, showNotice, word } from "../ui/dom";
import { PageError } from "../ui/reads";

const TABS = ["transactions", "accounts", "spending"] as const;
type Tab = (typeof TABS)[number];
const TAB_WORDS: Record<Tab, string> = { transactions: "tabTransactions", accounts: "tabAccounts", spending: "tabSpending" };
const isTab = (name: unknown): name is Tab => (TABS as readonly unknown[]).includes(name);
const tabOf = (pairs: Record<string, string>): Tab => (isTab(pairs.tab) ? pairs.tab : "transactions");

useTransactionsLink((args) => fragmentOf({ tab: "transactions", ...args }));

const panelOf = (name: Tab): HTMLElement => document.querySelector<HTMLElement>(`[data-panel="${name}"]`)!;
const opened = fragment();
let shown: Tab = tabOf(opened);
const accounts = accountsPart(panelOf("accounts"));
const spending = spendingPart(panelOf("spending"), shown === "spending" ? opened : {});
const transactions = transactionsPart(panelOf("transactions"), shown === "transactions" ? opened : {});
const parts: Record<Tab, Part> = { transactions, accounts, spending };

const tabs = TABS.map((name) => tab(word(TAB_WORDS[name]), { id: `tab-${name}`, "aria-controls": `panel-${name}`, "data-tab": name }));
document.querySelector("[data-tabs]")!.append(...tabs);

const stale = new Set<Tab>();

const keep = (): void => keepFragment({ tab: shown, ...parts[shown].link() });

function showTab(name: Tab): void {
  shown = name;
  if (stale.delete(name)) reread(name);
  tabs.forEach((button, at) => {
    const selected = TABS[at] === name;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  for (const tabName of TABS) panelOf(tabName).hidden = tabName !== name;
  keep();
}
showTab(shown);

function showTake(): void {
  const [held, months] = [accounts.view(), spending.view()];
  const last = months?.months.find((m) => m.month === months.own);
  if (held === null || last === undefined) return;
  showSubtitle(word("take", { worth: held.totals.net_worth, accounts: held.totals.accounts, spent: last.spent, month: last.label }));
}

const readTab = (name: Tab): Promise<void> =>
  parts[name].load().then(() => {
    if (name !== "transactions") showTake();
  });

const loadAll = (): Promise<void> =>
  Promise.all(TABS.map((name) => parts[name].load().then(() => panelOf(name).querySelector("[data-loading]")?.remove()))).then(() => {}).finally(showTake);

const reading = startView(
  TABS.map((name) => panelOf(name)),
  () =>
    loadAll().catch((err: unknown) => {
      for (const name of TABS) if (panelOf(name).querySelector("[data-loading]") !== null) stale.add(name);
      throw err;
    }),
);
const { run } = reading;

let failures = 0;
let retryAt = 0;
const ASKS_VIEWER = new Set(["needs_reauth", "not_in_manifest", "approval_required", "consent_required", "selection_required", "not_granted"]);
let asksViewer = false;

const reread = (name: Tab): void =>
  run(() =>
    readTab(name).then(
      () => {
        failures = 0;
        asksViewer = false;
      },
      (err: unknown) => {
        stale.add(name);
        failures++;
        retryAt = Date.now() + Math.min(30_000 * 2 ** (failures - 1), 600_000);
        asksViewer = err instanceof PageError && err.code !== undefined && ASKS_VIEWER.has(err.code);
        throw err;
      },
    ),
  );

keepCurrent(reading, async (back) => {
  const typing = unsaved();
  if (stale.has(shown) && !(shown === "transactions" && typing)) {
    if (Date.now() < retryAt || (asksViewer && !back)) return;
    stale.delete(shown);
    return reread(shown);
  }
  let now: string | null = null;
  try {
    now = await ledgerStamp();
  } catch (err) {
    if (err instanceof PageError && err.code !== undefined && RETRACT.has(err.code)) showNotice(failureText(err));
    return;
  }
  if (typeof now !== "string") return;
  const moved = TABS.filter((name) => stampOf(name) !== now);
  if (moved.length === 0) return;
  staleMenus();
  for (const name of moved) if (name !== shown) stale.add(name);
  if (!moved.includes(shown)) return;
  if (shown === "transactions" && unsaved()) stale.add(shown);
  else reread(shown);
});

const bar = document.querySelector<HTMLElement>("[data-tabs]")!;
bar.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLElement>("[data-tab]");
  if (button !== null) showTab(button.dataset.tab as Tab);
});
bar.addEventListener("keydown", (event) => {
  const at = tabs.indexOf(event.target as HTMLButtonElement);
  if (at === -1) return;
  const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: tabs.length - 1 }[event.key];
  if (to === undefined) return;
  event.preventDefault();
  const next = (to + tabs.length) % tabs.length;
  tabs[next]!.focus();
  showTab(TABS[next]!);
});

document.addEventListener("state", keep);
document.addEventListener("saved", () => {
  stale.add("accounts");
  stale.add("spending");
});
window.addEventListener("hashchange", () => {
  const pairs = fragment();
  const name = tabOf(pairs);
  const tabButton = tabs[TABS.indexOf(name)]!;
  if (name !== shown) tabButton.focus();
  showTab(name);
  if (name === "transactions") transactions.followFrom(pairs, tabButton);
  else parts[name].follow(pairs);
});
