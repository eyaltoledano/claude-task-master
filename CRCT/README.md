# Cline Recursive Chain-of-Thought System (CRCT) - v7.0

Welcome to the **Cline Recursive Chain-of-Thought System (CRCT)**, a framework designed to manage context, dependencies, and tasks in large-scale Cline projects within VS Code. Built for the Cline extension, CRCT leverages a recursive, file-based approach with a modular dependency tracking system to keep your project's state persistent and efficient, even as complexity grows.

This is **v7.0**, a basic but functional release of an ongoing refactor to improve dependency tracking modularity. While the full refactor is still in progress (stay tuned!), this version offers a stable starting point for community testing and feedback. It includes base templates for all core files and the new `dependency_processor.py` script.

---

## Key Features

- **Recursive Decomposition**: Breaks tasks into manageable subtasks, organized via directories and files for isolated context management.
- **Minimal Context Loading**: Loads only essential data, expanding via dependency trackers as needed.
- **Persistent State**: Uses the VS Code file system to store context, instructions, outputs, and dependencies—kept up-to-date via a **Mandatory Update Protocol (MUP)**.
- **Modular Dependency Tracking**: 
  - `dependency_tracker.md` (module-level dependencies)
  - `doc_tracker.md` (documentation dependencies)
  - Mini-trackers (file/function-level within modules)
  - Uses hierarchical keys and RLE compression for efficiency (~90% fewer characters vs. full names in initial tests).
- **Phase-Based Workflow**: Operates in distinct phases—**Set-up/Maintenance**, **Strategy**, **Execution**—controlled by `.clinerules`.
- **Chain-of-Thought Reasoning**: Ensures transparency with step-by-step reasoning and reflection.

---

## Quickstart

1. **Clone the Repo**: 
   ```bash
   git clone https://github.com/RPG-fan/Cline-Recursive-Chain-of-Thought-System-CRCT-.git
   cd Cline-Recursive-Chain-of-Thought-System-CRCT-
   ```

2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Set Up Cline Extension**:
   - Open the project in VS Code with the Cline extension installed.
   - Copy `cline_docs/prompts/core_prompt(put this in Custom Instructions).md` into the Cline system prompt field.

4. **Start the System**:
   - Type `Start.` in the Cline input to initialize the system.
   - The LLM will bootstrap from `.clinerules`, creating missing files and guiding you through setup if needed.

*Note*: The Cline extension’s LLM automates most commands and updates to `cline_docs/`. Minimal user intervention is required (in theory!).

---

## Project Structure

```
cline/
│   .clinerules              # Controls phase and state
│   README.md                # This file
│   requirements.txt         # Python dependencies
│
├───cline_docs/              # Operational memory
│   │   activeContext.md     # Current state and priorities
│   │   changelog.md         # Logs significant changes
│   │   productContext.md    # Project purpose and user needs
│   │   progress.md          # Tracks progress
│   │   projectbrief.md      # Mission and objectives
│   │   dependency_tracker.md # Module-level dependencies
│   │   ...                  # Additional templates
│   └───prompts/             # System prompts and plugins
│       core_prompt.md       # Core system instructions
│       setup_maintenance_plugin.md
│       strategy_plugin.md
│       execution_plugin.md
│
├───cline_utils/             # Utility scripts
│   └───dependency_system/
│       dependency_processor.py # Dependency management script
│
├───docs/                    # Project documentation
│   │   doc_tracker.md       # Documentation dependencies
│
├───src/                     # Source code root
│
└───strategy_tasks/          # Strategic plans
```

---

## Current Status & Future Plans

- **v7.0**: A basic, functional release with modular dependency tracking via `dependency_processor.py`. Includes templates for all `cline_docs/` files.
- **Efficiency**: Achieves a ~1.9 efficiency ratio (90% fewer characters) for dependency tracking vs. full names—improving with scale.
- **Ongoing Refactor**: I’m enhancing modularity and token efficiency further. The next version will refine dependency storage and extend savings to simpler projects.

Feedback is welcome! Please report bugs or suggestions via GitHub Issues.

---

## Getting Started (Optional - Existing Projects)

To test on an existing project:
1. Copy your project into `src/`.
2. Use these prompts to kickstart the LLM:
   - `Perform initial setup and populate dependency trackers.`
   - `Review the current state and suggest next steps.`

The system will analyze your codebase, initialize trackers, and guide you forward.

---

## Thanks!

This is a labor of love to make Cline projects more manageable. I’d love to hear your thoughts—try it out and let me know what works (or doesn’t)!
