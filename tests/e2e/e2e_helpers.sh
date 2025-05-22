#!/bin/bash

# --- LLM Analysis Helper Function ---
# This function should be sourced by the main E2E script or test scripts.
# It requires curl and jq to be installed.
# It expects the project root path to be passed as the second argument.

# --- New Function: extract_and_sum_cost ---
# Takes a string containing command output.
# Extracts costs (lines with "Est. Cost: $X.YYYYYY" or similar from telemetry output)
# from the output, sums them, and adds them to the GLOBAL total_e2e_cost variable.
extract_and_sum_cost() {
  local command_output="$1"
  # Ensure total_e2e_cost is treated as a number, default to 0.0 if not set or invalid
  if ! [[ "$total_e2e_cost" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
    total_e2e_cost="0.0"
  fi

  local extracted_cost_sum="0.0"

  # Grep for lines containing "Est. Cost: $", then extract the numeric value.
  # Example line: │     Est. Cost: $0.093549                       │
  # Accumulate all costs found in the command_output
  while IFS= read -r line; do
    # Extract the numeric part after 'Est. Cost: $' and before any trailing spaces/chars
    cost_value=$(echo "$line" | grep -o -E 'Est\. Cost: \$([0-9]+\.[0-9]+)' | sed -E 's/Est\. Cost: \$//g')
    if [[ -n "$cost_value" && "$cost_value" =~ ^[0-9]+\.[0-9]+$ ]]; then
      # echo "[DEBUG] Found cost value: $cost_value in line: '$line'" # For debugging
      extracted_cost_sum=$(echo "$extracted_cost_sum + $cost_value" | bc)
    # else # For debugging
      # echo "[DEBUG] No valid cost value found or extracted in line: '$line' (extracted: '$cost_value')" # For debugging
    fi
  done < <(echo "$command_output" | grep -E 'Est\. Cost: \$')

  # echo "[DEBUG] Extracted sum from this command output: $extracted_cost_sum" # For debugging
  if (( $(echo "$extracted_cost_sum > 0" | bc -l) )); then
    total_e2e_cost=$(echo "$total_e2e_cost + $extracted_cost_sum" | bc)
    # echo "[DEBUG] Updated global total_e2e_cost: $total_e2e_cost" # For debugging
  fi
  # No echo here, the function modifies a global variable.
}
export -f extract_and_sum_cost # Export for use in other scripts if sourced

analyze_log_with_llm() {
  local log_file="$1"
  local project_root="$2" # Expect project root as the second argument

  if [ -z "$project_root" ]; then
      echo "[HELPER_ERROR] Project root argument is missing. Skipping LLM analysis." >&2
      return 1
  fi

  local env_file="${project_root}/.env" # Path to .env in project root
  local supported_models_file="${project_root}/scripts/modules/supported-models.json"

  local provider_summary_log="provider_add_task_summary.log" # File summarizing provider test outcomes
  local api_key=""
  local api_endpoint="https://api.anthropic.com/v1/messages"
  local api_key_name="ANTHROPIC_API_KEY"
  local llm_analysis_model_id="claude-3-7-sonnet-20250219" # Model used for this analysis
  local llm_analysis_provider="anthropic"

  echo "" # Add a newline before analysis starts

  if ! command -v jq &> /dev/null; then
    echo "[HELPER_ERROR] LLM Analysis requires 'jq'. Skipping analysis." >&2
    return 1
  fi
  if ! command -v curl &> /dev/null; then
    echo "[HELPER_ERROR] LLM Analysis requires 'curl'. Skipping analysis." >&2
    return 1
  fi
  if ! command -v bc &> /dev/null; then
    echo "[HELPER_ERROR] LLM Analysis requires 'bc' for cost calculation. Skipping analysis." >&2
    return 1
  fi

  if [ -f "$env_file" ]; then
    api_key=$(grep "^${api_key_name}=" "$env_file" | sed -e "s/^${api_key_name}=//" -e 's/^[[:space:]"]*//' -e 's/[[:space:]"]*$//')
  fi

  if [ -z "$api_key" ]; then
    echo "[HELPER_ERROR] ${api_key_name} not found or empty in project root .env file ($env_file). Skipping LLM analysis." >&2
    return 1
  fi

  if [ ! -f "$log_file" ]; then
    echo "[HELPER_ERROR] Log file not found: $log_file (PWD: $(pwd)). Check path passed to function. Skipping LLM analysis." >&2
    return 1
  fi

  local log_content
  log_content=$(cat "$log_file") || {
    echo "[HELPER_ERROR] Failed to read log file: $log_file. Skipping LLM analysis." >&2
    return 1
  }

  read -r -d '' prompt_template <<'EOF'
Analyze the following E2E test log for the task-master tool. The log contains output from various 'task-master' commands executed sequentially.

Your goal is to:
1. Verify if the key E2E steps completed successfully based on the log messages (e.g., init, parse PRD, list tasks, analyze complexity, expand task, set status, manage models, add/remove dependencies, add/update/remove tasks/subtasks, generate files).
2. **Specifically analyze the Multi-Provider Add-Task Test Sequence:**
   a. Identify which providers were tested for `add-task`. Look for log steps like "Testing Add-Task with Provider: ..." and the summary log 'provider_add_task_summary.log'.
   b. For each tested provider, determine if `add-task` succeeded or failed. Note the created task ID if successful.
   c. Review the corresponding `add_task_show_output_<provider>_id_<id>.log` file (if created) for each successful `add-task` execution.
   d. **Compare the quality and completeness** of the task generated by each successful provider based on their `show` output. Assign a score (e.g., 1-10, 10 being best) based on relevance to the prompt, detail level, and correctness.
   e. Note any providers where `add-task` failed or where the task ID could not be extracted.
3. Identify any general explicit "[ERROR]" messages or stack traces throughout the *entire* log.
4. Identify any potential warnings or unusual output that might indicate a problem even if not marked as an explicit error.
5. Provide an overall assessment of the test run's health based *only* on the log content.

Return your analysis **strictly** in the following JSON format. Do not include any text outside of the JSON structure:

{
  "overall_status": "Success|Failure|Warning",
  "verified_steps": [ "Initialization", "PRD Parsing", /* ...other general steps observed... */ ],
  "provider_add_task_comparison": {
     "prompt_used": "... (extract from log if possible or state 'standard auth prompt') ...",
     "provider_results": {
       "anthropic": { "status": "Success|Failure|ID_Extraction_Failed|Set_Model_Failed", "task_id": "...", "score": "X/10 | N/A", "notes": "..." },
       "openai": { "status": "Success|Failure|...", "task_id": "...", "score": "X/10 | N/A", "notes": "..." },
       /* ... include all tested providers ... */
     },
     "comparison_summary": "Brief overall comparison of generated tasks..."
   },
  "detected_issues": [ { "severity": "Error|Warning|Anomaly", "description": "...", "log_context": "[Optional, short snippet from log near the issue]" } ],
  "llm_summary_points": [ "Overall summary point 1", "Provider comparison highlight", "Any major issues noted" ]
}

Here is the main log content:

%s
EOF

  local full_prompt
  if ! printf -v full_prompt "$prompt_template" "$log_content"; then
    echo "[HELPER_ERROR] Failed to format prompt using printf." >&2
    return 1
  fi

  local payload
  payload=$(jq -n --arg prompt "$full_prompt" '{
    "model": "'"$llm_analysis_model_id"'",
    "max_tokens": 3072,
    "messages": [
      {"role": "user", "content": $prompt}
    ]
  }') || {
      echo "[HELPER_ERROR] Failed to create JSON payload using jq." >&2
      return 1
  }

  local response_raw response_http_code response_body
  response_raw=$(curl -s -w "\nHTTP_STATUS_CODE:%{http_code}" -X POST "$api_endpoint" \
       -H "Content-Type: application/json" \
       -H "x-api-key: $api_key" \
       -H "anthropic-version: 2023-06-01" \
       --data "$payload")

  response_http_code=$(echo "$response_raw" | grep '^HTTP_STATUS_CODE:' | sed 's/HTTP_STATUS_CODE://')
  response_body=$(echo "$response_raw" | sed '$d')

  if [ "$response_http_code" != "200" ]; then
      echo "[HELPER_ERROR] LLM API call failed with HTTP status $response_http_code." >&2
      echo "[HELPER_ERROR] Response Body: $response_body" >&2
      return 1
  fi

  if [ -z "$response_body" ]; then
      echo "[HELPER_ERROR] LLM API call returned empty response body." >&2
      return 1
  fi

  # Calculate cost of this LLM analysis call
  local input_tokens output_tokens input_cost_per_1m output_cost_per_1m calculated_llm_cost
  input_tokens=$(echo "$response_body" | jq -r '.usage.input_tokens // 0')
  output_tokens=$(echo "$response_body" | jq -r '.usage.output_tokens // 0')

  if [ -f "$supported_models_file" ]; then
      model_cost_info=$(jq -r --arg provider "$llm_analysis_provider" --arg model_id "$llm_analysis_model_id" '
          .[$provider][] | select(.id == $model_id) | .cost_per_1m_tokens
      ' "$supported_models_file")

      if [[ -n "$model_cost_info" && "$model_cost_info" != "null" ]]; then
          input_cost_per_1m=$(echo "$model_cost_info" | jq -r '.input // 0')
          output_cost_per_1m=$(echo "$model_cost_info" | jq -r '.output // 0')

          calculated_llm_cost=$(echo "($input_tokens / 1000000 * $input_cost_per_1m) + ($output_tokens / 1000000 * $output_cost_per_1m)" | bc -l)
          # Format to 6 decimal places
          formatted_llm_cost=$(printf "%.6f" "$calculated_llm_cost")
          echo "LLM Analysis AI Cost: $formatted_llm_cost USD" # This line will be parsed by run_e2e.sh
      else
          echo "[HELPER_WARNING] Cost data for model $llm_analysis_model_id not found in $supported_models_file. LLM analysis cost not calculated."
      fi
  else
      echo "[HELPER_WARNING] $supported_models_file not found. LLM analysis cost not calculated."
  fi
  # --- End cost calculation for this call ---

  if echo "$response_body" | node "${project_root}/tests/e2e/parse_llm_output.cjs" "$log_file"; then
      echo "[HELPER_SUCCESS] LLM analysis parsed and printed successfully by Node.js script."
      return 0
  else
      local node_exit_code=$?
      echo "[HELPER_ERROR] Node.js parsing script failed with exit code ${node_exit_code}."
      echo "[HELPER_ERROR] Raw API response body (first 500 chars): $(echo "$response_body" | head -c 500)"
      return 1
  fi
}

export -f analyze_log_with_llm 