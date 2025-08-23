---
"task-master-ai": patch
---

Fix Windows compatibility issues and test failures

- Fix Windows path separator issues in profile configurations and file utilities
- Resolve runtime errors in expand-task.js (task and finalSubtaskCount undefined)
- Improve cross-platform path handling using path.posix methods
- Fix test expectations for move-cross-tag functionality
- Resolve permission error handling in manage-gitignore tests
- Update AI service logging expectations
- Fix path separator issues in Kiro hooks and Gemini integration tests
- Ensure all 1244 tests pass on Windows platform
