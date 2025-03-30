# CRCT Integration Plan - Detailed

## Goal
Complete the integration of CRCT features into the Task Master project, focusing on enhanced context management and dependency tracking.

## 1. Implement Auto-save Context (`activeContext.md`)
*   **Goal:** Automatically log significant task operations to `cline_docs/activeContext.md`.
*   **Action:** Modify key functions in `scripts/modules/task-manager.js` and command handlers (e.g., `setTaskStatus`, `addTask`, `updateTask`, `expandTask`) to append timestamped log entries detailing the action performed (e.g., "Task 5 status set to 'done'", "Task 8 expanded").

## 2. Implement Git Version History
*   **Goal:** Automatically commit changes to `tasks.json` and `cline_docs/` after key operations to provide a basic version history.
*   **Action:** In the functions identified in step 1 (and potentially `parsePrd`, `handleContextCommand` edit), add logic to execute `git add tasks.json cline_docs/*` and `git commit -m "TaskMaster: [Action] - Task [ID] [Details]"` using Node.js `child_process`. Include error handling for cases where the project isn't a Git repository.

## 3. Implement Cross-task References
*   **Goal:** Allow tasks in `tasks.json` to reference other related tasks.
*   **Action:**
    *   Update the `Task` structure/interface to include an optional `relatedTasks: number[]` field.
    *   Update the `addTask` command/function to accept and store related task IDs (e.g., via a `--related <ids>` option).
    *   Update the `show` command/function to display these related tasks.
    *   (Optional) Update the `update` command/function to allow modifying related tasks.

## 4. Test Existing CRCT Features
*   **Goal:** Ensure the already integrated CRCT commands (`phase`, `context`, `deps`) are robust.
*   **Action:** Write new integration tests in `tests/integration/cli/` covering:
    *   `task-master phase get/set` (valid/invalid phases).
    *   `task-master context view/edit` (default file, basic edit simulation).
    *   `task-master deps validate` (valid/invalid dependencies in `tasks.json`).
    *   `task-master deps visualize` (check for valid Mermaid output).

## 5. Update Documentation
*   **Goal:** Reflect the completed integration in project documentation.
*   **Action:**
    *   Update `README.md` section on CRCT integration.
    *   Update `crct-integration-plan.md` to mark implemented features.

## Workflow Diagram
```mermaid
graph TD
    A[Start Integration Completion] --> B[Implement Auto-save Context];
    B --> C[Implement Git Version History];
    C --> D[Implement Cross-task References];
    D --> E[Test Existing CRCT Commands];
    E --> F[Update Documentation];
    F --> G[End Integration];

    subgraph AutoSave [Implement Auto-save Context]
        direction LR
        AS1[Identify state-changing functions] --> AS2[Modify functions to append to activeContext.md]
    end

    subgraph GitHistory [Implement Git Version History]
        direction LR
        GH1[Identify key functions] --> GH2[Add git add/commit logic] --> GH3[Add error handling]
    end

    subgraph CrossTaskRef [Implement Cross-task References]
        direction LR
        CTR1[Update Task interface] --> CTR2[Update add-task command] --> CTR3[Update show-task command]
    end

    subgraph Testing [Test Existing CRCT Commands]
        direction LR
        T1[Review command implementations] --> T2[Write integration tests]
    end

    subgraph Docs [Update Documentation]
        direction LR
        D1[Update README.md] --> D2[Update crct-integration-plan.md]
    end