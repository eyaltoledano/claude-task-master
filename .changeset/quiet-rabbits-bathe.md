---
"task-master-ai": patch
---

Fix max_tokens limits for OpenRouter and Groq models

- Add special handling in config-manager.js for custom OpenRouter models to use a conservative default of 32,768 max_tokens
- Update qwen/qwen-turbo model max_tokens from 1,000,000 to 32,768 to match OpenRouter's actual limits
- Fix moonshotai/kimi-k2-instruct max_tokens to 16,384 to match Groq's actual limit (fixes #1028)
- This prevents "maximum context length exceeded" errors when using OpenRouter models not in our supported models list