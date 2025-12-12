---
"task-master-ai": minor
---

Added support for new OpenAI models with reasoning effort configuration:
- `gpt-5.1` (codex-cli & openai): supports none, low, medium, high reasoning
- `gpt-5.1-codex-max` (codex-cli & openai): supports none, low, medium, high, xhigh reasoning
- `gpt-5.2` (codex-cli & openai): supports none, low, medium, high, xhigh reasoning  
- `gpt-5.2-pro` (openai only): supports medium, high, xhigh reasoning

Updated ai-sdk-provider-codex-cli dependency to ^0.7.0.
