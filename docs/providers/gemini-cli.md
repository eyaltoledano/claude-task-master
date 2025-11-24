# Gemini CLI Provider

The Gemini CLI provider allows you to use Google's Gemini models through the Gemini CLI tool, leveraging your existing Gemini subscription and OAuth authentication.

## Why Use Gemini CLI?

The primary benefit of using the `gemini-cli` provider is to leverage your existing Personal Gemini Code Assist license/usage Google offers for free, or Gemini Code Assist Standard/Enterprise subscription you may already have, via OAuth configured through the Gemini CLI. This is ideal for users who:

- Have an active Gemini Code Assist license (including those using the free tier offere by Google)
- Want to use OAuth authentication instead of managing API keys
- Have already configured authentication via `gemini` OAuth login

## Installation

The provider is already included in Task Master. However, you need to install the Gemini CLI tool:

```bash
# Install gemini CLI globally
npm install -g @google/gemini-cli
```

## Authentication

### Primary Method: CLI Authentication (Recommended)

The Gemini CLI provider is designed to use your pre-configured OAuth authentication:

```bash
# Launch Gemini CLI and go through the authentication procedure
gemini
```

For OAuth use, select `Login with Google` - This will open a browser window for OAuth authentication. Once authenticated, Task Master will automatically use these credentials when you select the `gemini-cli` provider and models.

### Alternative Method: API Key

While the primary use case is OAuth authentication, you can also use an API key if needed:

```bash
export GEMINI_API_KEY="your-gemini-api-key"
```

**Note:** If you want to use API keys, consider using the standard `google` provider instead, as `gemini-cli` is specifically designed for OAuth/subscription users.

More details on authentication steps and options can be found in the [gemini-cli GitHub README](https://github.com/google-gemini/gemini-cli).

## Configuration

Use the `task-master init` command to run through the guided initialization:

```bash
task-master init
```

**OR**

Configure `gemini-cli` as a provider using the Task Master models command:

```bash
# Set gemini-cli as your main provider with gemini-2.5-pro
task-master models --set-main gemini-2.5-pro --gemini-cli

# Or use the faster gemini-2.5-flash model
task-master models --set-main gemini-2.5-flash --gemini-cli
```

You can also manually edit your `.taskmaster/config.json`:

```json
{
  "models": {
    "main": {
      "provider": "gemini-cli",
      "modelId": "gemini-2.5-pro",
      "maxTokens": 65536,
      "temperature": 0.2
    },
    "research": {
      "provider": "gemini-cli",
      "modelId": "gemini-2.5-pro",
      "maxTokens": 65536,
      "temperature": 0.1
    },
    "fallback": {
      "provider": "gemini-cli",
      "modelId": "gemini-2.5-flash",
      "maxTokens": 65536,
      "temperature": 0.2
    }
  },
  "global": {
    "logLevel": "info",
    "debug": false,
    "defaultNumTasks": 10,
    "defaultSubtasks": 5,
    "defaultPriority": "medium",
    "projectName": "Taskmaster",
    "ollamaBaseURL": "http://localhost:11434/api",
    "bedrockBaseURL": "https://bedrock.us-east-1.amazonaws.com",
    "responseLanguage": "English",
    "defaultTag": "master",
    "azureOpenaiBaseURL": "https://your-endpoint.openai.azure.com/"
  },
  "claudeCode": {}
}
```

### Available Models

The gemini-cli provider supports the following models:
- `gemini-3-pro-preview` - Latest preview model with best performance
- `gemini-2.5-pro` - High performance model (1M token context window, 65,536 max output tokens)
- `gemini-2.5-flash` - Fast, efficient model (1M token context window, 65,536 max output tokens)

## Usage Examples

### Basic Usage

Once gemini-cli is installed and authenticated, and Task Master  simply use Task Master as normal:

```bash
# The provider will automatically use your OAuth credentials
task-master parse-prd my-prd.txt
```

## Troubleshooting

### "Authentication failed" Error

If you get an authentication error:

1. **Primary solution**: Run `gemini` to authenticate with your Google account - use `/auth` slash command in **gemini-cli** to change authentication method if desired.
2. **Check authentication status**: Run `gemini` and use `/about` to verify your Auth Method and GCP Project if applicable.
3. **If using API key** (not recommended): Ensure `GEMINI_API_KEY` env variable is set correctly, see the gemini-cli README.md for more info.

### "Model not found" Error

The gemini-cli provider supports the following models:
- `gemini-3-pro-preview`
- `gemini-2.5-pro`
- `gemini-2.5-flash`

If you need other Gemini models, use the standard `google` provider with an API key instead.

### Gemini CLI Not Found

If you get a "gemini: command not found" error:

```bash
# Install the Gemini CLI globally
npm install -g @google/gemini-cli

# Verify installation
gemini --version
```

## Native Structured Outputs (v1.4.0+)

As of `ai-sdk-provider-gemini-cli` v1.4.0, the Gemini CLI provider now supports **native structured output** via Gemini's `responseJsonSchema` parameter. This provides several benefits:

### Key Benefits

- **Guaranteed Schema Compliance**: JSON output is constrained at the API level to match your schema
- **No JSON Parsing Errors**: Eliminates issues with malformed JSON or conversational preamble
- **Improved Reliability**: Native schema enforcement means consistent, predictable output
- **Better Performance**: No need for post-processing or JSON extraction from text

### How It Works

When you use Task Master commands that require structured output (like `parse-prd`, `expand`, `add-task`, `update-task`, or `analyze-complexity`), the provider:

1. Passes the Zod schema directly to Gemini's API via `responseJsonSchema`
2. Sets `responseMimeType: 'application/json'` for clean JSON output
3. Returns validated, schema-compliant JSON without any text extraction needed

### Supported Commands

All commands that use structured output benefit from native schema enforcement:

- `task-master parse-prd` - Parse PRD and generate tasks
- `task-master expand` - Expand tasks into subtasks
- `task-master add-task` - Add new tasks with AI assistance
- `task-master update-task` - Update existing tasks
- `task-master analyze-complexity` - Analyze task complexity

### Requirements

- **Node.js 20+**: The v1.4.0 SDK requires Node.js 20 or later
- **ai-sdk-provider-gemini-cli >= 1.4.0**: Included with Task Master automatically

## Important Notes

- **OAuth vs API Key**: This provider is specifically designed for users who want to use OAuth authentication via gemini-cli. If you prefer using API keys, consider using the standard `google` provider instead.
- **Limited Model Support**: Only `gemini-3-pro-preview`, `gemini-2.5-pro`, and `gemini-2.5-flash` are available through gemini-cli.
- **Subscription Benefits**: Using OAuth authentication allows you to leverage any subscription benefits associated with your Google account.
- **Node.js Requirement**: Requires Node.js 20+ due to native structured output support.
- The provider uses the `ai-sdk-provider-gemini-cli` npm package internally.
- Supports all standard Task Master features: text generation, streaming, and structured object generation with native schema enforcement.