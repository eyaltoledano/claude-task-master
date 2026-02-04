---
"@tm/cli": patch
---

Enhanced help documentation sync test to verify subcommand structure and improve test maintainability

This changeset adds comprehensive help documentation sync tests that verify:
- Tags subcommand documentation matches the new 'tags add/use/remove' structure
- Deprecated tag commands (add-tag, use-tag, delete-tag) are not documented
- List command options are properly documented with all variants

Also includes minor fixes:
- Updated 'tags add' command args to include missing --from-branch option
- Added clarifying comments for legacy command mappings during migration
