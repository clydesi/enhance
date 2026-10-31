<p align="center">
  <img src="src/brand/logo.svg" alt="Clyde" width="128">
</p>

# Clyde Enhance

Enhance Clyde with ready-made rules, categories, artifacts, and plugins.

## Layout

One folder per kind of contribution:

| Folder | What it holds |
|---|---|
| `rules/` | Rules that can modify a transaction manually or through automation. |
| `categories/` | Categories that organize transactions for spending and tax reports. |
| `artifacts/` | Artifacts that present Clyde features in a view that stays open and keeps itself current. |
| `plugin/` | A plugin that pairs the Clyde connector with skills for the things users do most. |

More kinds get their own folder when their feature exists. `rules/` and `categories/` each hold their data (one JSON file, in order). `artifacts/` holds one self-contained HTML file per artifact, built from its source in `src/artifacts/`. `src/brand/` holds the logo and icon this README and the artifacts share. `plugin/` holds the plugin's manifests, its connector, and its skills.

`rules/` and `categories/` each also hold a `retired.json` list of ids that left the data and are never reused, a `schema.json` that states each entry's fields, and a `validate.ts` for what spans entries. `lib/format/` checks entries against the schemas, and Clyde runs those same files on the copy it pins, so the two can't disagree. `lib/plugin/` checks `plugin/`, and `lib/artifacts/` builds and checks `artifacts/`. CI runs every validator on every pull request, and compares `rules/`, `categories/`, and `artifacts/` with the base branch.

## How Clyde uses it

Clyde pins a commit of this repo and copies the folders it reads into its own code. New entries and fixes reach Clyde only when Clyde moves that pin, after its own tests pass against them. The plugin is released from the `plugin-release` branch. Artifacts don't go through Clyde: a user's AI app reads one from the `main` branch and copies it into an artifact of their own. The copy changes only when the user asks their AI app to update it from the file.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to work on the repo and how changes are reviewed.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

---

Copyright 2026 Clyde Intelligence, LLC. Licensed under the [Apache License, Version 2.0](LICENSE).
