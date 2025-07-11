# Command Test Coverage

## Commands Found in commands.js

1. **parse-prd** ✅ (has test: parse-prd.test.js)
2. **update** ✅ (has test: update-tasks.test.js)
3. **update-task** ✅ (has test: update-task.test.js)
4. **update-subtask** ✅ (has test: update-subtask.test.js)
5. **generate** ✅ (has test: generate.test.js)
6. **set-status** (aliases: mark, set) ✅ (has test: set-status.test.js)
7. **list** ✅ (has test: list.test.js)
8. **expand** ✅ (has test: expand-task.test.js)
9. **analyze-complexity** ✅ (has test: analyze-complexity.test.js)
10. **research** ✅ (has test: research.test.js, research-save.test.js)
11. **clear-subtasks** ✅ (has test: clear-subtasks.test.js)
12. **add-task** ✅ (has test: add-task.test.js)
13. **next** ✅ (has test: next.test.js)
14. **show** ✅ (has test: show.test.js)
15. **add-dependency** ✅ (has test: add-dependency.test.js)
16. **remove-dependency** ✅ (has test: remove-dependency.test.js)
17. **validate-dependencies** ✅ (has test: validate-dependencies.test.js)
18. **fix-dependencies** ✅ (has test: fix-dependencies.test.js)
19. **complexity-report** ✅ (has test: complexity-report.test.js)
20. **add-subtask** ✅ (has test: add-subtask.test.js)
21. **remove-subtask** ✅ (has test: remove-subtask.test.js)
22. **remove-task** ✅ (has test: remove-task.test.js)
23. **init** ✅ (has test: init.test.js)
24. **models** ✅ (has test: models.test.js)
25. **lang** ✅ (has test: lang.test.js)
26. **move** ✅ (has test: move.test.js)
27. **rules** ✅ (has test: rules.test.js)
28. **migrate** ✅ (has test: migrate.test.js)
29. **sync-readme** ✅ (has test: sync-readme.test.js)
30. **add-tag** ✅ (has test: add-tag.test.js)
31. **delete-tag** ✅ (has test: delete-tag.test.js)
32. **tags** ✅ (has test: tags.test.js)
33. **use-tag** ✅ (has test: use-tag.test.js)
34. **rename-tag** ✅ (has test: rename-tag.test.js)
35. **copy-tag** ✅ (has test: copy-tag.test.js)

## Summary

- **Total Commands**: 35
- **Commands with Tests**: 35 (100%)
- **Commands without Tests**: 0 (0%)

## Missing Tests (Priority)

### Lower Priority (Additional features)
1. **lang** - Manages response language settings
2. **move** - Moves task/subtask to new position
3. **rules** - Manages task rules/profiles
4. **migrate** - Migrates project structure
5. **sync-readme** - Syncs task list to README

### Tag Management (Complete set)
6. **add-tag** - Creates new tag
7. **delete-tag** - Deletes existing tag
8. **tags** - Lists all tags
9. **use-tag** - Switches tag context
10. **rename-tag** - Renames existing tag
11. **copy-tag** - Copies tag with tasks

## Recently Added Tests (2024)

The following tests were just created:
- generate.test.js
- init.test.js
- clear-subtasks.test.js
- add-subtask.test.js
- remove-subtask.test.js
- next.test.js
- models.test.js
- remove-dependency.test.js
- validate-dependencies.test.js
- fix-dependencies.test.js
- complexity-report.test.js