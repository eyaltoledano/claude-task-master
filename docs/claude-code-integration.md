# Claude Code CLI Integration

Taskmaster now supports using Claude Code CLI as an AI provider, allowing users to leverage their flat subscription for all AI operations instead of paying per API call.

## Prerequisites

1. Install Claude Code CLI:

   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. Ensure you're logged in to Claude Code:
   ```bash
   claude --version
   ```

## Configuration

### Option 1: Interactive Setup

Run the interactive model setup and select "⚡ Claude Code CLI (Subscription)":

```bash
task-master models --setup
```

### Option 2: Manual Configuration

Add Claude Code as a provider in your `.taskmasterconfig`:

```json
{
	"models": {
		"main": {
			"provider": "claude-code",
			"modelId": "default",
			"maxTokens": 64000,
			"temperature": 0.2
		}
	}
}
```

### Option 3: Command Line

Set Claude Code as your main model:

```bash
task-master models --set-main default --claude-code
```

## Features

- **Zero API costs**: Uses your Claude Code subscription for all operations
- **Full compatibility**: Works with all Taskmaster commands
- **Model selection**: Supports model selection via `--model` flag (opus, sonnet, haiku)
- **No API key required**: Authentication is handled by Claude Code CLI

## Usage Examples

Once configured, all Taskmaster commands will use Claude Code CLI:

```bash
# Parse a PRD
task-master parse-prd requirements.md

# Analyze task complexity
task-master analyze-complexity

# Update tasks
task-master update-tasks
```

## Technical Details

- The integration executes Claude Code CLI commands with `--print --output-format json` flags
- Responses are parsed from the JSON output
- Error handling includes checks for CLI installation and authentication
- Token counting is not available (returns 0 for compatibility)

## Limitations

1. **No streaming support**: Claude Code CLI doesn't support streaming responses
2. **No token counts**: Usage metrics show 0 tokens (cost information is available)
3. **Performance**: Slightly slower than direct API calls due to CLI overhead
4. **Model selection**: Limited to models available in your Claude Code subscription

## Troubleshooting

1. **Claude Code CLI not found**: Ensure it's installed globally and in your PATH
2. **Authentication errors**: Run `claude` to ensure you're logged in
3. **Timeout errors**: Large prompts may take longer via CLI than direct API

## Cost Comparison

| Provider        | Cost Model        | Typical Monthly Cost        |
| --------------- | ----------------- | --------------------------- |
| Anthropic API   | Pay-per-token     | $50-500+ depending on usage |
| Claude Code CLI | Flat subscription | $10/month unlimited         |

For users who already have a Claude Code subscription, this integration provides significant cost savings for Taskmaster operations.
