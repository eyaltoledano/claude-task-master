# Using Task Master with Claude Code

This document explains how to use Task Master with your local Claude Code CLI instead of requiring a separate Claude API key.

## Overview

Task Master has been modified to work with the locally installed Claude Code CLI, allowing you to utilize your existing Claude Code installation without requiring a separate Anthropic API key.

## Prerequisites

1. Ensure you have Claude Code CLI installed and working properly
   - You should be able to run `claude-code --version` successfully
   - If not, install Claude Code following the [official instructions](https://claude.ai/code)

2. Task Master with Claude Code integration
   - This version of Task Master includes the necessary modifications

## Configuration

The default configuration is set to use Claude Code automatically. If you want to verify or change your configuration:

```bash
# Check current configuration
task-master models

# Set Claude Code as the main provider (if not already set)
task-master models --set-main=local --claude-code
```

## How It Works

When Task Master is configured to use Claude Code:

1. Instead of making API calls to Anthropic's servers, Task Master will execute commands using your local Claude Code CLI
2. No API key is required as it leverages your local Claude Code authentication
3. Prompts are passed to Claude Code via temporary files
4. Results are processed and returned to Task Master

## Testing the Integration

You can test if the Claude Code integration is working properly by running:

```bash
node test-claude-code.js
```

This will send a simple test prompt to Claude Code and display the result.

## Benefits

- No need for a separate Anthropic API key
- No additional billing for Claude API usage
- Leverages your existing Claude Code installation
- All Task Master functionality works with Claude Code

## Limitations

- The streaming functionality is not fully implemented for Claude Code (responses are returned all at once)
- Complex tool use might have limitations compared to direct API calls
- Depends on the Claude Code CLI being installed and correctly configured

## Troubleshooting

If you encounter issues:

1. Verify Claude Code is working by testing it directly:
   ```
   claude-code prompt "What is 2+2?"
   ```

2. Check the Claude Code path in the integration:
   - The implementation looks for Claude Code in common installation locations
   - If your installation is in a non-standard location, you may need to modify the path in `/src/ai-providers/claude-code.js`

3. Try switching to Anthropic API temporarily to compare behavior:
   ```
   task-master models --set-main=claude-3-7-sonnet-20250219 --anthropic
   ```
   (Note: This will require a valid ANTHROPIC_API_KEY in your environment)