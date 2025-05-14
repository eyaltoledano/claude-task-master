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
# OR source it if preferred and path is reliable

# <<< Determine SCRIPT_DIR and PROJECT_ROOT_DIR early >>>
SCRIPT_DIR_FV="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT_DIR_FV="$( cd "$SCRIPT_DIR_FV/../.." &> /dev/null && pwd )" # Assumes script is in tests/e2e/

# --- Try to Source e2e_helpers.sh ---
E2E_HELPERS_PATH_FV="${PROJECT_ROOT_DIR_FV}/tests/e2e/e2e_helpers.sh"
if [ -f "$E2E_HELPERS_PATH_FV" ]; then
    # shellcheck source=tests/e2e/e2e_helpers.sh
    source "$E2E_HELPERS_PATH_FV"
    echo "[INFO FV] Sourced e2e_helpers.sh successfully."
else
    echo "[ERROR FV] e2e_helpers.sh not found at $E2E_HELPERS_PATH_FV. Cost extraction will fail."
    # Define a placeholder if not found, so the script doesn't break immediately,
    # but cost extraction will effectively be a no-op.
    extract_and_sum_cost() { echo "$2"; } # Returns current total, effectively adding 0
fi


_format_duration() {
  local total_seconds=$1
  local minutes=$((total_seconds / 60))
  local seconds=$((total_seconds % 60))
  printf "%dm%02ds" "$minutes" "$seconds"
}

_get_elapsed_time_for_log() {
  local current_time
  current_time=$(date +%s)
  local elapsed_seconds
  elapsed_seconds=$((current_time - overall_start_time)) # Needs overall_start_time
  _format_duration "$elapsed_seconds"
}

log_info() {
  echo "[INFO FV] [$(_get_elapsed_time_for_log)] $(date +"%Y-%m-%d %H:%M:%S") $1"
}

log_success() {
  echo "[SUCCESS FV] [$(_get_elapsed_time_for_log)] $(date +"%Y-%m-%d %H:%M:%S") $1"
}

log_error() {
  echo "[ERROR FV] [$(_get_elapsed_time_for_log)] $(date +"%Y-%m-%d %H:%M:%S") $1" >&2
}

log_step() {
  test_step_count=$((test_step_count + 1)) # Needs test_step_count
  echo ""
  echo "============================================="
  echo "  FV STEP ${test_step_count}: [$(_get_elapsed_time_for_log)] $(date +"%Y-%m-%d %H:%M:%S") $1"
  echo "============================================="
}

# --- Signal Handling ---
child_pid=0
PROGRESS_LOG_FILE="fallback_verification_progress.log" # Stays in run dir

cleanup() {
    echo ""
    log_error "Interrupt received. Cleaning up any running child process..."
    if [ "$child_pid" -ne 0 ]; then
        log_info "Killing child process (PID: $child_pid) and its group..."
        kill -TERM -- "-$child_pid" 2>/dev/null || kill -KILL -- "-$child_pid" 2>/dev/null
        child_pid=0
    fi
    log_info "Progress saved in: $PROGRESS_LOG_FILE"
    # Print current total cost on interrupt
    if [[ -n "${total_fallback_cost+x}" && "$total_fallback_cost" != "0.0" ]]; then # Check if var is set and not initial
        log_info "Current Total Fallback AI Cost at interruption: $total_fallback_cost USD"
    fi
    exit 130
}

trap cleanup INT TERM

# --- Configuration ---
# SCRIPT_DIR and PROJECT_ROOT_DIR already defined above
SUPPORTED_MODELS_FILE="$PROJECT_ROOT_DIR_FV/scripts/modules/supported-models.json"
BASE_RUNS_DIR="$PROJECT_ROOT_DIR_FV/tests/e2e/_runs"

# --- Determine Target Run Directory ---
TARGET_RUN_DIR=""
if [ "$#" -ge 1 ] && [ -n "$1" ]; then
    TARGET_RUN_DIR="$1"
    if [[ "$TARGET_RUN_DIR" != /* ]]; then
        TARGET_RUN_DIR="$(pwd)/$TARGET_RUN_DIR"
    fi
    echo "[INFO FV] Using provided target run directory: $TARGET_RUN_DIR"
else
    echo "[INFO FV] No run directory provided, finding latest in $BASE_RUNS_DIR..."
    TARGET_RUN_DIR=$(ls -td "$BASE_RUNS_DIR"/run_* 2>/dev/null | head -n 1)
    if [ -z "$TARGET_RUN_DIR" ]; then
        echo "[ERROR FV] No run directories found matching 'run_*' in $BASE_RUNS_DIR. Cannot proceed." >&2
        exit 1
    fi
     echo "[INFO FV] Found latest run directory: $TARGET_RUN_DIR"
fi

if [ ! -d "$TARGET_RUN_DIR" ]; then
    echo "[ERROR FV] Target run directory not found or is not a directory: $TARGET_RUN_DIR" >&2
    exit 1
fi

echo "[INFO FV] Changing working directory to: $TARGET_RUN_DIR"
if ! cd "$TARGET_RUN_DIR"; then
     echo "[ERROR FV] Failed to cd into target directory: $TARGET_RUN_DIR" >&2
     exit 1
fi
echo "[INFO FV] Now operating inside: $(pwd)"

overall_start_time=$(date +%s) # Initialize for logging helpers
test_step_count=0               # Initialize for logging helpers
total_fallback_cost="0.0"       # Initialize total cost for this script

log_info "Starting fallback verification script execution in $(pwd)"
log_info "Progress will be logged to: $(pwd)/$PROGRESS_LOG_FILE"

log_step "Checking for dependencies (jq, bc) in verification script"
if ! command -v jq &> /dev/null; then log_error "Dependency 'jq' not installed."; exit 1; fi
if ! command -v bc &> /dev/null; then log_error "Dependency 'bc' not installed (for cost calculation)."; exit 1; fi
log_success "Dependencies 'jq' and 'bc' found."


log_step "Starting/Resuming Fallback Model (generateObjectService) Verification"
touch "$PROGRESS_LOG_FILE"

if [ ! -f "$SUPPORTED_MODELS_FILE" ]; then
    log_error "supported-models.json not found at: $SUPPORTED_MODELS_FILE."
    exit 1
fi
log_info "Using supported models file: $SUPPORTED_MODELS_FILE"

if [ ! -f "tasks/tasks.json" ]; then
    log_error "tasks/tasks.json not found in current directory ($(pwd)). Was this run directory properly initialized?"
    exit 1
fi
if ! jq -e '.tasks[] | select(.id == 1) | .subtasks[] | select(.id == 1)' tasks/tasks.json > /dev/null 2>&1; then
    log_error "Subtask 1.1 not found in tasks.json within $(pwd). Cannot perform update-subtask tests."
    exit 1
fi
log_info "Subtask 1.1 found in $(pwd)/tasks/tasks.json, proceeding with verification."

jq -c 'to_entries[] | .key as $provider | .value[] | select(.allowed_roles[]? == "fallback") | {provider: $provider, id: .id}' "$SUPPORTED_MODELS_FILE" | while IFS= read -r model_info; do
    provider=$(echo "$model_info" | jq -r '.provider')
    model_id=$(echo "$model_info" | jq -r '.id')
    flag=""

    if grep -Fq "${provider},${model_id}," "$PROGRESS_LOG_FILE"; then
        log_info "--- Skipping: $provider / $model_id (already tested, result in $PROGRESS_LOG_FILE) ---"
        # Still need to sum up its cost if it was successful before
        previous_test_output=$(grep -F "${provider},${model_id}," "$PROGRESS_LOG_FILE" | head -n 1)
        # Assuming the output file for successful test exists and contains cost
        prev_output_file="update_subtask_raw_output_${provider}_${model_id//\//_}.log"
        if [[ "$previous_test_output" == *",SUCCESS"* && -f "$prev_output_file" ]]; then
            # shellcheck disable=SC2154 # overall_start_time is set
            log_info "Summing cost from previous successful test of $provider / $model_id from $prev_output_file"
            # shellcheck disable=SC2154 # total_fallback_cost is set
            total_fallback_cost=$(extract_and_sum_cost "$(cat "$prev_output_file")" "$total_fallback_cost")
            log_info "Cumulative fallback AI cost after previous $provider / $model_id: $total_fallback_cost USD"
        fi
        continue
    fi

    log_info "--- Verifying: $provider / $model_id ---"

    if [ "$provider" == "openrouter" ]; then flag="--openrouter"; fi
    if [ "$provider" == "ollama" ]; then flag="--ollama"; fi

    if ! command -v task-master &> /dev/null; then
        log_error "task-master command not found."
        echo "[INSTRUCTION FV] Please run 'npm link task-master-ai' in the project root first."
        exit 1
    fi
    log_info "Setting main model to $model_id ${flag:+using flag $flag}..."
    set_model_cmd="task-master models --set-main \"$model_id\" $flag"
    if ! eval "$set_model_cmd" > /dev/null 2>&1; then
        log_error "Failed to set main model for $provider / $model_id. Skipping test."
        echo "$provider,$model_id,SET_MODEL_FAILED" >> "$PROGRESS_LOG_FILE"
        continue
    fi
    log_info "Set main model ok."

    log_info "Running update-subtask --id=1.1 --prompt='Test generateObjectService' (timeout 120s)"
    update_subtask_output_file="update_subtask_raw_output_${provider}_${model_id//\//_}.log"
    
    # Capture output to a variable AND a file
    update_subtask_command_output=""
    timeout 120s task-master update-subtask --id=1.1 --prompt="Simple test prompt to verify generateObjectService call." 2>&1 | tee "$update_subtask_output_file" &
    # Store the command output in a variable simultaneously
    # update_subtask_command_output=$(timeout 120s task-master update-subtask --id=1.1 --prompt="Simple test prompt to verify generateObjectService call." 2>&1)
    # The above direct capture won't work well with tee and backgrounding. Instead, read the file after command completion.
    child_pid=$!
    wait "$child_pid"
    update_subtask_exit_code=$?
    child_pid=0

    # Read output from file for cost extraction
    if [ -f "$update_subtask_output_file" ]; then
        update_subtask_command_output=$(cat "$update_subtask_output_file")
    else
        update_subtask_command_output="" # Ensure it's defined
    fi

    result_status=""
    if [ $update_subtask_exit_code -eq 0 ] && echo "$update_subtask_command_output" | grep -q "Successfully updated subtask #1.1"; then
        log_success "update-subtask succeeded for $provider / $model_id (Verified Output)."
        result_status="SUCCESS"
        # Extract and sum cost if successful
        # shellcheck disable=SC2154 # total_fallback_cost is set
        total_fallback_cost=$(extract_and_sum_cost "$update_subtask_command_output" "$total_fallback_cost")
        log_info "Cumulative fallback AI cost after $provider / $model_id: $total_fallback_cost USD"
    elif [ $update_subtask_exit_code -eq 124 ]; then
        log_error "update-subtask TIMED OUT for $provider / $model_id. Check $update_subtask_output_file."
        result_status="FAILED_TIMEOUT"
    elif [ $update_subtask_exit_code -eq 130 ] || [ $update_subtask_exit_code -eq 143 ]; then
         log_error "update-subtask INTERRUPTED for $provider / $model_id."
         result_status="INTERRUPTED"
    else
        log_error "update-subtask FAILED for $provider / $model_id (Exit Code: $update_subtask_exit_code). Check $update_subtask_output_file."
        result_status="FAILED"
    fi

    echo "$provider,$model_id,$result_status" >> "$PROGRESS_LOG_FILE"

done

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
# Print the total cost for this script's operations
formatted_total_fallback_cost=$(printf "%.6f" "$total_fallback_cost")
echo "Total Fallback AI Cost (this script run): $formatted_total_fallback_cost USD" # This line will be parsed
echo "-------------------------------------------------------"
echo ""

log_info "Finished Fallback Model (generateObjectService) Verification Script"

trap - INT TERM
exit 0
