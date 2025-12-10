# Snowflake Provider Integration Guide

Use Task Master with Snowflake's Cortex AI models via **REST API** (default) or **Cortex Code CLI**.

## Quick Start

### 1. Set Up Authentication

Choose one method (see [Authentication Methods](#authentication-methods) for details):

```bash
# Option A: Key Pair (Recommended for production)
export SNOWFLAKE_ACCOUNT="your-account"
export SNOWFLAKE_USER="your.name@company.com"
export SNOWFLAKE_PRIVATE_KEY_PATH="/path/to/rsa_key.p8"
export SNOWFLAKE_PRIVATE_KEY_PASSPHRASE="optional-passphrase"  # if encrypted
```

# Option B: Programmatic Access Token
export SNOWFLAKE_API_KEY="your-pat-token"
export SNOWFLAKE_BASE_URL="https://your-account.snowflakecomputing.com"

# Option C: Connection Profile (~/.snowflake/connections.toml)
# See Authentication Methods section for TOML configuration
```

### 2. Configure Task Master

```bash
task-master models --setup
# Select "snowflake" as provider
# Select your preferred model (e.g., claude-sonnet-4-5)
```

### 3. Start Using

```bash
task-master add-task --prompt="Implement user authentication" --research
task-master expand --id=1 --research
task-master next
```

## Authentication Methods

Task Master supports three authentication methods for Snowflake Cortex:

| Method | Use Case | Setup |
|--------|----------|-------|
| **Key Pair** | Production, long-lived credentials | RSA private key + environment variables |
| **Programmatic Access Token** | Generated token with expiration | `SNOWFLAKE_API_KEY` environment variable |
| **Connection Profile** | Preferred option for Cortex Code CLI, supports defining multiple accounts | `~/.snowflake/connections.toml` |

**Authentication Priority (as implemented):**
- Uses environment variables for PAT + Base URL - if `SNOWFLAKE_API_KEY` and `SNOWFLAKE_BASE_URL` (or `CORTEX_API_KEY` + `CORTEX_BASE_URL`) are both set
- Uses other environment variables (`SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USER`, etc.)
- Uses connection defined in `~/.snowflake/connections.toml` or `~/.snowflake/config.toml`

> **Note:** All authentication methods work with both REST API and CLI execution modes.

**Security Considerations:**
- **Programmatic Access Tokens (PAT)** have built-in expiration, which many organizations prefer for enhanced security. They require token refresh/rotation but provide better access control.
- **Key Pair authentication** generates short-lived OAuth tokens (JWT → OAuth exchange) with automatic caching and renewal. The private key never leaves your environment, only the generated OAuth tokens are sent to Snowflake. Tokens are cached in memory for their lifetime (~120 seconds).
- Choose based on your organization's security policies and compliance requirements.

[Learn more about key pair authentication](https://docs.snowflake.com/en/user-guide/key-pair-auth)
[Learn more about Programmatic Access Tokens](https://docs.snowflake.com/en/user-guide/programmatic-access-tokens)

## Supported Models

Any model available via the [Snowflake Cortex REST API](https://docs.snowflake.com/developer-guide/snowflake-rest-api/reference/cortex-inference) can be used.

**Claude Models (Recommended)** - Best for Task Master with structured output support. All Claude models work with both REST API and Cortex Code CLI execution modes:

| Model | Best For | Structured Output |
|-------|----------|-------------------|
| `claude-sonnet-4-5` | Complex reasoning, code generation | ✅ |
| `claude-haiku-4-5` | Fast responses, high volume | ✅ |
| `claude-4-sonnet` | Balanced performance and speed | ✅ |
| `claude-4-opus` | Most capable, complex tasks | ✅ |

**OpenAI Models** - Require REST API execution mode (not available via Cortex Code CLI):

| Model | Best For | Structured Output |
|-------|----------|-------------------|
| `openai-gpt-5` | Latest GPT-5, most capable | ✅ |
| `openai-gpt-5-mini` | Balanced GPT-5, efficient | ✅ |
| `openai-gpt-5-nano` | Fast GPT-5, lightweight | ✅ |
| `openai-gpt-4.1` | Reliable, large context | ✅ |

> **Note:** Use Claude or OpenAI models for best results with Task Master's structured outputs. Other Cortex models (Llama, Mistral, DeepSeek) do not support structured outputs.

## Pricing

All operations use **REST API pricing** ([Table 6(b)](https://www.snowflake.com/legal-files/CreditConsumptionTable.pdf)) regardless of execution mode - CLI uses the REST backend.

> **Note:** Cortex Code CLI (private preview) supports only Claude models. OpenAI models require REST mode.

### Pricing & Specifications by Model

| Model | Input | Output | Cache Write | Cache Read | Context Window (tokens) | Max Output (tokens) |
|-------|-------|--------|-------------|------------|----------------|------------|
| `claude-sonnet-4-5` | $3.30 | $16.50 | $4.13 | $0.33 | 200,000 | 64,000 |
| `claude-haiku-4-5` | $1.10 | $5.50 | $1.38 | $0.11 | 200,000 | 64,000 |
| `claude-4-sonnet` | $3.00 | $15.00 | $3.75 | $0.30 | 200,000 | 32,000 |
| `claude-4-opus` | $15.00 | $75.00 | $18.75 | $1.50 | 200,000 | 8,192 |
| `openai-gpt-5` | $1.38 | $11.00 | - | $0.14 | 272,000 | 8,192 |
| `openai-gpt-5-mini` | $0.28 | $2.20 | - | $0.03 | 272,000 | 8,192 |
| `openai-gpt-5-nano` | $0.06 | $0.44 | - | $0.01 | 272,000 | 8,192 |
| `openai-gpt-4.1` | $2.20 | $8.80 | - | $0.55 | 128,000 | 32,000 |


> **Notes:**
> - Costs per million tokens (USD)
> - **Context Window** = Full input capacity; **Max Output** = Maximum generation per response
> - The `max_tokens` in [`supported-models.json`](../../scripts/modules/supported-models.json) specifies output limits only
> - Prompt caching reduces costs for repeated operations (automatically applied by Task Master)
> - For complete model specifications, see [Snowflake Cortex docs](https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql#model-restrictions)

## Model Availability by Region

All Task Master–supported models are available on AWS and Azure in most regions. GCP regions may have limited OpenAI GPT-5 availability. Use [Cross Region Inference](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cross-region-inference) to access models from other regions.

[Check model availability for your region](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api#model-availability)

## Configuration

Basic `.taskmaster/config.json`:

```json
{
  "models": {
    "main": { "provider": "snowflake", "modelId": "claude-haiku-4-5" },
    "research": { "provider": "snowflake", "modelId": "claude-sonnet-4-5" }
  }
}
```

Advanced options:

```json
{
  "snowflake": {
    "connection": "default",
    "executionMode": "auto",
    "timeout": 60000,
    "retries": 3,
    "enablePromptCaching": true,
    "thinkingLevel": "medium"
  }
}
```

| Option | Description | Default |
|--------|-------------|---------|
| `connection` | Connection name from `connections.toml` | `"default"` |
| `executionMode` | `"auto"`, `"rest"`, or `"cli"` | `"auto"` |
| `timeout` | Request timeout in ms | `60000` |
| `retries` | Max retry attempts | `3` |
| `enablePromptCaching` | Cache repeated prompts (Claude) | `false` |
| `thinkingLevel` | Extended thinking: `"low"`, `"medium"`, `"high"` | - |

## Troubleshooting

### Authentication Failed

```bash
# Verify config exists
cat ~/.snowflake/connections.toml

# Check permissions
chmod 600 ~/.snowflake/connections.toml

# Test with CLI (if installed)
cortex connection list
```

### Timeout Errors

Increase timeout or use a faster model:

```json
{
  "snowflake": {
    "timeout": 120000,
    "modelId": "claude-haiku-4-5"
  }
}
```

### Model Not Available

1. Verify model availability: `SHOW MODELS IN DATABASE SNOWFLAKE`
2. Check role permissions in Snowflake
3. Contact your Snowflake administrator
