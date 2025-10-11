---
"task-master-ai": minor
---

Enhance `expand_all` to intelligently use complexity analysis recommendations when expanding tasks. 

The expand-all operation now automatically leverages recommendations from `analyze-complexity` to determine optimal subtask counts for each task, resulting in more accurate and context-aware task breakdowns.

Key improvements:
- Automatic integration with complexity analysis reports
- Tag-aware complexity report path resolution
- Intelligent subtask count determination based on task complexity
- Falls back to defaults when complexity analysis is unavailable
- Enhanced logging for better visibility into expansion decisions

When you run `task-master expand --all` after `task-master analyze-complexity`, Task Master now uses the recommended subtask counts from the complexity analysis instead of applying uniform defaults, ensuring each task is broken down according to its actual complexity.
