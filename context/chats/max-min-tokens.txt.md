We want to refine how Task Master handles AI model token limits to be more precise, by:

1.  Distinguishing between `maxInputTokens` and `maxOutputTokens` in the configuration.
2.  Dynamically adjusting the `maxOutputTokens` for an API call based on the actual prompt length to stay within the model's total context window (or respecting separate input/output limits if the API and model support that).
3.  Ensuring that `ai-services-unified.js` uses these more granular limits.

This is a good improvement for both cost control and preventing errors.

Here's a plan:

**Phase 1: Configuration and Core Logic Updates**

1.  **Update `.taskmasterconfig` Structure:**
    - I'll modify the `models` section in your `.taskmasterconfig`. For each role (`main`, `research`, `fallback`), `maxTokens` will be replaced with `maxInputTokens` and `maxOutputTokens`.
      - We'll need to decide on reasonable default values for these new fields. We can look at the current `maxTokens` and the model's known limits to make an initial guess.
2.  **Update `MODEL_MAP` in `ai-services-unified.js`:**
    - This array already stores cost data. We need to ensure it also stores the _absolute_ maximum input and output tokens for each model listed (e.g., `model_max_input_tokens`, `model_max_output_tokens`). If these fields are not present, they will need to be added. The values in `.taskmasterconfig` will then represent user-defined operational limits, which should ideally be validated against these absolute maximums.
3.  **Update `config-manager.js`:**
    - Getter functions like `getParametersForRole` will be updated to fetch `maxInputTokens` and `maxOutputTokens` instead of the singular `maxTokens`.
    - New getters might be needed if we want to access the model's absolute limits directly from `MODEL_MAP` via `config-manager.js`.
4.  **Update `ai-services-unified.js` (`_unifiedServiceRunner`):**
    - **Token Counting:** This is a crucial step. Before an API call, we need to estimate the token count of the combined `systemPrompt` and `userPrompt`.
      - The Vercel AI SDK or the individual provider SDKs might offer utilities for this. For example, some SDKs expose a `tokenizer` or a way to count tokens for a given string.
      - If a direct utility isn't available through the Vercel SDK for the specific provider, we might need to use a library like `tiktoken` for OpenAI/Anthropic models or investigate provider-specific tokenization. This could be complex as tokenization varies between models.
      - For now, let's assume we can get a reasonable estimate.
    - **Dynamic Output Token Calculation & Validation:**
      - Retrieve `configured_max_input_tokens` and `configured_max_output_tokens` from `config-manager.js` for the current role.
      - Retrieve `model_absolute_max_input_tokens` and `model_absolute_max_output_tokens` from `MODEL_MAP`.
      - Let `prompt_tokens = countTokens(systemPrompt + userPrompt)`.
      - **Input Validation:** If `prompt_tokens > configured_max_input_tokens` OR `prompt_tokens > model_absolute_max_input_tokens`, throw an error. (We might also consider auto-truncation strategies in the future, but an error is safer to start).
      - **Output Calculation:** The `max_tokens` parameter sent to the API (which typically refers to the _max number of tokens to generate_) should be `configured_max_output_tokens`. We also need to ensure this doesn't violate the model's absolute output limit.
      - Some models have a _total_ context window (input + output). If this is the case for a model, the `max_tokens` parameter for the API call might need to be `min(configured_max_output_tokens, model_absolute_total_tokens - prompt_tokens)`. However, many modern APIs handle separate input and output limits, simplifying this. We'll aim to pass `configured_max_output_tokens` as the API's `max_tokens` parameter, assuming the input validation has passed.
    - **API Call Parameter:** Update the `callParams` to use the correctly determined `max_tokens` for generation (which will be our `configured_max_output_tokens`).

**Phase 2: Error Handling and Refinements**

1.  **Enhanced Error Handling:** Provide clear error messages if prompt tokens exceed input limits, or if API calls fail due to token issues despite our calculations.
2.  **Validation:** Add validation (perhaps in `config-manager.js` or when `task-master models --setup` is run) to ensure `configured_max_input_tokens` and `configured_max_output_tokens` in `.taskmasterconfig` do not exceed the `model_absolute_max_input_tokens` and `model_absolute_max_output_tokens` from `MODEL_MAP`.

Let's start by inspecting `scripts/modules/config-manager.js` to see how parameters and `MODEL_MAP` are currently handled. This will inform the changes needed for `.taskmasterconfig` and `ai-services-unified.js`.

I will now read `scripts/modules/config-manager.js`.

Okay, I've reviewed `scripts/modules/config-manager.js`. Here's what I've gathered and how it impacts the plan:

- **`MODEL_MAP` Source:** `MODEL_MAP` is loaded from `supported-models.json`. This is excellent, as it means we can update the model capabilities (including new token limits) in a structured JSON file.
- **Configuration Loading:** `_loadAndValidateConfig` handles loading `.taskmasterconfig` and merging it with `DEFAULTS`.
- **Getters:** There are specific getters for `maxTokens` for each role (e.g., `getMainMaxTokens`). We will need to update these.
- **`getParametersForRole`:** This function already exists and is a good candidate for returning the new `maxInputTokens` and `maxOutputTokens`.

Here's the refined plan:

**Phase 1: Configuration and Data Structures**

1.  **Update `supported-models.json`:**

    - For each model entry in `supported-models.json`, we need to add `maxInputTokens` and `maxOutputTokens` fields. These should reflect the _absolute maximums_ for that specific model.
    - Example entry change:

      ```json
      // Before
      {
          "id": "claude-3-7-sonnet-20250219",
          "name": "Claude 3.7 Sonnet (Preview)",
          "context_window": 200000, // This might be total context
          "cost_per_1m_tokens": { "input": 3, "output": 15, "currency": "USD" }
      }

      // After (assuming 200k is total, and we make a reasonable split or find official numbers)
      {
          "id": "claude-3-7-sonnet-20250219",
          "name": "Claude 3.7 Sonnet (Preview)",
          "maxInputTokens": 190000, // Example
          "maxOutputTokens": 8192,  // Example, often smaller for generation
          "cost_per_1m_tokens": { "input": 3, "output": 15, "currency": "USD" }
      }
      ```

    - I will need to find the official input/output token limits for the models currently in your `MODEL_MAP`. If you have this information handy, it would speed things up. Otherwise, I can make educated guesses or search for them.

2.  **Update `.taskmasterconfig` (Defaults and User File):**
    - In `scripts/modules/config-manager.js`, modify the `DEFAULTS` object. For each role (`main`, `research`, `fallback`), replace `maxTokens` with:
      - `maxInputTokens`: A sensible default (e.g., a large portion of the model's capability, but user-configurable).
      - `maxOutputTokens`: A sensible default for generation (e.g., 4096 or 8192).
    - You will then need to manually update your existing `.taskmasterconfig` file to reflect this new structure. I can provide the snippet for you to paste.
3.  **Update `config-manager.js`:**
    - Modify `getParametersForRole(role, explicitRoot = null)`:
      - It currently fetches `maxTokens` and `temperature`.
      - Update it to fetch `maxInputTokens`, `maxOutputTokens`, and `temperature` from the loaded config for the given role.
    - Remove the role-specific `getMaxTokens` functions (e.g., `getMainMaxTokens`, `getResearchMaxTokens`, `getFallbackMaxTokens`). The `getParametersForRole` will be the central way to get these.
    - (Optional, for later validation) Consider adding a new function `getModelCapabilities(providerName, modelId)` that reads from `MODEL_MAP` to return the absolute `maxInputTokens` and `maxOutputTokens` for a given model. This would be useful for validating the user's settings in `.taskmasterconfig`.

**Phase 2: Core Logic in `ai-services-unified.js`**

1.  **Token Counting (`_unifiedServiceRunner`):**

    - This is the most complex part. We need a reliable way to count tokens for the prompts.
      - **Strategy 1 (Ideal):** Leverage Vercel AI SDK. The SDK might provide a way to get a tokenizer for the active model or a utility function. We'll need to investigate its capabilities.
      - **Strategy 2 (Fallback):** Use a library like `tiktoken` for models compatible with OpenAI's tokenization (many are, including some Anthropic models). For other models, we might need provider-specific tokenizers or make estimations (less ideal).
      - **Initial Approach:** Let's try to find a Vercel AI SDK utility first. If not, we'll start with `tiktoken` as a common case and acknowledge that other models might need specific handling later.
    - The function `_unifiedServiceRunner` will call this token counting utility:

      ```javascript
      // Placeholder for token counting
      function countTokens(text, modelId /* or providerName */) {
      	// ... implementation using SDK or library ...
      	// This is a simplification; actual tokenization is model-specific.
      	// For now, a rough estimate might be (text.length / 4) as a placeholder
      	// if a proper tokenizer isn't immediately available.
      	if (!text) return 0;
      	return Math.ceil(text.length / 3.5); // Very rough general estimate
      }

      const promptTokens = countTokens(systemPrompt) + countTokens(prompt);
      ```

2.  **Dynamic Output Token Calculation & Validation (`_unifiedServiceRunner`):**

    - Fetch parameters using the updated `getParametersForRole` from `config-manager.js`:
      ```javascript
      const roleParams = getParametersForRole(
      	currentRole,
      	effectiveProjectRoot
      );
      // roleParams will now contain { maxInputTokens, maxOutputTokens, temperature }
      ```
    - Fetch model's absolute limits from `MODEL_MAP` (we'll need a helper in `config-manager.js` or do it directly in `ai-services-unified.js` for now):
      ```javascript
      // Simplified; ideally use a robust getter from config-manager
      const modelInfo = MODEL_MAP[providerName?.toLowerCase()]?.find(
      	(m) => m.id === modelId
      );
      const modelAbsoluteMaxInput = modelInfo?.maxInputTokens || Infinity;
      const modelAbsoluteMaxOutput =
      	modelInfo?.maxOutputTokens || roleParams.maxOutputTokens; // Fallback to configured if not in map
      ```
    - **Input Validation:**
      ```javascript
      if (promptTokens > roleParams.maxInputTokens) {
      	throw new Error(
      		`Prompt (${promptTokens} tokens) exceeds configured max input tokens (${roleParams.maxInputTokens}) for role '${currentRole}'.`
      	);
      }
      if (promptTokens > modelAbsoluteMaxInput) {
      	throw new Error(
      		`Prompt (${promptTokens} tokens) exceeds model's absolute max input tokens (${modelAbsoluteMaxInput}) for ${modelId}.`
      	);
      }
      ```
    - **API Call Parameter (`max_tokens` for generation):**
      The `max_tokens` parameter passed to the provider's API call should be `roleParams.maxOutputTokens`. We must also ensure this doesn't exceed the model's absolute output capability.

      ```javascript
      const apiMaxOutputTokens = Math.min(
      	roleParams.maxOutputTokens,
      	modelAbsoluteMaxOutput
      );

      const callParams = {
      	apiKey,
      	modelId,
      	// Use apiMaxOutputTokens for the actual API call
      	maxTokens: apiMaxOutputTokens, // This usually means max tokens to GENERATE
      	temperature: roleParams.temperature,
      	messages,
      	baseUrl,
      	...(serviceType === 'generateObject' && { schema, objectName }),
      	...restApiParams
      };
      ```

3.  **Update `logAiUsage`:**
    - The cost calculation in `logAiUsage` seems correct as it already uses `inputCost` and `outputCost` per 1M tokens. This part should remain compatible.

**Next Steps:**

1.  **Modify `supported-models.json`:** I need the content of this file to propose the new `maxInputTokens` and `maxOutputTokens` fields. Please provide it.
2.  **Decide on Tokenizer Strategy:** What are your thoughts on the token counting? Are you aware of any utilities within Vercel AI SDK for this, or should we plan to integrate `tiktoken` initially?

Once I have the content of `supported-models.json`, I can draft the changes for it and then proceed to `config-manager.js` and `.taskmasterconfig`.

```json
        // Before
        {
            "id": "claude-3-7-sonnet-20250219",
            "name": "Claude 3.7 Sonnet (Preview)",
            "context_window": 200000, // This might be total context
            "cost_per_1m_tokens": { "input": 3, "output": 15, "currency": "USD" }
        }

        // After (assuming 200k is total, and we make a reasonable split or find official numbers)
        {
            "id": "claude-3-7-sonnet-20250219",
            "name": "Claude 3.7 Sonnet (Preview)",
            "maxInputTokens": 190000, // Example
            "maxOutputTokens": 8192,  // Example, often smaller for generation
            "cost_per_1m_tokens": { "input": 3, "output": 15, "currency": "USD" }
        }
```

```javascript
// Placeholder for token counting
function countTokens(text, modelId /* or providerName */) {
	// ... implementation using SDK or library ...
	// This is a simplification; actual tokenization is model-specific.
	// For now, a rough estimate might be (text.length / 4) as a placeholder
	// if a proper tokenizer isn't immediately available.
	if (!text) return 0;
	return Math.ceil(text.length / 3.5); // Very rough general estimate
}

const promptTokens = countTokens(systemPrompt) + countTokens(prompt);
```

```javascript
const roleParams = getParametersForRole(currentRole, effectiveProjectRoot);
// roleParams will now contain { maxInputTokens, maxOutputTokens, temperature }
```

```javascript
// Simplified; ideally use a robust getter from config-manager
const modelInfo = MODEL_MAP[providerName?.toLowerCase()]?.find(
	(m) => m.id === modelId
);
const modelAbsoluteMaxInput = modelInfo?.maxInputTokens || Infinity;
const modelAbsoluteMaxOutput =
	modelInfo?.maxOutputTokens || roleParams.maxOutputTokens; // Fallback to configured if not in map
```

```javascript
if (promptTokens > roleParams.maxInputTokens) {
	throw new Error(
		`Prompt (${promptTokens} tokens) exceeds configured max input tokens (${roleParams.maxInputTokens}) for role '${currentRole}'.`
	);
}
if (promptTokens > modelAbsoluteMaxInput) {
	throw new Error(
		`Prompt (${promptTokens} tokens) exceeds model's absolute max input tokens (${modelAbsoluteMaxInput}) for ${modelId}.`
	);
}
```

```javascript
const apiMaxOutputTokens = Math.min(
	roleParams.maxOutputTokens,
	modelAbsoluteMaxOutput
);

const callParams = {
	apiKey,
	modelId,
	// Use apiMaxOutputTokens for the actual API call
	maxTokens: apiMaxOutputTokens, // This usually means max tokens to GENERATE
	temperature: roleParams.temperature,
	messages,
	baseUrl,
	...(serviceType === 'generateObject' && { schema, objectName }),
	...restApiParams
};
```

Okay, I have the contents of `supported-models.json`.

It seems many models have a `max_tokens` field, which I assume is the _total context window_. Some don't have it, and for others (like OpenAI `gpt-4o`), the listed `max_tokens` (16384) is known to be its _output_ token limit when using the Chat Completions API, while the context window is much larger (128k). This highlights the complexity: `max_tokens` in `supported-models.json` is used inconsistently.

**Revised Plan for `supported-models.json` and Token Definitions:**

To bring clarity, we'll introduce two new fields and ensure their meaning is consistent:

- `contextWindowTokens`: The total number of tokens the model can process (input + output). This would replace the current ambiguous `max_tokens`.
- `maxOutputTokens`: The maximum number of tokens the model can _generate_ in a single response. This is often smaller than the total context window, especially for larger models.

If a model _only_ specifies a total context window, we'll have to make a reasonable assumption for `maxOutputTokens` (e.g., 4096 or 8192, or a fraction of the total context window). If it only specifies an output token limit (like some OpenAI models in certain API modes), we'll need to find its total context window.

**Updated `supported-models.json` Structure (Example):**

```json
// For a model like Anthropic Claude 3.7 Sonnet (Preview)
{
    "id": "claude-3-7-sonnet-20250219",
    "swe_score": 0.623,
    "cost_per_1m_tokens": { "input": 3.0, "output": 15.0 },
    "allowed_roles": ["main", "fallback"],
    "contextWindowTokens": 200000, // From Anthropic's documentation
    "maxOutputTokens": 8192     // Anthropic default, user can override in .taskmasterconfig
}

// For a model like OpenAI GPT-4o
{
    "id": "gpt-4o",
    "swe_score": 0.332,
    "cost_per_1m_tokens": { "input": 2.5, "output": 10.0 },
    "allowed_roles": ["main", "fallback"],
    "contextWindowTokens": 128000, // Official context window
    "maxOutputTokens": 16384    // Max output for chat completions is 16k for gpt-4o (used to be 4k/8k for older gpt-4)
                                // but the model card mentions 128k total. The API call parameter for `max_tokens` sets this output cap.
}
```

I will proceed to generate the updated `supported-models.json` content. This will be a significant change. I will make my best effort to find the correct `contextWindowTokens` and `maxOutputTokens` for each model. If official numbers are ambiguous or not readily available, I'll use sensible defaults and add a comment.

**Regarding Tokenizer Strategy:**

- **Vercel AI SDK:** The `ai` package (Vercel AI SDK) itself is a lightweight wrapper. Tokenization is usually handled by the underlying provider-specific SDKs (e.g., `@anthropic-ai/sdk`, `openai`). The Vercel SDK doesn't provide a universal tokenizer.
- **Provider SDKs:**
  - `@anthropic-ai/sdk`: Does not expose a public tokenizer directly. Anthropic recommends counting based on their guidelines (roughly 3.5 chars/token for English).
  - `openai` (for Node.js): The `gpt-3-encoder` or `tiktoken` libraries are commonly used. `tiktoken` is more current.
- **`tiktoken`:** This is a good general-purpose library for OpenAI models and those that use compatible tokenization (many models fine-tuned from Llama, etc., might be close). It supports various encodings.
- **Recommendation:**
  1.  Start by integrating `tiktoken`. We can select the encoding based on the provider or even specific model if needed (e.g., `cl100k_base` for gpt-4, gpt-3.5-turbo, DALL-E models).
  2.  For providers where `tiktoken` is not accurate (e.g., Google's Gemini, Perplexity if they have proprietary tokenizers), we might have to rely on character-based estimations (e.g., `length / N`) as a rougher guide or investigate if their specific SDKs offer token counting.
  3.  The Vercel AI SDK's `experimental_streamObject` and other functions _might_ internally handle some aspects of token counting for request preparation, but we need explicit counting for our logic _before_ the call.

For now, let's assume we'll add a `countTokens` utility that uses `tiktoken` for OpenAI and Anthropic (as Anthropic's guidance is character-based but `cl100k_base` is often a decent proxy for their tokenization for rough estimates, though not perfect), and a character-based fallback for others.

I will now generate the proposed changes for `scripts/modules/supported-models.json`. This will be a large diff.

After this, we'll move to:

1.  Updating `.taskmasterconfig` defaults in `config-manager.js` and providing you the snippet for your user file.
2.  Updating `config-manager.js` getters.
3.  Implementing the logic in `ai-services-unified.js`.

```json
// For a model like Anthropic Claude 3.7 Sonnet (Preview)
{
    "id": "claude-3-7-sonnet-20250219",
    "swe_score": 0.623,
    "cost_per_1m_tokens": { "input": 3.0, "output": 15.0 },
    "allowed_roles": ["main", "fallback"],
    "contextWindowTokens": 200000, // From Anthropic's documentation
    "maxOutputTokens": 8192     // Anthropic default, user can override in .taskmasterconfig
}

// For a model like OpenAI GPT-4o
{
    "id": "gpt-4o",
    "swe_score": 0.332,
    "cost_per_1m_tokens": { "input": 2.5, "output": 10.0 },
    "allowed_roles": ["main", "fallback"],
    "contextWindowTokens": 128000, // Official context window
    "maxOutputTokens": 16384    // Max output for chat completions is 16k for gpt-4o (used to be 4k/8k for older gpt-4)
                                // but the model card mentions 128k total. The API call parameter for `max_tokens` sets this output cap.
}
```

```json
// For a model like Anthropic Claude 3.7 Sonnet (Preview)
{
    "id": "claude-3-7-sonnet-20250219",
    "swe_score": 0.623,
    "cost_per_1m_tokens": { "input": 3.0, "output": 15.0 },
    "allowed_roles": ["main", "fallback"],
    "contextWindowTokens": 200000, // From Anthropic's documentation
    "maxOutputTokens": 8192     // Anthropic default, user can override in .taskmasterconfig
}

// For a model like OpenAI GPT-4o
{
    "id": "gpt-4o",
    "swe_score": 0.332,
    "cost_per_1m_tokens": { "input": 2.5, "output": 10.0 },
    "allowed_roles": ["main", "fallback"],
    "contextWindowTokens": 128000, // Official context window
    "maxOutputTokens": 16384    // Max output for chat completions is 16k for gpt-4o (used to be 4k/8k for older gpt-4)
                                // but the model card mentions 128k total. The API call parameter for `max_tokens` sets this output cap.
}
```
