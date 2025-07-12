# Agent LLM Delegation Workflow

This document outlines the workflow for how Taskmaster delegates Large Language Model (LLM) calls to an agent calling it using the `agent_llm` MCP tool and how the agent should respond.

## Overview

When Taskmaster is configured to use an "AgentLLM" provider for a specific AI role (e.g., 'main', 'research'), instead of making a direct LLM call, it signals a delegation request. An agent to which Taskmaster MCP is hooked to is expected to pick up this request, perform the LLM call, and then return the result to Taskmaster. The `agent_llm` MCP tool is the dedicated channel for this communication. An `interactionId` is used to correlate requests and responses.

## Workflow Steps

1.  **Taskmaster Initiates a Delegated LLM Call:**
    *   An internal Taskmaster operation (e.g., triggered by a command like `parse_prd`, `analyze_project_complexity`, `expand_task`, `expand_all`, `update`, `update_task`, `update_subtask`, `add_task`, `research`) requires an LLM call (e.g., `generateText`, `streamText`, or `generateObject`).
    *   The `AgentLLMProvider` in Taskmaster is invoked. Instead of calling an LLM, it generates an `interactionId` and returns a special signal object.
    *   This signal propagates up to the `TaskMasterMCPServer`'s core logic.
    *   The core logic identifies this as a pending agent interaction. It pauses the original operation and prepares to call the `agent_llm` tool.

2.  **Taskmaster Calls `agent_llm` (Taskmaster -> Agent):**
    *   The `TaskMasterMCPServer` invokes the `agent_llm` MCP tool with parameters indicating a delegation request *to* the agent.
    *   The agent's MCP client (which is connected to Taskmaster's MCP server) receives this `agent_llm` tool call. The response from this *specific* `agent_llm` call (which is effectively a directive *to* the agent) will look like this:

    ```json
    {
        "toolResponseSource": "taskmaster_to_agent",
        "status": "pending_agent_llm_action",
        "message": "Taskmaster requires an LLM call from the agent. Details provided in llmRequestForAgent. Agent must call agent_llm with this interactionId in response.",
        "llmRequestForAgent": {
            // These are the parameters the agent needs to make the LLM call
            "apiKey": null, // Typically null, as the agent handles its own LLM auth
            "modelId": "agent-delegated-model", // Example model
            "messages": [
                { "role": "system", "content": "You are a helpful assistant." },
                { "role": "user", "content": "Translate 'hello' to French." }
            ],
            "maxTokens": 100,
            "temperature": 0.7,
            // "schema": { ... }, // Present for 'generateObject'
            // "objectName": "generated_data", // Present for 'generateObject'
            // ... any other relevant LLM parameters
        },
        "interactionId": "some-unique-uuid-string-generated-by-taskmaster",
        "pendingInteractionSignalToAgent": {
            "type": "agent_must_respond_via_agent_llm",
            "interactionId": "some-unique-uuid-string-generated-by-taskmaster",
            "instructions": "Agent, please perform the LLM call using llmRequestForAgent and then invoke the 'agent_llm' tool with your response, including this interactionId."
        }
    }
    ```

3.  **Agent Performs the LLM Call:**
    *   The agent receives the above JSON as the result of Taskmaster's `agent_llm` call.
    *   The agent extracts the `llmRequestForAgent` object and the `interactionId`.
    *   Using the details in `llmRequestForAgent` (like `modelId`, `messages`, `maxTokens`, `schema`, etc.), the agent makes the actual LLM call using its own LLM client, API keys, and infrastructure.
    *   The agent can choose any LLM provider it is configured to use for the given `modelId` or its internal routing logic.

4.  **Agent Calls `agent_llm` (Agent -> Taskmaster):**
    *   Once the agent receives the response (or error) from its LLM call, it must call the `agent_llm` MCP tool on Taskmaster again.
    *   This call from the agent *back to Taskmaster*  includes:
        *   The original `interactionId` received in step 2.
        *   An `agentLLMResponse` object containing the outcome of its LLM call.

    *   **Example `agent_llm` call from Agent (Success):**
        ```json
        // Agent calls Taskmaster's agent_llm tool with these parameters:
        {
            "interactionId": "some-unique-uuid-string-generated-by-taskmaster",
            "agentLLMResponse": {
                "status": "success",
                "data": {
                    // For generateText:
                    "text": "Bonjour",
                    // For generateObject:
                    // "object": { "translation": "Bonjour" },
                    // For streamText, 'data' might be structured differently or
                    // the agent might need to make multiple calls if streaming directly to agent_llm is complex.
                    // (Streaming aspect through agent_llm needs further clarification if direct streaming is intended)
                    "usage": { "inputTokens": 10, "outputTokens": 5 } // Optional usage data
                }
                // Note: For specific Taskmaster operations like `parse_prd` that are delegated as `generateObject` requests,
                // the `agentLLMResponse.data` should contain the direct structured JSON output (e.g., `{ "tasks": [...], "metadata": {...} }`).
                // This will be passed through as `finalLLMOutput` by the `agent_llm` tool.
                // The more generic `data: { "object": ... }` structure is for other types of `generateObject` calls.
            },
            "projectRoot": "/path/to/project" // Agent should provide this
        }
        ```

    *   **Example `agent_llm` call from Agent (Error):**
        ```json
        // Agent calls Taskmaster's agent_llm tool with these parameters:
        {
            "interactionId": "some-unique-uuid-string-generated-by-taskmaster",
            "agentLLMResponse": {
                "status": "error",
                "errorDetails": {
                    "message": "LLM API returned a 429 status code.",
                    "type": "rate_limit_error",
                    // Any other relevant error details from the agent's LLM call
                }
            },
            "projectRoot": "/path/to/project" // Agent should provide this
        }
        ```

5.  **Taskmaster Processes Agent's Response & Resumes Original Operation:**
    *   Taskmaster's `agent_llm` tool receives the call from the agent.
    *   The `TaskMasterMCPServer` core logic uses the `interactionId` to find the paused operation.
    *   If `agentLLMResponse.status` is `"success"`, the `agentLLMResponse.data` is used as the result of the originally delegated LLM call (e.g., as if `generateText` returned this data). The paused operation resumes and completes.
    *   If `agentLLMResponse.status` is `"error"`, the `agentLLMResponse.errorDetails` are used to signal an error in the paused operation. The operation typically fails or retries based on Taskmaster's internal error handling.
    *   The `agent_llm` tool itself will respond to the agent's call with a confirmation like:
        ```json
        {
            "status": "agent_response_processed_by_taskmaster",
            "interactionId": "some-unique-uuid-string-generated-by-taskmaster"
        }
        ```
        This confirms to the agent that Taskmaster has received and processed its LLM response.


