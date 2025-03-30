# CRCT + Task Master Integration Plan

## 1. Objective

To define a plan for creating a new Cline prompt and associated mode that effectively integrates the **Cline Recursive Chain-of-Thought (CRCT)** system with the **Task Master** CLI tool. The goal is a synergistic system where Task Master provides initial task structuring and manipulation tools, while CRCT orchestrates the overall project execution, context management, and unified dependency tracking within Cline.

## 2. System Overviews

### 2.1. Task Master

-   **Purpose:** A CLI tool designed to break down a Product Requirements Document (PRD) into a structured, sequential list of development tasks stored in `tasks.json`.
-   **Key Features:**
    -   Parses PRD text files (`task-master parse-prd`).
    -   Manages tasks with titles, descriptions, statuses, priorities, and dependencies within `tasks.json`.
    -   Provides CLI commands for task manipulation (`list`, `next`, `show`, `expand`, `update`, `set-status`, `add-dependency`, etc.).
    -   Aimed at providing clear, sequential steps for an AI agent (like Cline) to follow.
-   **Primary Artifacts:** `prd.txt` (input), `tasks.json` (output/state).

### 2.2. CRCT (Cline Recursive Chain-of-Thought System)

-   **Purpose:** A framework for managing context, dependencies, and tasks within large-scale Cline projects, designed for persistence and efficiency in VS Code.
-   **Key Features:**
    -   Recursive decomposition of work.
    -   Persistent state management using the file system (`cline_docs/`).
    -   Phase-based workflow (Setup, Strategy, Execution) controlled by `.clinerules`.
    -   Modular dependency tracking for code and documentation (`dependency_tracker.md`, `doc_tracker.md`, mini-trackers).
    -   Mandatory Update Protocol (MUP) to keep state consistent.
    -   Emphasizes Chain-of-Thought (CoT) reasoning.
-   **Primary Artifacts:** `CRCT/cline_docs/` directory, `CRCT/.clinerules`, dependency tracker files.

## 3. Integration Strategy & Workflow

The integration aims for a tight coupling where CRCT acts as the central orchestrator, leveraging Task Master as a specialized toolset.

1.  **Initialization:**
    *   The user provides a `prd.txt` file at the project root.
    *   The workflow begins by invoking `task-master parse-prd prd.txt` to generate the initial `tasks.json` file, also at the project root. This file represents the high-level project plan derived from the PRD.

2.  **CRCT Orchestration:**
    *   CRCT takes over project management.
    *   It loads its operational context from `CRCT/cline_docs/` and `.clinerules`.
    *   Crucially, it also reads and incorporates the state from `tasks.json` into its understanding of the project plan and status.

3.  **Phase Management:**
    *   CRCT operates according to its defined phases (Setup/Maintenance, Strategy, Execution).
    *   The progression through these phases is guided not only by `.clinerules` and internal state but also by the status and dependencies defined in `tasks.json`. For example, the Strategy phase might involve analyzing `tasks.json` to plan the next steps, while the Execution phase focuses on implementing tasks identified as ready via `task-master next`.

4.  **Decision Making & Task Selection:**
    *   CRCT analyzes the overall project state by combining information from its internal context (`cline_docs/`), its dependency trackers, and the task list (`tasks.json`).
    *   It uses Task Master commands like `task-master list --status=pending` and `task-master next` to identify candidate tasks.
    *   It cross-references task dependencies (from `tasks.json`) with code/doc dependencies (from CRCT trackers) to determine the true readiness of a task.

5.  **Strategic Tool Usage (Task Master CLI):**
    *   CRCT autonomously decides *when* to use specific `task-master` commands as part of its workflow, based on its analysis. Examples:
        *   **Complexity:** If CRCT's analysis (or `task-master analyze-complexity`) identifies a task in `tasks.json` as too complex, it might invoke `task-master expand --id=<id>` to break it down.
        *   **Implementation Drift:** If the execution of a task leads to changes affecting future plans, CRCT might use `task-master update --from=<id> --prompt="<context>"`.
        *   **Completion:** Upon successful implementation and verification of a task, CRCT uses `task-master set-status --id=<id> --status=done` to update `tasks.json`.
        *   **Adding Tasks:** If new requirements emerge, CRCT might use `task-master add-task --prompt="..."`.

6.  **State Management (MUP):**
    *   CRCT maintains consistency across all state artifacts using its Mandatory Update Protocol.
    *   This means updates to `tasks.json` (via `task-master` commands) must be reflected in relevant `cline_docs/` files (e.g., `progress.md`, `activeContext.md`) and vice-versa. Changes in code that affect task feasibility might trigger updates to `tasks.json` via CRCT.

7.  **Unified Dependency Management:**
    *   CRCT's dependency tracking system is extended to be aware of and manage dependencies defined within `tasks.json`.
    *   When analyzing readiness or impact, CRCT considers the interplay between code dependencies (e.g., function A depends on library B) and task dependencies (e.g., task 5 depends on task 3).

## 4. Key Artifacts and Locations

-   `prd.txt`: **Project Root**. Input PRD file.
-   `tasks.json`: **Project Root**. Task list generated and managed by Task Master, used by CRCT.
-   `CRCT/`: **Project Root**. Directory containing all CRCT-specific files.
    -   `CRCT/.clinerules`: Controls CRCT phases.
    -   `CRCT/cline_docs/`: Contains CRCT operational memory files (context, progress, logs, etc.) and dependency trackers.
    -   `CRCT/cline_utils/`: Utility scripts for CRCT.
    -   `CRCT/src/`: Default location for project source code managed by CRCT.
    -   `CRCT/docs/`: Default location for project documentation managed by CRCT.

## 5. Workflow Visualization (Mermaid)

```mermaid
graph TD
    A[Start: User provides PRD (prd.txt @ root)] --> B{task-master parse-prd};
    B --> C[tasks.json @ root created/updated];
    C --> D{CRCT Initialization/Update};
    D --> E[CRCT reads .clinerules, cline_docs/*, tasks.json];
    E --> F{CRCT Strategy Phase};
    F -- Analyze tasks & dependencies (code/doc/task) --> G{Identify Next Task/Action};
    G -- Task needs expansion? --> H{task-master expand};
    G -- Implementation drift? --> I{task-master update};
    G -- Ready for execution --> J{CRCT Execution Phase};
    H --> K[Update tasks.json];
    I --> K;
    J -- Implement task --> L[Code/Doc Changes in CRCT/src, CRCT/docs];
    L --> M{Update CRCT Dependency Trackers (code/doc)};
    M --> N{task-master set-status --status=done};
    N --> K;
    K --> E;

    subgraph CRCT Management
        direction LR
        D
        E
        F
        G
        J
        M
    end

    subgraph Task Master Tools
        direction LR
        B
        H
        I
        N
    end

    subgraph Key Artifacts (@ root)
        direction TB
        A
        C
        K[tasks.json]
    end
```

## 6. Proposed Prompt Structure Outline

The final Cline prompt should incorporate these elements:

-   **Role:** Define AI as an advanced project manager using the integrated CRCT+Task Master framework.
-   **System Overview:** Briefly explain CRCT and Task Master concepts.
-   **Integrated Workflow:** Detail the steps outlined in Section 3 above.
-   **Key Artifacts:** List artifacts and their locations as per Section 4.
-   **Unified Dependency Management:** Explicitly state CRCT tracks code, doc, *and* task dependencies from `tasks.json`.
-   **AI-Driven Tool Use:** Emphasize `task-master` commands are tools for the AI to use strategically.
-   **Reasoning:** Mandate Chain-of-Thought (CoT) for all decisions.