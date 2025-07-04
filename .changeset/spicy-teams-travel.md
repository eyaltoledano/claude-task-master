---
"task-master-ai": patch
---

Improve provider validation system with clean constants structure

- **Fixed "Invalid provider hint" errors**: Resolved validation failures for Azure, Vertex, and Bedrock providers
- **Improved search UX**: Integrated search for better model discovery with real-time filtering
- **Better organization**: Moved custom provider options to bottom of model selection with clear section separators

This change ensures all custom providers (Azure, Vertex, Bedrock, OpenRouter, Ollama) work correctly in `task-master models --setup`
