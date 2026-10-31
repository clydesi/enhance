// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { type Category, checkCategories } from "../categories/validate.ts";
import { readJson, ROOT } from "../lib/check.ts";
import type { Schema } from "../lib/format/schema.ts";
import { ACCOUNT_TYPES, checkRules, DIRECTIONS, RULE_SCHEMA, type Rule } from "../rules/validate.ts";

const shopping: Category = { id: "personal.shopping", root: "personal", parent_id: null, name: "Shopping", type: "expense", schedule_c_line: null, schedule_e_line: null };
const books: Category = { id: "personal.shopping.books", root: "personal", parent_id: "personal.shopping", name: "Books", type: "expense", schedule_c_line: null, schedule_e_line: null };
const business: Category = { id: "business.ads", root: "business", parent_id: null, name: "Ads", type: "expense", schedule_c_line: "8", schedule_e_line: null };
const transfer: Category = { id: "transfers.transfer", root: "transfers", parent_id: null, name: "Transfer", type: "transfer", schedule_c_line: null, schedule_e_line: null };
const loan: Category = { id: "transfers.transfer.loan_principal", root: "transfers", parent_id: "transfers.transfer", name: "Loan Principal", type: "transfer", schedule_c_line: null, schedule_e_line: null };
const known = [shopping, books, business, { ...transfer, protected: true as const }, loan];

const char = (code: number): string => String.fromCodePoint(code);
const EMOJI = char(0x1f600);
const ZERO_WIDTH = char(0x200b);
const RTL_OVERRIDE = char(0x202e);
const CYRILLIC_A = char(0x0410);
const NBSP = char(0x00a0);
const EM_DASH = char(0x2014);
const E_ACUTE = char(0xe9);

const CATEGORY_ID = "a root (personal, business, or transfers), then one or two levels, each a dot and lowercase words of letters and digits joined by _";
const NAME = "1 to 40 characters starting with a letter or digit: letters, digits, single spaces, and the symbols & ' - / ( ) and comma";
const TAX_LINE = 'null, or a line number from 1 to 99 with an optional lowercase letter, such as "8" or "24a"';
const RULE_ID = "up to 60 characters in one or two levels, each lowercase words of letters and digits joined by _, levels joined by a dot, not starting rul_";
const PATTERN = "1 to 200 characters: uppercase letters, digits, spaces, the symbols & ' - . + / #, and the pattern characters * ^ $ | \\";
const PAYEE = "1 to 60 characters starting with a letter or digit: letters, digits, single spaces, and the symbols & ' - / ( ) comma period +";
const SAMPLE = "1 to 200 characters of plain ASCII";

const oneCategory = (entry: unknown) => checkCategories([entry as Category], [], undefined);

test("the current data passes", () => {
  const categories = readJson<Category[]>(join(ROOT, "categories", "categories.json"));
  const rules = readJson<Rule[]>(join(ROOT, "rules", "rules.json"));
  assert.deepEqual(checkCategories(categories, [], undefined), []);
  assert.deepEqual(checkRules(rules, [], categories, undefined), []);
});

test("a valid category list passes", () => {
  assert.deepEqual(checkCategories([shopping, books, business, transfer], [], undefined), []);
});

test("a file that isn't a list, or an entry that isn't an object, is reported, not thrown", () => {
  for (const file of [null, {}, "x"]) assert.deepEqual(checkCategories(file as unknown as Category[], [], undefined), ["file must be a list of categories"]);
  assert.deepEqual(checkCategories([shopping, null as unknown as Category], [], [shopping]), ["entry 1 (no id): value must be a category: an object of its fields"]);
  assert.deepEqual(checkCategories([shopping], [], [null, 5, shopping] as unknown as Category[]), []);
});

test("a category id is a root and one or two levels", () => {
  for (const id of [`personal.shopping${ZERO_WIDTH}`, "other.shopping", "personal", "personal.a.b.c", "Personal.shopping", "personal.shop-ping", "personal..shopping"]) {
    assert.deepEqual(oneCategory({ ...shopping, id }), [`entry 0 (${id}): id must be ${CATEGORY_ID}`], id);
  }
});

test("an id must be its name's path", () => {
  const wrong = { ...books, id: "personal.shopping.novels" };
  assert.deepEqual(checkCategories([shopping, wrong], [], undefined), ["entry 1 (personal.shopping.novels): id must be its name's path, personal.shopping.books"]);
});

test("a parent is a top-level category that comes earlier, in the same root", () => {
  assert.deepEqual(checkCategories([books, shopping], [], undefined), ["entry 0 (personal.shopping.books): parent personal.shopping is not an earlier entry"]);
  const stray = { ...books, id: "business.ads.books", parent_id: "business.ads" };
  assert.deepEqual(checkCategories([business, { ...stray, root: "personal" }], [], undefined), ["entry 1 (business.ads.books): parent is in another root"]);
  for (const parent_id of ["personal.shopping.books", "personal", `personal.shopping${ZERO_WIDTH}`]) {
    assert.deepEqual(oneCategory({ ...books, parent_id }), [`entry 0 (personal.shopping.books): parent_id must be null, or a top-level category's id: a root, a dot, and lowercase words of letters and digits joined by _`], parent_id);
  }
});

test("a child of an entry out of format isn't told its parent is missing", () => {
  const bad = { ...shopping, name: "Shopping!" };
  assert.deepEqual(checkCategories([bad, books], [], undefined), [`entry 0 (personal.shopping): name must be ${NAME}`]);
});

test("a name is 1 to 40 characters of single-spaced words, starting with a letter or digit", () => {
  const named = (name: string) => oneCategory({ ...shopping, name });
  for (const good of ["Shopping", "Home Improvement", "Gifts & Donations", "Rent/Lease (Property)", "Kids' Activities", "Taxes, Other", "1099 Income"]) {
    assert.deepEqual(oneCategory({ ...shopping, name: good, id: `personal.${good.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}` }), [], good);
  }
  for (const bad of [`Caf${E_ACUTE}`, "Two  spaces", " Lead", "Trail ", "&&", "(Other)", "Dr. Visits", "", "x".repeat(41), `Sh${ZERO_WIDTH}op`, `${CYRILLIC_A}pps`, `Shop ${EMOJI}`, "Shop!"]) {
    assert.deepEqual(named(bad), [`entry 0 (personal.shopping): name must be ${NAME}`], JSON.stringify(bad));
  }
});

test("roots, types, protected, and unknown or missing fields follow the schema", () => {
  assert.deepEqual(oneCategory({ ...shopping, root: "home" }), ["entry 0 (personal.shopping): root must be personal, business, or transfers"]);
  assert.deepEqual(oneCategory({ ...shopping, type: "spend" }), ["entry 0 (personal.shopping): type must be expense, income, or transfer"]);
  assert.deepEqual(oneCategory({ ...shopping, protected: false }), ["entry 0 (personal.shopping): protected must be true, or left out"]);
  assert.deepEqual(oneCategory({ ...shopping, color: "red" }), ["entry 0 (personal.shopping): color is not a known field"]);
  const { schedule_e_line: _, ...missing } = shopping;
  assert.deepEqual(oneCategory(missing), ["entry 0 (personal.shopping): schedule_e_line is missing"]);
});

test("the transfers root, and only it, has the transfer type", () => {
  assert.deepEqual(oneCategory({ ...transfer, type: "expense" }), ["entry 0 (transfers.transfer): the transfers root, and only it, has the transfer type"]);
  assert.deepEqual(oneCategory({ ...shopping, type: "transfer" }), ["entry 0 (personal.shopping): the transfers root, and only it, has the transfer type"]);
});

test("a tax line is null or a line number, on business categories only", () => {
  const line = (field: "schedule_c_line" | "schedule_e_line", value: unknown) => oneCategory({ ...business, [field]: value });
  for (const field of ["schedule_c_line", "schedule_e_line"] as const) {
    for (const good of [null, "1", "8", "24a", "99", "16b"]) assert.deepEqual(line(field, good), [], `${field} ${JSON.stringify(good)}`);
    for (const bad of ["", "0", "08", "100", "24A", "24ab", "Line 8", "8 ", `8${NBSP}`, `8${ZERO_WIDTH}`, `8${EM_DASH}`, 8]) {
      assert.deepEqual(line(field, bad), [`entry 0 (business.ads): ${field} must be ${TAX_LINE}`], `${field} ${JSON.stringify(bad)}`);
    }
  }
  assert.deepEqual(oneCategory({ ...shopping, schedule_c_line: "8" }), ["entry 0 (personal.shopping): only business categories have tax lines"]);
});

test("frozen fields can't change; tax lines can", () => {
  const renamed = { ...books, name: "Novels" };
  assert.match(checkCategories([shopping, renamed], [], [shopping, books]).join("\n"), /frozen/);
  assert.deepEqual(checkCategories([{ ...business, schedule_c_line: "9" }], [], [business]), []);
});

test("an id that leaves must move to retired, and retired ids are never reused", () => {
  assert.deepEqual(checkCategories([shopping], [], [shopping, books]), ["personal.shopping.books left the data without moving to retired.json"]);
  assert.deepEqual(checkCategories([shopping], [books.id], [shopping, books]), []);
  assert.match(checkCategories([shopping, books], [books.id], undefined).join("\n"), /appears twice/);
});

test("a protected category can't change or leave", () => {
  const locked = { ...shopping, protected: true as const };
  assert.deepEqual(checkCategories([], [locked.id], [locked]), ["personal.shopping is protected and can't leave"]);
  assert.deepEqual(checkCategories([{ ...locked, schedule_c_line: null, type: "income" }], [], [locked]), [
    "personal.shopping: type is frozen once published; ship a new id instead",
    "personal.shopping is protected and can't change",
  ]);
});

const general: Rule = { id: "shop", match: { description: "SHOP" }, set: { payee: "Shop", category_id: shopping.id }, samples: ["SHOP 123"] };
const specific: Rule = { id: "shop.books", match: { description: "SHOP BOOKS" }, set: { payee: "Shop Books", category_id: books.id }, samples: ["SHOP BOOKS 9"] };
const oneRule = (rule: unknown) => checkRules([rule as Rule], [], known, undefined);

test("a specific rule above a general one passes", () => {
  assert.deepEqual(checkRules([specific, general], [], known, undefined), []);
});

test("a file that isn't a list, or an entry that isn't an object, is reported, not thrown", () => {
  assert.deepEqual(checkRules({} as unknown as Rule[], [], known, undefined), ["file must be a list of rules"]);
  assert.deepEqual(checkRules([general, null as unknown as Rule], [], known, [general]), ["entry 1 (no id): value must be a rule: an object of its fields"]);
  assert.deepEqual(checkRules([general], [], known, [null, general] as unknown as Rule[]), []);
});

test("a sample taken by a rule above fails, field by field", () => {
  assert.deepEqual(checkRules([general, specific], [], known, undefined), [
    'entry 1 (shop.books): sample "SHOP BOOKS 9" is taken for payee by shop, above it',
    'entry 1 (shop.books): sample "SHOP BOOKS 9" is taken for category_id by shop, above it',
  ]);
});

test("a rule above that isn't in the format takes no samples", () => {
  const broken = { ...general, id: "broken", set: { payee: "Shop!" } };
  assert.deepEqual(checkRules([broken, specific], [], known, undefined), [`entry 0 (broken): set.payee must be ${PAYEE}`]);
});

test("a rule matches its own samples; an account-only rule matches any", () => {
  assert.deepEqual(oneRule({ ...general, samples: ["NOPE"] }), ['entry 0 (shop): doesn\'t match its own sample "NOPE"']);
  assert.deepEqual(oneRule({ ...general, match: { account: "CARD 1234" }, samples: ["ANY TEXT"] }), []);
});

test("no two rules share an effect", () => {
  const twin = { ...specific, id: "shop.twin", match: { description: "TWIN" }, samples: ["TWIN"], set: { ...general.set } };
  assert.match(checkRules([general, twin], [], known, undefined).join("\n"), /no two rules share an effect/);
});

test("a rule id is one or two levels of lowercase words, up to 60, never rul_", () => {
  for (const good of ["shop", "shop.books", "amazon.prime_video", `a${"_b".repeat(29)}c`.slice(0, 60)]) assert.deepEqual(oneRule({ ...general, id: good }), [], good);
  for (const id of ["rul_shop", "Shop", "shop..x", "shop-x", "a.b.c", `sh${ZERO_WIDTH}op`, "x".repeat(61), ""]) {
    assert.deepEqual(oneRule({ ...general, id }), [`entry 0 (${id}): id must be ${RULE_ID}`], id);
  }
});

test("a rule with no match and no set must be protected, and has no samples", () => {
  assert.deepEqual(oneRule({ id: "link.transfers" }), ["entry 0 (link.transfers): a rule with no match and no set must be protected"]);
  assert.deepEqual(oneRule({ id: "link.transfers", protected: true }), []);
  assert.deepEqual(oneRule({ id: "link.transfers", protected: true, samples: ["A"] }), ["entry 0 (link.transfers): a rule with no match has no samples"]);
});

test("a rule needs a pattern, something to set, and samples", () => {
  assert.deepEqual(oneRule({ ...general, match: {} }), ["entry 0 (shop): match must be a description pattern, an account pattern, or both"]);
  assert.deepEqual(oneRule({ ...general, set: {} }), ["entry 0 (shop): set must be a payee, a category_id, a business_category_id, or a mix of them"]);
  const { match: _m, ...noMatch } = general;
  assert.deepEqual(oneRule(noMatch), ["entry 0 (shop): needs a description or account pattern"]);
  const { set: _s, ...noSet } = general;
  assert.deepEqual(oneRule(noSet), ["entry 0 (shop): needs a payee, a category, or a business category"]);
  const { samples: _x, ...noSamples } = general;
  assert.deepEqual(oneRule(noSamples), ["entry 0 (shop): needs at least one sample statement text"]);
  assert.deepEqual(oneRule({ ...general, samples: [] }), ["entry 0 (shop): samples must be a list of at least one statement text"]);
  assert.deepEqual(oneRule({ ...general, set: { payee: "Shop", entity: "x" } }), ["entry 0 (shop): set.entity is not a known field"]);
});

test("a refused pattern and an unknown category are reported", () => {
  assert.deepEqual(oneRule({ ...general, match: { description: "A||B" } }), ['entry 0 (shop): match.description "A||B" is not a pattern the rules take (CONTRIBUTING.md, Patterns)']);
  assert.deepEqual(oneRule({ ...general, set: { payee: "Shop", category_id: "personal.nowhere" } }), ["entry 0 (shop): category personal.nowhere is not in categories.json"]);
});

test("an over-long alternative is reported for either pattern", () => {
  const long = "A".repeat(49);
  const over = (field: string) => [`entry 0 (shop): match.${field} "${long}" has an alternative over 50 bytes as Clyde matches it in its database (%${long}%)`];
  assert.deepEqual(oneRule({ ...general, match: { description: long }, samples: [long] }), over("description"));
  assert.deepEqual(oneRule({ ...general, match: { description: "SHOP", account: long } }), over("account"));
});

test("a rule may set a transfers category, but never a protected one", () => {
  assert.deepEqual(oneRule({ ...general, set: { category_id: loan.id } }), []);
  assert.deepEqual(oneRule({ ...general, set: { category_id: transfer.id } }), ["entry 0 (shop): category transfers.transfer is protected, so no rule sets it"]);
});

test("a business category stands alone or beside a category outside the business root, and is in the data and unprotected", () => {
  const both = (category_id: string | undefined, business_category_id: unknown) => oneRule({ ...general, set: { payee: "Shop", ...(category_id === undefined ? {} : { category_id }), business_category_id } });
  assert.deepEqual(both(shopping.id, business.id), []);
  assert.deepEqual(both(loan.id, business.id), []);
  assert.deepEqual(both(undefined, business.id), []);
  assert.deepEqual(oneRule({ ...general, set: { business_category_id: business.id } }), []);
  assert.deepEqual(both(business.id, business.id), ["entry 0 (shop): set.category_id must be outside the business root when set.business_category_id is given"]);
  for (const bad of [shopping.id, "business", "business.Ads", 5]) {
    assert.deepEqual(both(shopping.id, bad), ["entry 0 (shop): set.business_category_id must be a business category's id: business, then one or two levels, each a dot and lowercase words of letters and digits joined by _"], JSON.stringify(bad));
  }
  assert.deepEqual(both(shopping.id, "business.nowhere"), ["entry 0 (shop): category business.nowhere is not in categories.json"]);
  const locked = { ...business, id: "business.locked", protected: true as const };
  assert.deepEqual(checkRules([{ ...general, set: { category_id: shopping.id, business_category_id: locked.id } }], [], [...known, locked], undefined), ["entry 0 (shop): category business.locked is protected, so no rule sets it"]);
});

test("a business category is part of a rule's effect, and fixed once published", () => {
  const split = { ...specific, set: { payee: "Shop", category_id: shopping.id, business_category_id: business.id } };
  assert.deepEqual(checkRules([split, general], [], known, undefined), []);
  assert.match(checkRules([split, { ...general, id: "shop.twin", set: { ...split.set } }], [], known, undefined).join("\n"), /no two rules share an effect/);
  const otherBusiness = { ...business, id: "business.other" };
  assert.deepEqual(checkRules([split, { ...specific, id: "shop.twin", match: { description: "TWIN" }, samples: ["TWIN"], set: { ...split.set, business_category_id: otherBusiness.id } }], [], [...known, otherBusiness], undefined), []);
  assert.match(checkRules([split], [], known, [{ ...split, set: { payee: "Shop", category_id: shopping.id } }]).join("\n"), /fixed once published/);
  assert.match(checkRules([{ ...split, set: { payee: "Shop", category_id: shopping.id } }], [], known, [split]).join("\n"), /fixed once published/);
});

test("a personal category reaches only personal rows, while a payee, a business side, or a transfers or business category reaches both", () => {
  const split: Rule = { ...shopIn, match: { description: "SHOP" }, set: { category_id: books.id, business_category_id: business.id } };
  assert.deepEqual(checkRules([general, split], [], known, undefined), []);
  const transfer: Rule = { ...shopIn, id: "shop.move", match: { description: "SHOP" }, set: { category_id: loan.id } };
  assert.deepEqual(checkRules([transfer, split], [], known, undefined), ['entry 1 (shop.payout): sample "SHOP 123" is taken for category_id by shop.move, above it']);
  const gig: Rule = { ...shopIn, id: "shop.gig", match: { description: "SHOP" }, set: { category_id: business.id } };
  assert.deepEqual(checkRules([gig, split], [], known, undefined), ['entry 1 (shop.payout): sample "SHOP 123" is taken for category_id by shop.gig, above it']);
  assert.deepEqual(checkRules([split, { ...general, set: { payee: "Shop", category_id: shopping.id } }], [], known, undefined), ['entry 1 (shop): sample "SHOP 123" is taken for category_id by shop.payout, above it']);
});

test("a business-only rule covers only business rows, so it takes only the business half of a sample", () => {
  const work: Rule = { ...shopIn, id: "shop.work", match: { description: "SHOP" }, set: { payee: "Shop Work", business_category_id: business.id } };
  assert.deepEqual(checkRules([work, general], [], known, undefined), []);
  assert.deepEqual(checkRules([general, work], [], known, undefined), taken("entry 1 (shop.work)", "shop").filter((p) => p.includes("payee")));
  const otherWork = { ...work, id: "shop.other", set: { payee: "Shop Other", business_category_id: business.id } };
  assert.deepEqual(checkRules([work, otherWork], [], known, undefined), taken("entry 1 (shop.other)", "shop.work").filter((p) => p.includes("payee")).concat(['entry 1 (shop.other): sample "SHOP 123" is taken for business_category_id by shop.work, above it']));
  assert.deepEqual(checkRules([work, shopOut, general], [], known, undefined), []);
  assert.deepEqual(checkRules([work, shopOut, shopIn, general], [], known, undefined), [
    'entry 3 (shop): sample "SHOP 123" is taken for payee by shop.work, shop.spend, and shop.payout, above it',
    'entry 3 (shop): sample "SHOP 123" is taken for category_id by shop.spend and shop.payout, above it',
  ]);
});

test("a direction is in or out, and goes with a pattern", () => {
  for (const direction of ["in", "out"]) assert.deepEqual(oneRule({ ...general, match: { description: "SHOP", direction } }), [], direction);
  for (const bad of ["In", "both", "", 1, null]) {
    assert.deepEqual(oneRule({ ...general, match: { description: "SHOP", direction: bad } }), ["entry 0 (shop): match.direction must be in for money in, out for money out, or left out for either"], JSON.stringify(bad));
  }
  assert.deepEqual(oneRule({ ...general, match: { account: "CARD", direction: "out" }, samples: ["ANY"] }), []);
});

test("account types are a list of groups, each once, and go with a pattern", () => {
  assert.deepEqual(oneRule({ ...general, match: { description: "SHOP", account_types: ["bank", "investments"] } }), []);
  assert.deepEqual(oneRule({ ...general, match: { description: "SHOP", account_types: ["bank", "bank"] } }), ["entry 0 (shop): match.account_types lists a group twice"]);
  assert.deepEqual(oneRule({ ...general, match: { description: "SHOP", account_types: [] } }), ["entry 0 (shop): match.account_types must be a list of at least one account type group, or left out for any account"]);
  assert.deepEqual(oneRule({ ...general, match: { description: "SHOP", account_types: "bank" } }), ["entry 0 (shop): match.account_types must be a list of at least one account type group, or left out for any account"]);
  assert.deepEqual(oneRule({ ...general, match: { description: "SHOP", account_types: ["checking"] } }), [
    "entry 0 (shop): match.account_types[0] must be bank, credit, investments, assets, liability, or business_payments",
  ]);
});

test("a direction or account types alone are not a match", () => {
  const alone = ["entry 0 (shop): match needs a description or account pattern; a direction or account types only narrow one"];
  assert.deepEqual(oneRule({ ...general, match: { direction: "in" } }), alone);
  assert.deepEqual(oneRule({ ...general, match: { account_types: ["bank"] } }), alone);
  assert.deepEqual(oneRule({ ...general, match: { direction: "in", account_types: ["bank"] } }), alone);
});

test("the schema's directions and account type groups are the validator's", () => {
  const match = ((RULE_SCHEMA.items as Schema).properties as Record<string, Schema>).match!;
  const fields = match.properties as Record<string, Schema>;
  assert.deepEqual((fields.account_types!.items as Schema).enum, ACCOUNT_TYPES);
  assert.deepEqual(fields.direction!.enum, DIRECTIONS);
});

test("a rule's format problems are reported together", () => {
  assert.deepEqual(oneRule({ ...general, match: { description: "SHOP", account_types: ["bank", "bank"] }, set: { category_id: business.id, business_category_id: business.id } }), [
    "entry 0 (shop): match.account_types lists a group twice",
    "entry 0 (shop): set.category_id must be outside the business root when set.business_category_id is given",
  ]);
});

const shopIn: Rule = { id: "shop.payout", match: { description: "SHOP", direction: "in" }, set: { payee: "Shop Payout", category_id: books.id }, samples: ["SHOP 123"] };
const shopOut: Rule = { id: "shop.spend", match: { description: "SHOP", direction: "out" }, set: { payee: "Shop Spend", category_id: business.id }, samples: ["SHOP 123"] };
const taken = (entry: string, by: string) => [`${entry}: sample "SHOP 123" is taken for payee by ${by}, above it`, `${entry}: sample "SHOP 123" is taken for category_id by ${by}, above it`];

test("a rule above takes a sample only for the directions it matches", () => {
  assert.deepEqual(checkRules([shopIn, { ...general, match: { description: "SHOP", direction: "out" } }], [], known, undefined), []);
  assert.deepEqual(checkRules([shopIn, general], [], known, undefined), []);
  assert.deepEqual(checkRules([shopIn, { ...general, match: { description: "SHOP", direction: "in" } }], [], known, undefined), taken("entry 1 (shop)", "shop.payout"));
  assert.deepEqual(checkRules([general, shopIn], [], known, undefined), taken("entry 1 (shop.payout)", "shop"));
});

test("rules above take a sample together when they cover every case of it", () => {
  assert.deepEqual(checkRules([shopIn, shopOut, general], [], known, undefined), taken("entry 2 (shop)", "shop.payout and shop.spend"));
  const banks = { ...shopIn, match: { ...shopIn.match, account_types: ["bank" as const] } };
  assert.deepEqual(checkRules([banks, shopOut, general], [], known, undefined), []);
  assert.deepEqual(checkRules([banks, shopOut, { ...general, match: { description: "SHOP", account_types: ["bank"] } }], [], known, undefined), taken("entry 2 (shop)", "shop.payout and shop.spend"));
  const typed = { ...general, id: "shop.typed", match: { description: "SHOP", account_types: [...ACCOUNT_TYPES] } };
  assert.deepEqual(checkRules([typed, shopIn], [], known, undefined), []);
  assert.deepEqual(checkRules([typed, { ...shopIn, match: { ...shopIn.match, account_types: ["bank"] } }], [], known, undefined), taken("entry 1 (shop.payout)", "shop.typed"));
});

test("a rule's category is fixed once published; its pattern may improve", () => {
  const moved = { ...general, set: { payee: "Shop", category_id: books.id } };
  assert.match(checkRules([moved], [], known, [general]).join("\n"), /fixed once published/);
  const better = { ...general, match: { description: "^SHOP" } };
  assert.deepEqual(checkRules([better], [], known, [general]), []);
});

test("a rule that leaves must move to retired; a protected one can't leave or change", () => {
  assert.deepEqual(checkRules([general], [], known, [general, specific]), ["shop.books left the data without moving to retired.json"]);
  assert.deepEqual(checkRules([general], [specific.id], known, [general, specific]), []);
  const locked = { id: "link.transfers", protected: true as const };
  assert.deepEqual(checkRules([], [locked.id], known, [locked]), ["link.transfers is protected and can't leave"]);
  assert.deepEqual(checkRules([{ ...locked, match: { description: "X" }, set: { payee: "X" }, samples: ["X"] }], [], known, [locked]), ["link.transfers is protected and can't change"]);
});

test("a payee is 1 to 60 characters of single-spaced words, starting with a letter or digit", () => {
  const payee = (value: unknown) => oneRule({ ...general, set: { payee: value, category_id: shopping.id } });
  for (const good of ["Shop & Co. (Books) +1", "x".repeat(60), "a", "7-Eleven", "AT&T", "McDonald's"]) assert.deepEqual(payee(good), [], good);
  for (const bad of [`Shop ${EMOJI}`, `Sh${ZERO_WIDTH}op`, `${RTL_OVERRIDE}Shop`, `${CYRILLIC_A}mazon`, `Caf${E_ACUTE}`, " Shop", "Shop  Books", "Shop ", "x".repeat(61), "Shop!", "Shop_1", "(Shop)", "&Co", "", 5]) {
    assert.deepEqual(payee(bad), [`entry 0 (shop): set.payee must be ${PAYEE}`], JSON.stringify(bad));
  }
});

test("a rule's category is a category id", () => {
  for (const bad of [`personal.${CYRILLIC_A}`, "Personal.Shopping", "personal..shopping", "shopping", "personal", "personal.a.b.c", ""]) {
    assert.deepEqual(oneRule({ ...general, set: { payee: "Shop", category_id: bad } }), [
      `entry 0 (shop): set.category_id must be a category's id: a root (personal, business, or transfers), then one or two levels, each a dot and lowercase words of letters and digits joined by _`,
    ], bad);
  }
});

test("patterns are uppercase ASCII with a few symbols; samples are any printable ASCII", () => {
  for (const good of ["^AT&T$", "7-ELEVEN", "MCDONALD'S", "APPLE.COM/BILL", "STORE #12", "UBER \\*EATS", "^A$|B*C"]) {
    assert.deepEqual(rulesFormatProblems({ ...general, match: { description: good } }), [], good);
  }
  for (const bad of ["shop", `SHOP${NBSP}123`, `SHOP${EM_DASH}`, `SHOP${ZERO_WIDTH}`, `${RTL_OVERRIDE}SHOP`, `CAF${char(0xc9)}`, "SHOP_1", "50%", "SHOP!", "(SHOP)", "S".repeat(201), "", 5]) {
    assert.deepEqual(oneRule({ ...general, match: { description: bad } }), [`entry 0 (shop): match.description must be ${PATTERN}`], JSON.stringify(bad));
    assert.deepEqual(oneRule({ ...general, match: { description: "SHOP", account: bad } }), [`entry 0 (shop): match.account must be ${PATTERN}`], JSON.stringify(bad));
  }
  assert.deepEqual(oneRule({ ...general, samples: ["SHOP {1} ~ _ % ! (x) @"] }), []);
  for (const bad of [`SHOP${NBSP}123`, `SHOP ${EM_DASH} 123`, `SHOP ${EMOJI}`, `SHOP${ZERO_WIDTH}`, "SHOP\t1", "S".repeat(201), "", 5]) {
    assert.deepEqual(oneRule({ ...general, samples: ["SHOP 1", bad] }), [`entry 0 (shop): samples[1] must be ${SAMPLE}`], JSON.stringify(bad));
  }
});

test("a protected entry compares by value, so reordered keys aren't a change", () => {
  const locked = { ...shopping, protected: true as const };
  const reordered = Object.fromEntries(Object.entries(locked).reverse()) as unknown as Category;
  assert.deepEqual(checkCategories([reordered], [], [locked]), []);
  const rule = { id: "link.transfers", protected: true as const };
  assert.deepEqual(checkRules([{ protected: true, id: "link.transfers" } as Rule], [], known, [rule]), []);
});

test("a rule above with only an account pattern takes no samples from rules below", () => {
  const byAccount: Rule = { id: "card", match: { account: "CARD 1234" }, set: { category_id: shopping.id }, samples: ["ANY TEXT"] };
  assert.deepEqual(checkRules([byAccount, specific], [], known, undefined), []);
});

test("a retired id stays retired", () => {
  const left = (id: string) => `${id} left retired.json; a retired id stays retired, so it is never reused`;
  assert.deepEqual(checkCategories([shopping], ["personal.old", "personal.older"], undefined, ["personal.old", "personal.older"]), []);
  assert.deepEqual(checkCategories([shopping], ["personal.old"], undefined, ["personal.old", "personal.older"]), [left("personal.older")]);
  assert.deepEqual(checkRules([general], [], known, undefined, ["shop.old"]), [left("shop.old")]);
  assert.deepEqual(checkRules([general], [], known, undefined, { not: "a list" } as unknown as string[]), []);
});

function rulesFormatProblems(rule: Rule): string[] {
  return checkRules([rule], [], known, undefined).filter((problem) => !problem.includes("sample"));
}
