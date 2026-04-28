---
"@tm/core": patch
---

Fix complexity data not showing in `list` after `analyze-complexity` with tags. When tasks are stored under a non-master tag and the list command defaults to 'master', complexity data from the tag-specific report is now correctly loaded.
