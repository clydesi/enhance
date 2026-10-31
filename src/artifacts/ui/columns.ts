// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import type { ColumnPrefs } from "../types";

export function applyPrefs(table: HTMLTableElement, prefs: ColumnPrefs): void {
  table.classList.toggle("no-tags", !prefs.columns.tags);
  table.classList.toggle("no-notes", !prefs.columns.notes);
}
