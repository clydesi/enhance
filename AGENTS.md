# Agents

Read [CONTRIBUTING.md](CONTRIBUTING.md) before changing anything: it holds every rule, and CI checks most of them. In short:

- **What belongs.** An enhancement is merged only under the 80/20 rule: among the top 20% of its kind and useful to 80% of Clyde users. One unit of work per pull request.
- **Checks.** Run `npm run typecheck`, `npm test`, and `npm run validate` before opening a pull request, and fix what fails.
- **Built files.** Never edit `artifacts/` or `src/artifacts/preview/examples/` by hand: `npm run build` writes the first, `node lib/artifacts/examples.ts` the second.
- **No comments.** Code, styles, and config carry none: only the license header, an artifact shell's opening comment, and the release after a pinned action in CI. A test refuses any other.
- **Plain ASCII.** Every file, punctuation included, and each ends with a newline.
- **Generic data.** No real merchants, institutions, people, or ledger data, in code, tests, examples, commits, or pull requests.
- **Clyde's surface only.** Name only what any connected client receives: tool names, inputs, and answer fields. Nothing here describes how Clyde works inside.
- **Artifacts.**
  - They read only the fields in `src/artifacts/clyde.ts`, each fact from a field of its own, never from words, position, or absence.
  - They call only Clyde's `show_` views and `edit`, and load nothing from outside the file.
  - Every word they show comes from `src/artifacts/words.json` or from Clyde's answers.
