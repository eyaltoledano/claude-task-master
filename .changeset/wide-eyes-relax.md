---
'task-master-ai': patch
---

Fix duplicate output on CLI help screen

- Prevent the Task Master CLI from printing the help screen more than once when using `-h` or `--help`.
- Removed redundant manual event handlers and guards for help output; now only the Commander `.helpInformation` override is used for custom help.
- Simplified logic so that help is only shown once for both "no arguments" and help flag flows.
- Ensures a clean, branded help experience with no repeated content.
- Fixes #339
