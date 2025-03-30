# Instructions for Using CRCT v7.0

These instructions assume you’re using the Cline VS Code extension with CRCT v7.0. The system automates most tasks via the LLM, but some manual steps are needed to get started.

---

## Prerequisites

- **VS Code**: Installed with the Cline extension.
- **Python**: 3.8+ with `pip`.
- **Git**: To clone the repo.

---

## Step 1: Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/RPG-fan/Cline-Recursive-Chain-of-Thought-System-CRCT-.git
   cd Cline-Recursive-Chain-of-Thought-System-CRCT-
   ```

2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
   *Includes `sentence-transformers` for embeddings.*

3. **Open in VS Code**:
   - Launch VS Code and open the `cline/` folder.

4. **Configure Cline**:
   - Open the Cline extension settings.
   - Paste the contents of `cline_docs/prompts/core_prompt(put this in Custom Instructions).md` into the system prompt field.

---

## Step 2: Initialize the System

1. **Start the LLM**:
   - In the Cline input, type `Start.` and run it.
   - The LLM will:
     - Read `.clinerules` (or create it if missing).
     - Load the `Set-up/Maintenance` plugin.
     - Initialize core files in `cline_docs/`.

2. **Follow Prompts**:
   - The LLM may ask for input (e.g., project goals for `projectbrief.md`).
   - Provide concise answers to help it populate files.

3. **Verify Setup**:
   - Check `cline_docs/` for new files (e.g., `dependency_tracker.md`).
   - Ensure `[CODE_ROOT_DIRECTORIES]` in `.clinerules` lists `src/` (edit manually if needed).

---

## Step 3: Populate Dependency Trackers

1. **Run Initial Setup**:
   - Input: `Perform initial setup and populate dependency trackers.`
   - The LLM will:
     - Identify code roots (e.g., `src/`).
     - Generate `dependency_tracker.md` and `doc_tracker.md` using `dependency_processor.py`.
     - Suggest and validate dependencies.

2. **Manual Validation (if prompted)**:
   - The LLM may present dependency suggestions (e.g., JSON output).
   - Confirm or adjust characters (`<`, `>`, `x`, etc.) as prompted.

---

## Step 4: Plan and Execute

1. **Enter Strategy Phase**:
   - Once trackers are populated, the LLM will transition to `Strategy` (check `.clinerules`).
   - Input: `Plan the next steps for my project.`
   - Output: New instruction files in `strategy_tasks/` or `src/`.

2. **Execute Tasks**:
   - Input: `Execute the planned tasks.`
   - The LLM will follow instruction files, update files, and apply the MUP.

---

## Tips

- **Monitor `activeContext.md`**: Tracks current state and priorities.
- **Check `.clinerules`**: Shows the current phase and next action.
- **Debugging**: If stuck, try `Review the current state and suggest next steps.`

---

## Notes

- CRCT v7.0 is a work-in-progress. Expect minor bugs (e.g., tracker initialization).
- The LLM handles most commands (`generate-keys`, `set_char`, etc.) automatically.
- For custom projects, populate `src/` and `docs/` before starting.

Questions? Open an issue on GitHub!