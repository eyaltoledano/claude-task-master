# Taskmaster Project Migration Guide

This guide explains how to manually migrate your existing Taskmaster project from the older file structure (where files like `tasks.json`, `tasks/`, and `scripts/` were in the project root) to the new structure where these are located inside a `.taskmaster/` directory.

This change helps keep your project root cleaner and organizes Taskmaster-specific files.

## Migration Steps

Follow these steps in your project's root directory using your terminal:

1.  **Create the `.taskmaster` directory:**
    This hidden directory will hold all Taskmaster-related files and configurations.

    ```bash
    mkdir .taskmaster
    ```

2.  **Move `tasks.json`:**
    Move the main tasks file into the new directory.

    ```bash
    mv tasks.json .taskmaster/tasks.json
    ```

    _If you don't have a `tasks.json` file, you can skip this step._

3.  **Move the `tasks/` directory:**
    Move the directory containing individual task files (if it exists).

    ```bash
    mv tasks .taskmaster/tasks
    ```

    _If you don't have a `tasks/` directory, you can skip this step._

4.  **Move the `scripts/` directory:**
    Move the directory containing Taskmaster scripts (like complexity reports or PRDs).
    ```bash
    mv scripts .taskmaster/scripts
    ```
    _If you don't have a `scripts/` directory, you can skip this step._

After completing these steps, your project structure will be updated, and Taskmaster commands should work correctly with the new layout.
