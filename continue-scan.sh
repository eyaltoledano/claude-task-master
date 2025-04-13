#!/bin/bash

# continue-scan.sh
# This script continues the workspace scanner process and displays all generated documents

# Set NODE_OPTIONS to increase memory limit if needed
export NODE_OPTIONS="--max-old-space-size=4096"

# Determine the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Run the continue-scan.js script
node "$SCRIPT_DIR/scripts/continue-scan.js" "$@"

# Check for successful execution
if [ $? -eq 0 ]; then
  echo -e "\n✅ Workspace scan continuation completed successfully!"
else
  echo -e "\n❌ Workspace scan continuation failed!"
  exit 1
fi 