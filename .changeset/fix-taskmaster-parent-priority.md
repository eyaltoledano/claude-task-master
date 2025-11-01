---
"task-master-ai": patch
---

fix: prioritize .taskmaster in parent directories over other project markers

When running task-master commands from subdirectories containing other project markers (like .git, go.mod, package.json), findProjectRoot() now correctly finds and uses .taskmaster directories in parent folders instead of stopping at the first generic project marker found.

This enables multi-repo monorepo setups where a single .taskmaster at the root tracks work across multiple sub-repositories.
