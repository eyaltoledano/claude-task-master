# GitHub Issues Integration

Task Master can automatically create GitHub issues from your task files. This feature enables you to sync your local task-based development workflow with GitHub's issue tracking system.

## Prerequisites

Before using this feature, you need to configure the following environment variables in your `.env` file:

```
GITHUB_TOKEN=your_github_personal_access_token
REPO_OWNER=your_github_username_or_organization
REPO_NAME=your_repository_name
```

- **GITHUB_TOKEN**: A GitHub personal access token with the `repo` scope. You can create one in your GitHub settings under Developer Settings > Personal Access Tokens.
- **REPO_OWNER**: Your GitHub username or organization name.
- **REPO_NAME**: The name of the repository where you want to create issues.

## Command Usage

```bash
# Basic usage: Create GitHub issues from all task files in the tasks directory
task-master create-github-issues

# Specify a different directory for task files
task-master create-github-issues --tasks-dir=custom/path/to/tasks

# Test without creating actual issues (dry run)
task-master create-github-issues --dry-run

# Customize issue content and labels
task-master create-github-issues --include-status=false --include-dependencies=false --label-prefix="task-status:"
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--tasks-dir <dir>` | Path to the tasks directory | `tasks` |
| `--include-status` | Include task status in the issue body | `true` |
| `--include-dependencies` | Include dependencies in the issue body | `true` |
| `--include-priority` | Include priority in the issue body | `true` |
| `--label-prefix <prefix>` | Prefix for labels based on task status | `status:` |
| `--dry-run` | Run without creating actual issues (test mode) | `false` |

## Task File Format

The command parses task files to extract the title and body. It uses:
- The first line of the task file as the issue title
- The rest of the file content as the issue body

## Example

```bash
# Create GitHub issues with a custom label prefix
task-master create-github-issues --label-prefix="priority:"
```

This will:
1. Read all task files from the `tasks` directory
2. Create a GitHub issue for each task file
3. Use the first line of each task file as the issue title
4. Use the rest of the file content as the issue body
5. Apply labels based on task status (e.g., "priority:pending", "priority:done")

## Troubleshooting

- **Authentication Issues**: If you get "Bad credentials" errors, ensure your GitHub token is valid and has the `repo` scope.
- **Not Found Errors**: Ensure your REPO_OWNER and REPO_NAME are correct and that your token has access to the repository.
- **Rate Limiting**: GitHub API has rate limits. If you encounter them, wait and try again later.
