// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { type ColumnPrefs, DEFAULT_PREFS } from "./types";

const KEY = "clyde-transactions-columns";

export function loadPrefs(): ColumnPrefs {
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) ?? "null") as ColumnPrefs | null;
    return kept !== null && typeof kept.columns?.tags === "boolean" && typeof kept.columns.notes === "boolean" ? { columns: kept.columns, pendingCollapsed: kept.pendingCollapsed === true } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: ColumnPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
  }
}
