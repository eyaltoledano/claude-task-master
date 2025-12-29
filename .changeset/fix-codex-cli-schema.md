---
"task-master-ai": patch
---

fix: Remove .default() from Zod schemas to satisfy OpenAI strict JSON schema validation

This fixes an issue where codex-cli provider (using OpenAI API) would fail with "Missing 'dependencies'" error during task expansion. OpenAI's structured outputs require all properties to be in the 'required' array, but Zod's .default() makes fields optional. The fix removes .default() from schemas and applies defaults at the application level instead.
