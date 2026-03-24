---
"task-master-ai": patch
---

Fix CLI using the wrong project's brief context when running in solo-mode repos. Previously, if you were logged into Hamster in one project and then ran Task Master in a different project, it would incorrectly use the previous project's brief context. Brief/org selection is now scoped per workspace (`~/.taskmaster/{projectId}/context.json`) instead of stored globally. Auth tokens remain global as intended — you stay logged in across repos, but each workspace gets its own brief context. Projects with local task files also get an additional safeguard to always prefer file storage.
