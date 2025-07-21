---
"task-master-ai": major
---

Added new AgentLLM provider to Delegate Task Master LLM calls to an MCP client without the need for API keys

This update introduces a new "AgentLLM" provider and associated MCP tool to delegate LLM calls to an agent. This allows Taskmaster MCP sever to offload LLM operations to the agent calling it.

Key changes include:

- New `AgentLLMProvider`: An AI provider that, instead of calling an LLM directly, returns a delegation signal with an `interactionId` and LLM request details.
- New `agent_llm` MCP Tool:  A tool that facilitates communication between Taskmaster and the agent. Taskmaster uses it to request LLM calls, and the agent uses it to return the LLM response.
- TaskMasterMCPServer Enhancements: The server now manages pending agent interactions, pausing the original operation and resuming it upon receiving the agent's response.
- Rules: Added rules `assets/rules/agent_llm.mdc`for the TaskMaster `agent_llm` MCP tool. The rules has to be added with the rules tool for the desired MCP client or manually for MCP cliets to process delegated llm requests correctly.

The workflow involves Taskmaster initiating a delegated LLM call, the agent performing the LLM call, and the agent calling `agent_llm` back to Taskmaster with the results.  An `interactionId` is used to correlate requests and responses.
