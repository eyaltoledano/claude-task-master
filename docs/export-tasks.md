# Exporting Tasks to Issue Trackers

Task Master can export your tasks to external issue tracking systems like GitHub and Jira. This allows you to seamlessly integrate your local task-based development workflow with popular issue tracking tools.

## Available Integrations

- [GitHub](#github-integration) - Export tasks to GitHub Issues
- [Jira](#jira-integration) - Export tasks to Jira

## Command Usage

```bash
# Export tasks to GitHub Issues
task-master export-tasks github [options]

# Export tasks to Jira
task-master export-tasks jira [options]
```

## GitHub Integration

Task Master can export your task files to GitHub issues.

### Prerequisites for GitHub

Before using this feature, you need to configure the following environment variables in your `.env` file:

```
GITHUB_TOKEN=your_github_personal_access_token
REPO_OWNER=your_github_username_or_organization
REPO_NAME=your_repository_name
```

- **GITHUB_TOKEN**: A GitHub personal access token with the `repo` scope. You can create one in your GitHub settings under Developer Settings > Personal Access Tokens.
- **REPO_OWNER**: Your GitHub username or organization name.
- **REPO_NAME**: The name of the repository where you want to create issues.

### GitHub Options

| Option | Description | Default |
|--------|-------------|---------|
| `--tasks-dir <dir>` | Path to the tasks directory | `tasks` |
| `--include-status` | Include task status in the issue body | `true` |
| `--include-dependencies` | Include dependencies in the issue body | `true` |
| `--include-priority` | Include priority in the issue body | `true` |
| `--label-prefix <prefix>` | Prefix for labels based on task status | `status:` |
| `--dry-run` | Run without creating actual issues (test mode) | `false` |

### GitHub Example

```bash
# Export tasks to GitHub with a custom label prefix
task-master export-tasks github --label-prefix="priority:"

# Test without creating actual issues
task-master export-tasks github --dry-run
```

## Jira Integration

Task Master can export your task files to Jira issues.

### Prerequisites for Jira

Before using this feature, you need to configure the following environment variables in your `.env` file:

```
JIRA_API_TOKEN=your_jira_api_token
JIRA_EMAIL=your_jira_email
JIRA_HOST=https://your-domain.atlassian.net
JIRA_PROJECT_KEY=PROJ
```

- **JIRA_API_TOKEN**: An API token for your Jira account. You can create one in your Atlassian account settings under Security > API Tokens.
- **JIRA_EMAIL**: The email address associated with your Jira account.
- **JIRA_HOST**: Your Jira instance URL (e.g., https://your-domain.atlassian.net).
- **JIRA_PROJECT_KEY**: The key of the Jira project where you want to create issues (e.g., PROJ).

### Jira Options

| Option | Description | Default |
|--------|-------------|---------|
| `--tasks-dir <dir>` | Path to the tasks directory | `tasks` |
| `--include-status` | Include task status in the issue description | `true` |
| `--include-dependencies` | Include dependencies in the issue description | `true` |
| `--include-priority` | Include priority in the issue description | `true` |
| `--issue-type <type>` | The Jira issue type to create | `Task` |
| `--dry-run` | Run without creating actual issues (test mode) | `false` |

### Jira Example

```bash
# Export tasks to Jira with a specific issue type
task-master export-tasks jira --issue-type="Story"

# Test without creating actual issues
task-master export-tasks jira --dry-run
```

## Task File Format

The command parses task files to extract the title and body. It uses:
- The first line of the task file as the issue title/summary
- The rest of the file content as the issue body/description

## Troubleshooting

### GitHub Issues

- **Authentication Issues**: If you get "Bad credentials" errors, ensure your GitHub token is valid and has the `repo` scope.
- **Not Found Errors**: Ensure your REPO_OWNER and REPO_NAME are correct and that your token has access to the repository.
- **Rate Limiting**: GitHub API has rate limits. If you encounter them, wait and try again later.

### Jira Issues

- **Authentication Issues**: If you get "Unauthorized" errors, check that your JIRA_API_TOKEN and JIRA_EMAIL are correct.
- **Permission Issues**: Ensure your Jira account has permission to create issues in the specified project.
- **Invalid Project Key**: Double-check your JIRA_PROJECT_KEY is correct for your Jira instance.
- **Invalid Issue Type**: Ensure the issue type you specify is valid for your Jira project.
