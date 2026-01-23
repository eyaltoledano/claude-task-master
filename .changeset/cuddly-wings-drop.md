---
"task-master-ai": minor
---

Add streaming output mode to loop command with `--stream` flag

- New `--stream` flag displays Claude's output in real-time as it generates, rather than waiting until the iteration completes
- New `--no-output` flag excludes full Claude output from iteration results to save memory
- Improved error handling with proper validation for incompatible options (stream + sandbox)
- Enhanced robustness with race condition fixes and better JSON parsing diagnostics
