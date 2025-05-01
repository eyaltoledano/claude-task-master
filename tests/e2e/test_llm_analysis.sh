#!/bin/bash

# Script to test the LLM analysis function independently

# Exit on error
set -u
set -o pipefail

# Source the helper functions
HELPER_SCRIPT="tests/e2e/e2e_helpers.sh"
if [ -f "$HELPER_SCRIPT" ]; then
  source "$HELPER_SCRIPT"
  echo "[INFO] Sourced helper script: $HELPER_SCRIPT"
else
  echo "[ERROR] Helper script not found at $HELPER_SCRIPT. Exiting." >&2
  exit 1
fi

# --- Configuration ---
# Get the absolute path to the project root (assuming this script is run from the root)
PROJECT_ROOT="$(pwd)"

# --- Argument Parsing ---
if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <path_to_log_file> <path_to_test_run_directory>" >&2
  echo "Example: $0 tests/e2e/log/e2e_run_YYYYMMDD_HHMMSS.log tests/e2e/_runs/run_YYYYMMDD_HHMMSS" >&2
  exit 1
fi

LOG_FILE_REL="$1"     # Relative path from project root
TEST_RUN_DIR_REL="$2" # Relative path from project root

# Construct absolute paths
LOG_FILE_ABS="$PROJECT_ROOT/$LOG_FILE_REL"
TEST_RUN_DIR_ABS="$PROJECT_ROOT/$TEST_RUN_DIR_REL"

# --- Validation ---
if [ ! -f "$LOG_FILE_ABS" ]; then
  echo "[ERROR] Log file not found: $LOG_FILE_ABS" >&2
  exit 1
fi

if [ ! -d "$TEST_RUN_DIR_ABS" ]; then
  echo "[ERROR] Test run directory not found: $TEST_RUN_DIR_ABS" >&2
  exit 1
fi

if [ ! -f "$TEST_RUN_DIR_ABS/.env" ]; then
  echo "[ERROR] .env file not found in test run directory: $TEST_RUN_DIR_ABS/.env" >&2
  exit 1
fi


# --- Execution ---
echo "[INFO] Changing directory to test run directory: $TEST_RUN_DIR_ABS"
cd "$TEST_RUN_DIR_ABS" || { echo "[ERROR] Failed to cd into $TEST_RUN_DIR_ABS"; exit 1; }

echo "[INFO] Current directory: $(pwd)"
echo "[INFO] Calling analyze_log_with_llm function with log file: $LOG_FILE_ABS"

# Call the function (sourced earlier)
analyze_log_with_llm "$LOG_FILE_ABS"
ANALYSIS_EXIT_CODE=$?

echo "[INFO] analyze_log_with_llm finished with exit code: $ANALYSIS_EXIT_CODE"

# Optional: cd back to original directory
# echo "[INFO] Changing back to project root: $PROJECT_ROOT"
# cd "$PROJECT_ROOT"

exit $ANALYSIS_EXIT_CODE 