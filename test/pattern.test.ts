// Copyright 2026 Clyde Intelligence, LLC
// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { test } from "node:test";
import { likePatterns, matches, patternProblems } from "../lib/format/pattern.ts";

const a = (n: number) => "A".repeat(n);
const over = (like: string) => [`has an alternative over 50 bytes as Clyde matches it in its database (${like})`];

test("the pattern syntax matches as CONTRIBUTING describes", () => {
  assert.ok(matches("STARBUCKS", "STARBUCKS STORE 01234"));
  assert.ok(matches("AMAZON*SEATTLE", "AMAZON MKTP SEATTLE WA"));
  assert.ok(matches("HBO MAX|MAX.COM", "max.com/bill"));
  assert.ok(matches("^ALDI", "ALDI 123"));
  assert.ok(!matches("^ALDI", "THE ALDI"));
  assert.ok(matches("^PEACOCK$", "peacock"));
  assert.ok(!matches("^PEACOCK$", "PEACOCK TV"));
  assert.ok(matches("UBER \\*EATS", "UBER *EATS PENDING"));
  assert.ok(!matches("UBER \\*EATS", "UBER EATS"));
});

test("a pattern the rules refuse is one problem", () => {
  for (const refused of ["A||B", "|A", "^", "*", "A^B", "A$B", "\\X", "A\\", "   ", "A".repeat(201)]) {
    assert.deepEqual(patternProblems(refused), ["is not a pattern the rules take (CONTRIBUTING.md, Patterns)"], refused);
  }
});

test("each alternative becomes a LIKE pattern: pieces joined by %, a % at each end not anchored", () => {
  assert.deepEqual(likePatterns("AB"), ["%AB%"]);
  assert.deepEqual(likePatterns("^AB$"), ["AB"]);
  assert.deepEqual(likePatterns("^AB"), ["AB%"]);
  assert.deepEqual(likePatterns("AB$"), ["%AB"]);
  assert.deepEqual(likePatterns("^A*B$|C"), ["A%B", "%C%"]);
  assert.deepEqual(likePatterns("^UBER \\*EATS"), ["UBER *EATS%"]);
  assert.deepEqual(likePatterns("^A\\|B$"), ["A|B"]);
  assert.deepEqual(likePatterns("^a_%\\\\$"), ["A\\_\\%\\\\"]);
});

test("each alternative fits 50 bytes as a LIKE pattern", () => {
  assert.deepEqual(patternProblems(a(48)), []);
  assert.deepEqual(patternProblems(a(49)), over(`%${a(49)}%`));
  assert.deepEqual(patternProblems(`^${a(50)}$`), []);
  assert.deepEqual(patternProblems(`^${a(51)}$`), over(a(51)));
  assert.deepEqual(patternProblems(`^${a(49)}`), []);
  assert.deepEqual(patternProblems(`${a(50)}$`), over(`%${a(50)}`));
  assert.deepEqual(patternProblems(`^${a(24)}*${a(25)}$`), []);
  assert.deepEqual(patternProblems(`^${a(24)}*${a(26)}$`), over(`${a(24)}%${a(26)}`));
  assert.deepEqual(patternProblems(`^${"_".repeat(25)}$`), []);
  assert.deepEqual(patternProblems(`^${"_".repeat(26)}$`), over("\\_".repeat(26)));
  assert.deepEqual(patternProblems(`^${"%".repeat(24)}A$`), []);
  assert.deepEqual(patternProblems(`^${"\\\\".repeat(25)}$`), []);
  assert.deepEqual(patternProblems(`^${"\\\\".repeat(26)}$`), over("\\\\".repeat(26)));
  assert.deepEqual(patternProblems(`^${a(24)}\\*${a(25)}$`), []);
  assert.deepEqual(patternProblems(`^${a(24)}\\|${a(25)}$`), []);
  assert.deepEqual(patternProblems(`^${a(25)}\\|${a(25)}$`), over(`${a(25)}|${a(25)}`));
  assert.deepEqual(patternProblems(`^${a(50)}$|^${a(50)}$`), []);
  assert.deepEqual(patternProblems(`^B$|${a(49)}`), over(`%${a(49)}%`));
});
