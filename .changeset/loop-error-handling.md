---
"task-master-ai": "patch"
---

Improve loop command error handling and use dangerously-skip-permissions

- Add proper spawn error handling (ENOENT, EACCES) with actionable messages
- Return error info from checkSandboxAuth and runInteractiveAuth instead of silent failures
- Use --dangerously-skip-permissions for unattended loop execution
- Fix null exit code masking issue
