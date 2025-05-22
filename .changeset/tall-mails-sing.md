---
'task-master-ai': patch
---

Fixes an issue where the research fallback would attempt to make API calls without checking for a valid API key first. This ensures proper error handling when the main task generation and first fallback both fail. Closes #421 #519.
