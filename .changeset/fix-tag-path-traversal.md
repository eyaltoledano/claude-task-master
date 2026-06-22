---
"task-master-ai": patch
---

Fix path traversal via unsanitized `tag` in tm-core file path builders (CWE-23). The complexity-report reader and the per-task file generator interpolated the tag straight into a filename, so a tag containing `../` (from a CLI/MCP argument, `.taskmaster/state.json` `currentTag`, or `TASKMASTER_TAG`) could read or write files outside the `.taskmaster/` directory. Tags are now slugified with a shared `slugifyTagForFilePath` helper, restoring parity with the legacy JS path writer; legitimately named tags are unaffected.
