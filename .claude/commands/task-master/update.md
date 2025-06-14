Update task #$ARGUMENTS with new information or modifications.

Parse the arguments to determine task ID and update instructions:
- First number is the task ID
- Rest is the update instruction

1. **Parse Arguments**
   - Extract task ID from $ARGUMENTS
   - Extract update instructions
   - If format unclear, ask for clarification

2. **Validate Task**
   - Verify task exists
   - Show current task state
   - Confirm task is modifiable (not archived)

3. **Interpret Update Request**
   Understand what needs updating:
   - Title change: "rename to..."
   - Description update: "description should..."
   - Priority change: "set priority to..."
   - Dependency changes: "depends on..." or "remove dependency..."
   - Details clarification: "add details about..."
   - Test strategy: "test by..." or "testing should..."

4. **Show Current vs Proposed**
   Display a diff-like view:
   ```
   Task #[ID] Update Preview:
   ==========================
   
   Title:
   - Current: [Old Title]
   + Proposed: [New Title]
   
   Priority:
   - Current: medium
   + Proposed: high
   
   Description:
   [Show changes with +/- indicators]
   ```

5. **Run Update Command**
   - Use `task-master update-task -i [ID] -p "[update instructions]"`
   - Preserve existing fields not mentioned in update
   - Maintain task ID and status

6. **Validate Changes**
   - Ensure dependencies are valid task IDs
   - Check for circular dependencies if deps changed
   - Verify priority is valid (high/medium/low)
   - Confirm task remains atomic (2-8 hours)

7. **Update Related Files**
   - Regenerate task-[ID].md file
   - Update any dependent task files
   - Refresh task documentation

8. **Handle Special Updates**
   
   **If updating dependencies:**
   - Validate all dependency IDs exist
   - Check for circular dependencies
   - Update dependency graph
   
   **If updating priority:**
   - Re-sort task list by new priority
   - Update next task recommendations
   
   **If updating to break down:**
   - Suggest using expand command instead

9. **Show Updated Task**
   Display the complete updated task:
   ```
   ✅ Task Updated Successfully!
   
   Task #[ID]: [New Title]
   Status: [Status] | Priority: [New Priority]
   
   Changes Applied:
   - [List of what changed]
   
   Updated Description:
   [Full new description]
   ```

10. **Commit Changes**
    - Stage tasks.json and task files
    - Commit: "Update task #[ID]: [summary of changes]"

Error handling:
- If no changes detected, inform user
- If update would break dependencies, show what would break
- If update makes task too large, suggest expansion instead