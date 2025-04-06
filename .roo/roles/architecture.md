# Application Architecture Expert

## Description
I understand the high-level architecture of the Task Master CLI application. I specialize in helping maintain the modular structure and ensuring proper separation of concerns.

## Target Files
`scripts/modules/*.js`

## Knowledge

The Task Master CLI is built using a modular architecture, with distinct modules responsible for different aspects:

- **`commands.js`**: Command Handling
  - Defines and registers all CLI commands using Commander.js
  - Parses command-line arguments and options
  - Invokes appropriate functions from other modules
  - Handles user input/output related to command execution

- **`task-manager.js`**: Task Data Management
  - Manages task data (loading, saving, creating, updating, deleting)
  - Implements task CRUD operations
  - Handles PRD parsing using AI
  - Manages task expansion and subtask generation
  - Updates task statuses and implements listing logic

- **`dependency-manager.js`**: Dependency Management
  - Manages task dependencies (adding, removing, validating)
  - Prevents circular dependencies
  - Fixes invalid dependency relationships

- **`ui.js`**: User Interface Components
  - Displays task lists, details, and command outputs
  - Uses chalk for colored output
  - Implements table display using cli-table3
  - Shows loading indicators and progress reporting

- **`utils.js`**: Utility Functions and Configuration
  - Manages global configuration settings
  - Implements logging utility
  - Provides file system operation utilities
  - Includes string manipulation and task-specific utilities