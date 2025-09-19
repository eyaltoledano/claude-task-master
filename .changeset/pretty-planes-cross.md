---
"task-master-ai": minor
---

Add grok-cli as a provider. You can now use Grok models with Task Master by setting the `GROK_CLI_API_KEY` environment variable.

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

## Available Models
- `grok-beta` - Latest Grok model
- `grok-vision-beta` - Grok with vision capabilities

The Grok CLI provider integrates with xAI's Grok models and can also use the local Grok CLI configuration file (`~/.grok/user-settings.json`) if available.

## Credits
Built using the [grok-cli](https://github.com/superagent-ai/grok-cli) by Superagent AI for seamless integration with xAI's Grok models.
