---
"task-master-ai": minor
---

Add Azure AI Foundry provider support for accessing AI models deployed in Microsoft Azure AI Foundry

- New `azure-ai-foundry` provider for Microsoft Azure AI Foundry (Microsoft Foundry)
- Smart routing: automatically routes Claude models to `/anthropic` endpoint (Anthropic Messages API) and other models to `/models` endpoint (OpenAI-compatible API)
- New environment variables: `AZURE_AI_FOUNDRY_API_KEY` and `AZURE_AI_FOUNDRY_ENDPOINT`
- Includes automatic endpoint URL normalization for Azure AI Foundry services
- Full documentation and configuration examples
