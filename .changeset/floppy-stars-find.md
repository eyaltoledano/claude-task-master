---
"task-master-ai": patch
---

Add progress tracking for MCP parse-prd tool

Implements MCP 2025-03-26 compliant progress notifications for the parse-prd tool. Users now receive progress updates showing task titles, priorities, and token usage during streaming operations. Includes automatic fallback to non-streaming mode if progress tracking fails or is not available, ensuring reliable operation across all environments.
