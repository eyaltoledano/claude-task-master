---
"task-master-ai": patch
---

Improve AI provider compatibility for JSON generation

- Fixed schema compatibility issues between Perplexity and OpenAI o3 models
- Removed nullable/default modifiers from Zod schemas for broader compatibility
- Added automatic JSON repair for malformed AI responses (handles cases like missing array values)
- Perplexity now uses JSON mode for more reliable structured output
- Post-processing handles default values separately from schema validation
