---
"task-master-ai": minor
---

Add optional `metadata` field to tasks for storing user-defined custom data

Tasks and subtasks now support an optional `metadata` field that allows storing arbitrary JSON data such as:
- External IDs (GitHub issues, Jira tickets, Linear issues)
- Workflow data (sprints, story points, custom statuses)
- Integration data (sync timestamps, external system references)
- Custom tracking (UUIDs, version numbers, audit information)

Key features:
- **AI-Safe**: Metadata is preserved through all AI operations (update-task, expand, etc.) because AI schemas intentionally exclude this field
- **Flexible Schema**: Store any JSON-serializable data without schema changes
- **Backward Compatible**: The field is optional; existing tasks work without modification
- **Subtask Support**: Both tasks and subtasks can have their own metadata
- **MCP Tool Support**: Use `update_task` and `update_subtask` with the `metadata` parameter to update metadata (requires `TASK_MASTER_ALLOW_METADATA_UPDATES=true` in MCP server environment)

Example usage:
```json
{
  "id": 1,
  "title": "Implement authentication",
  "metadata": {
    "githubIssue": 42,
    "sprint": "Q1-S3",
    "storyPoints": 5
  }
}
```

MCP metadata update example:
```javascript
// With TASK_MASTER_ALLOW_METADATA_UPDATES=true set in MCP env
update_task({
  id: "1",
  metadata: '{"githubIssue": 42, "sprint": "Q1-S3"}'
})
```
