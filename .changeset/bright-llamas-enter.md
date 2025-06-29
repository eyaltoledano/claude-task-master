---
"task-master-ai": patch
---

Fix expand command preserving tagged task structure and preventing data corruption

- Enhance E2E tests with comprehensive tag-aware expand testing to verify tag corruption fix
- Add new test section for feature-expand tag creation and testing during expand operations
- Verify tag preservation during expand, force expand, and expand --all operations
- Test that master tag remains intact while feature-expand tag receives subtasks correctly
- Fix file path references to use correct .taskmaster/config.json and .taskmaster/tasks/tasks.json locations
- All tag corruption verification tests pass successfully, confirming the expand command tag corruption bug fix works as expected
