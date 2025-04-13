---
"task-master-ai": patch
---

Fix undefined values in workspace scanner CLI output by adding proper fallbacks for progress percentages, message text, and task counts. This improves the user experience by ensuring that all progress feedback is properly displayed without "undefined" values appearing in the console. 