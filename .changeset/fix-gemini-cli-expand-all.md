---
"task-master-ai": minor
---

Fix gemini-cli provider to generate unique contextual subtasks

- Fixes #983: gemini-cli `expand --all` was producing identical generic subtasks
- Complete refactor of gemini-cli provider (reduced from 664 to 213 lines)
- Implements generateText override that redirects JSON requests to generateObject
- Adds provider-specific prompt variants (gemini-cli, gemini-cli-complexity)
- Improves dependency generation with clearer Handlebars syntax
- Maintains backward compatibility for all other providers