---
"task-master-ai": patch
---

Fix: `codexCli.commandSpecific` config is no longer leaked into the Codex CLI provider's `defaultSettings`. Previously, using `commandSpecific` in the `codexCli` config block caused Codex CLI to reject the settings with "Invalid default settings: Unrecognized key: commandSpecific". The key is now stripped before the settings are forwarded to `createCodexCli()`.
