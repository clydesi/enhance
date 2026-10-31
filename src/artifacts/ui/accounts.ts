// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import type { AccountOwner, AccountsView, ScopeCard } from "../types";
import { card, countBadge, FIGURE, listBar, searchInput, stat, subheading, text } from "./components";
import { element, word } from "./dom";
import { accountOwners, findInLedger, type LedgerOwner } from "./ledger";
import { ledgerList, ownerHead, summaryLine, swapLedger } from "./ledger-list";

let panel: HTMLElement;
let search: HTMLInputElement;
let tiles: HTMLElement;
let sums: HTMLElement;
let empty: HTMLElement;
let listed: LedgerOwner[] = [];

const summaryCard = (attrs: Record<string, string>, head: HTMLElement, total: string, lines: HTMLElement[]): HTMLElement =>
  card(
    { ...attrs, class: "p-4 sm:px-6" },
    head,
    element("div", { class: `mt-3 ${FIGURE}` }, total),
    element("ul", { class: "mt-4 text-base/6 text-mist-950 sm:text-sm/6 dark:text-white" }, ...lines),
  );

const personalCard = (owner: AccountOwner): HTMLElement =>
  summaryCard({}, ownerHead(owner, {}), owner.total, owner.sections.map((section) => summaryLine(section.name, section.count, section.total)));

const scopeCardOf = (scopes: ScopeCard): HTMLElement =>
  summaryCard(
    { "data-scope-card": "" },
    ownerHead({ name: word("businessesAndAssets"), business: false }, {}, countBadge(scopes.count)),
    scopes.total,
    scopes.top.map((scope) => summaryLine(scope.name, undefined, scope.total, scope.kind)),
  );

function filter(): void {
  const found = findInLedger(listed, search.value);
  swapLedger(panel.querySelector("[data-ledger]")!, ledgerList(found));
  empty.hidden = found.length > 0;
}

export function drawAccounts(root: HTMLElement, summary: AccountsView): void {
  listed = accountOwners(summary.owners);
  if (panel === undefined) {
    panel = root;
    search = searchInput({ maxlength: "200", "data-search": "", "aria-label": word("searchAccounts"), placeholder: word("searchAccountsPlaceholder") }, word("clearSearch"));
    search.addEventListener("input", filter);
    tiles = element("div", { class: "grid grid-cols-1 gap-4 sm:grid-cols-3" });
    sums = element("div", { class: "grid grid-cols-1 items-start gap-4 empty:hidden md:grid-cols-2" });
    empty = text(word("noAccounts"), { "data-empty": "", hidden: "", class: "px-2 pt-3" });
    panel.append(
      element(
        "div",
        { class: "flex flex-col gap-10" },
        tiles,
        sums,
        element(
          "div",
          {},
          listBar(subheading(2, word("allAccounts")), [search.parentElement!]),
          text(word("accountsNote"), { class: "mb-4" }),
          element("div", { "data-ledger": "" }),
          empty,
        ),
      ),
    );
  }
  const { net_worth, held, owed } = summary.totals;
  tiles.replaceChildren(stat(word("netWorth"), net_worth), stat(word("held"), held), stat(word("owed"), owed));
  sums.replaceChildren(
    ...summary.owners.filter((owner) => owner.key === "personal").map(personalCard),
    ...(summary.scope_card === null ? [] : [scopeCardOf(summary.scope_card)]),
  );
  filter();
}
