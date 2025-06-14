# Example Cursor AI Interactions

Here are some common interactions with Cursor AI when using Task Master:

## Starting a new project

```
I've just initialized a new project with Claude Task Master. I have a PRD at .taskmaster/docs/prd.txt.
Can you help me parse it and set up the initial tasks?
```

## Working on tasks

```
What's the next task I should work on? Please consider dependencies and priorities.
```

## Implementing a specific task

```
I'd like to implement task 4. Can you help me understand what needs to be done and how to approach it?
```

## Viewing multiple tasks

```
Can you show me tasks 1, 3, and 5 so I can understand their relationship?
```

```
I need to see the status of tasks 44, 55, and their subtasks. Can you show me those?
```

```
Show me tasks 10, 12, and 15 and give me some batch actions I can perform on them.
```

## Managing subtasks

```
I need to regenerate the subtasks for task 3 with a different approach. Can you help me clear and regenerate them?
```

## Handling changes

```
I've decided to use MongoDB instead of PostgreSQL. Can you update all future tasks to reflect this change?
```

## Completing work

```
I've finished implementing the authentication system described in task 2. All tests are passing.
Please mark it as complete and tell me what I should work on next.
```

## Reorganizing tasks

```
I think subtask 5.2 would fit better as part of task 7. Can you move it there?
```

(Agent runs: `task-master move --from=5.2 --to=7.3`)

```
Task 8 should actually be a subtask of task 4. Can you reorganize this?
```

(Agent runs: `task-master move --from=8 --to=4.1`)

```
I just merged the main branch and there's a conflict in tasks.json. My teammates created tasks 10-15 on their branch while I created tasks 10-12 on my branch. Can you help me resolve this by moving my tasks?
```

(Agent runs:

```bash
task-master move --from=10 --to=16
task-master move --from=11 --to=17
task-master move --from=12 --to=18
```

)

## Analyzing complexity

```
Can you analyze the complexity of our tasks to help me understand which ones need to be broken down further?
```

## Viewing complexity report

```
Can you show me the complexity report in a more readable format?
```

### Breaking Down Complex Tasks

```
Task 5 seems complex. Can you break it down into subtasks?
```

(Agent runs: `task-master expand --id=5`)

```
Please break down task 5 using research-backed generation.
```

(Agent runs: `task-master expand --id=5 --research`)

### Updating Tasks with Research

```
We need to update task 15 based on the latest React Query v5 changes. Can you research this and update the task?
```

(Agent runs: `task-master update-task --id=15 --prompt="Update based on React Query v5 changes" --research`)

### Adding Tasks with Research

```
Please add a new task to implement user profile image uploads using Cloudinary, research the best approach.
```

(Agent runs: `task-master add-task --prompt="Implement user profile image uploads using Cloudinary" --research`)

## Research-Driven Development

### Getting Fresh Information

```
Research the latest best practices for implementing JWT authentication in Node.js applications.
```

(Agent runs: `task-master research "Latest best practices for JWT authentication in Node.js"`)

### Research with Project Context

```
I'm working on task 15 which involves API optimization. Can you research current best practices for our specific implementation?
```

(Agent runs: `task-master research "API optimization best practices" --id=15 --files=src/api.js`)

### Research Before Implementation

```
Before I implement task 8 (React Query integration), can you research the latest React Query v5 patterns and any breaking changes?
```

(Agent runs: `task-master research "React Query v5 patterns and breaking changes" --id=8`)

### Research and Update Pattern

```
Research the latest security recommendations for Express.js applications and update our authentication task with the findings.
```

(Agent runs:

1. `task-master research "Latest Express.js security recommendations" --id=12`
2. `task-master update-subtask --id=12.3 --prompt="Updated with latest security findings: [research results]"`)

### Research for Debugging

```
I'm having issues with our WebSocket implementation in task 20. Can you research common WebSocket problems and solutions?
```

(Agent runs: `task-master research "Common WebSocket implementation problems and solutions" --id=20 --files=src/websocket.js`)

### Research Technology Comparisons

```
We need to choose between Redis and Memcached for caching. Can you research the current recommendations for our use case?
```

(Agent runs: `task-master research "Redis vs Memcached 2024 comparison for session caching" --tree`)

## Git Integration and Tag Management

### Creating Tags for Feature Branches

```
I'm starting work on a new feature branch for user authentication. Can you create a matching task tag?
```

(Agent runs: `task-master add-tag --from-branch`)

### Creating Named Tags

```
Create a new tag called 'api-v2' for our API redesign work.
```

(Agent runs: `task-master add-tag api-v2 --description="API v2 redesign tasks"`)

### Switching Tag Contexts

```
Switch to the 'testing' tag so I can work on QA tasks.
```

(Agent runs: `task-master use-tag testing`)

### Copying Tasks Between Tags

```
I need to copy the current tasks to a new 'hotfix' tag for urgent fixes.
```

(Agent runs: `task-master add-tag hotfix --copy-from-current --description="Urgent hotfix tasks"`)

### Managing Multiple Contexts

```
Show me all available tags and their current status.
```

(Agent runs: `task-master tags --show-metadata`)

### Tag Cleanup

```
I've finished the 'user-auth' feature and merged the branch. Can you clean up the tag?
```

(Agent runs: `task-master delete-tag user-auth`)

### Working with Tag-Specific Tasks

```
List all tasks in the 'api-v2' tag context.
```

(Agent runs: `task-master use-tag api-v2` then `task-master list`)

### Branch-Based Development Workflow

```
I'm switching to work on the 'feature/payments' branch. Can you set up the task context for this?
```

(Agent runs:
1. `git checkout feature/payments`
2. `task-master add-tag --from-branch --description="Payment system implementation"`
3. `task-master list` to show tasks in the new context)

### Parallel Feature Development

```
I need to work on both authentication and payment features simultaneously. How should I organize the tasks?
```

(Agent suggests and runs:
1. `task-master add-tag auth --description="Authentication feature tasks"`
2. `task-master add-tag payments --description="Payment system tasks"`
3. `task-master use-tag auth` to start with authentication work)
