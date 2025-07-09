Quick install Task Master globally if not already installed.

Execute this streamlined installation:

```bash
# Check and install in one command
task-master --version 2>/dev/null || npm install -g task-master-ai

# Verify installation
task-master --version

# Quick setup check
task-master models --status || echo "Note: You'll need to set up an AI provider API key"
```

If you see "command not found" after installation, you may need to:
1. Restart your terminal
2. Or add npm global bin to PATH: `export PATH=$(npm bin -g):$PATH`

Once installed, you can use all the Task Master commands!

Quick test: Run `/project:help` to see all available commands.