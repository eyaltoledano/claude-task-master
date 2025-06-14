Validate all task dependencies and identify issues.

Perform comprehensive dependency validation:

1. **Run Dependency Validation**
   - Execute `task-master validate-dependencies`
   - Capture all warnings and errors
   - Parse results for different issue types

2. **Check for Circular Dependencies**
   - Identify any circular dependency chains
   - Show the complete cycle path
   - Highlight which link to break

   Example output:
   ```
   ❌ Circular Dependency Detected:
   Task #3 → Task #5 → Task #7 → Task #3
   
   Suggested fix: Remove dependency of Task #7 on Task #3
   ```

3. **Find Missing Dependencies**
   - Tasks that reference non-existent task IDs
   - Show which tasks have invalid deps
   - Suggest corrections or removal

4. **Identify Blocked Task Chains**
   - Find tasks blocked by long chains
   - Calculate critical path
   - Show bottleneck tasks

   ```
   🚧 Blocked Task Analysis:
   
   Task #12 is blocked by:
   └─ #10 (pending)
      └─ #8 (pending)
         └─ #5 (in-progress)
   
   Unblocking #5 would free 3 downstream tasks
   ```

5. **Detect Orphaned Tasks**
   - Tasks with no dependencies and no dependents
   - Might indicate missing relationships
   - Suggest logical connections

6. **Analyze Dependency Depth**
   - Show tasks with excessive dependency depth
   - Recommend flattening where possible
   - Identify over-constrained tasks

7. **Generate Dependency Graph**
   Create a text visualization:
   ```
   📊 Dependency Graph:
   
   Layer 0 (No deps):     #1, #2, #4
            ↓              ↓
   Layer 1:           #3    #5    #6
                      ↓     ↓     ↓
   Layer 2:           #7    #8    #9
                       ↓         ↓
   Layer 3:            #10 ← ← ← #11
   ```

8. **Priority Conflicts**
   - High priority tasks depending on low priority
   - Suggest priority adjustments
   - Show impact of changes

9. **Fix Recommendations**
   For each issue found, provide:
   - Specific fix command
   - Impact of the fix
   - Alternative solutions

   ```
   🔧 Suggested Fixes:
   
   1. Remove circular dependency:
      task-master remove-dependency -i 7 -d 3
   
   2. Fix missing dependency:
      task-master update-task -i 12 -p "remove dependency on task 99"
   
   3. Add missing relationship:
      task-master add-dependency -i 15 -d 8
   ```

10. **Validation Report**
    Summary with health score:
    ```
    Dependency Health Report
    ========================
    ✅ Valid dependencies: 23
    ❌ Circular dependencies: 1
    ⚠️  Missing dependencies: 2
    📊 Maximum depth: 5 layers
    🎯 Critical path: 7 tasks
    
    Overall Health: 85% 🟡
    
    Run '/project:task-master:fix-deps' to auto-fix issues
    ```

11. **Export Options**
    - Save report to file
    - Generate Mermaid diagram code
    - Create GraphViz dot file