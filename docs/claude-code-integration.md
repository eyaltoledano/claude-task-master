# TODO: Move to apps/docs inside our documentation website

# Claude Code Integration Guide

This guide covers how to use Task Master with Claude Code AI SDK integration for enhanced AI-powered development workflows.

## Overview

Claude Code integration allows Task Master to leverage the Claude Code CLI for AI operations without requiring direct API keys. The integration uses OAuth tokens managed by the Claude Code CLI itself.

## Authentication Setup

The Claude Code provider uses token authentication managed by the Claude Code CLI.

### Prerequisites

1. **Install Claude Code CLI** (if not already installed):

   ```bash
   # Installation method depends on your system
   # Follow Claude Code documentation for installation
   ```

2. **Set up OAuth token** using Claude Code CLI:

   ```bash
   claude setup-token
   ```

   This command will:
   - Guide you through OAuth authentication
   - Store the token securely for CLI usage
   - Enable Task Master to use Claude Code without manual API key configuration

### Authentication Priority

Task Master will attempt authentication in this order:

1. **Environment Variable** (optional): `CLAUDE_CODE_OAUTH_TOKEN`
   - Useful for CI/CD environments or when you want to override the default token
   - Not required if you've set up the CLI token

2. **Claude Code CLI Token** (recommended): Token managed by `claude setup-token`
   - Automatically used when available
   - Most convenient for local development

3. **Fallback**: Error if neither is available

## Configuration

### Basic Configuration

Add Claude Code to your Task Master configuration:

```javascript
// In your .taskmaster/config.json or via task-master models command
{
  "models": {
    "main": "claude-code:sonnet",      // Use Claude Code with Sonnet
    "research": "perplexity-llama-3.1-sonar-large-128k-online",
    "fallback": "claude-code:opus"     // Use Claude Code with Opus as fallback
  }
}
```

### Supported Models

- `claude-code:sonnet` - Claude 3.5 Sonnet via Claude Code CLI
- `claude-code:opus` - Claude 3 Opus via Claude Code CLI

### Environment Variables (Optional)

While not required, you can optionally set:

```bash
export CLAUDE_CODE_OAUTH_TOKEN="your_oauth_token_here"
```

This is only needed in specific scenarios like:

- CI/CD pipelines
- Docker containers
- When you want to use a different token than the CLI default

## Usage Examples

### Basic Task Operations

```bash
# Use Claude Code for task operations
task-master add-task --prompt="Implement user authentication system" --research
task-master expand --id=1 --research
task-master update-task --id=1.1 --prompt="Add JWT token validation"
```

### Model Configuration Commands

```bash
# Set Claude Code as main model
task-master models --set-main claude-code:sonnet

# Use interactive setup
task-master models --setup
# Then select "claude-code" from the provider list
```

## Troubleshooting

### Common Issues

#### 1. "Claude Code CLI not available" Error

**Problem**: Task Master cannot connect to Claude Code CLI.

**Solutions**:

- Ensure Claude Code CLI is installed and in your PATH
- Run `claude setup-token` to configure authentication
- Verify Claude Code CLI works: `claude --help`

#### 2. Authentication Failures

**Problem**: Token authentication is failing.

**Solutions**:

- Re-run `claude setup-token` to refresh your OAuth token
- Check if your token has expired
- Verify Claude Code CLI can authenticate: try a simple `claude` command

#### 3. Model Not Available

**Problem**: Specified Claude Code model is not supported.

**Solutions**:

- Use supported models: `sonnet` or `opus`
- Check model availability: `task-master models --list`
- Verify your Claude Code CLI has access to the requested model

### Debug Steps

1. **Test Claude Code CLI directly**:

   ```bash
   claude --help
   # Should show help without errors
   ```

2. **Test authentication**:

   ```bash
   claude setup-token --verify
   # Should confirm token is valid
   ```

3. **Test Task Master integration**:

   ```bash
   task-master models --test claude-code:sonnet
   # Should successfully connect and test the model
   ```

4. **Check logs**:
   - Task Master logs will show detailed error messages
   - Use `--verbose` flag for more detailed output

### Environment-Specific Configuration

#### Docker/Containers

When running in Docker, you'll need to:

1. Install Claude Code CLI in your container
2. Set up authentication via environment variable:

   ```dockerfile
   ENV CLAUDE_CODE_OAUTH_TOKEN="your_token_here"
   ```

#### CI/CD Pipelines

For automated environments:

1. Set up a service account token or use environment variables
2. Ensure Claude Code CLI is available in the pipeline environment
3. Configure authentication before running Task Master commands

## Integration with AI SDK

Task Master's Claude Code integration uses the official `ai-sdk-provider-claude-code` package, providing:

- **Streaming Support**: Real-time token streaming for interactive experiences
- **Full AI SDK Compatibility**: Works with generateText, streamText, and other AI SDK functions
- **Automatic Error Handling**: Graceful degradation when Claude Code is unavailable
- **Type Safety**: Full TypeScript support with proper type definitions

### Example AI SDK Usage

```javascript
import { generateText } from 'ai';
import { ClaudeCodeProvider } from './src/ai-providers/claude-code.js';

const provider = new ClaudeCodeProvider();
const client = provider.getClient();

const result = await generateText({
  model: client('sonnet'),
  messages: [
    { role: 'user', content: 'Hello Claude!' }
  ]
});

console.log(result.text);
```

## Security Notes

- OAuth tokens are managed securely by Claude Code CLI
- No API keys need to be stored in your project files
- Tokens are automatically refreshed by the Claude Code CLI
- Environment variables should only be used in secure environments

## Getting Help

If you encounter issues:

1. Check the Claude Code CLI documentation
2. Verify your authentication setup with `claude setup-token --verify`
3. Review Task Master logs for detailed error messages
4. Open an issue with both Task Master and Claude Code version information
