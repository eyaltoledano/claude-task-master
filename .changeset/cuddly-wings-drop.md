---
"task-master-ai": minor
---

Add verbose output mode to loop command with `--verbose` flag

- New `-v, --verbose` flag shows Claude's work in real-time (thinking, tool calls) rather than waiting until the iteration completes
- New `--no-output` flag excludes full Claude output from iteration results to save memory
- Improved error handling with proper validation for incompatible options (verbose + sandbox)
