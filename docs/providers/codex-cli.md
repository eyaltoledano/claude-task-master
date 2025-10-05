# Codex CLI Provider

The `codex-cli` provider integrates Task Master with OpenAI's Codex CLI via the community AI SDK provider [`ai-sdk-provider-codex-cli`](https://github.com/ben-vargas/ai-sdk-provider-codex-cli). It uses your ChatGPT subscription (OAuth) via `codex login`, with optional `OPENAI_CODEX_API_KEY` support.

## Why Use Codex CLI?

The primary benefits of using the `codex-cli` provider include:

- **Use Latest OpenAI Models**: Access to cutting-edge models like GPT-5 and GPT-5-Codex via ChatGPT subscription
- **OAuth Authentication**: No API key management needed - authenticate once with `codex login`
- **Built-in Tool Execution**: Native support for command execution, file changes, MCP tools, and web search
- **Native JSON Schema Support**: Structured output generation without post-processing
- **Approval/Sandbox Modes**: Fine-grained control over command execution and filesystem access for safety

## Quickstart

Get up and running with Codex CLI in 3 steps:

```bash
# 1. Install Codex CLI globally
npm install -g @openai/codex

# 2. Authenticate with your ChatGPT account
codex login

# 3. Configure Task Master to use Codex CLI
task-master models --set-main gpt-5-codex --codex-cli
```

## Requirements

- **Node.js**: >= 18.0.0
- **Codex CLI**: >= 0.42.0 (>= 0.44.0 recommended)
- **ChatGPT Subscription**: Required for OAuth access (Plus, Pro, Business, Edu, or Enterprise)
- **Task Master**: >= 0.27.3 (version with Codex CLI support)

### Checking Your Versions

```bash
# Check Node.js version
node --version

# Check Codex CLI version
codex --version

# Check Task Master version
task-master --version
```

## Installation

### Install Codex CLI

```bash
# Install globally via npm
npm install -g @openai/codex

# Verify installation
codex --version
```

Expected output: `v0.44.0` or higher

### Install Task Master (if not already installed)

```bash
# Install globally
npm install -g task-master-ai

# Or install in your project
npm install --save-dev task-master-ai
```

## Authentication

### OAuth Authentication (Primary Method - Recommended)

The Codex CLI provider is designed to use OAuth authentication with your ChatGPT subscription:

```bash
# Launch Codex CLI and authenticate
codex login
```

This will:
1. Open a browser window for OAuth authentication
2. Prompt you to log in with your ChatGPT account
3. Store authentication credentials locally
4. Allow Task Master to automatically use these credentials

To verify your authentication:
```bash
# Open interactive Codex CLI
codex

# Use /about command to see auth status
/about
```

### Optional: API Key Method

While OAuth is the primary and recommended method, you can optionally use an OpenAI API key:

```bash
# In your .env file
OPENAI_CODEX_API_KEY=sk-your-openai-api-key-here
```

**Important Notes**:
- The API key will **only** be injected when explicitly provided
- OAuth authentication is always preferred when available
- Using an API key doesn't provide access to subscription-only models like GPT-5-Codex
- For full OpenAI API access with non-subscription models, consider using the standard `openai` provider instead
- `OPENAI_CODEX_API_KEY` is specific to the codex-cli provider to avoid conflicts with the `openai` provider's `OPENAI_API_KEY`

## Available Models

The Codex CLI provider supports only models available through ChatGPT subscription:

| Model ID | Description | Max Input Tokens | Max Output Tokens |
|----------|-------------|------------------|-------------------|
| `gpt-5` | Latest GPT-5 model | 272K | 128K |
| `gpt-5-codex` | GPT-5 optimized for agentic software engineering | 272K | 128K |

**Note**: These models are only available via OAuth subscription through Codex CLI (ChatGPT Plus, Pro, Business, Edu, or Enterprise plans). For other OpenAI models, use the standard `openai` provider with an API key.

**Research Capabilities**: Both GPT-5 models support web search tools, making them suitable for the `research` role in addition to `main` and `fallback` roles.

## Configuration

### Basic Configuration

Add Codex CLI to your `.taskmaster/config.json`:

```json
{
  "models": {
    "main": {
      "provider": "codex-cli",
      "modelId": "gpt-5-codex",
      "maxTokens": 128000,
      "temperature": 0.2
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

### Advanced Configuration with Codex CLI Settings

The `codexCli` section allows you to customize Codex CLI behavior:

```json
{
  "models": {
    "main": {
      "provider": "codex-cli",
      "modelId": "gpt-5-codex",
      "maxTokens": 128000,
      "temperature": 0.2
    }
  },
  "codexCli": {
    "allowNpx": true,
    "skipGitRepoCheck": true,
    "approvalMode": "on-failure",
    "sandboxMode": "workspace-write",
    "verbose": false
  }
}
```

### Codex CLI Settings Reference

#### Core Settings

- **`allowNpx`** (boolean, default: `false`)
  - Allow fallback to `npx @openai/codex` if the CLI is not found on PATH
  - Useful for CI environments or systems without global npm installations
  - Example: `"allowNpx": true`

- **`skipGitRepoCheck`** (boolean, default: `false`)
  - Skip git repository safety check before execution
  - Recommended for CI environments or non-repository usage
  - Example: `"skipGitRepoCheck": true`

#### Execution Control

- **`approvalMode`** (string)
  - Controls when to require user approval for command execution
  - Options:
    - `"untrusted"`: Require approval for all commands
    - `"on-failure"`: Only require approval after a command fails (default)
    - `"on-request"`: Approve only when explicitly requested
    - `"never"`: Never require approval (use with caution)
  - Example: `"approvalMode": "on-failure"`

- **`sandboxMode`** (string)
  - Controls filesystem access permissions
  - Options:
    - `"read-only"`: Read-only access to filesystem
    - `"workspace-write"`: Allow writes to workspace directory (default)
    - `"danger-full-access"`: Full filesystem access (use with extreme caution)
  - Example: `"sandboxMode": "workspace-write"`

#### Path and Environment

- **`codexPath`** (string, optional)
  - Custom path to Codex CLI executable
  - Useful when Codex is installed in a non-standard location
  - Example: `"codexPath": "/usr/local/bin/codex"`

- **`cwd`** (string, optional)
  - Working directory for Codex CLI execution
  - Defaults to current working directory
  - Example: `"cwd": "/path/to/project"`

- **`env`** (object, optional)
  - Additional environment variables for Codex CLI
  - Example: `"env": { "DEBUG": "true" }`

#### Advanced Settings

- **`fullAuto`** (boolean, optional)
  - Fully automatic mode (equivalent to `--full-auto` flag)
  - Bypasses most approvals for fully automated workflows
  - Example: `"fullAuto": true`

- **`dangerouslyBypassApprovalsAndSandbox`** (boolean, optional)
  - Bypass all safety checks including approvals and sandbox
  - **WARNING**: Use with extreme caution - can execute arbitrary code
  - Example: `"dangerouslyBypassApprovalsAndSandbox": false`

- **`color`** (string, optional)
  - Force color handling in Codex CLI output
  - Options: `"always"`, `"never"`, `"auto"`
  - Example: `"color": "auto"`

- **`outputLastMessageFile`** (string, optional)
  - Write last agent message to specified file
  - Useful for debugging or logging
  - Example: `"outputLastMessageFile": "./last-message.txt"`

- **`verbose`** (boolean, optional)
  - Enable verbose provider logging
  - Helpful for debugging issues
  - Example: `"verbose": true`

### Command-Specific Settings

Override settings for specific Task Master commands:

```json
{
  "codexCli": {
    "allowNpx": true,
    "approvalMode": "on-failure",
    "commandSpecific": {
      "parse-prd": {
        "approvalMode": "never",
        "verbose": true
      },
      "expand": {
        "sandboxMode": "read-only"
      },
      "add-task": {
        "approvalMode": "untrusted"
      }
    }
  }
}
```

## Usage

### Setting Codex CLI Models

```bash
# Set Codex CLI for main role
task-master models --set-main gpt-5-codex --codex-cli

# Set Codex CLI for fallback role
task-master models --set-fallback gpt-5 --codex-cli

# Set Codex CLI for research role
task-master models --set-research gpt-5 --codex-cli

# Verify configuration
task-master models
```

### Using Codex CLI with Task Master Commands

Once configured, use Task Master commands as normal:

```bash
# Parse a PRD with Codex CLI
task-master parse-prd my-requirements.txt

# Analyze project complexity
task-master analyze-complexity --research

# Expand a task into subtasks
task-master expand --id=1.2

# Add a new task with AI assistance
task-master add-task --prompt="Implement user authentication" --research
```

The provider will automatically use your OAuth credentials when Codex CLI is configured.

## Codebase Features

The Codex CLI provider is **codebase-capable**, meaning it can analyze and interact with your project files. This enables advanced features like:

- **Code Analysis**: Understanding your project structure and dependencies
- **Intelligent Suggestions**: Context-aware task recommendations
- **File Operations**: Reading and analyzing project files for better task generation
- **Pattern Recognition**: Identifying common patterns and best practices in your codebase

### Enabling Codebase Analysis

Codebase analysis is automatically enabled when:
1. Your provider is set to `codex-cli`
2. `enableCodebaseAnalysis` is `true` in your global configuration (default)

To verify or configure:

```json
{
  "global": {
    "enableCodebaseAnalysis": true
  }
}
```

## Troubleshooting

### "codex: command not found" Error

**Symptoms**: Task Master reports that the Codex CLI is not found.

**Solutions**:
1. **Install Codex CLI globally**:
   ```bash
   npm install -g @openai/codex
   ```

2. **Verify installation**:
   ```bash
   codex --version
   ```

3. **Alternative: Enable npx fallback**:
   ```json
   {
     "codexCli": {
       "allowNpx": true
     }
   }
   ```

### "Not logged in" Errors

**Symptoms**: Authentication errors when trying to use Codex CLI.

**Solutions**:
1. **Authenticate with OAuth**:
   ```bash
   codex login
   ```

2. **Verify authentication status**:
   ```bash
   codex
   # Then use /about command
   ```

3. **Re-authenticate if needed**:
   ```bash
   # Logout first
   codex
   # Use /auth command to change auth method

   # Then login again
   codex login
   ```

### "Old version" Warnings

**Symptoms**: Warnings about Codex CLI version being outdated.

**Solutions**:
1. **Check current version**:
   ```bash
   codex --version
   ```

2. **Upgrade to latest version**:
   ```bash
   npm install -g @openai/codex@latest
   ```

3. **Verify upgrade**:
   ```bash
   codex --version
   ```
   Should show >= 0.44.0

### "Model not available" Errors

**Symptoms**: Error indicating the requested model is not available.

**Causes and Solutions**:

1. **Using unsupported model**:
   - Only `gpt-5` and `gpt-5-codex` are available via Codex CLI
   - For other OpenAI models, use the standard `openai` provider

2. **Subscription not active**:
   - Verify your ChatGPT subscription is active
   - Check subscription status at <https://platform.openai.com>

3. **Wrong provider selected**:
   - Verify you're using `--codex-cli` flag when setting models
   - Check `.taskmaster/config.json` shows `"provider": "codex-cli"`

### API Key Not Being Used

**Symptoms**: You've set `OPENAI_CODEX_API_KEY` but it's not being used.

**Expected Behavior**:
- OAuth authentication is always preferred
- API key is only injected when explicitly provided
- API key doesn't grant access to subscription-only models

**Solutions**:
1. **Verify OAuth is working**:
   ```bash
   codex
   # Check /about for auth status
   ```

2. **If you want to force API key usage**:
   - This is not recommended with Codex CLI
   - Consider using the standard `openai` provider instead

3. **Verify .env file is being loaded**:
   ```bash
   # Check if .env exists in project root
   ls -la .env

   # Verify OPENAI_CODEX_API_KEY is set
   grep OPENAI_CODEX_API_KEY .env
   ```

### Approval/Sandbox Issues

**Symptoms**: Commands are blocked or filesystem access is denied.

**Solutions**:

1. **Adjust approval mode**:
   ```json
   {
     "codexCli": {
       "approvalMode": "on-request"
     }
   }
   ```

2. **Adjust sandbox mode**:
   ```json
   {
     "codexCli": {
       "sandboxMode": "workspace-write"
     }
   }
   ```

3. **For fully automated workflows** (use cautiously):
   ```json
   {
     "codexCli": {
       "fullAuto": true
     }
   }
   ```

## Important Notes

- **OAuth subscription required**: No API key needed for basic operation, but requires active ChatGPT subscription
- **Limited model selection**: Only `gpt-5` and `gpt-5-codex` available via OAuth
- **Pricing information**: Not available for OAuth models (shows as "Unknown" in cost calculations)
- **No automatic dependency**: The `@openai/codex` package is not added to Task Master's dependencies - install it globally or enable `allowNpx`
- **Codebase analysis**: Automatically enabled when using `codex-cli` provider
- **Safety first**: Default settings prioritize safety with `approvalMode: "on-failure"` and `sandboxMode: "workspace-write"`

## See Also

- [Configuration Guide](../configuration.md#codex-cli-provider) - Complete Codex CLI configuration reference
- [Command Reference](../command-reference.md) - Using `--codex-cli` flag with commands
- [Gemini CLI Provider](./gemini-cli.md) - Similar CLI-based provider for Google Gemini
- [Claude Code Integration](../claude-code-integration.md) - Another CLI-based provider
- [ai-sdk-provider-codex-cli](https://github.com/ben-vargas/ai-sdk-provider-codex-cli) - Source code for the provider package
