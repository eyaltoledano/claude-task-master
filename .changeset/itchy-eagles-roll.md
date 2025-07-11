---
"task-master-ai": minor
---

Added Requesty AI models provider

- The provider may be set through the interactive models setup or custom set through --set-main|research|fallback <modelId> --requesty flags with live validation on the provider list
- Initial list of models were added to supported-models.json file with prompt caching support on the provider end.
- Added MCP integration
- installed @requesty/ai-sdk dependency with support for text, streaming, object generation.
