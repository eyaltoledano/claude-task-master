---
"task-master-ai": minor
---

Add real-time progress tracking for MCP parse-prd tool

Implements MCP 2025-03-26 compliant progress notifications for MCP PRD parsing. Users now receive real-time updates showing task generation progress and token usage during streaming operations. Includes automatic fallback to non-streaming mode if progress tracking fails or is not available, ensuring reliable operation across all environments.
