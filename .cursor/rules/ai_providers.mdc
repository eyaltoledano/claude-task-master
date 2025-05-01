---
description: Guidelines for managing Task Master AI providers and models.
globs: 
alwaysApply: false
---
# Task Master AI Provider Management

This rule guides AI assistants on how to view, configure, and interact with the different AI providers and models supported by Task Master. For internal implementation details of the service layer, see [`ai_services.mdc`](mdc:.cursor/rules/ai_services.mdc).

-   **Primary Interaction:**
    -   Use the `models` MCP tool or the `task-master models` CLI command to manage AI configurations. See [`taskmaster.mdc`](mdc:.cursor/rules/taskmaster.mdc) for detailed command/tool usage.

-   **Configuration Roles:**
    -   Task Master uses three roles for AI models:
        -   `main`: Primary model for general tasks (generation, updates).
        -   `research`: Model used when the `--research` flag or `research: true` parameter is used (typically models with web access or specialized knowledge).
        -   `fallback`: Model used if the primary (`main`) model fails.
    -   Each role is configured with a specific `provider:modelId` pair (e.g., `openai:gpt-4o`).

-   **Viewing Configuration & Available Models:**
    -   To see the current model assignments for each role and list all models available for assignment:
        -   **MCP Tool:** `models` (call with no arguments or `listAvailableModels: true`)
        -   **CLI Command:** `task-master models`
    -   The output will show currently assigned models and a list of others, prefixed with their provider (e.g., `google:gemini-2.5-pro-exp-03-25`).

-   **Setting Models for Roles:**
    -   To assign a model to a role:
        -   **MCP Tool:** `models` with `setMain`, `setResearch`, or `setFallback` parameters.
        -   **CLI Command:** `task-master models` with `--set-main`, `--set-research`, or `--set-fallback` flags.
    -   **Crucially:** When providing the model ID to *set*, **DO NOT include the `provider:` prefix**. Use only the model ID itself.
        -   ✅ **DO:** `models(setMain='gpt-4o')` or `task-master models --set-main=gpt-4o`
        -   ❌ **DON'T:** `models(setMain='openai:gpt-4o')` or `task-master models --set-main=openai:gpt-4o`
    -   The tool/command will automatically determine the provider based on the model ID.

-   **Setting Custom Models (Ollama/OpenRouter):**
    -   To set a model ID not in the internal list for Ollama or OpenRouter:
        -   **MCP Tool:** Use `models` with `set<Role>` and **also** `ollama: true` or `openrouter: true`.
            -   Example: `models(setMain='my-custom-ollama-model', ollama=true)`
            -   Example: `models(setMain='some-openrouter-model', openrouter=true)`
        -   **CLI Command:** Use `task-master models` with `--set-<role>` and **also** `--ollama` or `--openrouter`.
            -   Example: `task-master models --set-main=my-custom-ollama-model --ollama`
            -   Example: `task-master models --set-main=some-openrouter-model --openrouter`
        -   **Interactive Setup:** Use `task-master models --setup` and select the `Ollama (Enter Custom ID)` or `OpenRouter (Enter Custom ID)` options.
    -   **OpenRouter Validation:** When setting a custom OpenRouter model, Taskmaster attempts to validate the ID against the live OpenRouter API.
    -   **Ollama:** No live validation occurs for custom Ollama models; ensure the model is available on your Ollama server.

-   **Supported Providers & Required API Keys:**
    -   Task Master integrates with various providers via the Vercel AI SDK.
    -   **API keys are essential** for most providers and must be configured correctly.
    -   **Key Locations** (See [`dev_workflow.mdc`](mdc:.cursor/rules/dev_workflow.mdc) - Configuration Management):
        -   **MCP/Cursor:** Set keys in the `env` section of `.cursor/mcp.json`.
        -   **CLI:** Set keys in a `.env` file in the project root.
    -   **Provider List & Keys:**
        -   **`anthropic`**: Requires `ANTHROPIC_API_KEY`.
        -   **`google`**: Requires `GOOGLE_API_KEY`.
        -   **`openai`**: Requires `OPENAI_API_KEY`.
        -   **`perplexity`**: Requires `PERPLEXITY_API_KEY`.
        -   **`xai`**: Requires `XAI_API_KEY`.
        -   **`mistral`**: Requires `MISTRAL_API_KEY`.
        -   **`azure`**: Requires `AZURE_OPENAI_API_KEY` and `AZURE_OPENAI_ENDPOINT`.
        -   **`openrouter`**: Requires `OPENROUTER_API_KEY`.
        -   **`ollama`**: Might require `OLLAMA_API_KEY` (not currently supported) *and* `OLLAMA_BASE_URL` (default: `http://localhost:11434/api`). *Check specific setup.*

-   **Troubleshooting:**
    -   If AI commands fail (especially in MCP context):
        1.  **Verify API Key:** Ensure the correct API key for the *selected provider* (check `models` output) exists in the appropriate location (`.cursor/mcp.json` env or `.env`).
        2.  **Check Model ID:** Ensure the model ID set for the role is valid (use `models` listAvailableModels/`task-master models`).
        3.  **Provider Status:** Check the status of the external AI provider's service.
        4.  **Restart MCP:** If changes were made to configuration or provider code, restart the MCP server.

## Adding a New AI Provider (Vercel AI SDK Method)

Follow these steps to integrate a new AI provider that has an official Vercel AI SDK adapter (`@ai-sdk/<provider>`):

1.  **Install Dependency:**
    -   Install the provider-specific package:
        ```bash
        npm install @ai-sdk/<provider-name>
        ```

2.  **Create Provider Module:**
    -   Create a new file in `src/ai-providers/` named `<provider-name>.js`.
    -   Use existing modules (`openai.js`, `anthropic.js`, etc.) as a template.
    -   **Import:**
        -   Import the provider's `create<ProviderName>` function from `@ai-sdk/<provider-name>`.
        -   Import `generateText`, `streamText`, `generateObject` from the core `ai` package.
        -   Import the `log` utility from `../../scripts/modules/utils.js`.
    -   **Implement Core Functions:**
        -   `generate<ProviderName>Text(params)`:
            -   Accepts `params` (apiKey, modelId, messages, etc.).
            -   Instantiate the client: `const client = create<ProviderName>({ apiKey });`
            -   Call `generateText({ model: client(modelId), ... })`.
            -   Return `result.text`.
            -   Include basic validation and try/catch error handling.
        -   `stream<ProviderName>Text(params)`:
            -   Similar structure to `generateText`.
            -   Call `streamText({ model: client(modelId), ... })`.
            -   Return the full stream result object.
            -   Include basic validation and try/catch.
        -   `generate<ProviderName>Object(params)`:
            -   Similar structure.
            -   Call `generateObject({ model: client(modelId), schema, messages, ... })`.
            -   Return `result.object`.
            -   Include basic validation and try/catch.
    -   **Export Functions:** Export the three implemented functions (`generate<ProviderName>Text`, `stream<ProviderName>Text`, `generate<ProviderName>Object`).

3.  **Integrate with Unified Service:**
    -   Open `scripts/modules/ai-services-unified.js`.
    -   **Import:** Add `import * as <providerName> from '../../src/ai-providers/<provider-name>.js';`
    -   **Map:** Add an entry to the `PROVIDER_FUNCTIONS` map:
        ```javascript
        '<provider-name>': {
            generateText: <providerName>.generate<ProviderName>Text,
            streamText: <providerName>.stream<ProviderName>Text,
            generateObject: <providerName>.generate<ProviderName>Object
        },
        ```

4.  **Update Configuration Management:**
    -   Open `scripts/modules/config-manager.js`.
    -   **`MODEL_MAP`:** Add the new `<provider-name>` key to the `MODEL_MAP` loaded from `supported-models.json` (or ensure the loading handles new providers dynamically if `supported-models.json` is updated first).
    -   **`VALID_PROVIDERS`:** Ensure the new `<provider-name>` is included in the `VALID_PROVIDERS` array (this should happen automatically if derived from `MODEL_MAP` keys).
    -   **API Key Handling:**
        -   Update the `keyMap` in `_resolveApiKey` and `isApiKeySet` with the correct environment variable name (e.g., `PROVIDER_API_KEY`).
        -   Update the `switch` statement in `getMcpApiKeyStatus` to check the corresponding key in `mcp.json` and its placeholder value.
        -   Add a case to the `switch` statement in `getMcpApiKeyStatus` for the new provider, including its placeholder string if applicable.
    -   **Ollama Exception:** If adding Ollama or another provider *not* requiring an API key, add a specific check at the beginning of `isApiKeySet` and `getMcpApiKeyStatus` to return `true` immediately for that provider.

5.  **Update Supported Models List:**
    -   Edit `scripts/modules/supported-models.json`.
    -   Add a new key for the `<provider-name>`.
    -   Add an array of model objects under the provider key, each including:
        -   `id`: The specific model identifier (e.g., `claude-3-opus-20240229`).
        -   `name`: A user-friendly name (optional).
        -   `swe_score`, `cost_per_1m_tokens`: (Optional) Add performance/cost data if available.
        -   `allowed_roles`: An array of roles (`"main"`, `"research"`, `"fallback"`) the model is suitable for.
        -   `max_tokens`: (Optional but recommended) The maximum token limit for the model.

6.  **Update Environment Examples:**
    -   Add the new `PROVIDER_API_KEY` to `.env.example`.
    -   Add the new `PROVIDER_API_KEY` with its placeholder (`YOUR_PROVIDER_API_KEY_HERE`) to the `env` section for `taskmaster-ai` in `.cursor/mcp.json.example` (if it exists) or update instructions.

7.  **Add Unit Tests:**
    -   Create `tests/unit/ai-providers/<provider-name>.test.js`.
    -   Mock the `@ai-sdk/<provider-name>` module and the core `ai` module functions (`generateText`, `streamText`, `generateObject`).
    -   Write tests for each exported function (`generate<ProviderName>Text`, etc.) to verify:
        -   Correct client instantiation.
        -   Correct parameters passed to the mocked Vercel AI SDK functions.
        -   Correct handling of results.
        -   Error handling (missing API key, SDK errors).

8.  **Documentation:**
    -   Update any relevant documentation (like `README.md` or other rules) mentioning supported providers or configuration.

*(Note: For providers **without** an official Vercel AI SDK adapter, the process would involve directly using the provider's own SDK or API within the `src/ai-providers/<provider-name>.js` module and manually constructing responses compatible with the unified service layer, which is significantly more complex.)*