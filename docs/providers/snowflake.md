# Snowflake Provider Integration Guide

Use Task Master with Snowflake's Cortex AI models via **REST API** (default) or **Cortex Code CLI**.

## Quick Start

### 1. Set Up Authentication

#### Option A: Environment Variables (Recommended)

```bash
# Key pair authentication
export SNOWFLAKE_ACCOUNT="your-account"
export SNOWFLAKE_USER="your.name@company.com"
export SNOWFLAKE_PRIVATE_KEY_PATH="/path/to/rsa_key.p8"
export SNOWFLAKE_PRIVATE_KEY_PASSPHRASE="optional-passphrase"  # if encrypted
```

#### Option B: Connection Profile

Create `~/.snowflake/connections.toml`:

```toml
[default]
account = "YOUR_ACCOUNT"
user = "YOUR_USERNAME"
private_key_path = "/path/to/rsa_key.p8"
private_key_passphrase = "optional-passphrase"
role = "YOUR_ROLE"
warehouse = "YOUR_WAREHOUSE"
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

| Method | Use Case | Setup |
|--------|----------|-------|
| **Key Pair** | Most secure, recommended | RSA private key + public key registered in Snowflake |
| **Connection Profile** | CLI mode, multiple accounts | `~/.snowflake/connections.toml` |
| **Programmatic Access Token** | Quick setup | `SNOWFLAKE_API_KEY` environment variable |

### Generate RSA Key Pair

```bash
# Generate private key (with passphrase)
openssl genrsa 2048 | openssl pkcs8 -topk8 -v2 des3 -inform PEM -out rsa_key.p8

# Generate public key
openssl rsa -in rsa_key.p8 -pubout -out rsa_key.pub

# Register in Snowflake
ALTER USER YOUR_USER SET RSA_PUBLIC_KEY='<public_key_content>';

# Secure permissions
chmod 600 rsa_key.p8 ~/.snowflake/connections.toml
```

## Supported Models

Any model available via the [Snowflake Cortex REST API](https://docs.snowflake.com/developer-guide/snowflake-rest-api/reference/cortex-inference) can be used.

**Claude Models (Recommended)** - Best for Task Master with structured output support:

| Model | Best For | Structured Output |
|-------|----------|-------------------|
| `claude-sonnet-4-5` | Complex reasoning, code generation | ✅ |
| `claude-haiku-4-5` | Fast responses, high volume | ✅ |
| `claude-4-sonnet` | Balanced performance and speed | ✅ |
| `claude-4-opus` | Most capable, complex tasks | ✅ |

**OpenAI Models:**

| Model | Best For | Structured Output |
|-------|----------|-------------------|
| `openai-gpt-5` | Latest GPT-5, most capable | ✅ |
| `openai-gpt-5-mini` | Balanced GPT-5, efficient | ✅ |
| `openai-gpt-5-nano` | Fast GPT-5, lightweight | ✅ |
| `openai-gpt-4.1` | Reliable, large context | ✅ |

> **Note:** Use Claude or OpenAI models for best results with Task Master's structured outputs. Other Cortex models (Llama, Mistral, DeepSeek) do not support structured outputs.

## Pricing

All Task Master operations use the **REST API pricing** (Table 6(b) from the [Snowflake Service Consumption Table](https://www.snowflake.com/legal-files/CreditConsumptionTable.pdf), effective December 5, 2025). This applies to both `executionMode: "rest"` and `executionMode: "cli"` - the Cortex Code CLI uses the REST API backend, so pricing is identical.

> **Important:** The Cortex Code CLI (private preview) supports **only Claude models** at this time. OpenAI models require REST mode.

### Pricing Table (REST API with Prompt Caching)

Costs shown are per one million tokens in USD:

| Model | Input | Output | Cache Write | Cache Read |
|-------|-------|--------|-------------|------------|
| `claude-4-5-sonnet` | $3.30 | $16.50 | $4.13 | $0.33 |
| `claude-4-5-haiku` | $1.10 | $5.50 | $1.38 | $0.11 |
| `claude-4-sonnet` | $3.00 | $15.00 | $3.75 | $0.30 |
| `claude-4-opus` | $15.00 | $75.00 | $18.75 | $1.50 |
| `openai-gpt-5` | $1.38 | $11.00 | - | $0.14 |
| `openai-gpt-5-mini` | $0.28 | $2.20 | - | $0.03 |
| `openai-gpt-5-nano` | $0.06 | $0.44 | - | $0.01 |
| `openai-gpt-4.1` | $2.20 | $8.80 | - | $0.55 |

*Source: [Snowflake Service Consumption Table](https://www.snowflake.com/legal-files/CreditConsumptionTable.pdf), Table 6(b)*

**Prompt Caching:** Claude and Open AI models support prompt caching, which can significantly reduce costs for repeated operations. Task Master automatically benefits from this for operations like `expand-all` or `research` that share common context.

### How Costs Are Calculated

The costs in our [`supported-models.json`](../../scripts/modules/supported-models.json) come directly from Table 6(b).

## Model Specifications

Context window and output limits for Task Master supported models. For complete specifications of all Cortex models, see the [full model specifications documentation](https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql#model-restrictions).

**Task Master Supported Models:**

| Model | Context Window (tokens) | Max Output (tokens) |
|-------|------------------------|---------------------|
| `claude-sonnet-4-5` | 200,000 | 64,000 |
| `claude-haiku-4-5` | 200,000 | 64,000 |
| `claude-4-sonnet` | 200,000 | 32,000 |
| `claude-4-opus` | 200,000 | 8,192 |
| `openai-gpt-5` | 272,000 | 8,192 |
| `openai-gpt-5-mini` | 272,000 | 8,192 |
| `openai-gpt-5-nano` | 272,000 | 8,192 |
| `openai-gpt-4.1` | 128,000 | 32,000 |

> **Important:** 
> - **Context Window** = Full input capacity available for every request
> - **Max Output** = Maximum tokens the model can generate in a single response
> - The REST API `max_tokens` parameter controls output generation limit
> - The `max_tokens` values in [`supported-models.json`](../../scripts/modules/supported-models.json) represent **output token limits**, not total context
> - Input tokens always use the full context window capacity

## Model Availability by Region

Model availability varies by Snowflake region. Refer to the [full Model Availability table](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api#model-availability) for your specific region. Enabling [Cross Region Inference](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cross-region-inference) can allow access to models in different regions from your local Snowflake account.

**Task Master Supported Models (abbreviated availability):**

| Model | AWS (Most Regions) | Azure (Most Regions) | GCP (Most Regions) |
|-------|-------------------|---------------------|-------------------|
| `claude-4-5-sonnet` | ✅ | ✅ | ✅ |
| `claude-4-5-haiku` | ✅ | ✅ | ✅ |
| `claude-4-sonnet` | ✅ | ✅ | ✅ |
| `claude-4-opus` | ✅ | ✅ | ✅ |
| `openai-gpt-5` | ✅ | ✅ | ⚠️ Limited |
| `openai-gpt-5-mini` | ✅ | ✅ | ⚠️ Limited |
| `openai-gpt-5-nano` | ✅ | ✅ | ⚠️ Limited |
| `openai-gpt-4.1` | ✅ | ✅ | ✅ |

> **Note:** GCP regions may have limited OpenAI model availability. Check the [complete availability table](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api#model-availability) for your specific region before configuring.

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

## CLI-Only Features

These features require the Cortex Code CLI (private preview):

- **Planning Mode**: Read-only analysis without modifying tasks
- **Custom Skills**: Domain-specific operations
- **MCP Support**: Built-in Model Context Protocol

```json
{
  "snowflake": {
    "executionMode": "cli",
    "enablePlanningMode": true,
    "enableSkills": true
  }
}
```

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

1. Verify model name: `cortex model list`
2. Check role permissions in Snowflake
3. Contact your Snowflake administrator

## Security Best Practices

- Use **key pair authentication** over passwords
- Set file permissions to `600` for keys and config files
- Use **separate connections** for dev/prod environments
- **Rotate keys** regularly via Snowflake console
- Use **role-based access control** in Snowflake

## Resources

### Official Documentation
- [Snowflake Cortex REST API](https://docs.snowflake.com/developer-guide/snowflake-rest-api/reference/cortex-inference)
- [Model Availability by Region](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api#model-availability)
- [Model Restrictions by Edition](https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql#model-restrictions)

### Pricing
- [Snowflake Service Consumption Table (PDF)](https://www.snowflake.com/legal-files/CreditConsumptionTable.pdf) - Official pricing (see Table 6(b) for REST API costs)
- Task Master uses REST API pricing for all operations, regardless of execution mode
