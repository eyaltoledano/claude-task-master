---
'task-master-ai': minor
---

Added comprehensive Ollama model validation and interactive setup support

- **Interactive Setup Enhancement**: Added "Custom Ollama model" option to `task-master models --setup`, matching the existing OpenRouter functionality
- **Live Model Validation**: When setting Ollama models, Taskmaster now validates against the local Ollama instance by querying `/api/tags` endpoint
- **Configurable Endpoints**: Uses the `ollamaBaseUrl` from `.taskmasterconfig` (with role-specific `baseUrl` overrides supported)
- **Robust Error Handling**: 
  - Detects when Ollama server is not running and provides clear error messages
  - Validates model existence and lists available alternatives when model not found
  - Graceful fallback behavior for connection issues
- **Full Platform Support**: Both MCP server tools and CLI commands support the new validation
- **Improved User Experience**: Clear feedback during model validation with informative success/error messages
