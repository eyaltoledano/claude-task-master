---
"task-master-ai": patch
---

Fixed project root detection to traverse parent directories when running Task Master commands from subdirectories. Previously, running `task-master` commands from a subdirectory would fail or incorrectly create a new `.taskmaster` directory in the current location instead of finding the parent project's `.taskmaster` directory. This fix enables multi-repo workflows where a single Task Master instance at the root can coordinate work across multiple repository subdirectories.

Fixes #1301
