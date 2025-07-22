---
"task-master-ai": patch
---

Fix: show command no longer requires complexity report file to exist

The `tm show` command was incorrectly requiring the complexity report file to exist even when not needed. Now it only validates the complexity report path when a custom report file is explicitly provided via the -r/--report option.