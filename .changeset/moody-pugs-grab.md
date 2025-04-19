---
'task-master-ai': patch
---

- Fix `task-master init` polluting codebase with new packages inside `package.json` and modifying project `README`
  - Now only initializes with cursor rules, windsurf rules, mcp.json, scripts/example_prd.txt, .gitignore modifications, and `README-task-master.md`
