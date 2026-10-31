<p align="center">
  <img src="src/brand/logo.svg" alt="Clyde" width="128">
</p>

# Contributing

We appreciate your contributions to enhance Clyde. Open an issue to suggest something, or a pull request with the change. By opening a pull request you license your contribution under the repo's Apache-2.0 license (section 5 of the license).

## What gets merged

An enhancement is anything in this repo that a Clyde user can add or use: a rule, a category, an artifact, a plugin skill, or any kind added later.

Enhancements are held to an 80/20 rule: one is merged only if it is among the top 20% of its kind and useful to 80% of Clyde users. Before you open an issue or pull request, ask: "Would most Clyde users use this?"

- **Likely to be merged:** fixes to existing enhancements, and new ones that most users would use.
- **Not merged:** enhancements for a local or regional business, for one person's setup, for a matter of taste, or for a need only a few users have.

An enhancement only you need can live in your own ledger or AI app: ask your AI app to create it. Issues and pull requests that don't meet the 80/20 rule are closed without review.

A pull request opens with a checklist. It merges once CI and code scanning pass, a maintainer approves it, and every review thread is resolved; only a maintainer merges.

## Running the checks

Node 26 or later. Install the dependencies once, then run every check before you open a pull request; CI runs them too.

```sh
npm ci             # the type checker and Node's types, and esbuild and Tailwind, which build the artifacts
npm run typecheck  # type-check the validators, the tests, and the artifacts' code
npm test           # the tests
npm run validate   # check rules/, categories/, plugin/, and artifacts/, and that artifacts/ and the preview's examples are built from their source
```

CI also compares `rules/`, `categories/`, and `artifacts/` with the base branch. To run that locally, pass each validator the base's files: `node rules/validate.ts --base <rules.json> --base-retired <retired.json>`, the same for categories, and `node lib/artifacts/validate.ts --base <folder>` for a folder holding the base's `artifacts/`.

The validators are TypeScript that Node runs as it is, stripping the types, so they use only syntax Node can strip; `npm run typecheck` refuses anything else. The files in `lib/format/` also run inside Clyde, which copies that folder alone, so they use nothing Node-only and import only one another; the type check runs them without Node's types, and a test checks their imports. `lib/plugin/` checks the plugin, `lib/artifacts/` the artifacts, and `lib/check.ts` is what the validators share in CI. Every `.ts` file starts with the copyright line and `SPDX-License-Identifier: Apache-2.0`, as the others do; a test checks it.

Code carries no comments: names and tests say what it does. The only comments are that license header, an artifact shell's opening comment, and the release named after a pinned action in CI. A test checks the code, the style, and the config. Every file is plain ASCII and ends with a newline.

## Rules

`rules/rules.json` lists rules in run order: for each field, the first rule that matches a transaction and sets that field wins, so a specific rule goes above the general one it overlaps.

| Field | Meaning |
|---|---|
| `id` | A short dotted path in lowercase, saying what the rule is about: `amazon`, `amazon.prime_video`, `uber.eats`. One or two levels of lowercase letters and digits, words joined by `_`, levels by `.`, up to 60 characters, never starting `rul_`. |
| `match.description` | A pattern on the transaction's statement text: 1 to 200 characters of uppercase letters, digits, spaces, `& ' - . + / #`, and the pattern characters below. A rule has this, `match.account`, or both. |
| `match.account` | A pattern on the account's name as its institution sends it, written the same way. Samples carry no account name, so a rule with only this pattern matches every sample and is not tested against the samples of rules below it. |
| `match.direction` | `in` (money in) or `out` (money out) on the transaction's own account; leave it out for either. Needs a pattern. |
| `match.account_types` | The account type groups the rule matches, each once: `bank`, `credit`, `investments`, `assets`, `liability`, `business_payments`. Leave it out for any account; with it, untyped accounts never match. Needs a pattern. |
| `set.payee` | The payee the rule sets, or leave it out: 1 to 60 characters starting with a letter or digit, of letters, digits, and `& ' - / ( ) , . +`, with single spaces between words. |
| `set.category_id` | The category the rule sets, or leave it out: an id from `categories/categories.json`, never a protected one. A personal category is never set on a business transaction. |
| `set.business_category_id` | The category set instead on a business transaction (from an account a business owns, or an asset account that files a tax form). Without `set.category_id`, the rule applies to business transactions only. Never a protected one. |
| `samples` | Statement texts the rule must match and win, field by field, against every rule above it: each 1 to 200 printable ASCII characters, as a statement shows them. Each is checked for every direction, account type, and personal or business case the rule can meet. |
| `protected` | `true` for rules Clyde's own behavior depends on. |

Every field is plain English text because a ledger shows it and matches on it: no emoji, accents, invisible or direction characters, non-breaking spaces, curly quotes or long dashes, or letters from other alphabets that look like Latin ones. Printable ASCII means the characters from space to `~`. `rules/schema.json` states each field's rule; when an entry breaks one, CI prints the field's path and the rule's `errorMessage`, such as `entry 3 (amazon): set.payee must be 1 to 60 characters ...`.

No two rules may set the same payee and categories. A rule's patterns and payee may improve in place; its categories are fixed once published (add a new rule and retire the old id instead).

### Patterns

Simple wildcard text, not a regular expression. Matching ignores case; write patterns in uppercase.

- Plain text matches anywhere: `STARBUCKS` matches `STARBUCKS STORE 01234`.
- `*` stands for any run of characters: `AMAZON*SEATTLE`.
- `|` separates alternatives: `HBO MAX|MAX.COM`.
- `^` at the start of an alternative anchors it to the start of the text; `$` at its end anchors it to the end: `^ALDI`, `^PEACOCK$`.
- `\` makes the next special character literal: `UBER \*EATS`. In JSON, write it as `\\*`.

Clyde matches each alternative in its database as a LIKE pattern of at most 50 bytes. That pattern is the alternative's literal pieces (the text between unescaped `*`, escapes resolved) joined by `%`, with a `%` added at the start unless the alternative begins with `^` and at the end unless it ends with `$`; a `\` in a piece counts as 2 bytes. A longer alternative is refused: `^UBER \*EATS` becomes `UBER *EATS%`, 11 bytes.

Prefer the shortest text that names the merchant or payer without catching others: anchor short words that appear inside other names (`^CVS`), and add a sample for each form its statement text takes.

## Categories

`categories/categories.json` is the category tree, parents before children.

| Field | Meaning |
|---|---|
| `id` | The path of the name: the parent's id (or the root), a dot, then the name's words in lowercase joined by `_`. `Office Expenses` under `business` is `business.office_expenses`. A category is at most two levels below its root. |
| `root` | `personal`, `business`, or `transfers`. |
| `parent_id` | The parent's id, which is a top-level category's, or `null` at the top of a root. |
| `name` | 1 to 40 characters starting with a letter or digit: letters, digits, single spaces, and `& ' - / ( ) ,`. |
| `type` | `expense` or `income`; `transfer` in the transfers root, which has only that type. |
| `schedule_c_line`, `schedule_e_line` | The tax form line a business category reports on: a number from 1 to 99 with an optional lowercase letter, such as `"8"` or `"24a"`, or `null`. |
| `protected` | `true` for categories Clyde's own behavior depends on. They never change or leave. |

Ids, names, and tax lines are plain English text, as in rules. `categories/schema.json` states each field's rule, and CI prints its `errorMessage` when an entry breaks one.

Once published, a category's id, root, parent, name, and type never change: tax reports for past years read them. To change one, add a new category and move the old id to `categories/retired.json`. Tax lines may change in place. An id in either `retired.json` stays there for good, so no later entry reuses it; CI compares both lists with the base branch's.

## Artifacts

`artifacts/` holds the built artifacts AI apps copy. Edit the source in `src/artifacts/` and run `npm run build`; never edit the built files. CI checks they match their source.

```sh
npm run build      # build src/artifacts/ into artifacts/
npm run preview    # serve each artifact at http://localhost:4173 with a sample ledger
```

- A view is a shell (`<name>.html`) and a script (`views/<name>.ts`), holding parts (`parts/`) built from shared pieces (`ui/`). `clyde.ts` lists the answer fields the views read, `answers.ts` turns answers into what they draw, and `connector.ts` makes the calls. Every word shown is in `words.json` or comes from Clyde.
- Each artifact is one self-contained `.html` file that loads nothing from outside it. It opens with a comment: `Clyde artifact: <Name>.` with the copyright and license line, a `Version:` line (major.minor.patch, from `0.1.0`), what it shows, and a `Connector tools:` line. Raise the patch for a fix, and the minor for any change to what it shows or does or which Clyde fields and tools it uses. CI checks that an artifact changed since the base branch has a higher version. It calls only Clyde's `show_` views and `edit`. `lib/artifacts/validate.ts` checks this.
- It reads each fact from a field of its own, never from words, position, or absence, and holds no one's data.
- The preview answers from a sample ledger in `src/artifacts/preview/` and keeps a Save until reload. `?theme=dark`, `?fail=<code>`, `?slow`, `?conflict`, and `?failMonth=YYYY-MM` show other states.
- `src/artifacts/preview/examples/` holds one call of each kind the Dashboard makes, with exactly the fields it reads; Clyde's tests check its answers against them. `node lib/artifacts/examples.ts` writes them.
- It works at 360 px with no sideways scroll, in light and dark, with visible focus rings, and respects reduced motion.

## Plugin

`plugin/` is the Clyde plugin in the open plugin format.

- One folder per skill under `plugin/skills/`, holding only `SKILL.md`. Its `name` matches the folder; its `description` is one sentence of up to 300 characters, as short as it can be.
- A skill names only Clyde's tools, says what the details typed after it narrow and what happens when one is missing, and repeats nothing a tool already says.
- Examples are generic: no merchants or institutions, dates on January 1 or in January, months from January, and a year only as next year.
- Wording is plain: the description names Clyde; no "bank" outside type and category names, "sign in" as two words, no app or lab names, nothing about syncing, no styling or layout words, no "never", "always", or "must", no "catalog" for Enhance, and plain ASCII punctuation.
- A new skill also goes in `SKILLS` in `lib/plugin/validate.ts` and in the table in `plugin/README.md`.
- `plugin.json` and `mcp.json` are the portable manifest and connector; `.claude-plugin/plugin.json` and `.mcp.json` are a host's own copies and stay equal to them.
- `package.json`'s version is the plugin's. Its brand and naming fields are fixed in `PACKAGE` in `lib/plugin/validate.ts`, so a change to one goes in both files.
- Brand values (names, description, contact, links) match Clyde's own brand file; Clyde's tests check them when it moves its pin. `lib/plugin/validate.ts` checks the rest.

---

Copyright 2026 Clyde Intelligence, LLC. Licensed under the [Apache License, Version 2.0](LICENSE).
