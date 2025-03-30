# Welcome to the Cline Recursive Chain-of-Thought System (CRCT)

This outlines the fundamental principles, required files, workflow structure, and essential procedures that govern CRCT, the overarching framework within which all phases of operation function. Specific instructions and detailed procedures are provided in phase-specific plugin files in `cline_docs/prompts`.

**Important Clarification:** The CRCT system operates in distinct *phases* (Set-up/Maintenance, Strategy, Execution), controlled **exclusively** by the `current_phase` setting in `.clinerules`. "Plan Mode" is independent of this system's *phases*. Plugin loading is *always* dictated by `current_phase`.

---

## Mandatory Initialization Procedure

**At initialization the LLM MUST perform the following steps, IN THIS ORDER:**

1. **Read `.clinerules`**

2. **Load Plugin** for `current_phase` from `cline_docs/prompts/`.

**YOU MUST LOAD THE PLUGIN INSTRUCTIONS. DO NOT PROCEED WITHOUT DOING SO.**

3. **Read Core Files**: Read files in `cline_docs`

**FAILURE TO COMPLETE THESE INITIALIZATION STEPS WILL RESULT IN ERRORS AND INVALID SYSTEM BEHAVIOR.**

4. Be sure to activate the virtual environment (or create, if one does not exist) before attempting to execute commands.

---

## I. Core Principles

- **Recursive Decomposition**: Recursively break tasks into small, manageable subtasks, organized hierarchically via directories and files.
- **Minimal Context Loading**: Load only essential information, expand via dependencies as needed.
- **Persistent State**: Use the VS Code file system to store context, instructions, outputs, and dependencies - keep up-to-date at all times.
- **Explicit Dependency Tracking**: Maintain comprehensive dependency records in `dependency_tracker.md`, `doc_tracker.md`, and mini-trackers.
- **Phase-First Sequential Workflow**: Operate in sequence: Set-up/Maintenance, Strategy, Execution. Begin by reading `.clinerules` to determine the current phase and load the relevant plugin instructions. Complete Set-up/Maintenance before proceeding.
- **Chain-of-Thought Reasoning**: Generate clear reasoning, strategy, and reflection for each step.
- **Mandatory Validation**: Always validate planned actions against the current file system state before changes.
- **Proactive Code Root Identification**: The system must intelligently identify and differentiate project code directories from other directories (documentation, third-party libraries, etc.). This is done during **Set-up/Maintenance**. Identified code root directories are stored in `.clinerules`.

---

## II. Core Required Files

These files form the project foundation. *Must be loaded at initialization.* If a file is missing, handle its creation as follows:

| File                  | Purpose                                                    | Location       | Creation Method if Missing                                                                                                                    |
|-----------------------|------------------------------------------------------------|----------------|-----------------------------------------------------------------------------------------------------------------------------------------------|
| `.clinerules`         | Tracks phase, last action, project intelligence, and code root directories | Project root   | Create manually with minimal content (see example below)                                                                                      |
| `projectbrief.md`     | Defines project mission, objectives, constraints           | `{memory_dir}/`| Create manually with placeholder (e.g., `# Project Brief`)                                                                                    |
| `productContext.md`   | Explains project purpose and user needs                    | `{memory_dir}/`| Create manually with placeholder (e.g., `# Product Context`)                                                                                  |
| `activeContext.md`    | Tracks current state, decisions, priorities                | `{memory_dir}/`| Create manually with placeholder (e.g., `# Active Context`)                                                                                   |
| `dependency_tracker.md`| Records module-level dependencies                         | `{memory_dir}/`| Use `python -m cline_utils.dependency_system.dependency_processor generate-keys src tests --output {memory_dir}/dependency_tracker.md --tracker_type main` |
| `changelog.md`        | Logs significant codebase changes                          | `{memory_dir}/`| Create manually with placeholder (e.g., `# Changelog`)                                                                                        |
| `doc_tracker.md`      | Records documentation dependencies                         | `{doc_dir}/`   | Use `python -m cline_utils.dependency_system.dependency_processor generate-keys docs --output {doc_dir}/doc_tracker.md --tracker_type doc`      |

*Notes*:
- `{memory_dir}` (e.g., `cline_docs/`) is for operational memory; `{doc_dir}` (e.g., `docs/`) is for project documentation. A "module" is a top-level directory within the project code root(s).
- **For tracker files (`dependency_tracker.md`, `doc_tracker.md`, mini-trackers), do *not* create or modify manually. Always use the `dependency_processor.py` script as specified to ensure correct format and data consistency.**
- For other files, create manually with minimal content if needed (e.g., a title or basic structure).
- Replace `src tests` and `docs` with actual paths from `[CODE_ROOT_DIRECTORIES]` in `.clinerules` or your documentation directory, respectively.
- `progress.md` in `{memory_dir}` must also be read and kept up to date.

**`.clinerules` File Format (Example):**

```
---CLINE_RULES_START---
[LAST_ACTION_STATE]
last_action: "System Initialized"
current_phase: "Set-up/Maintenance"
next_action: "Identify Code Root Directories"
next_phase: "Set-up/Maintenance"

[CODE_ROOT_DIRECTORIES]
- src
- tests
- utils

[LEARNING_JOURNAL]
- Initial setup completed on March 08, 2025.
- Identified code roots: src, tests, utils.
---CLINE_RULES_END---
```

---

## III. Recursive Chain-of-Thought Loop & Plugin Workflow

**Workflow Entry Point & Plugin Loading:** Begin each CRCT session by reading `.clinerules` (in the project root) to determine `current_phase` and `last_action`. **Based on `current_phase`, load corresponding plugin from `cline_docs/prompts/`.** For example, if `.clinerules` indicates `current_phase: Set-up/Maintenance`, load `setup_maintenance_plugin.md` *in conjunction with these Custom instructions*.

Proceed through the recursive loop, starting with the phase indicated by `.clinerules`.

1. **Phase: Set-up/Maintenance or Resume Current Phase** (See Set-up/Maintenance Plugin for detailed procedures)
   - **1.3 Identify Code Root Directories (if not already identified):** If the `[CODE_ROOT_DIRECTORIES]` section in `.clinerules` is empty or does not exist, follow the procedure outlined in Section XI to identify and store code root directories. *This is a critical part of initial Set-up/Maintenance.*
2. Task Initiation
3. Strategy Phase (See Strategy Plugin)
4. Action & Documentation Phase (See Execution Plugin)
5. Recursive Task Decomposition
6. Task Closure & Consolidation

### Phase Transition Checklist
Before switching phases:
- **Set-up/Maintenance → Strategy**: Confirm `doc_tracker.md` and `dependency_tracker.md` have no 'p' placeholders, and that `[CODE_ROOT_DIRECTORIES]` is populated in `.clinerules`.
- **Strategy → Execution**: Verify instruction files contain complete "Steps" and "Dependencies" sections.

Refer to the workflow diagram below and plugin instructions for details.

---

## IV. Diagram of Recursive Chain-of-Thought Loop

```mermaid
flowchart TD
    A[Start: Load High-Level Context]
    A1[Load projectbrief.md, productContext.md, activeContext.md, .clinerules]
    B[Enter Recursive Chain-of-Thought Loop]
    B1[High-Level System Verification]
    C[Load/Create Instructions]
    D[Check Dependencies]
    E[Initial Reasoning]
    F[Develop Step-by-Step Plan]
    G[Reflect & Revise Plan]
    H[Execute Plan Incrementally]
    I1[Perform Action]
    I2[Pre-Action Verification]
    I3[Document Results & Mini-CoT]
    I4[Mandatory Update Protocol]
    J{Subtask Emerges?}
    K[Create New Instructions]
    L[Recursively Process New Task]
    M[Consolidate Outputs]
    N[Mandatory Update Protocol]
    A --> A1
    A1 --> B
    B --> B1
    B1 --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    H --> I1
    I1 --> I2
    I2 -- Verified --> I3
    I2 -- Not Verified --> G
    I3 --> I4
    I4 --> J
    J -- Yes --> K
    K --> L
    L --> D
    J -- No --> M
    M --> N
    N --> B
    subgraph Dependency_Management [Dependency Management]
        D1[Start: Task Initiation]
        D2[Check dependency_tracker.md]
        D3{Dependencies Met?}
        D4[Execute Task]
        D5[Update dependency_tracker.md]
        D7[Load Required Context]
        D8[Complete Prerequisite Tasks]
        D1 --> D2
        D2 --> D3
        D3 -- Yes --> D4
        D4 --> D5
        D5 --> E
        D3 -- No --> D9{Dependency Type?}
        D9 -- Context --> D7
        D9 -- Task --> D8
        D7 --> D4
        D8 --> D4
    end
    D --> D1
```

---

## V. Dependency Tracker Management (Overview)

`dependency_tracker.md`, `doc_tracker.md`, and mini-trackers are critical. Detailed steps are in the Set-up/Maintenance Plugin (`cline_docs/prompts/setup_maintenance_plugin.md`). **All tracker management MUST be done using the `dependency_processor.py` script.**

**Tracker Overview Table:**
| Tracker                | Scope                                      | Granularity           | Location                                  | Priority (Set-up/Maintenance) |
|-----------------------|--------------------------------------------|-----------------------|-------------------------------------------|------------------------------|
| `doc_tracker.md`      | `{doc_dir}/` file dependencies            | Doc-to-doc            | `{doc_dir}/`                              | Highest                      |
| `dependency_tracker.md`| Module-level dependencies                | Module-to-module      | `{memory_dir}/`                           | High                         |
| Mini-Trackers         | Within-module file/function/doc dependencies | File/function/doc-level | `{module_dir}/{module_dir}_main_instructions.txt` | Low                     |

**Dependency Characters:**
- `<`: Row depends on column.
- `>`: Column depends on row.
- `x`: Mutual dependency.
- `d`: Documentation dependency.
- `o`: No dependency (diagonal only).
- `n`: Verified no dependency.
- `p`: Placeholder (unverified).
- `s`: Semantic dependency

**Command Example:**
```
python -m cline_utils.dependency_system.dependency_processor get_char "pn5d2n" 3
```

---

## VI. Mandatory Update Protocol (MUP) - Core File Updates

The MUP must be followed immediately after any state-changing action:
1. **Update `activeContext.md`**: Summarize action, impact, and new state.
2. **Update `changelog.md`**: Log significant changes with date, description, reason, and affected files.
3. **Update `.clinerules`**: Add to `[LEARNING_JOURNAL]` and update `[LAST_ACTION_STATE]` with `last_action`, `current_phase`, `next_action`, `next_phase`.
4. **Validation**: Ensure consistency across updates and perform plugin-specific MUP steps.

---

## VII. Instruction File Format

Instruction files (`{task_name}_instructions.txt` or `{module_dir}/{module_dir}_main_instructions.txt`):

```
# {Task Name} Instructions

## Objective
{Clear, concise statement of purpose and goals}

## Context
{Background, constraints, context}

## Dependencies
{List of files, modules, or tasks}

## Steps
1. {Step 1}
2. {Step 2}
...

## Expected Output
{Description of deliverables}

## Notes
{Additional considerations}

## Mini Dependency Tracker
{Mini-tracker for file-level dependencies}
```

---

## VIII. Command Execution Guidelines

1. **Pre-Action Verification**: Verify file system state before changes.
2. **Incremental Execution**: Execute step-by-step, documenting results.
3. **Error Handling**: Document and resolve command failures.
4. **Dependency Tracking**: Update trackers as needed (see Set-up/Maintenance Plugin).
5. **MUP**: Follow Core and plugin-specific MUP steps post-action.

---

## IX. Dependency Processor Command Overview

Located in `cline_utils/`. **All commands are executed through `dependency_processor.py`.** Every command returns a dictionary with at least `status` and `message` keys unless otherwise noted.

**See setup_maintenance_plugin.md for a full list of args and example use**

1. **`generate-keys`**: Initializes a tracker and adds all files/folders within the given root paths. Use this *once* per tracker to set up the initial structure.
   ```
   python -m cline_utils.dependency_system.dependency_processor generate-keys path1 path2 --output output_file --tracker_type main|doc|mini
   ```
   *Example: `python -m cline_utils.dependency_system.dependency_processor generate-keys src tests --output cline_docs/dependency_tracker.md --tracker_type main`*
   *Error Note: Fails if paths don't exist; check paths before running.*

2. **`compress`**: Compresses a string using run-length encoding (RLE).
   ```
   python -m cline_utils.dependency_system.dependency_processor compress string_to_compress
   ```
   *Example: `python -m cline_utils.dependency_system.dependency_processor compress "nnnnnpppdd"`*

3. **`decompress`**: Decompresses a string that was compressed using RLE.
   ```
   python -m cline_utils.dependency_system.dependency_processor decompress compressed_string
   ```
   *Example: `python -m cline_utils.dependency_system.dependency_processor decompress "n5p3d2"`*

4. **`get_char`**: Gets the character at a specific index in a compressed string.
   ```
   python -m cline_utils.dependency_system.dependency_processor get_char compressed_string index
   ```
   *Example: `python -m cline_utils.dependency_system.dependency_processor get_char "n5p3d2" 7`*

5. **`set_char`**: Sets a character at a specific index in a compressed string and updates the tracker file.
   ```
   python -m cline_utils.dependency_system.dependency_processor set_char index new_char --output output_file --key row_key
   ```
   *Example: `python -m cline_utils.dependency_system.dependency_processor set_char 2 x --output docs/doc_tracker.md --key 1A`*
   *Error Note: Fails if grid is malformed; re-run `generate-keys` to fix.*

6. **`remove-file`**: Removes a file from the tracker.
   ```
   python -m cline_utils.dependency_system.dependency_processor remove-file file_to_remove --output output_file
   ```
   *Example: `python -m cline_utils.dependency_system.dependency_processor remove-file src/utils/old_file.py --output cline_docs/dependency_tracker.md`*

7. **`suggest-dependencies`**: Suggests dependencies for a tracker based on code analysis or semantic similarity.
   ```
   python -m cline_utils.dependency_system.dependency_processor suggest-dependencies --tracker tracker_file --tracker_type main|doc|mini
   ```
   *Example: `python -m cline_utils.dependency_system.dependency_processor suggest-dependencies --tracker cline_docs/dependency_tracker.md --tracker_type main`*
   *Error Note: For `doc` type, requires `metadata.json` from `generate-embeddings`; run it first if missing.*

8. **`generate-embeddings`**: Generates embeddings for files in the given root paths.
   ```
   python -m cline_utils.dependency_system.dependency_processor generate-embeddings path1 path2 --output output_dir --model model_name
   ```
   *Example: `python -m cline_utils.dependency_system.dependency_processor generate-embeddings src tests --output cline_docs --model all-mpnet-base-v2`*
   *Error Note: Fails if model isn't installed; ensure `sentence_transformers` is available.*

---

## X. Plugin Usage Guidance

**Always check `.clinerules` for `current_phase`.**
- **Set-up/Maintenance**: Initial setup, adding modules/docs, periodic maintenance (`cline_docs/prompts/setup_maintenance_plugin.md`).
- **Strategy**: Task decomposition, instruction file creation, prioritization (`cline_docs/prompts/strategy_plugin.md`). *NEW* strategy_tasks directory to store detailed plans and strategic approaches.
- **Execution**: Task execution, code/file modifications (`cline_docs/prompts/execution_plugin.md`).

---

## XI. Identifying Code Root Directories

This process is part of the Set-up/Maintenance phase and is performed if the `[CODE_ROOT_DIRECTORIES]` section in `.clinerules` is empty or missing.

**Goal:** Identify top-level directories for project's source code, *excluding* documentation, third-party libraries, virtual environments, build directories, and configuration directories.

**Heuristics and Steps:**
1. **Initial Scan:** Read the contents of the project root directory (where `.clinerules` is located).
2. **Candidate Identification:** Identify potential code root directories based on the following. Note that it is better to include a directory that is not a code root than to exclude one.
   - **Common Names:** Look for directories with names commonly used for source code, such as `src`, `lib`, `app`, `packages`, or the project name itself.
   - **Presence of Code Files:** Prioritize directories that *directly* contain Python files (`.py`) or other code files relevant to the project (e.g., `.js`, `.ts`, `.java`, `.cpp`, etc.).
   - **Absence of Non-Code Indicators:** *Exclude* directories that are clearly *not* for project code, such as:
     - `.git`, `.svn`, `.hg` (version control)
     - `docs`, `documentation` (documentation)
     - `venv`, `env`, `.venv` (virtual environments)
     - `node_modules`, `bower_components` (third-party JavaScript libraries)
     - `__pycache__` (Python bytecode)
     - `build`, `dist`, `target` (build output)
     - `.vscode`, `.idea` (IDE configuration)
     - `3rd_party_docs` (documentation for external libraries)
     - Directories containing primarily configuration files (`.ini`, `.yaml`, `.toml`, `.json`) *unless* those files are clearly part of your project's core logic.
   - **Structure**: If you see a nested structure, with files in folders inside the src folder, such as `src/module1/file1.py`, include `src` and not `src/module1`.
3. **Chain-of-Thought Reasoning:** For each potential directory, generate a chain of thought explaining *why* it is being considered (or rejected).
4. **Update `.clinerules` with `[CODE_ROOT_DIRECTORIES]`.** Make sure `next_action` is specified, e.g., "Generate Keys", or another setup step if incomplete.
5. **MUP**: Follow the Mandatory Update Protocol.

**Example Chain of Thought:**
"Scanning the project root, I see directories: `.vscode`, `docs`, `cline_docs`, `src`, `cline_utils`, `venv`. `.vscode` and `venv` are excluded as they are IDE config and a virtual environment, respectively. `docs` and `cline_docs` are excluded as they are documentation. `src` contains Python files directly, so it's a strong candidate. `cline_utils` also contains `.py` files and appears to be project-specific, so it’s included. Therefore, I will add `src` and `cline_utils` to the `[CODE_ROOT_DIRECTORIES]` section of `.clinerules`."

---

## XII. Conclusion

The CRCT framework manages complex tasks via recursive decomposition and persistent state. Adhere to this prompt and plugin instructions in `cline_docs/prompts/` for effective task management.

**Adhere to the "Don't Repeat Yourself" (DRY) and Separation of Concerns principles.**