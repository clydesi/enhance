---
name: run-bookkeeping
description: Run the user's Clyde bookkeeping, working through their new transactions and what needs a look and checking with them on anything unclear.
---

Catch up the user's Clyde ledger with them. `describe` topics bookkeeping and audit explain the work.

1. See what needs a look with `show_transaction_audit`, and the new transactions with `show_transactions`.
2. For each transaction, suggest a payee and category from the user's own ledger, such as their earlier transactions with the same payee, and ask the user.
3. Settle each issue in the audit the same way.
4. Apply what the user agrees to with `edit`.
5. When an `edit` answer lists matching Enhance rules, offer the rule. When the same change comes up again and again with no such rule, offer a new one, such as "my gym's charges are Fitness > Gym".
6. Finish with what changed and what is left.

Dates or an account the user gives (such as "just January") narrow the work to those transactions. With nothing given, work through everything that needs a look.
