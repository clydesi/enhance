// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { accountsView, noteStamp } from "../answers";
import type { AccountsView } from "../types";
import { drawAccounts } from "../ui/accounts";
import type { Part } from "./part";

export function accountsPart(panel: HTMLElement): Part & { view(): AccountsView | null } {
  let shown: AccountsView | null = null;
  return {
    load: () =>
      accountsView().then((view) => {
        shown = view;
        drawAccounts(panel, view);
        noteStamp("accounts", view.stamp);
      }),
    link: () => ({}),
    follow() {},
    view: () => shown,
  };
}
