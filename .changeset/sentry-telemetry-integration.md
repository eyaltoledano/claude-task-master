---
'task-master-ai': patch
---

Add Sentry integration for error tracking and AI telemetry monitoring

- **Sentry Integration**: Added comprehensive error tracking and AI operation monitoring using Sentry with Vercel AI SDK integration
- **AI Telemetry**: All AI operations (generateText, streamText, generateObject, streamObject) now automatically track spans, token usage, prompts, and responses
- **MCP Server Instrumentation**: Wrapped FastMCP server with `Sentry.wrapMcpServerWithSentry()` to automatically capture spans for all MCP tool interactions
- **Privacy Controls**: Added `anonymousTelemetry` config option (default: true) allowing local storage users to opt out of telemetry
- **Complete Coverage**: Telemetry enabled for all AI commands including parse-prd, expand, update-task, analyze-complexity, and research
- **Internal Telemetry**: Sentry DSN is hardcoded internally for Task Master's telemetry (not user-configurable)
- **Dual Initialization**: Automatic Sentry initialization in both CLI (scripts/dev.js) and MCP Server (mcp-server/src/index.js) with full MCP instrumentation

