#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}=======================================${NC}"
echo -e "${BLUE}    Task Master MCP Server Setup    ${NC}"
echo -e "${BLUE}=======================================${NC}"

# Function to check for dependency
check_dependency() {
  if ! command -v $1 &> /dev/null; then
    echo -e "${RED}❌ $1 is not installed. Please install it first.${NC}"
    exit 1
  fi
}

# Check for required tools
check_dependency node
check_dependency npm

# Get Node.js version
NODE_VERSION=$(node -v)
echo -e "${BLUE}Node.js version:${NC} $NODE_VERSION"

# Try installing fastmcp with different versions
install_fastmcp() {
  # Array of versions to try
  versions=("latest" "0.0.73" "0.0.40" "0.0.30")
  
  echo -e "${YELLOW}⚙️ Attempting to install fastmcp...${NC}"
  
  for version in "${versions[@]}"; do
    echo -e "${CYAN}Trying fastmcp@${version}...${NC}"
    npm install fastmcp@$version --no-save --loglevel=error > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}✅ Successfully installed fastmcp@${version}${NC}"
      return 0
    else
      echo -e "${YELLOW}⚠️ Failed to install fastmcp@${version}${NC}"
    fi
  done
  
  # If we get here, all installation attempts failed
  echo -e "${RED}❌ Could not install any version of fastmcp${NC}"
  echo -e "${YELLOW}ℹ️ Will continue with fallback server implementation${NC}"
  return 1
}

# Install fastmcp if not already installed
if ! npm list fastmcp --depth=0 &> /dev/null; then
  install_fastmcp
else
  echo -e "${GREEN}✅ fastmcp is already installed${NC}"
fi

# Start the server
echo -e "${YELLOW}🚀 Starting MCP server...${NC}"
echo -e "${CYAN}The server will be available on your local network${NC}"
echo -e "${CYAN}You can test it with: npm run test-server${NC}"
node mcp-server/server.js

# If the server exits with an error, we'll reach here
echo -e "${RED}Server stopped unexpectedly${NC}" 