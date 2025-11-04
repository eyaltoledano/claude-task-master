---
"task-master-ai": patch
---

Fix parse-prd schema to accept responses from models that omit optional fields (like Z.ai/GLM). Changed `metadata` field to use union pattern with `.default(null)` for better structured outputs compatibility.
