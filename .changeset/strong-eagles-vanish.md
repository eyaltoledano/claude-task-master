---
"task-master-ai": minor
---

feat(move): improve cross-tag move UX and safety

- CLI: print "Next Steps" tips after cross-tag moves that used --ignore-dependencies (validate/fix guidance)
- CLI: show dedicated help block on ID collisions (destination tag already has the ID)
- Core: add structured suggestions to TASK_ALREADY_EXISTS errors
- MCP: map ID collision errors to TASK_ALREADY_EXISTS and include suggestions
- Tests: cover MCP options, error suggestions, CLI tips printing, and integration error payload suggestions
---
