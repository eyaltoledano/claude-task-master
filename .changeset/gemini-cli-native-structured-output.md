---
"task-master-ai": minor
---

Upgrade gemini-cli provider to native structured output support

- Upgrade `ai-sdk-provider-gemini-cli` from v1.1.1 to v1.4.0 with native `responseJsonSchema` support
- Simplify provider implementation by removing JSON extraction workarounds (652 lines → 95 lines)
- Enable native structured output via Gemini API's schema enforcement
