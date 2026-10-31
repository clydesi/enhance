// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { CATEGORY_ROOTS, type CategoryNode, type CategoryRoot } from "../types";

const PAYEE_ROWS = 8;

type CategoryRow = { kind: "root"; name: CategoryRoot } | { kind: "option"; id: string; name: string; depth: 0 | 1 };

export function categoryRows(nodes: CategoryNode[], query: string): CategoryRow[] {
  const typed = query.trim().toLowerCase();
  const hit = (node: CategoryNode): boolean => node.name.toLowerCase().includes(typed);
  const option = (node: CategoryNode, depth: 0 | 1): CategoryRow => ({ kind: "option", id: node.id, name: node.name, depth });
  return CATEGORY_ROOTS.flatMap((root) => {
    const rows = nodes
      .filter((top) => top.root === root && top.parent_id === null)
      .flatMap((top) => {
        const children = nodes.filter((node) => node.parent_id === top.id);
        const kept = hit(top) ? children : children.filter(hit);
        return hit(top) || kept.length > 0 ? [option(top, 0), ...kept.map((child) => option(child, 1))] : [];
      });
    return rows.length === 0 ? [] : [{ kind: "root" as const, name: root }, ...rows];
  });
}

export function payeeNamed(payees: string[], text: string): string | null {
  const name = text.trim();
  return payees.find((payee) => payee === name) ?? payees.find((payee) => payee.toLowerCase() === name.toLowerCase()) ?? null;
}

export function payeeRows(payees: string[], query: string, typed: string): Array<{ name: string; isNew: boolean }> {
  const text = query.trim().toLowerCase();
  const rows = payees
    .filter((payee) => payee.toLowerCase().includes(text))
    .slice(0, PAYEE_ROWS)
    .map((name) => ({ name, isNew: false }));
  const name = typed.trim();
  const known = payeeNamed(payees, name);
  if (text !== "" && name !== "" && known === null) rows.push({ name, isNew: true });
  if (text === "" && known !== null && !rows.some((row) => row.name === known)) rows.push({ name: known, isNew: false });
  return rows;
}
