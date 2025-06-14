Automatically implement the next available task with full AI assistance.

This workflow will:
1. Select the next task
2. Implement it following best practices
3. Write tests
4. Complete the task

Execute this comprehensive workflow:

1. **Select Next Task**
   - Run `/project:task-master:next`
   - Confirm task selection
   - Set status to in-progress

2. **Understand Requirements**
   - Analyze task description and details
   - Review test strategy
   - Check acceptance criteria
   - Study any dependent task implementations

3. **Plan Implementation**
   - Break down into implementation steps
   - Identify files to create/modify
   - Plan test cases
   - Consider edge cases

4. **Implement Core Functionality**
   - Create/modify necessary files
   - Follow project conventions and patterns
   - Use appropriate design patterns
   - Add comprehensive error handling

5. **Write Tests**
   Based on test strategy:
   - Unit tests for new functions
   - Integration tests for features
   - Update existing tests if needed
   - Aim for >80% coverage

6. **Code Quality Checks**
   - Run linter: `npm run lint` (fix any issues)
   - Type checking: `npm run typecheck` (if applicable)
   - Format code: `npm run format` (if available)
   - Remove debug code and console.logs

7. **Test Execution**
   - Run all tests: `npm test`
   - Fix any failing tests
   - Verify new tests pass
   - Check coverage report

8. **Documentation**
   - Add JSDoc comments for new functions
   - Update README if adding features
   - Create usage examples
   - Document any configuration changes

9. **Review Implementation**
   - Self-review the changes
   - Ensure task requirements are met
   - Verify code follows best practices
   - Check for security issues

10. **Complete Task**
    - Run `/project:task-master:complete [task-id]`
    - Create descriptive commit
    - Update task status

11. **Prepare for Next**
    Ask: "Task #[ID] has been implemented successfully! Would you like to:
    1. Review the implementation
    2. Start the next task automatically
    3. Check project status"

Error Handling:
- If tests fail, debug and fix
- If implementation blocked, document blockers
- If requirements unclear, mark task for review

Quality Gates:
- ✅ All tests passing
- ✅ No linting errors
- ✅ Documentation updated
- ✅ Task requirements met

Note: This workflow maintains high code quality while maximizing development speed.