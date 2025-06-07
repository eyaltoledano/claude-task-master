# Claude CLI Integration

This document explains how to use Claude Code CLI (claude.ai/code) as an AI provider in Task Master.

## Overview

The Claude CLI provider allows you to use your local Claude Code installation as an AI provider for Task Master. This is particularly useful when you want to:
- Use Claude without consuming API credits
- Test Task Master features with Claude
- Use your Claude Code subscription directly

## Setup

1. **Install Claude Code**: Download and install Claude Code from https://claude.ai/code

2. **Set the environment variable**:
   ```bash
   export CLAUDE_CLI_COMMAND="claude"
   ```
   
   If your Claude CLI has a different name or path, adjust accordingly:
   ```bash
   export CLAUDE_CLI_COMMAND="/path/to/claude"
   ```
   
   For MCP server usage, you can use the full path with flags:
   ```bash
   export CLAUDE_CLI_COMMAND="/home/user/.claude/local/claude --model opus -p --dangerously-skip-permissions"
   ```

3. **Optional: Enable file reference mode** (recommended for large PRDs):
   ```bash
   export CLAUDE_CLI_USE_FILE_REFERENCE="true"
   ```

4. **Configure Task Master** to use claude-cli as a provider:
   ```bash
   task-master models --setup
   ```
   
   Then select `claude-cli` as your provider and `claude-local` as the model.

## Configuration

In your `.taskmaster/config.json` or `.taskmasterconfig`:

```json
{
  "models": {
    "main": {
      "provider": "claude-cli",
      "modelId": "claude-local",
      "maxTokens": 200000,
      "temperature": 0.2
    }
  }
}
```

## Features and Limitations

### Features
- **Object generation support**: Through automatic conversion to JSON prompts
- **Large input handling**: Uses temporary files for prompts exceeding shell limits
- **File reference mode**: Can reference files instead of including full content
- **Configurable timeout**: Default 5 minutes, adjustable per request
- **Automatic flag handling**: Adds `-p` or `--print` flag if not present

### Limitations
- **No streaming support**: The CLI provider doesn't support streaming responses
- **No token usage tracking**: The CLI doesn't provide token usage information
- **Print mode only**: Uses Claude's print mode (`-p` flag) for automation
- **Response buffer limit**: 10MB maximum response size

## How It Works

The Claude CLI provider:
1. Formats your messages into a prompt
2. Writes the prompt to a temporary file (to handle large inputs)
3. Executes the Claude CLI with input redirection: `claude -p < /tmp/prompt.txt`
4. Parses the response (handling JSON for object generation requests)
5. Cleans up the temporary file
6. Returns the response

## Troubleshooting

### Command not found
If you get a "command not found" error, ensure:
- Claude Code is installed
- The `CLAUDE_CLI_COMMAND` environment variable is set correctly
- The command is in your PATH or use an absolute path
- The Claude executable has execute permissions

### No response
If Claude doesn't respond:
- Check that Claude Code is activated and logged in
- Try running the command manually: `claude -p "Hello"`
- Ensure you have an active Claude subscription
- Check if the process is timing out (default 5 minutes)

### Timeout errors
If operations time out:
- The default timeout is 5 minutes
- For long operations, you may need to increase the timeout
- Check if Claude is actually processing or stuck

### JSON parsing errors
If you see JSON parsing errors:
- The claude-cli-adapter converts object generation to text prompts
- Ensure Claude is returning valid JSON when requested
- Check the MCP server console output for error details

### Large responses
The provider sets a 10MB buffer limit for responses. Very large responses may be truncated.

## Example Usage

### Basic CLI Usage
```bash
# Set up the environment
export CLAUDE_CLI_COMMAND="claude"

# Configure Task Master to use Claude CLI
task-master models --setup
# Select: claude-cli / claude-local

# Use Task Master normally
task-master parse-prd my-project.txt
task-master expand task-001
```

### MCP Server Usage with Claude Desktop
```json
// In Claude Desktop's MCP settings:
{
  "mcpServers": {
    "task-master": {
      "command": "node",
      "args": ["/path/to/task-master/mcp-server/server.js"],
      "cwd": "/path/to/your/project",
      "env": {
        "CLAUDE_CLI_COMMAND": "/home/user/.claude/local/claude --model opus -p --dangerously-skip-permissions",
        "CLAUDE_CLI_USE_FILE_REFERENCE": "true"
      }
    }
  }
}
```

### Debugging
```bash
# Enable file reference mode for large PRDs
export CLAUDE_CLI_USE_FILE_REFERENCE="true"

# Test Claude CLI directly
echo "Hello, Claude" | claude -p

# Check Claude CLI version
claude --version
```