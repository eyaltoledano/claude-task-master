#!/bin/bash

# quiet-scan.sh - Run the Task Master workspace scanner with minimal output
# 
# Usage: ./quiet-scan.sh [directory]
# 
# This script runs the workspace scanner with LOG_LEVEL=error to suppress
# all logs except errors, showing only the progress bar.

# Check if script is run with execute permission
if [ ! -x "$0" ]; then
  echo "Please run with: bash quiet-scan.sh or chmod +x quiet-scan.sh first"
fi

# Default directory is current directory if not specified
DIRECTORY=${1:-.}

# Export LOG_LEVEL as environment variable
export LOG_LEVEL=error

# Run the scanner with the quiet flag and specified directory
npx task-master scan-workspace "$DIRECTORY" --quiet

# Exit with the same code as the scanner
exit $? 