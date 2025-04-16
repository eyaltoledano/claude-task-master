---
'task-master-ai': patch
---

Adds model management and new configuration file .taskmasterconfig which houses the models used for main, research and fallback. Adds models command and setter flags. Adds a --setup flag with an interactive setup. We should be calling this during init. Shows a table of active and available models when models is called without flags. Includes SWE scores and token costs, which are manually entered into the supported_models.json, the new place where models are defined for support. Config-manager.js is the core module responsible for managing the new config."
