---
"task-master-ai": patch
---

Enhanced add-task fuzzy search intelligence and improved user experience

**Smarter Task Discovery:**

- Remove hardcoded category system that always matched "Task management"
- Eliminate arbitrary limits on fuzzy search results (5→25 high relevance, 3→10 medium relevance, 8→20 detailed tasks)
- Improve semantic weighting in Fuse.js search (details=3, description=2, title=1.5) for better relevance
- Generate context-driven task recommendations based on true semantic similarity

**Enhanced Terminal Experience:**

- Fix duplicate banner display issue that was "eating" terminal history (closes #553)
- Remove console.clear() and redundant displayBanner() calls from UI functions
- Preserve command history for better development workflow
- Streamline banner display across all commands (list, next, show, set-status, clear-subtasks, dependency commands)

**Visual Improvements:**

- Replace emoji complexity indicators with clean filled circle characters (●) for professional appearance
- Improve consistency and readability of task complexity display

**AI Provider Compatibility:**

- Change generateObject mode from 'tool' to 'auto' for better cross-provider compatibility
- Add qwen3-235n-a22b:free model support (closes #687)
- Add smart warnings for free OpenRouter models with limitations (rate limits, restricted context, no tool_use)

**Technical Improvements:**

- Enhanced context generation in add-task to rely on semantic similarity rather than rigid pattern matching
- Improved dependency analysis and common pattern detection
- Better handling of task relationships and relevance scoring
- More intelligent task suggestion algorithms

The add-task system now provides truly relevant task context based on semantic understanding rather than arbitrary categories and limits, while maintaining a cleaner and more professional terminal experience.
