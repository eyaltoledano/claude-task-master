Parse the Product Requirements Document at $ARGUMENTS to generate implementation tasks.

Execute comprehensive PRD analysis and task generation:

1. **Validate PRD File**
   - Check if file exists at $ARGUMENTS
   - Verify file is readable
   - Detect file format (md, txt, pdf, docx)
   - Load content appropriately

2. **Analyze PRD Content**
   Read and understand:
   - Project goals and objectives
   - Functional requirements
   - Non-functional requirements
   - Technical constraints
   - Success criteria
   - Timeline/milestones

3. **Determine Task Count**
   Estimate based on PRD scope:
   - Small feature: 8-12 tasks
   - Medium feature: 15-20 tasks
   - Large project: 25-30 tasks
   - Or parse from PRD if specified

4. **Choose AI Mode**
   Select based on content:
   - If mentions cutting-edge tech → Research mode
   - If standard implementation → Normal mode
   - If architecture heavy → Research mode
   ```
   Detected: [Technology mentions]
   Using: Research mode for better recommendations
   ```

5. **Generate Tasks**
   Execute task generation:
   ```bash
   task-master parse-prd "$ARGUMENTS" \
     --num-tasks 15 \
     --output tasks.json \
     --research  # if needed
   ```

6. **Validate Generated Tasks**
   Check task quality:
   - Each task is atomic (2-8 hours)
   - Clear, actionable titles
   - Comprehensive descriptions
   - Logical dependencies
   - Complete coverage of PRD

7. **Task Categories**
   Ensure balanced task distribution:
   ```
   📊 Task Distribution:
   - Core Features: 8 tasks (53%)
   - Testing: 3 tasks (20%)
   - Documentation: 2 tasks (13%)
   - DevOps/Deploy: 1 task (7%)
   - Performance: 1 task (7%)
   ```

8. **Dependency Analysis**
   Validate dependency graph:
   - No circular dependencies
   - Logical progression
   - Parallel work possible
   - Critical path identified

9. **Generate Task Files**
   Create individual task documentation:
   ```bash
   task-master generate
   ```
   Creates task-1.md through task-N.md

10. **Create Implementation Roadmap**
    Generate PROJECT-ROADMAP.md:
    ```markdown
    # Implementation Roadmap
    
    ## Phase 1: Foundation (Tasks 1-5)
    - Set up project structure
    - Implement core models
    - Create basic API
    
    ## Phase 2: Features (Tasks 6-12)
    - User authentication
    - Main functionality
    - Data validation
    
    ## Phase 3: Polish (Tasks 13-15)
    - Testing suite
    - Documentation
    - Deployment setup
    
    Critical Path: 1 → 3 → 6 → 10 → 15
    Estimated Duration: 3-4 weeks
    ```

11. **Show Summary**
    Display results:
    ```
    ✅ PRD Parsed Successfully!
    
    Project: [Extracted project name]
    Tasks Generated: 15
    
    Priority Breakdown:
    🔴 High: 5 tasks
    🟡 Medium: 7 tasks
    🟢 Low: 3 tasks
    
    Complexity:
    - Average: 42/100
    - Most Complex: Task #8 (78/100)
    - Simplest: Task #13 (18/100)
    
    Ready to Start: Task #1, #2, #4 (no dependencies)
    
    Next Steps:
    1. Review tasks: /project:task-master:list
    2. Start first task: /project:task-master:next
    3. View roadmap: cat PROJECT-ROADMAP.md
    ```

12. **Initial Commit**
    Create project inception commit:
    ```bash
    git add tasks.json task-*.md PROJECT-ROADMAP.md
    git commit -m "Initialize project from PRD
    
    - Generated 15 implementation tasks
    - Created dependency graph
    - Set up implementation roadmap
    
    Source: $ARGUMENTS"
    ```

13. **Validation Checklist**
    Confirm PRD coverage:
    ```
    ✓ All functional requirements mapped to tasks
    ✓ Non-functional requirements addressed
    ✓ Test tasks included
    ✓ Documentation tasks created
    ✓ Deployment considered
    ```

14. **Project Setup**
    If this is project initialization:
    - Create README.md with project overview
    - Set up .gitignore
    - Initialize package.json (if applicable)
    - Create folder structure

This command transforms requirements into actionable development tasks.