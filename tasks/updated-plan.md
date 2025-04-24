# Simplified Implementation Plan for .taskmaster/ Directory Structure

Based on examining the codebase, I've developed a simplified but accurate implementation plan that focuses on the specific code areas that need to be modified.

## Key Areas Requiring Changes

1. **path-utils.js** - This is the central file that handles path resolution for all Task Master files.
   - Current implementation (in `/mcp-server/src/core/utils/path-utils.js`) handles resolving paths for task files, PRD documents, and other artifacts
   - Various functions like `findTasksJsonPath()`, `findPRDDocumentPath()`, and `resolveTasksOutputPath()` need to be updated

2. **init.js** - The initialization script that sets up a new project.
   - Currently creates directories like `scripts/` and `tasks/` directly in the project root
   - Needs to be updated to create a `.taskmaster/` directory with these subdirectories

3. **Task File Management Functions** - Various functions in `task-manager.js` that read, write, and generate task files.
   - These functions use paths derived from the path utilities

## Simplified Task List

### 1. Update Path Utilities
- Add a `TASKMASTER_BASE_PATH = '.taskmaster/'` constant to path-utils.js
- Modify path resolution functions to prepend this base path to all file paths:
  - Update `findTasksJsonPath()` to look in `.taskmaster/tasks/tasks.json`
  - Update `findPRDDocumentPath()` to look in `.taskmaster/scripts/` 
  - Update `resolveTasksOutputPath()` to use `.taskmaster/tasks/tasks.json`

### 2. Update Initialization Logic
- Modify `createProjectStructure()` in init.js to create the `.taskmaster/` directory first
- Update directory creation to create:
  - `.taskmaster/scripts/`
  - `.taskmaster/tasks/`
- Use the new path structure when copying template files

### 3. Add Detection for Existing Projects
- Add logic in key commands to detect if a project is using the old directory structure
- Display a clear message about the new structure and suggest manual migration
- Provide clear error messages when files aren't found in the new structure

### 4. Update Documentation
- Update README and other documentation to reflect the new directory structure
- Create a simple migration guide explaining how to move files from old to new structure

### 5. Create Basic Tests
- Create simple tests to verify that paths resolve correctly with the new structure
- Test initialization creates the proper directory structure
- Test error handling when files aren't found

This simplified approach addresses the core requirements while minimizing changes to the codebase. The key is to modify the path resolution functions to use the `.taskmaster/` prefix, and ensure the initialization process creates the proper directory structure.
