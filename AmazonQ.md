# Amazon Q Integration with Task Master

This document outlines how to use Amazon Q with the Task Master project.

## Setup

1. **Install Amazon Q CLI**:
   ```bash
   pip install amazon-q-cli
   ```

2. **Configure Amazon Q**:
   ```bash
   q configure
   ```

3. **Add Task Master MCP Configuration**:

Add the following to your Amazon Q MCP configuration:

```json
{
  "mcpServers": {
    "taskmaster-ai": {
      "command": "npx",
      "args": ["-y", "--package=task-master-ai", "task-master-ai"],
      "env": {
        "ANTHROPIC_API_KEY": "YOUR_ANTHROPIC_API_KEY_HERE",
        "PERPLEXITY_API_KEY": "YOUR_PERPLEXITY_API_KEY_HERE",
        "OPENAI_API_KEY": "YOUR_OPENAI_KEY_HERE",
        "GOOGLE_API_KEY": "YOUR_GOOGLE_KEY_HERE",
        "MISTRAL_API_KEY": "YOUR_MISTRAL_KEY_HERE",
        "OPENROUTER_API_KEY": "YOUR_OPENROUTER_KEY_HERE",
        "XAI_API_KEY": "YOUR_XAI_KEY_HERE",
        "AZURE_OPENAI_API_KEY": "YOUR_AZURE_KEY_HERE"
      }
    }
  }
}
```

## Troubleshooting MCP Connection Issues

If you encounter issues with the Task Master MCP server:

1. **Check API Keys**: Ensure your API keys are correctly set in the MCP configuration.

2. **Update Task Master**: Run `npm update -g task-master-ai` to get the latest version.

3. **Enable Debug Logging**: Run with `Q_LOG_LEVEL=trace q chat` and check logs in your temp directory.

4. **Alternative Approach**: If MCP integration fails, use Task Master directly via CLI:
   ```bash
   npx task-master-ai init
   ```

5. **Check Network Connectivity**: Ensure you have a stable internet connection.

6. **Restart Editor**: Sometimes simply restarting your editor can resolve MCP connection issues.

7. **Check for Firewall Issues**: Make sure your firewall isn't blocking the MCP server's connections.

## Common Task Master Commands

```
Can you parse my PRD at scripts/prd.txt?
What's the next task I should work on?
Can you help me implement task 3?
Can you help me expand task 4?
```
