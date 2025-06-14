Perform a comprehensive health check of the Task Master project.

Run diagnostics to ensure everything is properly configured:

1. **Task Master Installation**
   ```
   ✓ Checking Task Master installation...
   ```
   - Verify `task-master` command is available
   - Check version with `task-master --version`
   - Ensure all dependencies installed
   - Verify MCP server exists

2. **Project Structure**
   ```
   ✓ Validating project structure...
   ```
   Check for required files/directories:
   - [ ] tasks.json exists
   - [ ] .taskmaster/ directory exists
   - [ ] .taskmaster/config.json exists
   - [ ] .claude/ directory properly set up
   - [ ] .gitignore includes necessary entries

3. **Task Data Integrity**
   ```
   ✓ Checking task data...
   ```
   - Validate tasks.json format
   - Check for duplicate task IDs
   - Verify ID sequence integrity
   - Ensure all required fields present

4. **Dependency Health**
   ```
   ✓ Validating dependencies...
   ```
   - Run `task-master validate-dependencies`
   - Check for circular dependencies
   - Verify all referenced tasks exist
   - Calculate maximum dependency depth

5. **Git Integration**
   ```
   ✓ Checking version control...
   ```
   - Verify git repository initialized
   - Check for uncommitted changes
   - Ensure .gitignore properly configured
   - Show current branch

6. **AI Provider Configuration**
   ```
   ✓ Checking AI providers...
   ```
   - Verify at least one API key configured
   - Test main provider connectivity
   - Check fallback provider
   - Validate model availability

7. **Test Infrastructure**
   ```
   ✓ Checking test setup...
   ```
   - Look for test command in package.json
   - Check test framework installation
   - Verify test file patterns
   - Run quick test suite

8. **Code Quality Tools**
   ```
   ✓ Checking linting/formatting...
   ```
   - Check for ESLint configuration
   - Verify Prettier setup (if applicable)
   - Look for pre-commit hooks
   - Test linter execution

9. **Performance Metrics**
   ```
   ✓ Analyzing performance...
   ```
   - Count total tasks
   - Calculate average task complexity
   - Measure tasks.json file size
   - Check for performance bottlenecks

10. **Generate Health Report**
    ```
    🏥 Task Master Health Report
    ============================
    
    Core Systems:
    ✅ Task Master CLI:      v0.16.2
    ✅ Project Structure:    Valid
    ✅ Task Data:           156 tasks
    ✅ Dependencies:        No cycles
    ✅ Git Status:          Clean
    
    AI Configuration:
    ✅ Main Provider:       Claude (active)
    ⚠️  Research Provider:   Perplexity (no key)
    ✅ Fallback Provider:   GPT-4 (configured)
    
    Code Quality:
    ✅ Tests:               86% coverage
    ✅ Linting:            ESLint configured
    ⚠️  Pre-commit:         Not installed
    
    Performance:
    📊 Total Tasks:         156
    📊 Completed:          45 (29%)
    📊 Complexity Avg:      42/100
    📊 Max Dep Depth:      5 levels
    
    Issues Found: 2
    ----------------
    1. Research provider not configured
       Fix: Set PERPLEXITY_API_KEY in .env
    
    2. Pre-commit hooks not installed
       Fix: npm install husky --save-dev
    
    Overall Health: 🟢 Good (90%)
    ```

11. **Maintenance Suggestions**
    Based on findings, suggest:
    - Archive completed tasks if > 100
    - Regenerate task files if out of sync
    - Update dependencies if outdated
    - Run complexity analysis if not recent

12. **Quick Fixes**
    Offer to fix common issues:
    ```
    🔧 Quick Fixes Available:
    
    1. Install pre-commit hooks? (y/n)
    2. Regenerate task files? (y/n)
    3. Archive completed tasks? (y/n)
    4. Update .gitignore? (y/n)
    ```

Save report to `.taskmaster/health-reports/[date].md` for tracking.