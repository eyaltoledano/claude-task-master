# MCP API Key Setup Guide

## Quick Diagnosis

If Task Master AI tools are failing with network errors like:
- `Cannot connect to API: getaddrinfo ENOTFOUND api.anthropic.com`
- `Failed after 3 attempts. Last error: Cannot connect to API`
- Tool timeouts or connection failures

**The most common cause is missing API keys in your MCP configuration.**

## Understanding API Key Locations

Task Master uses **different API key sources** depending on how it's being used:

| Usage Mode | API Key Location | When Applied |
|------------|------------------|--------------|
| **CLI** | `.env` file in project root | Running `task-master` commands in terminal |
| **MCP** | MCP config file's `env` section | Using Task Master through IDE MCP integration |

**Critical:** When using Task Master through MCP (Cursor, Claude Code, VS Code, etc.), the `.env` file is **NOT read**. API keys must be in the MCP configuration file.

## Step-by-Step Setup for MCP

### Step 1: Locate Your MCP Configuration File

Find the appropriate configuration file for your IDE:

**Cursor:**
- Global: `~/.cursor/mcp.json`
- Project: `.cursor/mcp.json`

**Claude Code:**
- Check project directory for `mcp.json`
- Or refer to Claude Code's global configuration

**Windsurf:**
- Project-specific `mcp.json`

**VS Code:**
- `.vscode/mcp.json`

### Step 2: Add API Keys to MCP Configuration

Open your MCP configuration file and add API keys to the `env` section of the `task-master-ai` server:

```json
{
  "mcpServers": {
    "task-master-ai": {
      "command": "npx",
      "args": ["-y", "task-master-ai"],
      "env": {
        "ANTHROPIC_API_KEY": "YOUR_ACTUAL_KEY_HERE",
        "OPENAI_API_KEY": "YOUR_ACTUAL_KEY_HERE",
        "PERPLEXITY_API_KEY": "YOUR_ACTUAL_KEY_HERE"
      }
    }
  }
}
```

**Important:** Replace `YOUR_ACTUAL_KEY_HERE` with your actual API keys. Do not leave placeholder text.

### Step 3: Obtain API Keys

Get API keys from the respective provider websites:

#### Anthropic Claude (Recommended)
1. Visit https://console.anthropic.com/
2. Create an account or sign in
3. Navigate to "API Keys"
4. Create a new API key
5. Copy the key (format: `sk-ant-api03-...`)

**Why Anthropic?** Claude models are highly recommended for Task Master's AI operations due to excellent performance and reliability.

#### OpenAI (Alternative/Fallback)
1. Visit https://platform.openai.com/
2. Sign in or create an account
3. Go to "API Keys" section
4. Create a new secret key
5. Copy the key (format: `sk-proj-...` or `sk-...`)

#### Perplexity (For Research Features)
1. Visit https://www.perplexity.ai/
2. Sign up for API access
3. Get your API key
4. Copy the key (format: `pplx-...`)

**Why Perplexity?** Perplexity provides real-time web search capabilities, making it ideal for research-backed features (`--research` flag).

### Step 4: Update Task Master Model Configuration

After adding API keys, configure Task Master to use a provider for which you have a valid key:

```bash
# Set Anthropic Claude as main provider (recommended)
task-master models --set-main claude-3-5-sonnet-20241022

# Set Perplexity for research operations
task-master models --set-research sonar-pro

# Set OpenAI as fallback
task-master models --set-fallback gpt-4o-mini
```

Or use the interactive setup:

```bash
task-master models --setup
```

### Step 5: Restart Your IDE

After updating the MCP configuration:
1. **Completely close** your IDE (Cursor, VS Code, etc.)
2. **Reopen** the IDE
3. This ensures the MCP server reloads with the new environment variables

### Step 6: Verify Setup

Test that API keys are working:

1. **Check model configuration:**
   ```bash
   task-master models
   ```
   This displays your current provider configuration.

2. **Test an AI operation:**
   Use a simple Task Master tool through your IDE's MCP interface:
   - Try `add_task` with a simple prompt
   - Or use `parse_prd` if you have a PRD file

## Common Issues and Solutions

### Issue: "Still getting connection errors after adding keys"

**Solutions:**
1. **Verify key format:** Ensure you copied the complete API key with no extra spaces
2. **Check provider match:** Run `task-master models` and verify the configured providers match the keys you added
3. **Restart IDE:** Make sure you completely restarted your IDE after updating MCP config
4. **Check key validity:** Test the API key directly with a simple curl command or on the provider's website

### Issue: "Which API keys do I need?"

**Answer:** You need API keys for **the providers you've configured** in `.taskmaster/config.json`.

Run `task-master models` to see your configuration:
```
Active Models Configuration:
├─ Main: anthropic / claude-3-5-sonnet-20241022
├─ Research: perplexity / sonar-pro
└─ Fallback: openai / gpt-4o-mini
```

In this example, you need:
- `ANTHROPIC_API_KEY` (for main)
- `PERPLEXITY_API_KEY` (for research)
- `OPENAI_API_KEY` (for fallback)

### Issue: "Do I need keys for all providers?"

**Answer:** No, only for providers you've configured. At minimum, you need a key for your **main** provider.

**Recommended minimum setup:**
- `ANTHROPIC_API_KEY` - For main AI operations
- `PERPLEXITY_API_KEY` - For research features (optional but recommended)

### Issue: "My .env file has keys but MCP still fails"

**Answer:** When using MCP, the `.env` file is **not read**. You must add keys to the MCP configuration file's `env` section.

The `.env` file is **only used for CLI operations** (running `task-master` commands directly in terminal).

### Issue: "Can I use the same keys in both .env and MCP config?"

**Answer:** Yes! You can (and should) use the same API keys in both places:
- Add them to `.env` for CLI usage
- Add them to MCP config for MCP/IDE usage

This ensures Task Master works in both modes.

## Example: Complete MCP Configuration

Here's a complete example for Cursor:

**File: `~/.cursor/mcp.json`**

```json
{
  "mcpServers": {
    "task-master-ai": {
      "command": "/Users/yourusername/.nvm/versions/node/v22.21.0/bin/node",
      "args": [
        "/path/to/task-master-ai/dist/mcp-server.js"
      ],
      "cwd": "/path/to/task-master-ai",
      "timeout": 300,
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-api03-actual-key-here-not-a-placeholder",
        "OPENAI_API_KEY": "sk-proj-actual-key-here-not-a-placeholder",
        "PERPLEXITY_API_KEY": "pplx-actual-key-here-not-a-placeholder"
      }
    }
  }
}
```

**Key points:**
- `timeout: 300` ensures long-running AI operations complete (5 minutes)
- All API keys are **real keys**, not placeholder text
- Paths are absolute, not relative

## Security Best Practices

1. **Never commit API keys to version control**
   - Add MCP config files to `.gitignore` if they contain keys
   - Use environment variable references when possible

2. **Rotate keys regularly**
   - Most providers allow key rotation
   - Update both MCP config and `.env` when rotating

3. **Use separate keys for different projects**
   - If budget allows, create project-specific API keys
   - Makes it easier to track usage and revoke access

4. **Monitor API usage**
   - Check your provider dashboards regularly
   - Set up billing alerts to avoid surprises

## Advanced: Provider-Specific Notes

### Anthropic Claude
- **Pricing:** Usage-based, billed per token
- **Rate Limits:** Vary by plan (check console.anthropic.com)
- **Best for:** Main AI operations, complex reasoning
- **Supported models:** claude-3-5-sonnet-20241022, claude-3-opus-20240229, etc.

### OpenAI
- **Pricing:** Usage-based, billed per token
- **Rate Limits:** Vary by tier (check platform.openai.com/account/limits)
- **Best for:** Fallback operations, specific GPT requirements
- **Supported models:** gpt-4o, gpt-4o-mini, gpt-4-turbo, etc.

### Perplexity
- **Pricing:** Usage-based, search-focused
- **Rate Limits:** Check perplexity.ai for details
- **Best for:** Research operations with `--research` flag
- **Supported models:** sonar-pro, llama-3.1-sonar-large-128k-online, etc.
- **Special feature:** Real-time web search integration

## Getting Help

If you're still experiencing issues after following this guide:

1. **Check Task Master logs:**
   ```bash
   # Enable debug logging
   export DEBUG=true
   task-master models
   ```

2. **Verify MCP server is running:**
   - Check IDE's extension/plugin logs
   - Look for Task Master MCP server startup messages

3. **Review error messages carefully:**
   - Network errors → API key issue
   - Model errors → Configuration issue
   - Timeout errors → May need to increase MCP timeout setting

4. **Consult documentation:**
   - [Configuration Guide](./configuration.md)
   - [MCP Provider Guide](./mcp-provider-guide.md)
   - [Model Configuration](./models.md)

5. **Community support:**
   - GitHub Issues: Report bugs or ask questions
   - Discord/Community: Get help from other users

---

**Remember:** API keys in MCP config's `env` section are essential for MCP usage. When in doubt, verify your keys are present and valid in the correct location for your usage mode.

