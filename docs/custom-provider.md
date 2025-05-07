# Custom OpenAI-Compatible Provider

Task Master supports using custom OpenAI-compatible providers, allowing you to connect to any API service that implements the OpenAI API format. This is useful for:

- Self-hosted LLM servers like LMStudio, LocalAI, or Ollama with OpenAI compatibility
- Alternative commercial providers that implement the OpenAI API format
- Private or enterprise LLM deployments

## Configuration

To use a custom OpenAI-compatible provider, you need to configure the following environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `CUSTOM_AI_API_KEY` | API key for the custom provider | Yes |
| `CUSTOM_AI_API_BASE_URL` | Base URL for the API (e.g., `https://api.example.com/v1`) | Yes |
| `CUSTOM_AI_MODEL` | Model ID to use (e.g., `gpt-3.5-turbo`) | No (defaults to provider's default) |
| `CUSTOM_AI_MODEL_MAIN` | Model ID to use for the main role | No (falls back to `CUSTOM_AI_MODEL`) |
| `CUSTOM_AI_MODEL_RESEARCH` | Model ID to use for the research role | No (falls back to `CUSTOM_AI_MODEL`) |
| `CUSTOM_AI_MODEL_FALLBACK` | Model ID to use for the fallback role | No (falls back to `CUSTOM_AI_MODEL`) |
| `CUSTOM_AI_HEADERS` | JSON string of custom headers to include in API requests | No |
| `AI_PROVIDER` | Global provider override for all roles (e.g., `custom`) | No |
| `AI_PROVIDER_MAIN` | Provider override for main role | No (falls back to `AI_PROVIDER`) |
| `AI_PROVIDER_RESEARCH` | Provider override for research role | No (falls back to `AI_PROVIDER`) |
| `AI_PROVIDER_FALLBACK` | Provider override for fallback role | No (falls back to `AI_PROVIDER`) |

### Example .env Configuration

```
# Custom provider settings
CUSTOM_AI_API_KEY=your_api_key_here
CUSTOM_AI_API_BASE_URL=https://api.example.com/v1
CUSTOM_AI_MODEL=gpt-3.5-turbo
# Role-specific models (optional)
CUSTOM_AI_MODEL_MAIN=claude-3-7-sonnet-20250219
CUSTOM_AI_MODEL_RESEARCH=sonar-reasoning-pro
CUSTOM_AI_MODEL_FALLBACK=gemini-2.5-flash-preview-04-17-thinking
CUSTOM_AI_HEADERS={"Authorization":"Bearer your_token_here","X-Custom-Header":"value"}

# Provider override settings (optional)
# These override the automatic provider detection based on model name
AI_PROVIDER=custom                      # Global provider override for all roles
# Or use role-specific provider overrides
AI_PROVIDER_MAIN=custom                 # Provider override for main role
AI_PROVIDER_RESEARCH=custom             # Provider override for research role
AI_PROVIDER_FALLBACK=custom             # Provider override for fallback role
```

The provider override variables (`AI_PROVIDER` and `AI_PROVIDER_*`) are particularly useful when using models that would normally be associated with other providers. For example, if you're using a custom provider that serves Claude or GPT models, you can set `AI_PROVIDER=custom` to ensure Task Master uses your custom provider regardless of the model name.

### Provider Resolution Logic

Task Master uses the following priority order when determining which provider to use for a given model:

1. **Role-specific provider override**: If `AI_PROVIDER_MAIN`, `AI_PROVIDER_RESEARCH`, or `AI_PROVIDER_FALLBACK` is set, it will be used for the corresponding role.
2. **Global provider override**: If `AI_PROVIDER` is set, it will be used for all roles that don't have a role-specific override.
3. **CLI flag hint**: If the `--custom`, `--ollama`, or `--openrouter` flag is used when setting a model, that provider will be used.
4. **Model name matching**: If no explicit provider is specified, Task Master will try to match the model name to a known provider (e.g., `claude-*` models will be matched to Anthropic).

This logic ensures that you have full control over which provider is used for each role, regardless of the model name.

## Setting Up via CLI

You can configure the custom provider using the Task Master CLI:

```bash
# Set the main model to use the custom provider
task-master models --set-main=default-model --custom

# Set the research model to use the custom provider
task-master models --set-research=default-model --custom

# Set the fallback model to use the custom provider
task-master models --set-fallback=default-model --custom
```

## Interactive Setup

You can also configure the custom provider using the interactive setup:

```bash
task-master models --setup
```

During the setup, you'll see an option for "Use custom OpenAI-compatible provider..." which will prompt you for:

1. Base URL for the custom provider
2. API key for the custom provider
3. Model ID for the selected role (optional)
4. Custom headers as JSON (optional)

If you've already configured the custom provider for another role, the system will offer to reuse the same base URL, API key, and headers, allowing you to just specify a different model for each role.

## MCP Configuration

To use the custom provider with MCP (Model Control Protocol) in Cursor or other compatible editors, add the following to your MCP configuration:

```json
{
  "mcpServers": {
    "taskmaster-ai": {
      "command": "npx",
      "args": ["-y", "--package=task-master-ai", "task-master-ai"],
      "env": {
        "ANTHROPIC_API_KEY": "YOUR_ANTHROPIC_API_KEY_HERE",
        "CUSTOM_AI_API_KEY": "YOUR_CUSTOM_API_KEY_HERE",
        "CUSTOM_AI_API_BASE_URL": "YOUR_CUSTOM_API_BASE_URL_HERE",
        "CUSTOM_AI_MODEL": "YOUR_DEFAULT_CUSTOM_MODEL_ID",
        "CUSTOM_AI_MODEL_MAIN": "YOUR_MAIN_CUSTOM_MODEL_ID",
        "CUSTOM_AI_MODEL_RESEARCH": "YOUR_RESEARCH_CUSTOM_MODEL_ID",
        "CUSTOM_AI_MODEL_FALLBACK": "YOUR_FALLBACK_CUSTOM_MODEL_ID",
        "CUSTOM_AI_HEADERS": "{\"X-Custom-Header\":\"value\"}"
      }
    }
  }
}
```

## Compatible Providers

The custom provider implementation should work with any service that implements the OpenAI API format, including:

- Self-hosted LLM servers:
  - [LMStudio](https://lmstudio.ai/)
  - [LocalAI](https://github.com/go-skynet/LocalAI)
  - [Ollama](https://ollama.ai/) with OpenAI compatibility mode
  - [vLLM](https://github.com/vllm-project/vllm)
  - [Text Generation WebUI](https://github.com/oobabooga/text-generation-webui) with OpenAI API extension

- Commercial providers with OpenAI-compatible APIs:
  - [Together AI](https://www.together.ai/)
  - [Groq](https://groq.com/)
  - [Anyscale](https://www.anyscale.com/)
  - [Fireworks AI](https://fireworks.ai/)

## Function Calling Support

Task Master includes a robust fallback mechanism for models that don't fully support function calling or tool use. This is particularly important when using `generateObjectService` with custom OpenAI-compatible providers.

### How the Fallback Works

1. **Initial Attempt**: The system first tries to use standard function calling with the model.

2. **Detection**: If the model returns a completion without using the function (indicated by errors like "tool was not called" or "finishReason: stop"), the fallback mechanism activates.

3. **JSON Generation**: The system retries with a specialized prompt that instructs the model to generate a valid JSON object matching the schema directly in its response.

4. **Parsing and Validation**: The JSON response is extracted, parsed, and validated to ensure all required fields are present and not empty.

5. **Field Validation and Retry**: If critical fields (like title, description, testStrategy) are missing or empty, the system will retry with a more specific prompt up to 2 times.

6. **Default Values**: If retries are exhausted or unsuccessful, the system will fill in missing or empty fields with sensible default values to ensure the task is still usable.

7. **Model Registration**: Models that fail to use function calling are automatically registered in an internal list, so future calls will use the JSON fallback directly without attempting function calling first.

### Models with Known Limitations

Some models are known to have limited or no support for function calling:

- Google Gemini models (e.g., `gemini-2.5-flash-preview-04-17-thinking`, `gemini-1.5-flash`)
- Older Anthropic models (e.g., `claude-instant-1.2`)
- Some third-party hosted models

For these models, the system will automatically use the JSON fallback approach without attempting function calling first.

## Troubleshooting

If you encounter issues with the custom provider:

1. **Check API Compatibility**: Ensure your provider fully implements the OpenAI API format, including the chat completions endpoint.

2. **Verify Base URL**: Make sure the base URL is correct and includes the appropriate version path (usually `/v1`).

3. **API Key Format**: Some providers may have specific API key formats or authentication methods. Check if your provider requires a specific format or additional headers.

4. **Custom Headers**: If your provider requires special headers, use the `CUSTOM_AI_HEADERS` environment variable to provide them as a JSON string.

5. **Model ID**: If you're getting errors about the model not being found, make sure to specify the correct model ID using the `CUSTOM_AI_MODEL` environment variable.

6. **Debug Mode**: Enable debug mode by setting `DEBUG=true` in your environment variables to see more detailed logs.

7. **JSON Generation Issues**: If you're seeing errors related to JSON parsing, check the model's ability to generate valid JSON. Some models may need additional prompting or formatting guidance.

8. **Empty Fields in Tasks**: If tasks are being created with empty fields (title, description, testStrategy), enable debug logging (`DEBUG=true`) to see the raw model responses. The system will attempt to retry and fix empty fields, but you may need to try a different model or adjust your prompts to get better results.

## Example: Using with LocalAI

```bash
# Set environment variables for LocalAI
export CUSTOM_AI_API_KEY=not-needed
export CUSTOM_AI_API_BASE_URL=http://localhost:8080/v1
export CUSTOM_AI_MODEL=gpt-3.5-turbo

# Set as main model
task-master models --set-main=gpt-3.5-turbo --custom
```

## Example: Using with Together AI (Different Models per Role)

```bash
# Set shared environment variables for Together AI
export CUSTOM_AI_API_KEY=your_together_ai_key
export CUSTOM_AI_API_BASE_URL=https://api.together.xyz/v1

# Set role-specific models
export CUSTOM_AI_MODEL_MAIN=meta-llama/Llama-3-70b-chat
export CUSTOM_AI_MODEL_RESEARCH=mistralai/Mixtral-8x7B-Instruct-v0.1
export CUSTOM_AI_MODEL_FALLBACK=google/gemma-7b-it

# Set as main model
task-master models --set-main=meta-llama/Llama-3-70b-chat --custom

# Set as research model
task-master models --set-research=mistralai/Mixtral-8x7B-Instruct-v0.1 --custom

# Set as fallback model
task-master models --set-fallback=google/gemma-7b-it --custom
```

## Example: Using Provider Overrides with Models from Different Providers

This example demonstrates how to use a custom provider with models that would normally be associated with other providers:

```bash
# Set custom provider settings
export CUSTOM_AI_API_KEY=your_custom_api_key
export CUSTOM_AI_API_BASE_URL=https://helixmind.online/v1

# Set role-specific models that look like they belong to other providers
export CUSTOM_AI_MODEL_MAIN=claude-3-7-sonnet-20250219
export CUSTOM_AI_MODEL_RESEARCH=sonar-reasoning-pro
export CUSTOM_AI_MODEL_FALLBACK=gemini-2.5-flash-preview-04-17-thinking

# Set provider overrides to ensure all models use the custom provider
export AI_PROVIDER=custom
# Or use role-specific overrides if needed
# export AI_PROVIDER_MAIN=custom
# export AI_PROVIDER_RESEARCH=custom
# export AI_PROVIDER_FALLBACK=custom

# Set the models (no need for --custom flag when AI_PROVIDER is set)
task-master models --set-main=claude-3-7-sonnet-20250219
task-master models --set-research=sonar-reasoning-pro
task-master models --set-fallback=gemini-2.5-flash-preview-04-17-thinking
```

With the provider overrides, Task Master will use your custom provider for all roles, even though the model names would normally be associated with Anthropic, Perplexity, and Google respectively.
