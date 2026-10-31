# Artifacts

Ready-made views of Clyde that stay open in your AI app and keep themselves current, instead of being rebuilt each time.

| File | What it shows |
|---|---|
| `dashboard.html` | Transactions, Accounts, and Spending in three tabs: transactions by month, with search, sorting, and editing, a list of accounts, and a spending summary. |

An account or a spending line opens the Dashboard's Transactions tab filtered by that scope.

## Use one

Ask your AI app to make an artifact from the file's link in this folder. It copies the file into an artifact of your own and lets you interact with your ledger. The artifact reads your ledger, and can update transactions when you edit or ask your agent.

## Updates

Your artifact is a copy, so it doesn't change when the file here does. The `Version:` line at the top of each file tells you whether yours is current: when the file's version is newer, ask your AI app to update your artifact from the file's link.

## Contribute one

The files here are built from `src/artifacts/`. See the Artifacts section of [CONTRIBUTING.md](../CONTRIBUTING.md).
