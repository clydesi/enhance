// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { buildExamples, EXAMPLES, staleExamples } from "../lib/artifacts/examples.ts";
import { ROOT } from "../lib/check.ts";
import type { AccountRow, AccountsAnswer, EditAnswer, ListAnswer, ListSection, MenusAnswer, PendingListRow, PostedListRow, SpendingAnswer, TransactionAnswer } from "../src/artifacts/clyde.ts";
import { preview, Refused } from "../src/artifacts/preview/build-data.ts";
import { ACCOUNTS, SHOWCASE } from "../src/artifacts/preview/ledger.ts";

const list = (input: Record<string, unknown>, clyde = preview()): ListAnswer => clyde.call("show_transactions", input) as ListAnswer;
const whole = (id: string, clyde = preview()): TransactionAnswer => clyde.call("show_transactions", { transaction: id }) as TransactionAnswer;
const sectionsOf = (answer: ListAnswer): ListSection[] => answer.sections ?? [];
const posted = (answer: ListAnswer): PostedListRow[] => sectionsOf(answer).flatMap((s) => s.rows).filter((row): row is PostedListRow => "id" in row);
const accountRows = (answer: AccountsAnswer): AccountRow[] => answer.owners.flatMap((o) => o.sections.flatMap((s) => [...(s.rows ?? []), ...(s.groups ?? []).flatMap((g) => g.rows)]));
const pendingIn = (answer: ListAnswer): PendingListRow[] => sectionsOf(answer).flatMap((s) => s.rows).filter((row): row is PendingListRow => !("id" in row));
const cents = (text: string): number => Math.round(Number(text.replace(/[^0-9.]/g, "")) * 100) * (text.startsWith("-") ? -1 : 1);
const refusal = (run: () => unknown): Refused["refusal"] => {
  try {
    run();
  } catch (err) {
    if (err instanceof Refused) return err.refusal;
    throw err;
  }
  assert.fail("expected a refusal");
};

test("the first twelve rows after the pending ones show every kind, in order", () => {
  const page = list({ limit: 20 });
  assert.equal(sectionsOf(page)[0]!.label, "Pending");
  assert.equal(pendingIn(page).length, 3);
  const rows = posted(page).slice(0, 12);
  const kinds = rows.map((row) => {
    const badges = (row.badges ?? []).map((b) => b.key);
    const { edit, splits } = whole(row.id);
    if (splits !== null) return row.mark === "split_business" ? "split with a business line" : "split";
    if (badges.includes("flagged")) return "flagged";
    if (badges.includes("possible_duplicate")) return "possible duplicate";
    if (badges.includes("new") && edit.category_id !== null) return "new";
    if (edit.category_id === null) return "uncategorized";
    if (row.direction === "in") return "money in";
    if (row.tags !== "" && row.notes !== "") return "tags and a note";
    if (row.category_name === "Holiday Savings") return "transfer";
    if (row.payee.length > 60 && row.notes.length > 100) return "long payee and note";
    if (edit.scope_id?.startsWith("ent_")) return "business";
    if (edit.scope_id?.startsWith("acct_")) return "rental";
    return "other";
  });
  assert.deepEqual(kinds, ["split", "split with a business line", "business", "rental", "flagged", "possible duplicate", "new", "money in", "tags and a note", "uncategorized", "transfer", "long payee and note"]);
  assert.equal(SHOWCASE.length, 12);
  assert.deepEqual([rows[6]!.payee, rows[6]!.amount], [rows[5]!.payee, rows[5]!.amount]);
  assert.deepEqual([posted(page)[12]!.account, posted(page)[12]!.category_name], ["Holiday Savings", "Everyday Checking"]);
});

test("the ledger is the same every build", () => {
  for (const [tool, input] of [["show_transactions", { limit: 50, offset: 100 }], ["show_accounts", {}], ["show_spending", { month: "2026-07" }], ["show_transactions", { menus: true }]] as const)
    assert.deepEqual(preview().call(tool, input), preview().call(tool, input));
});

test("the examples are what the preview's builder writes", () => {
  assert.deepEqual(staleExamples(join(ROOT, "src", "artifacts", "preview", "examples"), buildExamples()), []);
});

test("a list pages, sorts, filters, and searches", () => {
  const clyde = preview();
  const first = list({ limit: 20 }, clyde);
  const all = list({ limit: 10_000 }, clyde);
  assert.match(first.heading, /^Transactions \u00b7 \d{1},\d{3}$/);
  assert.deepEqual(first.next, { offset: 20 });
  assert.equal(first.chip, null);
  const second = list({ limit: 20, offset: 20 }, clyde);
  assert.equal(pendingIn(second).length, 0);
  assert.deepEqual(posted(second).map((r) => r.id), posted(all).slice(20, 40).map((r) => r.id));
  assert.equal(posted(second)[0]!.number, "21");
  assert.equal(list({ limit: 20, offset: posted(all).length - 5 }, clyde).next, null);

  const oldest = list({ direction: "asc", limit: 20 }, clyde);
  assert.equal(posted(oldest)[0]!.payee, "Opening balance");
  assert.equal(sectionsOf(oldest).at(-1)!.label, "Pending");
  const byAmount = posted(list({ sort: "amount", direction: "desc", limit: 30 }, clyde));
  const value = (row: PostedListRow): number => cents(row.amount);
  assert.ok(byAmount.every((row, i) => i === 0 || value(byAmount[i - 1]!) >= value(row)));
  const smallest = posted(list({ sort: "amount", direction: "asc", limit: 5 }, clyde));
  assert.ok(smallest.every((row, i) => i === 0 || value(smallest[i - 1]!) <= value(row)) && value(smallest[0]!) < value(byAmount.at(-1)!));
  assert.ok(byAmount.some((row) => row.direction === "in") && byAmount.some((row) => row.direction === "out"));
  assert.deepEqual(sectionsOf(list({ sort: "payee", direction: "asc", limit: 5 }, clyde)).map((s) => [s.label, s.rows.length]), [["Pending", 3], [null, 5]]);

  assert.equal(list({ account: "acct_3", limit: 5 }, clyde).chip, "Travel Rewards Card");
  assert.equal(pendingIn(list({ account: "acct_3", limit: 5 }, clyde)).length, 1);
  assert.equal(list({ category: "personal.groceries", owner: "personal", month: "2026-12", spending: true, limit: 5 }, clyde).chip, "Groceries");
  assert.equal(list({ category: "uncategorized", limit: 5 }, clyde).chip, "Uncategorized");
  assert.equal(list({ owner: "acct_9", limit: 5 }, clyde).chip, "Rental House");
  assert.equal(list({ month: "2026-12", limit: 5 }, clyde).chip, "December 2026");
  assert.equal(list({ spending: true, limit: 5 }, clyde).chip, "Spending");
  const found = list({ search: "harvest", limit: 100 }, clyde);
  assert.equal(found.chip, null);
  assert.equal(pendingIn(found).length, 0);
  assert.match(found.heading, /^\d+ matches$/);
  assert.ok(posted(found).every((row) => row.payee === "Harvest Kitchen"));
  const none = list({ search: "zzqqxx" }, clyde);
  assert.deepEqual([none.heading, typeof none.empty, none.sections, none.next], ["0 matches", "string", [], null]);

  const dining = posted(list({ category: "personal.dining_drinks", month: "2026-12", limit: 1000 }, clyde));
  assert.ok(dining.length > 0 && dining.every((row) => row.date.startsWith("Dec") && whole(row.id, clyde).edit.category_id?.startsWith("personal.dining_drinks.")));
  const rental = posted(list({ owner: "acct_9", limit: 1000 }, clyde)).map((row) => whole(row.id, clyde));
  assert.ok(rental.some((one) => one.splits !== null) && rental.filter((one) => one.splits === null).every((one) => one.edit.scope_id === "acct_9"));
});

test("a list's row is what it draws; its own read brings its form's values, facts, and splits", () => {
  const rows = posted(list({ limit: 12 }));
  assert.ok(rows.every((row) => !("edit" in row) && !("facts" in row) && !("splits" in row)));
  const split = whole(rows[1]!.id);
  assert.deepEqual(split.edit, { payee: "Online Marketplace", category_id: null, scope_id: null, tags: [], notes: "" });
  assert.deepEqual(split.facts.map((f) => f.key), ["posted", "statement_description", "statement_account", "account", "for", "transacted"]);
  assert.equal(split.facts.find((f) => f.key === "for")!.value, "Design Studio LLC (Sch C L22)");
  assert.deepEqual(split.splits!.rows.map((l) => [l.category_name, l.mark ?? null, l.direction, l.business ?? false]), [["Office Supplies", "business", "out", true], ["Home Supplies", null, "out", false]]);
  assert.equal(whole(rows[3]!.id).facts.find((f) => f.key === "for")!.value, "Rental House (Sch E L14)");
  assert.deepEqual(whole(rows[8]!.id).edit.tags, ["anniversary", "trip"]);
  assert.equal(rows[8]!.tags, "anniversary, trip");
  assert.deepEqual([split.row.category_name, split.row.mark, split.row.business], [rows[1]!.category_name, rows[1]!.mark, rows[1]!.business]);
  assert.equal(refusal(() => preview().call("show_transactions", { transaction: "txn_0" })).error, "not_found");
});

test("the accounts add up, closed and empty ones marked", () => {
  const answer = preview().call("show_accounts", {}) as AccountsAnswer;
  const rows = accountRows(answer);
  assert.equal(rows.length, ACCOUNTS.length);
  assert.equal(answer.accounts, `${ACCOUNTS.length} accounts`);
  for (const account of ACCOUNTS) if (account.balance !== undefined) assert.equal(cents(rows.find((r) => r.id === account.id)!.balance), account.balance, account.name);
  const worth = rows.reduce((sum, r) => sum + cents(r.balance), 0);
  assert.equal(cents(answer.totals.find((t) => t.key === "net_worth")!.value), worth);
  assert.deepEqual(answer.totals.map((t) => t.key), ["net_worth", "held", "owed"]);
  assert.deepEqual(rows.filter((r) => r.closed === true).map((r) => r.name), ["Store Card", "Old Brokerage"]);
  assert.deepEqual(rows.filter((r) => r.balance === "").map((r) => r.id), ["acct_13"]);
  assert.deepEqual(rows.filter((r) => r.empty === true).map((r) => r.id), ["acct_12", "acct_13", "acct_7"]);
  assert.deepEqual(answer.owners[0]!.sections[0]!.groups?.map((g) => g.name), ["Cash and checking", "Credit", "Savings"]);
  assert.deepEqual(answer.owners.map((o) => [o.name, o.business]), [["Personal", false], ["Design Studio LLC", true]]);
  assert.deepEqual(answer.businesses_and_assets.top.map((t) => t.kind), ["Real Estate", "Business"]);
});

test("a month's spending adds up by owner, parent, and category", () => {
  const clyde = preview();
  const answer = clyde.call("show_spending", {}) as SpendingAnswer;
  assert.deepEqual(answer.months.rows.find((m) => m.shown)?.key, "2026-12");
  assert.deepEqual([answer.months.rows[0]!.key, answer.months.rows.at(-1)!.key], ["2026-02", "2027-01"]);
  const june = clyde.call("show_spending", { month: "2026-06" }) as SpendingAnswer;
  assert.deepEqual([june.months.rows[0]!.key, june.months.rows.at(-1)!.key], ["2025-07", "2026-06"]);
  assert.equal(june.months.rows.find((m) => m.shown)?.key, "2026-06");
  assert.ok(!("current" in answer) && !("current" in june));
  const spent = cents(answer.stats.find((s) => s.key === "spent")!.value);
  assert.equal(answer.owners.reduce((sum, o) => sum + cents(o.spent), 0), spent);
  assert.equal(answer.months.rows.find((m) => m.shown)!.spent_cents, spent);
  assert.deepEqual(answer.owners.map((o) => [o.name, o.business, o.asset ?? false]), [["Personal", false, false], ["Design Studio LLC", true, false], ["Rental House", false, true]]);
  for (const owner of answer.owners) {
    let parent = 0;
    let children = 0;
    for (const row of owner.rows) {
      if (row.parent) {
        assert.equal(children, parent, `${owner.name}: a parent's categories add up to it`);
        parent = cents(row.spent);
        children = 0;
      } else children += cents(row.spent);
    }
    assert.equal(children, parent);
  }
  const groceries = answer.owners[0]!.rows.find((r) => r.show.category === "personal.groceries" && !r.parent)!;
  const listed = posted(list({ ...groceries.show, exact: true, month: "2026-12", spending: true, limit: 1000 }, clyde));
  assert.equal(String(listed.length), groceries.transactions);
  assert.equal((clyde.call("show_spending", { month: "2027-01" }) as SpendingAnswer).months.rows.at(-1)!.key, "2027-01");
});

test("a refund in an expense category lowers its spending, and the spending filter lists it", () => {
  const clyde = preview();
  const answer = clyde.call("show_spending", { month: "2026-11" }) as SpendingAnswer;
  const clothing = answer.owners[0]!.rows.find((r) => r.show.category === "personal.shopping.clothing" && !r.parent)!;
  const signed = posted(list({ ...clothing.show, limit: 1000 }, clyde)).map((row) => cents(row.amount) * (row.direction === "in" ? 1 : -1));
  assert.ok(signed.some((c) => c > 0) && signed.some((c) => c < 0), JSON.stringify(signed));
  assert.equal(cents(clothing.spent), -signed.reduce((sum, c) => sum + c, 0));
});

test("a Save is kept, at the version read, and a guarded scope change asks first", () => {
  const clyde = preview();
  const stamp = (): string => (clyde.call("show_transactions", { stamp: true }) as { stamp: string }).stamp;
  const before = stamp();
  const ops = [
    { op: "update_transaction", id: "txn_10", version: 1, review_status: "reviewed", payee: "Craft Market" },
    { op: "set_splits", id: "txn_10", version: 1, splits: [{ category: "personal.shopping.hobbies" }] },
    { op: "set_tags", id: "txn_10", version: 1, tags: ["shelf", "Gift"] },
  ];
  assert.deepEqual(clyde.call("edit", { reason: "transaction_edit", ops }), {});
  const saved = clyde.call("show_transactions", { transaction: "txn_10" }) as TransactionAnswer;
  assert.deepEqual([saved.row.payee, saved.row.category_name, saved.row.tags, saved.row.version, saved.badges], ["Craft Market", "Hobbies", "Gift, shelf", 2, []]);
  assert.notEqual(stamp(), before);
  const { menus } = clyde.call("show_transactions", { menus: true }) as MenusAnswer;
  assert.ok(menus.payees.includes("Craft Market"));
  assert.deepEqual(menus.scopes, [{ id: "ent_1", name: "Design Studio LLC", business: true }, { id: "acct_9", name: "Rental House", asset: true }]);
  assert.deepEqual(refusal(() => clyde.call("edit", { reason: "transaction_edit", ops })), { error: "conflict", message: "This transaction changed since you read it.", details: { txn_10: 2 } });

  const move = { reason: "transaction_edit", ops: [{ op: "set_splits", id: "txn_4", version: 1, splits: [{ category: "personal.home.home_improvement" }] }] };
  const asked = clyde.call("edit", move) as EditAnswer;
  assert.deepEqual(asked.scope_changes, [{ before: [{ name: "Rental House" }], after: [{ name: null }] }]);
  assert.deepEqual(clyde.call("edit", { ...move, confirm_token: asked.confirm_token }), {});
  assert.equal((clyde.call("show_transactions", { transaction: "txn_4" }) as TransactionAnswer).edit.scope_id, null);
});

test("every show_ answer carries the change stamp; menus and the stamp take no other field", () => {
  const clyde = preview();
  for (const [tool, input] of [["show_transactions", { limit: 1 }], ["show_transactions", { transaction: "txn_1" }], ["show_transactions", { menus: true }], ["show_accounts", {}], ["show_spending", {}]] as const)
    assert.equal((clyde.call(tool, input) as { stamp: string }).stamp, "1", `${tool} ${JSON.stringify(input)}`);
  assert.equal(refusal(() => clyde.call("show_transactions", { menus: true, limit: 1 })).error, "validation");
  assert.equal(refusal(() => clyde.call("show_transactions", { stamp: true, transaction: "txn_1" })).error, "validation");
});

test("every row, line, owner, and account says what it is in a field of its own", () => {
  const clyde = preview();
  const page = list({ limit: 12 }, clyde);
  const rows = posted(page);
  assert.deepEqual(rows.slice(0, 4).map((r) => [r.mark ?? null, r.business ?? false, r.asset ?? false]), [["split", false, false], ["split_business", true, false], ["business", true, false], ["business", false, true]]);
  assert.deepEqual(rows.slice(4, 7).map((r) => (r.badges ?? []).map((b) => b.key)), [["flagged"], ["new", "possible_duplicate"], ["new"]]);
  assert.deepEqual(pendingIn(page).map((p) => [p.pending, p.statement_description]), [[true, "RIDESHARE *TRIP"], [true, "SQ *ROASTERY CAFE"], [true, "GAS STATION 4417"]]);

  const accounts = clyde.call("show_accounts", {}) as AccountsAnswer;
  assert.deepEqual(accounts.owners.map((o) => o.id), ["personal", "ent_1"]);
  const all = accountRows(accounts);
  assert.deepEqual(all.filter((r) => r.business === true).map((r) => r.id), ["acct_8"]);
  assert.deepEqual(all.filter((r) => r.asset === true).map((r) => r.id), ["acct_9"]);
  assert.deepEqual(accounts.businesses_and_assets.top.map((t) => [t.id, t.business ?? false, t.asset ?? false]), [["acct_9", false, true], ["ent_1", true, false]]);

  const spending = clyde.call("show_spending", { month: "2027-01" }) as SpendingAnswer;
  assert.deepEqual(spending.owners.map((o) => o.id), ["personal", "ent_1", "acct_9"]);
  for (const owner of spending.owners) {
    const parents = owner.rows.filter((r) => r.parent);
    assert.ok(owner.rows.filter((r) => !r.parent).every((r) => parents.some((p) => p.id === r.parent_id)), owner.name);
    assert.ok(parents.every((p) => !("parent_id" in p)));
  }
  const uncategorized = spending.owners[0]!.rows.filter((r) => r.show.category === "uncategorized");
  assert.deepEqual(uncategorized.map((r) => [r.id, "parent_id" in r ? r.parent_id : "none", r.parent]), [[null, "none", true], [null, null, false]]);
});

test("the preview refuses what Clyde would, and a refused Save changes nothing", () => {
  const clyde = preview();
  for (const input of [{ category: "nope" }, { account: "nope" }, { owner: "nope" }, { month: "2026-13" }, { search: 5 }, { limit: 0 }, { offset: -1 }, { direction: "sideways" }, { from: "zzz" }])
    assert.ok(["validation", "not_found"].includes(refusal(() => clyde.call("show_transactions", input)).error), JSON.stringify(input));
  const save = (ops: Record<string, unknown>[]) => clyde.call("edit", { reason: "transaction_edit", ops: ops.map((op) => ({ id: "txn_10", version: 1, ...op })) });
  for (const ops of [
    [{ op: "update_transaction", payee: "Changed" }, { op: "bogus" }],
    [{ op: "update_transaction", payee: "" }],
    [{ op: "set_tags" }],
    [{ op: "update_transaction", review_status: "unreviewed" }],
    [{ op: "set_splits", splits: [null] }],
    [{ op: "set_tags", tags: ["a", " "] }],
    [{ op: "set_splits", splits: [{ category: "nope" }] }],
    [{ op: "set_splits", splits: [{ category: "business.office_supplies", entity_id: "ent_9" }] }],
    [{ op: "set_splits", splits: [{ category: "personal.groceries" }, { category: "personal.shopping" }] }],
  ])
    assert.ok(["validation", "not_found"].includes(refusal(() => save(ops)).error), JSON.stringify(ops));
  assert.equal(refusal(() => clyde.call("edit", { reason: "transaction_edit", ops: [{ op: "update_transaction", id: "txn_10" }] })).error, "validation");
  assert.equal(refusal(() => clyde.call("edit", { reason: "transaction_edit", ops: [null] })).error, "validation");
  assert.deepEqual([whole("txn_10", clyde).row.payee, whole("txn_10", clyde).row.version], ["PAYMENT *CRAFTMARKET", 1]);
  const asked = clyde.call("edit", { reason: "transaction_edit", ops: [{ op: "set_splits", id: "txn_2", version: 1, splits: [{ category: "personal.groceries" }] }] }) as EditAnswer;
  assert.deepEqual(asked.scope_changes, [{ before: [{ name: "Design Studio LLC" }], after: [{ name: null }] }]);
});

test("each example has a file of its own", () => {
  assert.equal(new Set(EXAMPLES.map((e) => e.file)).size, EXAMPLES.length);
});
