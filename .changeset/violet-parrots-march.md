---
'task-master-ai': patch
---

Adds a 'models' CLI and MCP command to get the current model configuration, available models, and gives the ability to set main/research/fallback models." 
    - In the CLI, `task-master models` shows the current models config. Using the `--setup` flag launches an interactive set up that allows you to easily select the models you want to use for each of the three roles. Use `q` during the interactive setup to cancel the setup.
    - In the MCP, responses are simplified in RESTful format (instead of the full CLI output). The agent can use the `models` tool with different arguments, including `listAvailableModels` to get available models. Run without arguments, it will return the current configuration. Arguments are available to set the model for each of the three roles. This allows you to manage Taskmaster AI providers and models directly from either the CLI or MCP or both.
    - Updated the CLI help menu when you run `task-master` to include missing commands and .taskmasterconfig information.
    - Adds `--research` flag to `add-task` so you can hit up Perplexity right from the add-task flow, rather than having to add a task and then update it.