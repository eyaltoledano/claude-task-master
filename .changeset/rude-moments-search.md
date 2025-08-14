---
"task-master-ai": patch
---

Fix `add-tag --from-branch` command error where `projectRoot` was not properly referenced

The command was failing with "projectRoot is not defined" error because the code was directly referencing `projectRoot` instead of `context.projectRoot` in the git repository checks. This fix corrects the variable references to use the proper context object.
