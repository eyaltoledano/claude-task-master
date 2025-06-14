Create a sprint plan based on available tasks and project velocity.

Generate an intelligent sprint plan considering dependencies, complexity, and team capacity:

1. **Analyze Current State**
   - Get all pending tasks with `task-master list -s pending`
   - Load complexity report if available
   - Check for in-progress tasks
   - Calculate available capacity

2. **Determine Sprint Capacity**
   - If historical data exists, calculate average velocity
   - Otherwise, estimate based on:
     - Sprint length: $ARGUMENTS (default: 2 weeks)
     - Developer hours/day: 6 productive hours
     - Total capacity: days × hours

3. **Identify Task Candidates**
   - Tasks with all dependencies met
   - Tasks on the critical path (priority)
   - Mix of complexity levels
   - Consider task priorities

4. **Apply Selection Algorithm**
   ```
   Selection Criteria:
   1. Critical path tasks (must do)
   2. High priority with met dependencies
   3. Medium priority, low complexity (quick wins)
   4. Remaining capacity: medium priority, medium complexity
   5. Buffer: 20% capacity for unknowns
   ```

5. **Generate Sprint Backlog**
   Create optimal task selection:
   ```
   🚀 Sprint Plan (2 weeks)
   ========================
   
   Week 1:
   -------
   Monday-Tuesday:
   - Task #3: Implement user authentication (8 hrs) [HIGH]
   
   Wednesday-Thursday:
   - Task #5: Create API endpoints (6 hrs) [HIGH]
   - Task #7: Add input validation (2 hrs) [MEDIUM]
   
   Friday:
   - Task #8: Write integration tests (4 hrs) [MEDIUM]
   - Buffer/Review time
   
   Week 2:
   -------
   Monday-Tuesday:
   - Task #10: Implement caching layer (8 hrs) [MEDIUM]
   
   Wednesday-Thursday:
   - Task #12: Add error handling (4 hrs) [HIGH]
   - Task #14: Update documentation (3 hrs) [LOW]
   
   Friday:
   - Task #15: Performance optimization (4 hrs) [MEDIUM]
   - Sprint review prep
   
   Total: 43 hours / 60 hours capacity (72%)
   Buffer: 17 hours (28%)
   ```

6. **Dependency Validation**
   - Verify all selected tasks can be started
   - Check for blocking dependencies
   - Ensure logical task order

7. **Risk Assessment**
   Identify and document risks:
   - High complexity tasks without buffer
   - External dependencies
   - Tasks requiring specific expertise
   - Potential blockers

8. **Create Sprint Board**
   Generate a visual board:
   ```
   📋 Sprint Board
   ===============
   
   To Do (7)          In Progress (0)    Done (0)
   ---------          ---------------    --------
   #3  [Auth]    →                   →
   #5  [API]     →                   →
   #7  [Valid]   →                   →
   #8  [Tests]   →                   →
   #10 [Cache]   →                   →
   #12 [Errors]  →                   →
   #14 [Docs]    →                   →
   
   Sprint Goals:
   ✓ Complete authentication flow
   ✓ Establish API foundation
   ✓ Improve error handling
   ```

9. **Generate Sprint Document**
   Create SPRINT-[date].md with:
   - Sprint goals
   - Selected tasks with details
   - Daily breakdown
   - Risk mitigation plan
   - Success criteria

10. **Update Task States**
    - Add sprint tags to selected tasks
    - Set sprint milestone (if using)
    - Create sprint branch (if using git flow)

11. **Communication Prep**
    Generate sprint kickoff materials:
    - Sprint goals summary
    - Task assignments (if team)
    - Key dependencies
    - Definition of done

12. **Tracking Setup**
    Prepare for sprint tracking:
    - Daily task checklist
    - Burndown chart data
    - Velocity tracking

Output sprint plan and ask:
"Sprint plan created! Would you like to:
1. Start the first sprint task
2. Adjust the sprint scope
3. Generate sprint kickoff notes"