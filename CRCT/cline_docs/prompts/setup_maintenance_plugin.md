# **Cline Recursive Chain-of-Thought System (CRCT) - Set-up/Maintenance Plugin**

**This Plugin provides detailed instructions and procedures for the Set-up/Maintenance phase of the CRCT system. It should be used in conjunction with the Core System Prompt.**

---

## I. Entering and Exiting Set-up/Maintenance Phase

**Entering Set-up/Maintenance Phase:**
1. **Initial State**: Start here for new projects or if `.clinerules` shows `current_phase: "Set-up/Maintenance"`.
2. **`.clinerules` Check**: Always read `.clinerules` first. If `[LAST_ACTION_STATE]` indicates "Set-up/Maintenance", proceed with these instructions.
3. **New Project**: If `.clinerules` is missing/empty, assume this phase and initialize core files.

**Exiting Set-up/Maintenance Phase:**
1. **Completion Criteria:**
   - All core files exist and are initialized.
   - `doc_tracker.md` is populated (no 'p' placeholders).
   - `dependency_tracker.md` is populated (no 'p' placeholders).
   - Mini-trackers are created/populated as needed.
2. **`.clinerules` Update (MUP):**
   ```
   last_action: "Completed Set-up/Maintenance Phase"
   current_phase: "Set-up/Maintenance"
   next_action: "Phase Complete - User Action Required"
   next_phase: "Strategy"
   ```
3. **User Action**: After updating `.clinerules`, pause for user to trigger the next session (e.g., reset context in VS Code). See Core System Prompt, Section III for a phase transition checklist.

---

## II. Initializing Core Required Files

**Action**: Ensure all core files exist, creating them if missing as specified.

**Procedure:**
1. **Check for Existence**: Check if each file (`.clinerules`, `projectbrief.md`, `productContext.md`, `activeContext.md`, `dependency_tracker.md`, `changelog.md`, `doc_tracker.md`) exists.
2. **Create Missing Files:**
   - For `.clinerules`, `projectbrief.md`, `productContext.md`, `activeContext.md`, `changelog.md`: Use `write_to_file` to create manually with minimal content (e.g., `# Project Brief\n\n[Describe mission here]` for `projectbrief.md`).
   - For `dependency_tracker.md`: Run:
     ```
     python -m cline_utils.dependency_system.dependency_processor generate-keys src tests --output cline_docs/dependency_tracker.md --tracker_type main
     ```
     *Replace `src tests` with the actual code root directories from `[CODE_ROOT_DIRECTORIES]` in `.clinerules`. Replace `cline_docs/` with your `{memory_dir}` if different.*
   - For `doc_tracker.md`: Run:
     ```
     python -m cline_utils.dependency_system.dependency_processor generate-keys docs --output docs/doc_tracker.md --tracker_type doc
     ```
     *Replace `docs` with the actual path to your documentation directory. Replace `docs/` with your `{doc_dir}` if different.*
   - **Important**: Do not manually create or modify tracker files; **always** use `dependency_processor.py` to ensure proper structure and data consistency. Use `generate-keys` for initial setup.
   - Example Initial `.clinerules`:
     ```
     ---CLINE_RULES_START---
     [LAST_ACTION_STATE]
     last_action: "System Initialized"
     current_phase: "Set-up/Maintenance"
     next_action: "Initialize Core Files"
     next_phase: "Set-up/Maintenance"
     [LEARNING_JOURNAL]
     # Cline Project Learning Journal (.clinerules)
     # Add entries as insights emerge.
     ---CLINE_RULES_END---
     ```
3. **MUP**: Follow Core Prompt MUP after creating files.

---

## III. Populating `doc_tracker.md` (Documentation Dependency Tracker)

**Objective**: Fully populate `doc_tracker.md` in `{doc_dir}/` with verified dependencies (highest priority). **All tracker modifications MUST be done using the `dependency_processor.py` script.**

**Procedure:**
1. **File Existence Check**: Verify `doc_tracker.md` exists in `{doc_dir}/`. If not, create it with:
   ```
   python -m cline_utils.dependency_system.dependency_processor generate-keys docs --output docs/doc_tracker.md --tracker_type doc
   ```
   *Replace `docs` with your documentation directory path.*
2. **Generate Embeddings:**
   ```
   python -m cline_utils.dependency_system.dependency_processor generate-embeddings docs --output docs --model all-mpnet-base-v2
   ```
   *Replace `docs` with your `{doc_dir}` path.*
3. **Suggest Dependencies:**
   ```
   python -m cline_utils.dependency_system.dependency_processor suggest-dependencies --tracker docs/doc_tracker.md --tracker_type doc
   ```
   *Note*: Validate suggestions before applying them. The command provides suggestions in JSON format; review and choose the correct dependency character based on documentation relationships. Run this command **once** for initial suggestions.
4. **Validate and Set Dependencies:**
   - Review JSON output from `suggest-dependencies`.
   - Open the relevant files (row and column files from the suggestion).
   - Confirm the dependency and determine the correct character (`<`, `>`, `x`, `d`, or `n`).
   - Use `set_char` to set the character in the grid:
     ```
     python -m cline_utils.dependency_system.dependency_processor set_char 2 d --output docs/doc_tracker.md --key 1A
     ```
     *Replace `2`, `d`, and `1A` with the actual index, character, and row key from your tracker.*
5. **Iterate and Complete**: Repeat Steps 3-4 until no 'p' placeholders remain in `doc_tracker.md`.
6. **MUP**: Apply Core MUP and Section VII additions after each `set_char` and upon completion.

---

## IV. Populating `dependency_tracker.md` (Module-Level Dependency Tracker)

**Objective**: Fully populate `dependency_tracker.md` in `{memory_dir}/` *after* `doc_tracker.md`. **All tracker modifications MUST be done using the `dependency_processor.py` script.**

**Procedure:**
1. **File Existence Check**: Verify that `dependency_tracker.md` exists in `{memory_dir}/`. If not, create it with:
   ```
   python -m cline_utils.dependency_system.dependency_processor generate-keys src tests --output cline_docs/dependency_tracker.md --tracker_type main
   ```
   *Replace `src tests` with paths from `[CODE_ROOT_DIRECTORIES]` in `.clinerules`. Replace `cline_docs/` with your `{memory_dir}` if different.*
2. **Generate Embeddings:**
   ```
   python -m cline_utils.dependency_system.dependency_processor generate-embeddings src tests --output cline_docs --model all-mpnet-base-v2
   ```
   *The `--output` path is the parent directory for the `embeddings/` subdirectory.*
3. **Suggest Dependencies:**
   ```
   python -m cline_utils.dependency_system.dependency_processor suggest-dependencies --tracker cline_docs/dependency_tracker.md --tracker_type main
   ```
   *Run once for initial suggestions; validate JSON output.*
4. **Validate and Set Dependencies:**
   - Review JSON output from `suggest-dependencies`.
   - Open the relevant files (row and column files).
   - Confirm the dependency and choose the correct character (`<`, `>`, `x`, `d`, or `n`).
   - Use `set_char`:
     ```
     python -m cline_utils.dependency_system.dependency_processor set_char 3 < --output cline_docs/dependency_tracker.md --key 1B
     ```
     *Adjust `3`, `<`, and `1B` based on your tracker data.*
5. **Iterate and Complete**: Repeat Steps 3-4 until no 'p' placeholders remain.
6. **MUP**: Apply Core MUP and Section VII additions after each `set_char` and upon completion.

---

## V. Dependency Tracker Management (Details)

### V.1 Dependency Characters
- `<`: Row depends on column.
- `>`: Column depends on row.
- `x`: Mutual dependency.
- `d`: Documentation dependency.
- `o`: No dependency (diagonal only).
- `n`: Verified no dependency.
- `p`: Placeholder (unverified).
- `s`: Semantic dependency

### V.2 Hierarchical Key System
- **Purpose**: Encodes hierarchy in trackers.
- **Structure**: Tier (number), Directory (uppercase), Subdirectory (lowercase), File (number).
- **Examples**: `1A` (top-level dir 'A'), `1A1` (first file in 'A'), `2Ba3` (third file in subdir 'a' of 'B').

### V.3 Grid Format and X-Axis Header
- **X-Axis Header**: "X " followed by column keys.
- **Dependency Rows**: Row key, " = ", compressed string (RLE, excluding 'o').

### V.4 Dependency Processor Commands
Located in `cline_utils/`. **All commands for the dependency system are executed through `dependency_processor.py`.** Every command returns a dictionary in JSON format with `status` and `message` keys.

**Placeholder Definitions:**
| Placeholder    | Description                                      | Example                           |
|----------------|--------------------------------------------------|-----------------------------------|
| `path1`, `path2`| One or more file or directory paths            | `src`, `docs`                     |
| `tracker_file` | Path to a tracker file (`.md` file)             | `cline_docs/dependency_tracker.md`|
| `file_path`    | Path to a source code or documentation file     | `src/utils/helpers.py`            |
| `row_key`      | Key identifying a row in the dependency grid    | `1A2`                             |
| `index`        | Numerical index of a column in the dependency grid | `5`                           |
| `character`    | A dependency character (`<`, `>`, `x`, `d`, `n`, `p`, `s`) | `d`                   |
| `output_file`  | Path to a file for command output               | `docs/doc_tracker.md`             |
| `output_dir`   | Path to a directory for command output          | `cline_docs/`                     |

1. **`generate-keys`**:
   ```
   python -m cline_utils.dependency_system.dependency_processor generate-keys path1 path2 --output output_file --tracker_type main|doc|mini
   ```
2. **`compress`**:
   ```
   python -m cline_utils.dependency_system.dependency_processor compress string_to_compress
   ```
3. **`decompress`**:
   ```
   python -m cline_utils.dependency_system.dependency_processor decompress compressed_string
   ```
4. **`get_char`**:
   ```
   python -m cline_utils.dependency_system.dependency_processor get_char compressed_string index
   ```
5. **`set_char`**:
   ```
   python -m cline_utils.dependency_system.dependency_processor set_char index character --output output_file --key row_key
   ```
6. **`remove-file`**:
   ```
   python -m cline_utils.dependency_system.dependency_processor remove-file file_to_remove --output output_file
   ```
7. **`suggest-dependencies`**:
   ```
   python -m cline_utils.dependency_system.dependency_processor suggest-dependencies --tracker tracker_file --tracker_type main|doc|mini
   ```
8. **`generate-embeddings`**:
   ```
   python -m cline_utils.dependency_system.dependency_processor generate-embeddings path1 path2 --output output_dir --model model_name
   ```

### V.5 Mini-Tracker Example
For `{module_dir}` = "utils":
1. **Create and Populate:**
   ```
   python -m cline_utils.dependency_system.dependency_processor generate-keys utils --output utils/utils_main_instructions.txt --tracker_type mini
   ```
2. **Suggest Dependencies:**
   ```
   python -m cline_utils.dependency_system.dependency_processor suggest-dependencies --tracker utils/utils_main_instructions.txt --tracker_type mini
   ```
3. **Validate and Set:**
   ```
   python -m cline_utils.dependency_system.dependency_processor set_char 1 x --output utils/utils_main_instructions.txt --key 1U1
   ```
   *Adjust `1`, `x`, and `1U1` based on your tracker data.*

### V.6 Command Sequence Flowchart
```mermaid
flowchart TD
A[Generate Keys (One Time)] --> B[Generate Embeddings]
B --> C[Suggest Dependencies]
C --> D[Validate Suggestion]
D --> E[Set Character]
E --> F{No more 'p' placeholders?}
F -- No --> C
F -- Yes --> G[Complete]
```

---

## VI. Populating Mini-Trackers

**Objective**: Create and populate mini-trackers in `{module_dir}/{module_dir}_main_instructions.txt`.

**Procedure:**
1. **Identify Modules**: Use `dependency_tracker.md` directories.
2. **Instruction File Check:**
   - If `{module_dir}/{module_dir}_main_instructions.txt` is missing:
     - Create with basic structure (see Core Prompt, Section VII).
     - Initialize mini-tracker:
       ```
       python -m cline_utils.dependency_system.dependency_processor generate-keys utils --output utils/utils_main_instructions.txt --tracker_type mini
       ```
       *Replace `utils` with the actual module directory.*
   - If it exists, proceed to Step 3.
3. **Generate Embeddings (if applicable):**
   ```
   python -m cline_utils.dependency_system.dependency_processor generate-embeddings utils --output utils --model all-mpnet-base-v2
   ```
   *Replace `utils` with the actual module directory.*
4. **Suggest and Validate**: See **Section V.5** for example commands. Adapt `--tracker` and keys accordingly.
5. **Iterate and Complete**: Repeat until populated.
6. **MUP**: Apply Core MUP and Section VII additions.

---

## VII. Set-up/Maintenance Plugin - MUP Additions

After Core MUP steps:
1. **Update `dependency_tracker.md`**: Save changes from commands.
2. **Update `doc_tracker.md`**: Save changes.
3. **Update Mini-Trackers**: Save changes.
4. **Update `.clinerules` [LAST_ACTION_STATE]:**

    - Example after `doc_tracker.md`:

    ```
    ---CLINE_RULES_START---
    [LAST_ACTION_STATE]
    last_action: "Populated doc_tracker.md"
    current_phase: "Set-up/Maintenance"
    next_action: "Populate dependency_tracker.md"
    next_phase: "Set-up/Maintenance"
    [LEARNING_JOURNAL]
    # Populate this with any insights you learn about the user or project.
    ---CLINE_RULES_END---
    ```
