// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Preview, preview, Refused } from "../../src/artifacts/preview/build-data.ts";
import { ROOT } from "../check.ts";

interface Example {
  file: string;
  tool: string;
  input: Record<string, unknown>;
  before?: (clyde: Preview) => void;
}

const at = (id: string, op: Record<string, unknown>): Record<string, unknown> => ({ ...op, id, version: 1 });

const MOVE_OFF_RENTAL = [at("txn_4", { op: "update_transaction", review_status: "reviewed" }), at("txn_4", { op: "set_splits", splits: [{ category: "personal.home.home_improvement" }] })];

export const EXAMPLES: Example[] = [
  { file: "transactions-page.json", tool: "show_transactions", input: { limit: 5 } },
  { file: "transactions-filtered.json", tool: "show_transactions", input: { account: "acct_3", limit: 3 } },
  { file: "transactions-empty.json", tool: "show_transactions", input: { search: "no such payee", limit: 20 } },
  { file: "transaction.json", tool: "show_transactions", input: { transaction: "txn_4" } },
  { file: "transaction-split.json", tool: "show_transactions", input: { transaction: "txn_2" } },
  { file: "menus.json", tool: "show_transactions", input: { menus: true } },
  { file: "stamp.json", tool: "show_transactions", input: { stamp: true } },
  { file: "accounts.json", tool: "show_accounts", input: {} },
  { file: "spending.json", tool: "show_spending", input: {} },
  {
    file: "edit.json",
    tool: "edit",
    input: {
      reason: "transaction_edit",
      ops: [
        at("txn_10", { op: "update_transaction", review_status: "reviewed", payee: "Craft Market", notes: "Shelf brackets" }),
        at("txn_10", { op: "set_splits", splits: [{ category: "business.office_supplies", entity_id: "ent_1" }] }),
        at("txn_10", { op: "set_tags", tags: ["supplies"] }),
      ],
    },
  },
  {
    file: "edit-confirm.json",
    tool: "edit",
    input: { reason: "transaction_edit", ops: MOVE_OFF_RENTAL },
  },
  {
    file: "edit-confirmed.json",
    tool: "edit",
    input: { reason: "transaction_edit", ops: MOVE_OFF_RENTAL, confirm_token: "preview-confirm" },
  },
  {
    file: "edit-conflict.json",
    tool: "edit",
    input: { reason: "transaction_edit", ops: [at("txn_9", { op: "update_transaction", review_status: "reviewed", notes: "Two nights" })] },
    before: (clyde) => clyde.change("txn_9", "Downtown Hotel"),
  },
];

const ascii = (text: string): string => text.replace(/[^\x00-\x7f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);

export function buildExamples(): Map<string, string> {
  return new Map(
    EXAMPLES.map(({ file, tool, input, before }) => {
      const clyde = preview();
      before?.(clyde);
      let outcome: { answer: unknown } | { error: unknown };
      try {
        outcome = { answer: clyde.call(tool, structuredClone(input)) };
      } catch (err) {
        if (!(err instanceof Refused)) throw err;
        outcome = { error: err.refusal };
      }
      return [file, `${ascii(JSON.stringify({ tool, input, ...outcome }, null, 2))}\n`];
    }),
  );
}

export function staleExamples(dir: string, built: ReadonlyMap<string, string>): string[] {
  const present = new Set(readdirSync(dir).filter((file) => file.endsWith(".json")));
  return [
    ...[...built].filter(([file, text]) => !present.has(file) || readFileSync(join(dir, file), "utf8") !== text).map(([file]) => `${file}: differs from what the preview's builder writes; run node lib/artifacts/examples.ts`),
    ...[...present].filter((file) => !built.has(file)).map((file) => `${file}: is no example the builder writes`),
  ];
}

if (import.meta.main) {
  const dir = join(ROOT, "src", "artifacts", "preview", "examples");
  const built = buildExamples();
  if (process.argv.includes("--check")) {
    const stale = staleExamples(dir, built);
    for (const problem of stale) console.error(`examples: ${problem}`);
    if (stale.length > 0) process.exit(1);
    console.log(`examples: match what the preview's builder writes, ${built.size} entries`);
  } else {
    for (const [file, text] of built) writeFileSync(join(dir, file), text);
    console.log(`examples: wrote ${built.size}`);
  }
}
