---
"task-master-ai": minor
---

Add --tag flag support to core commands for multi-context task management. Commands like parse-prd, analyze-complexity, and others now support targeting specific task lists, enabling rapid prototyping and parallel development workflows.

Key features:
- parse-prd --tag=feature-name: Parse PRDs into separate task contexts on the fly
- analyze-complexity --tag=branch: Generate tag-specific complexity reports  
- All task operations can target specific contexts while preserving other lists
- Non-existent tags are created automatically for seamless workflow

