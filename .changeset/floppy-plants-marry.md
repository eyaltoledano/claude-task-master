---
'task-master-ai': patch
---

Fix CLI --force flag for parse-prd command

Previously, the --force flag was not respected when running `parse-prd`, causing the command to prompt for confirmation or fail even when --force was provided. This patch ensures that the flag is correctly passed and handled, allowing users to overwrite existing tasks.json files as intended.

- Fixes #477