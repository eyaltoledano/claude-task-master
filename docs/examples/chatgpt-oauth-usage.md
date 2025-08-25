# ChatGPT OAuth Provider Usage

The ChatGPT OAuth provider allows you to use OpenAI GPT-5 via your ChatGPT Plus/Pro/Teams subscription without an API key.

## Install

Install the provider package (AI SDK v4 build):

```bash
npm install ai-sdk-provider-chatgpt-oauth@ai-sdk-v4
```

## Authenticate

Use the Codex CLI to log in (stores tokens at `~/.codex/auth.json`):

```bash
npx -y @openai/codex login
```

Alternatively, set environment variables:

- `CHATGPT_OAUTH_ACCESS_TOKEN`
- `CHATGPT_OAUTH_ACCOUNT_ID`
- Optional: `CHATGPT_OAUTH_REFRESH_TOKEN`

## Configure Task Master

Update `.taskmaster/config.json`:

```json
{
  "models": {
    "main": {
      "provider": "chatgpt-oauth",
      "modelId": "gpt-5",
      "reasoningEffort": "medium",
      "reasoningSummary": "auto"
    },
    "fallback": {
      "provider": "chatgpt-oauth",
      "modelId": "gpt-5",
      "reasoningEffort": "medium",
      "reasoningSummary": "auto"
    }
  }
}
```

### Reasoning Settings

The ChatGPT OAuth provider supports reasoning controls:

- `reasoningEffort`: `"low" | "medium" | "high" | null` (null disables reasoning)
- `reasoningSummary`: `"auto" | "none" | "concise" | "detailed" | null` (null omits summary)

These are automatically added with sensible defaults when you select the ChatGPT OAuth provider.

### Unsupported Parameters

The ChatGPT backend does **not** support these common parameters:
- `maxTokens` - The backend uses its own internal limits
- `temperature` - The backend uses its own internal settings

These parameters will be automatically excluded from your config when using ChatGPT OAuth.

### Usage Restrictions

GPT-5 via ChatGPT OAuth does not support live browsing/retrieval. Do not use it as your "research" role. Configure it for main/fallback roles only.

Example with custom reasoning settings:

```jsonc
{
  "models": {
    "main": {
      "provider": "chatgpt-oauth",
      "modelId": "gpt-5",
      "reasoningEffort": "high",
      "reasoningSummary": "detailed"
    }
  }
}
```

## Notes

- No API key is required; the provider uses your ChatGPT OAuth session.
- Structured outputs are supported. Task Master enforces JSON output and validates against your schema.
- Telemetry reports token counts; cost is shown as 0 since this uses a subscription.
- Backend APIs may evolve; update the provider if compatibility issues arise.
