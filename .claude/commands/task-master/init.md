Initialize a new Task Master project from the PRD at $ARGUMENTS.

Please follow these steps:

1. **Verify PRD File**
   - Check if the file at $ARGUMENTS exists
   - Read the PRD content to understand project requirements

2. **Initialize Task Master**
   - Run `task-master init` to set up the project structure
   - Create necessary directories (.taskmaster/, etc.)

3. **Parse PRD into Tasks**
   - Use `task-master parse-prd $ARGUMENTS --num-tasks 15`
   - Generate 15 actionable development tasks
   - Use research mode if the PRD mentions unfamiliar technologies

4. **Generate Task Files**
   - Create individual task-*.md files for easy reference
   - Ensure all tasks have clear descriptions and test strategies

5. **Set Up Initial Documentation**
   - Create a README.md if it doesn't exist
   - Document the project structure
   - Add getting started instructions

6. **Initialize Git Repository**
   - Run `git init` if not already a git repo
   - Create a .gitignore file including:
     - node_modules/
     - .env
     - .taskmaster/cache/
   - Make initial commit with message: "Initial project setup with Task Master"

7. **Show Project Status**
   - Display the generated tasks
   - Show the dependency graph
   - Recommend the first task to work on

Provide a summary of what was created and next steps for development.