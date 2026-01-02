---
"task-master-ai": patch
---

fix: resolve 301-second timeout on large PRD parsing

Fixes timeout issues when parsing large PRD documents. The parse-prd command now supports operations up to 15 minutes by default, with proper timeout parameter flow-through to the underlying HTTP client. This resolves consistent timeouts at ~301 seconds that users experienced with complex or large PRD files.