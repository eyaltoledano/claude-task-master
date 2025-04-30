# Contributing to Claude Task Master

Thank you for your interest in contributing to Claude Task Master! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
  - [Development Environment Setup](#development-environment-setup)
  - [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
  - [Making Changes](#making-changes)
  - [Testing](#testing)
  - [Submitting Changes](#submitting-changes)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)
- [Adding New Commands](#adding-new-commands)
- [MCP Server Development](#mcp-server-development)
- [Documentation](#documentation)
- [Using AI Assistance](#using-ai-assistance)
- [Release Process](#release-process)

## Code of Conduct

We expect all contributors to adhere to the following principles:

- Be respectful and inclusive in communications
- Accept constructive criticism gracefully
- Focus on what is best for the community and project
- Show empathy towards other community members

## Getting Started

### Development Environment Setup

1. **Fork the Repository**

   Start by forking the [Claude Task Master repository](https://github.com/eyaltoledano/claude-task-master) to your GitHub account.

2. **Clone Your Fork**

   ```bash
   git clone https://github.com/YOUR-USERNAME/claude-task-master.git
   cd claude-task-master
   ```

3. **Install Dependencies**

   ```bash
   npm install
   ```

4. **Set Up Environment Variables**

   Create a `.env` file in the project root and add the following variables:

   ```
   ANTHROPIC_API_KEY=your_anthropic_api_key
   PERPLEXITY_API_KEY=your_perplexity_api_key  # Optional
   DEBUG=true  # For development
   LOG_LEVEL=debug
   ```

5. **Configure Git**

   Add the upstream repository as a remote to keep your fork in sync:

   ```bash
   git remote add upstream https://github.com/eyaltoledano/claude-task-master.git
   ```

### Project Structure

Claude Task Master follows a modular structure:

```
├── bin/                  # Executable scripts
├── scripts/              # Core scripts and utilities
│   ├── modules/          # Core functionality modules
│   │   ├── ai-services.js    # AI service integrations
│   │   ├── commands.js       # CLI command definitions
│   │   ├── task-manager.js   # Task management logic
│   │   ├── ui.js             # UI components and display
│   │   └── utils.js          # Utility functions
├── mcp-server/           # Model Context Protocol server
│   ├── src/              # MCP server source code
│   │   ├── core/         # Core MCP functionality
│   │   ├── tools/        # MCP tools implementation
├── tests/                # Test suite
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
├── .github/              # GitHub workflows and configs
└── tasks/                # Example task definitions
```

## Development Workflow

### Making Changes

1. **Create a Feature Branch**

   Always create a new branch for your changes:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Keep Your Branch Updated**

   Regularly sync your branch with upstream changes:

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

3. **Commit Best Practices**

   - Write clear, concise commit messages
   - Prefix commits with type: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`
   - Keep commits focused on single changes. Avoid unrelated changes in the same commit.
   - Only stage and commit files relevant to the specific change you are making. Do not commit unrelated or automatically generated files (e.g., build artifacts, unless explicitly required).
   - Example: `feat: add expand-all command with research option`

### Testing

We use Jest for testing. **Crucially, all new features or bug fixes must include appropriate unit or integration tests.** Pull requests without adequate test coverage will not be merged, as this introduces technical debt.

Consult the [`tests.mdc`](mdc:.cursor/rules/tests.mdc) rule for detailed guidelines on implementing tests.

```bash
# Run all tests
npm test

# Run specific tests
npm test -- -t "task manager"

# Run tests in watch mode during development
npm run test:watch

# Check test coverage
npm run test:coverage
```

Test files should be placed in the `tests/` directory, mirroring the structure of the source files they test. Ensure all tests pass before submitting your changes: `npm test`.

### Submitting Changes

Before creating a pull request, ensure you have followed these steps:

1. **Format Your Code:**
   Run the code formatter to ensure consistency:
   ```bash
   npm run format
   ```
   Only commit formatting changes directly related to your code modifications. Avoid committing unrelated formatting adjustments.

2. **Run Tests:**
   Confirm all existing and new tests pass:
   ```bash
   npm test
   ```

3. **Create a Changeset (If Applicable):**
   If your changes include a **bug fix** or a **new feature** targeting the `main` branch, you **must** create a changeset. This automatically updates the version and `CHANGELOG.md`.
   ```bash
   npm run changeset
   ```
   Follow the prompts:
   - Select the package(s) affected (usually the main package).
   - Choose the bump type (`Patch` for fixes, `Minor` for features, `Major` for breaking changes).
   - Write a **concise summary** for the changelog (this is different from your Git commit message). See [`changeset.mdc`](mdc:.cursor/rules/changeset.mdc) for details.

   Stage the generated changeset file (`.changeset/*.md`) along with your code.

4. **Commit Your Changes:**
   Stage only the relevant files (your code changes, tests, and the changeset file if created). Use a clear and descriptive commit message following the [Commit Best Practices](#commit-best-practices).

5. **Push Your Branch:**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request:**
   Open a pull request from your fork's branch to the `main` branch of the upstream repository.

## Pull Request Process

1. **PR Title Format**

   Follow the conventional commit format for PR titles:
   - `feat: add new feature`
   - `fix: resolve issue with command`
   - `docs: improve installation instructions`
   - `refactor: reorganize command structure`

2. **PR Description**

   A clear description helps maintainers understand your contribution and speeds up the review process. Include:
   - A clear summary of **what** the PR does and **why** it's needed.
   - Link to any related issue(s) (e.g., `Fixes #123`).
   - Screenshots or examples if the change affects the UI or command output.
   - Details on how the changes were tested.
   - Notes on any potential breaking changes.
   - Set expectations clearly.

3. **PR Scope and Review:**
   - **Keep PRs Focused:** Each PR should address **one specific feature or bug fix**. Small, focused PRs are reviewed and merged faster. If you need to make multiple distinct changes, create separate PRs.
   - **Review Your Own PR:** Before requesting a review from maintainers, **re-read your own PR carefully**. Check the code diffs, description, and ensure all requirements (tests, formatting, changeset) are met. This makes the maintainer's job easier and accelerates the process.
   - **Avoid Arbitrary Changes:** Only include changes directly related to the PR's purpose. Do not refactor unrelated code or commit unnecessary changes (e.g., whitespace adjustments in untouched files).

4. **PR Checklist**

   Ensure your PR meets these requirements:
   - [ ] Code follows style guidelines (`npm run format` executed)
   - [ ] **Tests added or updated** for new functionality or bug fixes (`npm test` passes)
   - [ ] Documentation updated (README, JSDoc, command help)
   - [ ] **Changeset included** if it's a feature or fix (`npm run changeset` executed if needed)
   - [ ] PR is focused on a single logical change
   - [ ] PR description is clear and complete
   - [ ] Self-reviewed the PR diff for clarity and correctness
   - [ ] All CI checks pass

5. **Review Process**

   - At least one maintainer must approve your PR
   - Address all review comments and requested changes
   - Maintainers may suggest improvements or alternative approaches

## Style Guidelines

### Code Style

- We follow a modified Airbnb JavaScript style guide enforced by Prettier. Run `npm run format` before committing.
- Use ES modules (`import`/`export`) for module system
- Use async/await for asynchronous code
- Prefer arrow functions for callbacks
- Use meaningful variable and function names

### Documentation

- Use JSDoc comments for functions and classes
- Keep README and other documentation up to date
- Document command options and examples

## Adding New Commands

To add a new command to the CLI:

1. **Create Command Handler**

   Add a new command handler function in `scripts/modules/task-manager.js`.

2. **Register Command**

   Register the command in `scripts/modules/commands.js` following this pattern:

   ```javascript
   programInstance
     .command('your-command')
     .description('Description of what your command does')
     .option('-o, --option <value>', 'Description of the option')
     .action(async (options) => {
       // Implement command logic here
     });
   ```

3. **Add Tests**

   Create tests for your command in `tests/unit/` and/or `tests/integration/`. **Remember, test coverage is mandatory.**

4. **Update Documentation**

   Add documentation for your command in README.md and relevant docs.

5. **Add MCP Support**

   If applicable, add MCP server support by creating a new tool in `mcp-server/src/tools/`.

## MCP Server Development

The Model Context Protocol (MCP) server provides integration with Cursor AI:

1. **Tool Structure**

   Each MCP tool should:
   - Be placed in `mcp-server/src/tools/`
   - Use direct function imports from task-master-core.js
   - Include proper parameter validation with Zod
   - Handle errors gracefully

2. **Testing MCP Server**

   ```bash
   # Start the MCP inspector for testing
   npm run inspector
   ```

3. **Registering Tools**

   Register new tools in `mcp-server/src/tools/index.js`.

## Documentation

Good documentation is essential. When contributing, please:

- Update the README.md when adding or changing features
- Add JSDoc comments to all functions and classes
- Include examples for new commands or features
- Keep the command reference section up to date

## Using AI Assistance

We encourage leveraging AI tools like Cursor to enhance productivity, but it's crucial to use them responsibly:

- **Review AI Output:** **Always carefully review code generated or modified by AI.** Understand what the AI is doing and ensure it aligns with the project's standards and the specific goal of your PR.
- **Discard Unnecessary Changes:** AI, especially newer models, might rewrite code that is out of scope or make stylistic changes that aren't necessary. **Do not blindly accept all suggestions.** Use `git diff` and selectively stage only the relevant changes. Discard trivial or unrelated modifications (e.g., changing comments unnecessarily, reformatting untouched code). Remember: small, focused PRs get merged faster.
- **Take Ownership:** While AI can assist, **you are ultimately responsible** for the code you submit. If you see a better way to implement something than what the AI suggested, use your judgment.

## Release Process

Releases are managed by maintainers using the following process:

1. Changesets are collected from merged PRs
2. When ready for release, maintainers run:
   ```bash
   npm run changeset version
   ```
3. A new PR is created with version bumps and CHANGELOG updates
4. Once merged, the GitHub Actions workflow publishes to npm

---

Thank you for contributing to Claude Task Master! Your efforts help improve the project for everyone.