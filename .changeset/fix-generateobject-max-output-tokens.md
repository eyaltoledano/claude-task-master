---
"task-master-ai": patch
---

Fix the configured token limit being dropped on structured-output commands. `generateObject`-backed operations (e.g. `add-task`, `parse-prd`, `expand`, `analyze-complexity`, `update`) now forward `maxTokens` to the model as `maxOutputTokens`, matching `generateText`/`streamText`/`streamObject`. Previously the limit was silently ignored, so OpenAI-compatible endpoints that default to a small token cap would truncate the response and fail with "No object generated".
