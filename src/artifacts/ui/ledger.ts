// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { transactionsLink } from "../links";
import type { AccountItem, AccountOwner, Badge, SpendingOwner } from "../types";

export interface LedgerLine {
  name: string;
  detail?: string;
  amount: string;
  count?: string;
  badges?: Badge[];
  muted?: boolean;
  nested?: true;
  search: string;
  href?: string;
}
export interface LedgerGroup {
  title: string;
  detail?: string;
  total: string;
  count?: string;
  badges?: Badge[];
  head?: true;
  href?: string;
  lines: LedgerLine[];
  subgroups?: LedgerSubgroup[];
}
export interface LedgerSubgroup {
  title: string;
  count: string;
  total: string;
  lines: LedgerLine[];
}
export interface LedgerOwner {
  name: string;
  business: boolean;
  asset?: boolean;
  total: string;
  groups: LedgerGroup[];
}

const accountLine = (account: AccountItem): LedgerLine => ({
  name: account.name,
  detail: account.type,
  amount: account.balance,
  muted: account.closed,
  search: [account.name, account.type].join(" ").toLowerCase(),
  ...(account.empty ? {} : { href: transactionsLink({ account: account.id }) }),
});

export const accountOwners = (owners: AccountOwner[]): LedgerOwner[] =>
  owners.map((owner) => ({
    name: owner.name,
    business: owner.business,
    total: owner.total,
    groups: owner.sections.map((section) =>
      section.groups === null
        ? { title: section.name, total: section.total, lines: section.accounts.map(accountLine) }
        : {
            title: section.name,
            total: section.total,
            lines: [],
            subgroups: section.groups.map((group) => ({ title: group.name, count: group.count, total: group.total, lines: group.accounts.map(accountLine) })),
          },
    ),
  }));

export const spendingOwners = (owners: SpendingOwner[]): LedgerOwner[] =>
  owners.map((owner) => ({
    name: owner.name,
    business: owner.business,
    asset: owner.asset,
    total: owner.spent,
    groups: owner.parents.map((parent) => ({
      head: true as const,
      title: parent.name,
      total: parent.spent,
      count: parent.count,
      href: transactionsLink(parent.show),
      lines: (parent.categories.length === 1 && parent.categories[0]!.id === parent.id ? [] : parent.categories).map((category) => ({
        name: category.name,
        amount: category.spent,
        count: category.count,
        muted: category.id === null,
        nested: true,
        search: category.name.toLowerCase(),
        href: transactionsLink(category.show),
      })),
    })),
  }));

export function findInLedger(owners: LedgerOwner[], query: string): LedgerOwner[] {
  const text = query.trim().toLowerCase();
  if (text === "") return owners;
  const titled = (title: string): boolean => title.toLowerCase().includes(text);
  const found = (lines: LedgerLine[]): LedgerLine[] => lines.filter((line) => line.search.includes(text));
  return owners.flatMap((owner) => {
    const groups = owner.groups.flatMap((group) => {
      if (titled(group.title)) return [group];
      if (group.subgroups === undefined) {
        const lines = found(group.lines);
        return lines.length === 0 ? [] : [{ ...group, lines }];
      }
      const subgroups = group.subgroups.flatMap((subgroup) => {
        const lines = titled(subgroup.title) ? subgroup.lines : found(subgroup.lines);
        return lines.length === 0 ? [] : [{ ...subgroup, lines }];
      });
      return subgroups.length === 0 ? [] : [{ ...group, subgroups }];
    });
    return groups.length === 0 ? [] : [{ ...owner, groups }];
  });
}
