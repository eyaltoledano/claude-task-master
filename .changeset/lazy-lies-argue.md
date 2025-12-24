---
"task-master-ai": patch
---

Smarter project root detection with boundary markers

- Prevents Task Master from incorrectly detecting `.taskmaster` folders in your home directory when working inside a different project
- Now stops at project boundaries (`.git`, `package.json`, lock files) instead of searching all the way up to the filesystem root
- Adds support for monorepo markers (`lerna.json`, `nx.json`, `turbo.json`) and additional lock files (`bun.lockb`, `deno.lock`)
