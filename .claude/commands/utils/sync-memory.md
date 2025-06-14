Synchronize Task Master project state with Claude's memory (CLAUDE.md).

Update CLAUDE.md with current project information:

1. **Gather Current State**
   - Read current tasks.json
   - Get project statistics
   - Check recent git history
   - Load complexity reports

2. **Calculate Metrics**
   ```
   Calculating project metrics...
   ```
   - Total tasks and breakdown by status
   - Completion percentage
   - Average task complexity
   - Velocity trends
   - Critical path analysis

3. **Extract Recent Decisions**
   From git commits and task completions:
   - Architectural decisions made
   - Technology choices
   - Problem solutions implemented
   - Workarounds applied

4. **Identify Patterns**
   - Common implementation patterns used
   - Recurring issues encountered
   - Successful approaches
   - Team conventions observed

5. **Update CLAUDE.md Sections**
   
   **Update Project Overview:**
   ```markdown
   ## Project Overview
   
   Claude Task Master is an AI-driven task management system...
   
   **Current Status**: 45/156 tasks complete (29%)
   **Sprint**: Week 2 of Sprint 3
   **Last Updated**: [timestamp]
   ```
   
   **Update Recent Decisions:**
   ```markdown
   ### Recent Decisions
   - Switched to TypeScript for better type safety (Task #23)
   - Implemented Redis caching for performance (Task #45)
   - Adopted feature-branch git workflow (Task #12)
   ```
   
   **Update Known Issues:**
   ```markdown
   ### Known Issues
   - Performance degradation with >1000 tasks (#67)
   - Circular dependency detection needs optimization (#89)
   - MCP server memory leak under investigation (#101)
   ```
   
   **Update Team Conventions:**
   ```markdown
   ### Team Conventions
   - All new features require 80%+ test coverage
   - Use conventional commits format
   - PR reviews required for task completion
   - Daily standups at 9 AM
   ```

6. **Add Task Insights**
   Document patterns from completed tasks:
   - Common blockers
   - Typical task completion times
   - Frequent dependency patterns
   - Testing strategies that worked

7. **Update Quick Reference**
   Refresh command shortcuts and workflows:
   - Most used commands
   - Successful workflow patterns
   - Time-saving shortcuts discovered

8. **Project-Specific Context**
   Add context learned from implementation:
   - API endpoints created
   - Database schema decisions
   - External service integrations
   - Performance optimizations

9. **Create Learning Summary**
   ```markdown
   ## Lessons Learned
   
   ### What's Working Well
   - Test-first approach reducing bugs
   - Small atomic tasks easier to complete
   - Daily standups improving visibility
   
   ### Areas for Improvement
   - Need better error handling patterns
   - Documentation falling behind
   - Integration tests need expansion
   ```

10. **Version and Timestamp**
    Add metadata:
    ```markdown
    ---
    Last Sync: [timestamp]
    Tasks Completed This Week: 12
    Next Milestone: Beta Release (Task #100)
    Sync Command: /project:utils:sync-memory
    ---
    ```

11. **Backup Previous Version**
    - Copy current CLAUDE.md to CLAUDE.md.backup
    - Keep last 3 versions
    - Allow rollback if needed

12. **Show Diff Summary**
    Display what was updated:
    ```
    📝 CLAUDE.md Updated:
    
    + Added 5 recent decisions
    + Updated 3 known issues
    + Refreshed project statistics
    + Added 2 new team conventions
    + Updated 8 task insights
    
    Sections modified: 6
    Lines changed: +47, -23
    ```

13. **Commit Changes**
    Create commit:
    ```
    git add .claude/CLAUDE.md
    git commit -m "Sync Claude memory with project state
    
    - Updated task statistics: 45/156 complete
    - Added recent architectural decisions
    - Refreshed known issues and conventions
    - Captured lessons learned from Sprint 3"
    ```

14. **Set Reminder**
    Suggest regular sync schedule:
    "Memory sync complete! 
    💡 Tip: Run this weekly or after major milestones.
    Next suggested sync: [date + 7 days]"

This keeps Claude's context fresh and relevant for better assistance.