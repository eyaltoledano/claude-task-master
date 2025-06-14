Generate or view task complexity analysis report.

Analyze task complexity and provide actionable insights:

1. **Check for Existing Report**
   - Look for recent complexity report in `.taskmaster/reports/`
   - If recent (< 7 days), ask to use or regenerate
   - Show last analysis date

2. **Run Complexity Analysis**
   ```
   🔍 Analyzing task complexity...
   ```
   Execute: `task-master analyze-complexity -o .taskmaster/reports/complexity-[date].json`

3. **Parse Analysis Results**
   Extract key metrics:
   - Average complexity score
   - Complexity distribution
   - High-risk tasks
   - Critical path identification
   - Total estimated hours

4. **Generate Visual Report**
   ```
   📊 Task Complexity Analysis
   ===========================
   
   Complexity Distribution:
   🟢 Simple (1-33):    45 tasks ████████████ 35%
   🟡 Moderate (34-66): 62 tasks ████████████████ 48%
   🔴 Complex (67-100): 22 tasks ██████ 17%
   
   Statistics:
   - Average Complexity: 46.7/100
   - Total Tasks: 129
   - Estimated Hours: 486
   - Critical Path: 12 tasks
   
   Top 5 Most Complex Tasks:
   1. #45: Implement distributed caching (Score: 92)
   2. #67: Refactor authentication system (Score: 89)
   3. #23: Database migration framework (Score: 87)
   4. #78: Real-time sync engine (Score: 85)
   5. #34: Performance optimization (Score: 84)
   ```

5. **Risk Analysis**
   Identify high-risk areas:
   ```
   ⚠️ Risk Areas Identified:
   
   1. Database Layer (5 complex tasks)
      - Consider breaking down migrations
      - Add integration test tasks
   
   2. Authentication (3 complex tasks)
      - High security risk
      - Suggest security review task
   
   3. Performance (4 complex tasks)
      - Interconnected optimizations
      - Need benchmarking tasks
   ```

6. **Recommendations**
   Based on analysis, suggest:
   ```
   💡 Recommendations:
   
   1. Break Down Complex Tasks:
      - Task #45 → 4-5 subtasks (caching strategies)
      - Task #67 → 3-4 subtasks (auth components)
      
   2. Reorder Dependencies:
      - Move Task #23 earlier (blocks 8 tasks)
      - Parallelize Tasks #34 and #78
   
   3. Add Missing Tasks:
      - Security audit for auth changes
      - Performance benchmarking suite
      - Integration tests for cache layer
   
   4. Resource Allocation:
      - Assign senior devs to tasks > 80 complexity
      - Pair programming for critical path tasks
   ```

7. **Sprint Impact Analysis**
   Show how complexity affects planning:
   ```
   📅 Sprint Planning Insights:
   
   - High complexity tasks need 20% buffer
   - Don't schedule > 2 complex tasks per sprint
   - Critical path requires 3 sprints minimum
   - Quick wins: 15 simple tasks (< 2 days total)
   ```

8. **Complexity Trends**
   If historical data exists:
   ```
   📈 Complexity Trends:
   
   Sprint 1: Avg 38 → Actual time: +15%
   Sprint 2: Avg 45 → Actual time: +22%
   Sprint 3: Avg 51 → Actual time: +28%
   
   Observation: Estimates improving but still optimistic
   Suggestion: Add 25% buffer for complex tasks
   ```

9. **Export Options**
   Offer different formats:
   - Markdown report for documentation
   - CSV for spreadsheet analysis
   - JSON for programmatic use
   - Mermaid diagram for visualization

10. **Actionable Next Steps**
    ```
    🎯 Suggested Actions:
    
    1. Break down top 3 complex tasks
       Command: /project:task-master:expand 45
    
    2. Review critical path
       Command: /project:task-master:show-critical-path
    
    3. Plan next sprint with complexity weights
       Command: /project:workflows:sprint-plan weighted
    
    4. Add recommended tasks
       Command: /project:task-master:add "Security audit for authentication"
    ```

11. **Save Analysis**
    Store insights:
    - Save report to `.taskmaster/reports/analysis-[date].md`
    - Update CLAUDE.md with key findings
    - Create commit: "Add complexity analysis report"

12. **Monitor Thresholds**
    Set up alerts:
    ```
    ⚡ Threshold Alerts:
    - Average complexity > 60: Consider task breakdown
    - Critical path > 15 tasks: Risk of delays
    - Complex tasks > 25%: Team may struggle
    ```

This analysis helps make informed decisions about task planning and resource allocation.