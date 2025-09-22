---
"task-master-ai": minor
---

Add grok-cli as a provider with full codebase context support. You can now use Grok models (grok-2, grok-3, grok-4, etc.) with Task Master for AI operations that have access to your entire codebase context, enabling more informed task generation and PRD parsing.

## Setup Instructions

1. **Get your Grok API key** from [console.x.ai](https://console.x.ai)
2. **Set the environment variable**:
   ```bash
   export GROK_CLI_API_KEY="your-api-key-here"
   ```
3. **Configure Task Master to use Grok**:
   ```bash
   task-master models --set-main grok-beta
   # or
   task-master models --set-research grok-beta
   # or
   task-master models --set-fallback grok-beta
   ```

## Key Features
- **Full codebase context**: Grok models can analyze your entire project when generating tasks or parsing PRDs
- **xAI model access**: Support for latest Grok models (grok-2, grok-3, grok-4, etc.)
- **Code-aware task generation**: Create more accurate and contextual tasks based on your actual codebase
- **Intelligent PRD parsing**: Parse requirements with understanding of your existing code structure

## Available Models
- `grok-beta` - Latest Grok model with codebase context
- `grok-vision-beta` - Grok with vision capabilities and codebase context

The Grok CLI provider integrates with xAI's Grok models via grok-cli and can also use the local Grok CLI configuration file (`~/.grok/user-settings.json`) if available.

## Credits
Built using the [grok-cli](https://github.com/superagent-ai/grok-cli) by Superagent AI for seamless integration with xAI's Grok models.
