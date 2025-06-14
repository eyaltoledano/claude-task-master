Generate a daily standup report and prepare for the day's work.

Create a comprehensive standup update:

1. **Yesterday's Progress**
   - Check git commits from last 24 hours
   - List completed tasks (status changed to 'done')
   - Show tasks worked on (commits referencing task IDs)
   - Calculate story points or hours completed

2. **Today's Plan**
   - Show current in-progress tasks
   - Run `task-master next` for recommendations
   - Consider task dependencies and priorities
   - Estimate what can be completed today

3. **Blockers and Risks**
   - Identify blocked tasks
   - Check for missing dependencies
   - Note any technical blockers found
   - List tasks at risk of delay

4. **Generate Standup Format**
   
   **Slack/Discord Format:**
   ```
   🌅 Daily Standup - [Date]
   
   📅 Yesterday:
   ✅ Completed Task #5: Implement user authentication
   🔄 Progress on Task #7: API endpoints (75% complete)
   📝 Commits: 3 (feat: auth flow, test: auth tests, docs: API readme)
   
   🎯 Today:
   🔄 Complete Task #7: API endpoints (2 hrs remaining)
   ▶️  Start Task #9: Input validation (4 hrs estimated)
   📚 Update API documentation
   
   🚧 Blockers:
   ⚠️  Task #10 blocked by #8 (waiting on code review)
   ❓ Need clarification on Task #12 requirements
   
   💪 Confidence: High | ETA on track ✅
   ```
   
   **Jira/Formal Format:**
   ```
   Daily Status Update - [Date]
   ============================
   
   Completed (Yesterday):
   - TASK-5: Implement user authentication [DONE]
   - TASK-7: API endpoints [IN PROGRESS - 75%]
   
   Planned (Today):
   - TASK-7: Complete API endpoints (2h)
   - TASK-9: Begin input validation (4h)
   - DOC-1: Update API documentation (1h)
   
   Impediments:
   - TASK-10: Blocked pending TASK-8 review
   - TASK-12: Requirements clarification needed
   
   Metrics:
   - Velocity: 8 points completed
   - Sprint progress: 40% complete
   - On track: YES
   ```

5. **Sprint Progress Overview**
   If in a sprint, show:
   - Sprint day (e.g., Day 3 of 10)
   - Burndown status
   - Remaining capacity
   - Sprint goal progress

6. **Visual Progress Bar**
   ```
   Sprint Progress: ████████░░░░░░░ 53%
   Tasks: 8/15 complete
   Hours: 32/60 logged
   Days remaining: 7
   ```

7. **Prepare Workspace**
   - Ensure working directory is clean
   - Pull latest changes
   - Run tests to ensure stable baseline
   - Open relevant task files

8. **Time Box Today's Work**
   Create a schedule:
   ```
   🕐 Today's Schedule:
   9:00-11:00  - Complete Task #7 (API endpoints)
   11:00-11:15 - Break
   11:15-1:00  - Start Task #9 (validation)
   1:00-2:00   - Lunch
   2:00-3:30   - Continue Task #9
   3:30-4:00   - Code review & documentation
   4:00-4:30   - Test runs & cleanup
   4:30-5:00   - Update task status & daily commit
   ```

9. **Risk Mitigation**
   For identified blockers:
   - Suggest alternative tasks if blocked
   - Identify who to contact for clarification
   - Propose workarounds

10. **Key Metrics**
    Show productivity metrics:
    - Average task completion time
    - Velocity trend
    - Quality metrics (test coverage, bugs)

11. **Action Items**
    Clear next steps:
    - [ ] Complete Task #7 by 11 AM
    - [ ] Start Task #9 implementation
    - [ ] Request review for Task #8
    - [ ] Update sprint board
    - [ ] End-of-day status update

12. **Start Work**
    Prompt: "Standup complete! Ready to start with Task #7? 
    Type 'yes' to begin implementation or 'show' to see task details."

Optional: Save standup to `standups/[date].md` for history.