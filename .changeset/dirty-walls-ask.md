---
"task-master-ai": minor
---

Add support for custom OpenAI-compatible providers, allowing you to connect Task Master to any service that implements the OpenAI API specification

**How to use:**

Configure your custom provider with the `models` command:

```bash
task-master models --set-main <your-model-id> --openai-compatible --baseURL <your-api-endpoint>
```

Example:

```bash
task-master models --set-main llama-3-70b --openai-compatible --baseURL http://localhost:8000/v1
# Or for an interactive view
task-master models --setup
```

Set your API key (if required by your provider) in mcp.json, your .env file or in your env exports:

```bash
OPENAI_COMPATIBLE_API_KEY="your-key-here"
```

This gives you the flexibility to use virtually any LLM service with Task Master, whether it's self-hosted, a specialized provider, or a custom inference server.
