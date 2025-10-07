---
"task-master-ai": minor
---

Add intelligent `scan` command for automated codebase analysis

Introduces a comprehensive project scanning feature that intelligently analyzes codebases using ast-grep and AI-powered analysis. The new `task-master scan` command provides:

- **Multi-phase Analysis**: Performs iterative scanning (project type identification → entry points → core structure → recursive deepening)
- **AST-grep Integration**: Uses ast-grep as an AI SDK tool for advanced code structure analysis
- **AI Enhancement**: Optional AI-powered analysis for intelligent project understanding
- **Structured Output**: Generates detailed JSON reports with file/directory summaries
- **Transparent Logging**: Clear progress indicators showing each analysis phase
- **Configurable Options**: Supports custom include/exclude patterns, scan depth, and output paths

This feature addresses the challenge of quickly understanding existing project structures when adopting Task Master, significantly streamlining initial setup and project onboarding.

Usage:
```bash
task-master scan --output=project_scan.json
task-master scan --include="*.js,*.ts" --exclude="*.test.*" --depth=3
task-master scan --no-ai  # Skip AI analysis for faster results
```