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

The gemini-cli provider supports only two models:
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

The gemini-cli provider only supports two models:
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

## Important Notes

- **OAuth vs API Key**: This provider is specifically designed for users who want to use OAuth authentication via gemini-cli. If you prefer using API keys, consider using the standard `google` provider instead.
- **Limited Model Support**: Only `gemini-2.5-pro` and `gemini-2.5-flash` are available through gemini-cli.
- **Subscription Benefits**: Using OAuth authentication allows you to leverage any subscription benefits associated with your Google account.
- The provider uses the `ai-sdk-provider-gemini-cli` npm package internally.
- Supports all standard Task Master features: text generation, streaming, and structured object generation.