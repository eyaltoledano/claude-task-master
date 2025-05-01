---
'task-master-ai': minor
---

Adds custom model ID support for Ollama and OpenRouter providers.
  - Adds the `--ollama` and `--openrouter` flags to `task-master models --set-<role>` command to set models for those providers outside of the support models list.
  - Updated `task-master models --setup` interactive mode with options to explicitly enter custom Ollama or OpenRouter model IDs.
  - Implemented live validation against OpenRouter API (`/api/v1/models`) when setting a custom OpenRouter model ID (via flag or setup).
  - Refined logic to prioritize explicit provider flags/choices over internal model list lookups in case of ID conflicts.
  - Added warnings when setting custom/unvalidated models.
  - We obviously don't recommend going with a custom, unproven model. If you do and find performance is good, please let us know so we can add it to the list of supported models.
