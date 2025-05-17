---
'task-master-ai': patch
---

### Feature: Flexible Git Storage for tasks.json and Task Files

This release introduces a robust, user-friendly mechanism for controlling whether `tasks.json` and the `tasks/` directory are stored in Git, with both CLI automation and interactive support.

#### Highlights

- **New CLI Flags:**
  - `--git-tasks <bool>` for the `init` command allow users to explicitly choose whether to store `tasks.json` and `tasks/` in Git, supporting both automation and scripting.
  - These flags override the interactive prompt, enabling seamless CI/CD or non-interactive usage.

- **Improved Interactive Flow:**
  - If no flag is provided, the CLI prompts the user once, at the end of the setup sequence, for their Git storage preference.
  - After all questions, a summary of all settings (including Git storage choice) is shown for confirmation before proceeding.

- **.gitignore Merge Logic:**
  - The `.gitignore` is updated non-destructively: existing entries are preserved, and only the relevant lines for `tasks.json` and `tasks/` are commented/uncommented based on user choice.
  - The section header `# Task files` is always included above these lines for clarity and consistency, but never duplicated.

#### Usage Example
- Store in Git (default): `task-master init` or `task-master init --git-tasks=true`
- Ignore in Git: `task-master init --git-tasks=false`