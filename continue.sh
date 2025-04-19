#!/bin/bash

# continue.sh - For compatibility, redirect to continue-scan.sh
# This script simply forwards all arguments to continue-scan.sh

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
"$SCRIPT_DIR/continue-scan.sh" "$@" 