# CLI-Based Agents Setup Guide

This guide explains how to configure Taskmaster to use CLI-based agents that leverage your existing subscriptions without requiring additional API keys.

## Overview

Taskmaster supports several CLI-based providers that use your existing subscriptions instead of requiring additional API keys:

- ✅ **Claude Code** - Uses your Anthropic account via Claude Code CLI
- ✅ **Codex CLI** - Uses your ChatGPT subscription via OpenAI Codex CLI  
- ✅ **Gemini CLI** - Uses your Google account via Google Gemini CLI
- ✅ **Ollama** - Runs models locally (no subscription needed)
- ✅ **Qwen via Ollama** - Runs Qwen models locally (no subscription needed)

## Installation & Setup

### Claude Code Setup

1. Install Claude Code CLI:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. Authenticate with your Anthropic account:
   ```bash
   claude
   # Follow the authentication prompts
   ```

3. Set Claude Code as your main model:
   ```bash
   task-master models --set-main claude-code/sonnet --claude-code
   ```

### Codex CLI Setup

1. Install Codex CLI:
   ```bash
   npm install -g @openai/codex
   ```

2. Authenticate with your ChatGPT account:
   ```bash
   codex login
   ```

3. Set Codex CLI as your main model:
   ```bash
   task-master models --set-main gpt-5-codex --codex-cli
   ```

### Gemini CLI Setup

1. Install Gemini CLI:
   ```bash
   npm install -g @google/gemini-cli
   ```

2. Authenticate with your Google account:
   ```bash
   gemini
   # Use /auth command to authenticate with Google
   ```

3. Set Gemini CLI as your main model:
   ```bash
   task-master models --set-main gemini-2.5-pro --gemini-cli
   ```

### Ollama Setup

1. Install and run Ollama:
   ```bash
   # Install from https://ollama.com/
   # Then start the server:
   ollama serve
   ```

2. Download your desired model:
   ```bash
   ollama pull qwen3:latest  # or any other model
   ```

3. Set Ollama as your main model:
   ```bash
   task-master models --set-main qwen3:latest --ollama
   ```

## MCP Configuration

To use CLI-based agents with MCP (Model Control Protocol), your configuration doesn't need API keys:

```json
{
  "mcpServers": {
    "task-master-ai": {
      "command": "npx",
      "args": ["-y", "task-master-ai"],
      "env": {
        "TASK_MASTER_TOOLS": "standard"
        // No API keys needed! Just ensure CLI tools are installed and authenticated
      }
    }
  }
}
```

## Configuration File Example

You can also configure models directly in `.taskmaster/config.json`:

```json
{
  "models": {
    "main": {
      "provider": "claude-code",
      "modelId": "sonnet",
      "maxTokens": 64000,
      "temperature": 0.2
    },
    "research": {
      "provider": "gemini-cli", 
      "modelId": "gemini-2.5-pro",
      "maxTokens": 65536,
      "temperature": 0.1
    },
    "fallback": {
      "provider": "codex-cli",
      "modelId": "gpt-5",
      "maxTokens": 128000,
      "temperature": 0.2
    }
  }
}
```

## Benefits of CLI-Based Agents

- **No Additional Costs**: Use your existing subscriptions without purchasing additional API credits
- **Latest Models**: Access cutting-edge models like GPT-5, Claude Opus, and Gemini 3.0
- **Enhanced Security**: All authentication is handled through your existing cloud provider
- **Rich Features**: Access to advanced features like web search, tool execution, and code analysis
- **Better Integration**: Native support for your provider's ecosystem and tools

## Troubleshooting

### "Command not found" Errors
Make sure your CLI tools are installed globally and available in your PATH:
```bash
# Test installation
claude --version
codex --version  
gemini --version
ollama --version
```

### Authentication Issues
- For Claude Code: Run `claude` and ensure you're logged in
- For Codex CLI: Run `codex login` 
- For Gemini CLI: Run `gemini` and use `/auth` to authenticate
- For Ollama: Ensure `ollama serve` is running

### Model Not Found
Ensure you're using the correct model ID for your provider:
- Claude Code: `sonnet`, `opus`, `haiku`
- Codex CLI: `gpt-5`, `gpt-5-codex`, `gpt-5.1`, `gpt-5.1-codex-max`, `gpt-5.2`
- Gemini CLI: `gemini-3-pro-preview`, `gemini-2.5-pro`, `gemini-2.5-flash`
- Ollama: Any model you've pulled (`qwen3:latest`, `llama3.1`, etc.)

## Next Steps

After setting up your CLI-based agents:

1. Initialize a project: `task-master init`
2. Set up your PRD: Create `.taskmaster/docs/prd.txt`
3. Parse your PRD: `task-master parse-prd .taskmaster/docs/prd.txt`
4. Start working on tasks: `task-master next`