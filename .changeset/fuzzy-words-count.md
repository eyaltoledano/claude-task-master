---
"task-master-ai": patch
---

Fix scope-up/down prompts to include all required fields for better AI model compatibility

- Added missing `priority` field to scope adjustment prompts to prevent validation errors with Claude-code and other models
- Ensures generated JSON includes all fields required by the schema
