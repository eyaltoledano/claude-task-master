---
'task-master-ai': patch
---

Add `--research` flag to parse-prd command, enabling enhanced task generation from PRD files. When used, Taskmaster leverages the Perplexity AI research model to:

- Research current technologies and best practices relevant to the project
- Identify technical challenges and security concerns not explicitly mentioned in the PRD
- Include specific library recommendations with version numbers
- Provide more detailed implementation guidance based on industry standards
- Create more accurate dependency relationships between tasks

This results in higher quality, more actionable tasks with minimal additional effort.

*NOTE* That this is an experimental feature. Research models don't typically do great at structured output. You may find some failures when using research mode, so please share your feedback so we can improve this.
