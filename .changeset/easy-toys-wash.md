---
'task-master-ai': minor
---

Adds support for the OpenRouter AI provider. Users can now configure models available through OpenRouter (requiring an `OPENROUTER_API_KEY`) via the `task-master models` command, granting access to a wide range of additional LLMs.
    - IMPORTANT FYI ABOUT OPENROUTER: Taskmaster relies on AI SDK, which itself relies on tool use. It looks like **free** models sometimes do not include tool use. For example, Gemini 2.5 pro (free) failed via OpenRouter (no tool use) but worked fine on the paid version of the model. Custom model support for Open Router is considered experimental and likely will not be further improved for some time.

