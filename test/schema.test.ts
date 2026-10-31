// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { test } from "node:test";
import { CATEGORY_SCHEMA } from "../categories/validate.ts";
import { categoriesFormat, rulesFormat } from "../lib/format/format.ts";
import { schemaKeywordProblems, schemaProblems } from "../lib/format/schema.ts";
import { RULE_SCHEMA } from "../rules/validate.ts";

test("both data schemas use only keywords and values the checker knows", () => {
  assert.deepEqual(schemaKeywordProblems(CATEGORY_SCHEMA), []);
  assert.deepEqual(schemaKeywordProblems(RULE_SCHEMA), []);
});

test("a keyword the checker doesn't know is refused, at any depth", () => {
  assert.deepEqual(schemaKeywordProblems({ type: "object", properties: { a: { oneOf: [] } } }), ["the schema uses oneOf at a, which this checker doesn't know"]);
  assert.deepEqual(schemaKeywordProblems({ type: "array", items: { format: "email" } }), ["the schema uses format at [], which this checker doesn't know"]);
  assert.deepEqual(schemaKeywordProblems({ constructor: 1 }), ["the schema uses constructor at the top, which this checker doesn't know"]);
});

test("a keyword value the checker doesn't know is refused", () => {
  const refused = (schema: Record<string, unknown>) => schemaKeywordProblems(schema).length > 0;
  for (const schema of [
    { type: "date" },
    { type: [] },
    { type: [{}] },
    { minLength: "5" },
    { maxLength: -1 },
    { minItems: 1.5 },
    { required: "a" },
    { required: [1] },
    { properties: [] },
    { properties: { a: false } },
    { properties: { a: null } },
    { additionalProperties: true },
    { items: false },
    { items: [{}] },
    { pattern: "(" },
    { pattern: 5 },
    { const: { a: 1 } },
    { enum: [[1]] },
    { enum: [] },
    { errorMessage: 5 },
  ]) {
    assert.ok(refused(schema), JSON.stringify(schema));
  }
  assert.deepEqual(schemaKeywordProblems({ type: ["string", "null"], enum: ["a", null, 1, true], const: "a", additionalProperties: false }), []);
});

test("a data file whose schema is refused, or has no items, checks nothing", () => {
  assert.deepEqual(categoriesFormat([], { type: "array", items: { format: "email" } }), { problems: ["the schema uses format at [], which this checker doesn't know"], inFormat: [] });
  assert.deepEqual(categoriesFormat([], { type: "array" }), { problems: ["the schema needs items: the schema of one entry"], inFormat: [] });
});

test("a failing value is told the schema's errorMessage, or the keywords it fails", () => {
  assert.deepEqual(schemaProblems("ab", { type: "string", maxLength: 1, errorMessage: "one letter" }, "x"), ["x must be one letter"]);
  assert.deepEqual(schemaProblems("abc", { type: "string", maxLength: 2, pattern: "^a$" }, "x"), ["x must be at most 2 characters, must match ^a$"]);
  assert.deepEqual(schemaProblems("", { type: "string", minLength: 1 }), ["value must be at least 1 character"]);
  assert.deepEqual(schemaProblems("b", { enum: ["a", "c"] }), ['value must be one of "a", "c"']);
  assert.deepEqual(schemaProblems(false, { const: true }), ["value must be true"]);
});

test("types: a list allows any of them, and a value of the wrong type is reported alone", () => {
  const schema = { type: ["string", "null"], minLength: 2 };
  assert.deepEqual(schemaProblems(null, schema), []);
  assert.deepEqual(schemaProblems("ab", schema), []);
  assert.deepEqual(schemaProblems("a", schema), ["value must be at least 2 characters"]);
  assert.deepEqual(schemaProblems(5, schema), ["value must be string or null"]);
  assert.deepEqual(schemaProblems("x", { type: "object", required: ["a"] }), ["value must be object"]);
  assert.deepEqual(schemaProblems(1.5, { type: "integer" }), ["value must be integer"]);
  assert.deepEqual(schemaProblems(Number.NaN, { type: "number" }), ["value must be number"]);
  assert.deepEqual(schemaProblems(true, { type: "boolean" }), []);
});

test("lengths count code points, as JSON Schema does", () => {
  assert.deepEqual(schemaProblems(String.fromCodePoint(0x1f600), { type: "string", maxLength: 1 }), []);
});

test("objects: required fields, unknown fields, nested paths, and minProperties", () => {
  const schema = { type: "object", additionalProperties: false, required: ["a"], minProperties: 2, properties: { a: { type: "string" }, b: { type: "object", properties: { c: { type: "string" } } } } };
  assert.deepEqual(schemaProblems({ a: "x", b: { c: "y" } }, schema), []);
  assert.deepEqual(schemaProblems({ b: { c: 1 }, z: 1 }, schema), ["a is missing", "b.c must be string", "z is not a known field"]);
  assert.deepEqual(schemaProblems({ a: "x" }, schema), ["value must have at least 2 fields"]);
  assert.deepEqual(schemaProblems({ a: "x", constructor: 1 }, schema), ["constructor is not a known field"]);
  assert.deepEqual(schemaProblems(JSON.parse('{"b": {}}'), { ...schema, required: ["toString"], minProperties: 0 }), ["toString is missing"]);
  assert.deepEqual(schemaProblems({ a: 1 }, { type: "object", additionalProperties: { type: "string" } }), ["a must be string"]);
});

test("arrays: items by index, and minItems", () => {
  const schema = { type: "array", minItems: 1, items: { type: "string" } };
  assert.deepEqual(schemaProblems(["a", 2], schema, "samples"), ["samples[1] must be string"]);
  assert.deepEqual(schemaProblems([], schema, "samples"), ["samples must have at least 1 item"]);
});

test("a data file is a list; each entry's problems name its index and id, and say whether it's in the format", () => {
  for (const file of [{}, null, "x", 5]) assert.deepEqual(categoriesFormat(file, CATEGORY_SCHEMA), { problems: ["file must be a list of categories"], inFormat: [] });
  assert.deepEqual(rulesFormat({}, RULE_SCHEMA), { problems: ["file must be a list of rules"], inFormat: [] });
  const good = { id: "personal.shopping", root: "personal", parent_id: null, name: "Shopping", type: "expense", schedule_c_line: null, schedule_e_line: null };
  assert.deepEqual(categoriesFormat([good, { ...good, name: "Shop  ping" }, "x", null], CATEGORY_SCHEMA), {
    problems: [
      "entry 1 (personal.shopping): name must be 1 to 40 characters starting with a letter or digit: letters, digits, single spaces, and the symbols & ' - / ( ) and comma",
      "entry 2 (no id): value must be a category: an object of its fields",
      "entry 3 (no id): value must be a category: an object of its fields",
    ],
    inFormat: [true, false, false, false],
  });
});

test("rule patterns go through the pattern engine only once the entry passes the schema", () => {
  const rule = { id: "shop", match: { description: "A||B" }, set: { payee: "Shop" }, samples: ["A"] };
  assert.deepEqual(rulesFormat([rule], RULE_SCHEMA).problems, ['entry 0 (shop): match.description "A||B" is not a pattern the rules take (CONTRIBUTING.md, Patterns)']);
  assert.deepEqual(rulesFormat([{ ...rule, id: "Shop" }], RULE_SCHEMA).problems, [
    "entry 0 (Shop): id must be up to 60 characters in one or two levels, each lowercase words of letters and digits joined by _, levels joined by a dot, not starting rul_",
  ]);
});
