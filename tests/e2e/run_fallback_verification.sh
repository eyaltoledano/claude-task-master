#!/bin/bash

# --- Fallback Model Verification Script ---
# Purpose: Tests models marked as 'fallback' in supported-models.json
#          to see if they work with generateObjectService (via update-subtask).
# Usage:   1. Run from within a prepared E2E test run directory:
#             ./path/to/script.sh .
#          2. Run from project root (or anywhere) to use the latest run dir:
#             ./tests/e2e/run_fallback_verification.sh
#          3. Run from project root (or anywhere) targeting a specific run dir:
#             ./tests/e2e/run_fallback_verification.sh /path/to/tests/e2e/_runs/run_YYYYMMDD_HHMMSS
# Output: Prints a summary report to standard output. Errors to standard error.

# Treat unset variables as an error when substituting.
set -u
# Prevent errors in pipelines from being masked.
set -o pipefail

# --- Embedded Helper Functions ---
# Copied from e2e_helpers.sh to make this script standalone

_format_duration() {
  local total_seconds=$1
  local minutes=$((total_seconds / 60))
  local seconds=$((total_seconds % 60))
  printf "%dm%02ds" "$minutes" "$seconds"
}

_get_elapsed_time_for_log() {
  # Needs overall_start_time defined in the main script body
  local current_time=$(date +%s)
  local elapsed_seconds=$((current_time - overall_start_time))
  _format_duration "$elapsed_seconds"
}

log_info() {
  echo "[INFO] [$(_get_elapsed_time_for_log)] $(date +"%Y-%m-%d %H:%M:%S") $1"
}

log_success() {
  echo "[SUCCESS] [$(_get_elapsed_time_for_log)] $(date +"%Y-%m-%d %H:%M:%S") $1"
}

log_error() {
  echo "[ERROR] [$(_get_elapsed_time_for_log)] $(date +"%Y-%m-%d %H:%M:%S") $1" >&2
}

log_step() {
  # Needs test_step_count defined and incremented in the main script body
  test_step_count=$((test_step_count + 1))
  echo ""
  echo "============================================="
  echo "  STEP ${test_step_count}: [$(_get_elapsed_time_for_log)] $(date +"%Y-%m-%d %H:%M:%S") $1"
  echo "============================================="
}

# --- Signal Handling ---
# Global variable to hold child PID
child_pid=0
# Use a persistent log file name
PROGRESS_LOG_FILE="fallback_verification_progress.log"

cleanup() {
    echo "" # Newline after ^C
    log_error "Interrupt received. Cleaning up any running child process..."
    if [ "$child_pid" -ne 0 ]; then
        log_info "Killing child process (PID: $child_pid) and its group..."
        kill -TERM -- "-$child_pid" 2>/dev/null || kill -KILL -- "-$child_pid" 2>/dev/null
        child_pid=0
    fi
    # DO NOT delete the progress log file on interrupt
    log_info "Progress saved in: $PROGRESS_LOG_FILE"
    exit 130 # Exit with code indicating interrupt
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup INT TERM

# --- Configuration ---
# Determine the project root relative to this script's location
# Use a robust method to find the script's own directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
# Assumes this script is in tests/e2e/
PROJECT_ROOT_DIR="$( cd "$SCRIPT_DIR/../.." &> /dev/null && pwd )"
SUPPORTED_MODELS_FILE="$PROJECT_ROOT_DIR/scripts/modules/supported-models.json"
BASE_RUNS_DIR="$PROJECT_ROOT_DIR/tests/e2e/_runs"

# --- Determine Target Run Directory ---
TARGET_RUN_DIR=""
if [ "$#" -ge 1 ] && [ -n "$1" ]; then
    # Use provided argument if it exists
    TARGET_RUN_DIR="$1"
     # Make path absolute if it's relative
    if [[ "$TARGET_RUN_DIR" != /* ]]; then
        TARGET_RUN_DIR="$(pwd)/$TARGET_RUN_DIR"
    fi
    echo "[INFO] Using provided target run directory: $TARGET_RUN_DIR"
else
    # Find the latest run directory
    echo "[INFO] No run directory provided, finding latest in $BASE_RUNS_DIR..."
    TARGET_RUN_DIR=$(ls -td "$BASE_RUNS_DIR"/run_* 2>/dev/null | head -n 1)
    if [ -z "$TARGET_RUN_DIR" ]; then
        echo "[ERROR] No run directories found matching 'run_*' in $BASE_RUNS_DIR. Cannot proceed." >&2
        exit 1
    fi
     echo "[INFO] Found latest run directory: $TARGET_RUN_DIR"
fi

# Validate the target directory
if [ ! -d "$TARGET_RUN_DIR" ]; then
    echo "[ERROR] Target run directory not found or is not a directory: $TARGET_RUN_DIR" >&2
    exit 1
fi

# --- Change to Target Directory ---
echo "[INFO] Changing working directory to: $TARGET_RUN_DIR"
if ! cd "$TARGET_RUN_DIR"; then
     echo "[ERROR] Failed to cd into target directory: $TARGET_RUN_DIR" >&2
     exit 1
fi
echo "[INFO] Now operating inside: $(pwd)"

# --- Now we are inside the target run directory ---
overall_start_time=$(date +%s)
test_step_count=0
log_info "Starting fallback verification script execution in $(pwd)"
log_info "Progress will be logged to: $(pwd)/$PROGRESS_LOG_FILE"

# --- Dependency Checks ---
log_step "Checking for dependencies (jq) in verification script"
if ! command -v jq &> /dev/null; then
    log_error "Dependency 'jq' is not installed or not found in PATH."
    exit 1
fi
log_success "Dependency 'jq' found."

# --- Verification Logic ---
log_step "Starting/Resuming Fallback Model (generateObjectService) Verification"
# Ensure progress log exists, create if not
touch "$PROGRESS_LOG_FILE"

# Ensure the supported models file exists (using absolute path)
if [ ! -f "$SUPPORTED_MODELS_FILE" ]; then
    log_error "supported-models.json not found at absolute path: $SUPPORTED_MODELS_FILE."
    exit 1
fi
log_info "Using supported models file: $SUPPORTED_MODELS_FILE"

# Ensure subtask 1.1 exists (basic check, main script should guarantee)
# Check for tasks.json in the current directory (which is now the run dir)
if [ ! -f "tasks/tasks.json" ]; then
    log_error "tasks/tasks.json not found in current directory ($(pwd)). Was this run directory properly initialized?"
    exit 1
fi
if ! jq -e '.tasks[] | select(.id == 1) | .subtasks[] | select(.id == 1)' tasks/tasks.json > /dev/null 2>&1; then
    log_error "Subtask 1.1 not found in tasks.json within $(pwd). Cannot perform update-subtask tests."
    exit 1
fi
log_info "Subtask 1.1 found in $(pwd)/tasks/tasks.json, proceeding with verification."

# Read providers and models using jq
jq -c 'to_entries[] | .key as $provider | .value[] | select(.allowed_roles[]? == "fallback") | {provider: $provider, id: .id}' "$SUPPORTED_MODELS_FILE" | while IFS= read -r model_info; do
    provider=$(echo "$model_info" | jq -r '.provider')
    model_id=$(echo "$model_info" | jq -r '.id')
    flag="" # Default flag

    # Check if already tested
    # Use grep -Fq for fixed string and quiet mode
    if grep -Fq "${provider},${model_id}," "$PROGRESS_LOG_FILE"; then
        log_info "--- Skipping: $provider / $model_id (already tested, result in $PROGRESS_LOG_FILE) ---"
        continue
    fi

    log_info "--- Verifying: $provider / $model_id ---"

    # Determine provider flag
    if [ "$provider" == "openrouter" ]; then
        flag="--openrouter"
    elif [ "$provider" == "ollama" ]; then
        flag="--ollama"
    fi

    # 1. Set the main model
    if ! command -v task-master &> /dev/null; then
        log_error "task-master command not found."
        echo "[INSTRUCTION] Please run 'npm link task-master-ai' in the project root first."
        exit 1
    fi
    log_info "Setting main model to $model_id ${flag:+using flag $flag}..."
    set_model_cmd="task-master models --set-main \"$model_id\" $flag"
    model_set_status="SUCCESS"
    if ! eval $set_model_cmd > /dev/null 2>&1; then
        log_error "Failed to set main model for $provider / $model_id. Skipping test."
        echo "$provider,$model_id,SET_MODEL_FAILED" >> "$PROGRESS_LOG_FILE"
        continue # Skip the actual test if setting fails
    fi
    log_info "Set main model ok."

    # 2. Run update-subtask
    log_info "Running update-subtask --id=1.1 --prompt='Test generateObjectService' (timeout 120s)"
    update_subtask_output_file="update_subtask_raw_output_${provider}_${model_id//\//_}.log"

    timeout 120s task-master update-subtask --id=1.1 --prompt="Simple test prompt to verify generateObjectService call." > "$update_subtask_output_file" 2>&1 &
    child_pid=$!
    wait "$child_pid"
    update_subtask_exit_code=$?
    child_pid=0

    # 3. Check result and log persistently
    result_status=""
    if [ $update_subtask_exit_code -eq 0 ] && grep -q "Successfully updated subtask #1.1" "$update_subtask_output_file"; then
        log_success "update-subtask succeeded for $provider / $model_id (Verified Output)."
        result_status="SUCCESS"
    elif [ $update_subtask_exit_code -eq 124 ]; then
        log_error "update-subtask TIMED OUT for $provider / $model_id. Check $update_subtask_output_file."
        result_status="FAILED_TIMEOUT"
    elif [ $update_subtask_exit_code -eq 130 ] || [ $update_subtask_exit_code -eq 143 ]; then
         log_error "update-subtask INTERRUPTED for $provider / $model_id."
         result_status="INTERRUPTED" # Record interruption
         # Don't exit the loop, allow script to finish or be interrupted again
    else
        log_error "update-subtask FAILED for $provider / $model_id (Exit Code: $update_subtask_exit_code). Check $update_subtask_output_file."
        result_status="FAILED"
    fi

    # Append result to the persistent log file
    echo "$provider,$model_id,$result_status" >> "$PROGRESS_LOG_FILE"

done # End of fallback verification loop

# --- Generate Final Verification Report to STDOUT ---
# Report reads from the persistent PROGRESS_LOG_FILE
echo ""
echo "--- Fallback Model Verification Report (via $0) ---"
echo "Executed inside run directory: $(pwd)"
echo "Progress log: $(pwd)/$PROGRESS_LOG_FILE"
echo ""
echo "Test Command: task-master update-subtask --id=1.1 --prompt=\"...\" (tests generateObjectService)"
echo "Models were tested by setting them as the 'main' model temporarily."
echo "Results based on exit code and output verification:"
echo ""
echo "Models CONFIRMED to support generateObjectService (Keep 'fallback' role):"
awk -F',' '$3 == "SUCCESS" { print "- " $1 " / " $2 }' "$PROGRESS_LOG_FILE" | sort
echo ""
echo "Models FAILED generateObjectService test (Suggest REMOVING 'fallback' role):"
awk -F',' '$3 == "FAILED" { print "- " $1 " / " $2 }' "$PROGRESS_LOG_FILE" | sort
echo ""
echo "Models TIMED OUT during test (Suggest REMOVING 'fallback' role):"
awk -F',' '$3 == "FAILED_TIMEOUT" { print "- " $1 " / " $2 }' "$PROGRESS_LOG_FILE" | sort
echo ""
echo "Models where setting the model failed (Inconclusive):"
awk -F',' '$3 == "SET_MODEL_FAILED" { print "- " $1 " / " $2 }' "$PROGRESS_LOG_FILE" | sort
echo ""
echo "Models INTERRUPTED during test (Inconclusive - Rerun):"
awk -F',' '$3 == "INTERRUPTED" { print "- " $1 " / " $2 }' "$PROGRESS_LOG_FILE" | sort
echo ""
echo "-------------------------------------------------------"
echo ""

# Don't clean up the progress log
# if [ -f "$PROGRESS_LOG_FILE" ]; then
#     rm "$PROGRESS_LOG_FILE"
# fi

log_info "Finished Fallback Model (generateObjectService) Verification Script"

# Remove trap before exiting normally
trap - INT TERM

exit 0 # Exit successfully after printing the report
