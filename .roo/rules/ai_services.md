---
description: Guidelines for interacting with the unified AI service layer.
globs: scripts/modules/ai-services-unified.js, scripts/modules/task-manager/*.js, scripts/modules/commands.js
---

# AI Services Layer Guidelines

This document outlines the architecture and usage patterns for interacting with Large Language Models (LLMs) via Task Master's unified AI service layer (`ai-services-unified.js`). The goal is to centralize configuration, provider selection, API key management, fallback logic, and error handling.

**Core Components:**

*   **Configuration (`.taskmasterconfig` & [`config-manager.js`](mdc:scripts/modules/config-manager.js)):**
    *   Defines the AI provider and model ID for different **roles** (`main`, `research`, `fallback`).
    *   Stores parameters like `maxTokens` and `temperature` per role.
    *   Managed via the `task-master models --setup` CLI command.
    *   [`config-manager.js`](mdc:scripts/modules/config-manager.js) provides **getters** (e.g., `getMainProvider()`, `getParametersForRole()`) to access these settings. Core logic should **only** use these getters for *non-AI related application logic* (e.g., `getDefaultSubtasks`). The unified service fetches necessary AI parameters internally based on the `role`.
    *   **API keys** are **NOT** stored here; they are resolved via `resolveEnvVariable` (in [`utils.js`](mdc:scripts/modules/utils.js)) from `.env` (for CLI) or the MCP `session.env` object (for MCP calls). See [`utilities.md`](mdc:.roo/rules/utilities.md) and [`dev_workflow.md`](mdc:.roo/rules/dev_workflow.md).

*   **Unified Service (`ai-services-unified.js`):**
    *   Exports primary interaction functions: `generateTextService`, `generateObjectService`. (Note: `streamTextService` exists but has known reliability issues with some providers/payloads).
    *   Contains the core `_unifiedServiceRunner` logic.
    *   Internally uses `config-manager.js` getters to determine the provider/model/parameters based on the requested `role`.
    *   Implements the **fallback sequence** (e.g., main -> fallback -> research) if the primary provider/model fails.
    *   Constructs the `messages` array required by the Vercel AI SDK.
    *   Implements **retry logic** for specific API errors (`_attemptProviderCallWithRetries`).
    *   Resolves API keys automatically via `_resolveApiKey` (using `resolveEnvVariable`).
    *   Maps requests to the correct provider implementation (in `src/ai-providers/`) via `PROVIDER_FUNCTIONS`.
    *   Returns a structured object containing the primary AI result (`mainResult`) and telemetry data (`telemetryData`). See [`telemetry.md`](mdc:.roo/rules/telemetry.md) for details on how this telemetry data is propagated and handled.

*   **Provider Implementations (`src/ai-providers/*.js`):**
    *   Contain provider-specific wrappers around Vercel AI SDK functions (`generateText`, `generateObject`).

**Usage Pattern (from Core Logic like `task-manager/*.js`):**

1.  **Import Service:** Import `generateTextService` or `generateObjectService` from `../ai-services-unified.js`.
    ```javascript
    // Preferred for most tasks (especially with complex JSON)
    import { generateTextService } from '../ai-services-unified.js';

    // Use if structured output is reliable for the specific use case
    // import { generateObjectService } from '../ai-services-unified.js';
    ```

2.  **Prepare Parameters:** Construct the parameters object for the service call.
    *   `role`: **Required.** `'main'`, `'research'`, or `'fallback'`. Determines the initial provider/model/parameters used by the unified service.
    *   `session`: **Required if called from MCP context.** Pass the `session` object received by the direct function wrapper. The unified service uses `session.env` to find API keys.
    *   `systemPrompt`: Your system instruction string.
    *   `prompt`: The user message string (can be long, include stringified data, etc.).
    *   (For `generateObjectService` only): `schema` (Zod schema), `objectName`.

3.  **Call Service:** Use `await` to call the service function.
    ```javascript
    // Example using generateTextService (most common)
    try {
        const resultText = await generateTextService({
            role: useResearch ? 'research' : 'main', // Determine role based on logic
            session: context.session, // Pass session from context object
            systemPrompt: "You are...",
            prompt: userMessageContent
        });
        // Process the raw text response (e.g., parse JSON, use directly)
        // ...
    } catch (error) {
        // Handle errors thrown by the unified service (if all fallbacks/retries fail)
        report('error', `Unified AI service call failed: ${error.message}`);
        throw error;
    }

    // Example using generateObjectService (use cautiously)
    try {
        const resultObject = await generateObjectService({
            role: 'main',
            session: context.session,
            schema: myZodSchema,
            objectName: 'myDataObject',
            systemPrompt: "You are...",
            prompt: userMessageContent
        });
        // resultObject is already a validated JS object
        // ...
    } catch (error) {
        report('error', `Unified AI service call failed: ${error.message}`);
        throw error;
    }
    ```

4.  **Handle Results/Errors:** Process the returned text/object or handle errors thrown by the unified service layer.

**Key Implementation Rules & Gotchas:**

*   ✅ **DO**: Centralize **all** LLM calls through `generateTextService` or `generateObjectService`.
*   ✅ **DO**: Determine the appropriate `role` (`main`, `research`, `fallback`) in your core logic and pass it to the service.
*   ✅ **DO**: Pass the `session` object (received in the `context` parameter, especially from direct function wrappers) to the service call when in MCP context.
*   ✅ **DO**: Ensure API keys are correctly configured in `.env` (for CLI) or `.roo/mcp.json` (for MCP).
*   ✅ **DO**: Ensure `.taskmasterconfig` exists and has valid provider/model IDs for the roles you intend to use (manage via `task-master models --setup`).
*   ✅ **DO**: Use `generateTextService` and implement robust manual JSON parsing (with Zod validation *after* parsing) when structured output is needed, as `generateObjectService` has shown unreliability with some providers/schemas.
*   ❌ **DON'T**: Import or call anything from the old `ai-services.js`, `ai-client-factory.js`, or `ai-client-utils.js` files.
*   ❌ **DON'T**: Initialize AI clients (Anthropic, Perplexity, etc.) directly within core logic (`task-manager/`) or MCP direct functions.
*   ❌ **DON'T**: Fetch AI-specific parameters (model ID, max tokens, temp) using `config-manager.js` getters *for the AI call*. Pass the `role` instead.
*   ❌ **DON'T**: Implement fallback or retry logic outside `ai-services-unified.js`.
*   ❌ **DON'T**: Handle API key resolution outside the service layer (it uses `utils.js` internally).
*   ⚠️ **generateObjectService Caution**: Be aware of potential reliability issues with `generateObjectService` across different providers and complex schemas. Prefer `generateTextService` + manual parsing as a more robust alternative for structured data needs.
