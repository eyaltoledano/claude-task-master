# Gemini CLI Provider

The Gemini CLI provider allows you to use Google's Gemini models through the Gemini CLI tool, leveraging your existing Gemini subscription and OAuth authentication.

## Why Use Gemini CLI?

The primary benefit of using the `gemini-cli` provider is to leverage your existing Gemini Pro subscription or OAuth authentication configured through the Gemini CLI. This is ideal for users who:

- Have an active Gemini subscription
- Want to use OAuth authentication instead of managing API keys
- Have already configured authentication via `gemini auth login`

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
# Authenticate with your Google account
gemini auth login
```

This will open a browser window for OAuth authentication. Once authenticated, Task Master will automatically use these credentials when you select the `gemini-cli` provider.

### Alternative Method: API Key

While the primary use case is OAuth authentication, you can also use an API key if needed:

```bash
export GEMINI_API_KEY="your-gemini-api-key"
```

**Note:** If you want to use API keys, consider using the standard `google` provider instead, as `gemini-cli` is specifically designed for OAuth/subscription users.

## Configuration

Configure `gemini-cli` as a provider using the Task Master models command:

```bash
# Set gemini-cli as your main provider with gemini-2.5-pro
task-master models --set-main gemini-2.5-pro --gemini-cli

# Or use the faster gemini-2.5-flash model
task-master models --set-main gemini-2.5-flash --gemini-cli
```

You can also manually edit your `.taskmaster/config/providers.json`:

```json
{
  "main": {
    "provider": "gemini-cli",
    "model": "gemini-2.5-flash"
  }
}
```

### Available Models

The gemini-cli provider supports only two models:
- `gemini-2.5-pro` - High performance model (1M token context window, 65,536 max output tokens)
- `gemini-2.5-flash` - Fast, efficient model (1M token context window, 65,536 max output tokens)

## Usage Examples

### Basic Usage

Once authenticated with `gemini auth login` and configured, simply use Task Master as normal:

```bash
# The provider will automatically use your OAuth credentials
task-master new "Create a hello world function"
```

### With Specific Parameters

Configure model parameters in your providers.json:

```json
{
  "main": {
    "provider": "gemini-cli",
    "model": "gemini-2.5-pro",
    "parameters": {
      "maxTokens": 65536,
      "temperature": 0.7
    }
  }
}
```

### As Fallback Provider

Use gemini-cli as a fallback when your primary provider is unavailable:

```json
{
  "main": {
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-latest"
  },
  "fallback": {
    "provider": "gemini-cli",
    "model": "gemini-2.5-flash"
  }
}
```

## Troubleshooting

### "Authentication failed" Error

If you get an authentication error:

1. **Primary solution**: Run `gemini auth login` to authenticate with your Google account
2. **Check authentication status**: Run `gemini auth status` to verify you're logged in
3. **If using API key** (not recommended): Ensure `GEMINI_API_KEY` is set correctly

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

### Custom Endpoints

Custom endpoints can be configured if needed:

```json
{
  "main": {
    "provider": "gemini-cli",
    "model": "gemini-2.5-pro",
    "baseURL": "https://custom-endpoint.example.com"
  }
}
```

## Important Notes

- **OAuth vs API Key**: This provider is specifically designed for users who want to use OAuth authentication via `gemini auth login`. If you prefer using API keys, consider using the standard `google` provider instead.
- **Limited Model Support**: Only `gemini-2.5-pro` and `gemini-2.5-flash` are available through gemini-cli.
- **Subscription Benefits**: Using OAuth authentication allows you to leverage any subscription benefits associated with your Google account.
- The provider uses the `ai-sdk-provider-gemini-cli` npm package internally.
- Supports all standard Task Master features: text generation, streaming, and structured object generation.