# Rules for implementing tasks imported from Hamster using Taskamster

- Use only `tm list`, `tm show <sub/task id>` and `tm set-status` - other commands don't yet work with it.
- Do not use the MCP tools when connected with Hamster briefs - that is not yet up to date.
- Use `.cursor/rules/git_workflow.mdc` as a guide for the workflow
- When starting a task, mark it as in-progress. You can mark multiple task statuses at once with comma separation (i.e. `tm set-status -i 1,1.1 -s in-progress`)
- Read the task, then if it has subtasks, begin implementing the subtasks one at a time.
- When the subtask is done, run lint and typecheck, mark the task as done if it passes, and commit.
- Continue until all subtasks are done, then run a final lint and typecheck (`npm lint` and `npm typecheck`) and create a PR using `gh` cli for that Task.
- Keep committing to the same PR as long as the scope is maintained. An entire task list (brief) might fit into a single PR but not if it ends up being huge. It is preferred for everything to land in one PR if it is possible, otherwise commit to different PRs that build on top of the previous ones. Confirm with the human when doing this.
- When the parent task is completed, ensure you mark is as done.
- When the first task is done, repeat this process for all tasks until all tasks are done.
- If you run into an issue where the JWT seems expired or commands don't work, ensure you use `tm auth refresh` to refresh the token and if that does not work, use `tm context <brief url>` to reconnect the context. If you do not have the brief url, ask the user for it (perhaps use it at the beginning)
- If you need to get context from multiple tasks or subtasks, use `tm show <command-separated ids>` i.e. `tm show 1, 1.1`
- If you're working on a task that has subtasks the work of which can be completed in parallel, spawn sub-agents for each task and complete the work in parallel. Ensure that the work/files to adjust are not the same across subtasks so it is clear what can be done in parallel.
