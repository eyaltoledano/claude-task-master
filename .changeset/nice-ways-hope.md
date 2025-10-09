---
"task-master-ai": minor
---

Add RPG (Repository Planning Graph) method template for structured PRD creation. The new `example_prd_rpg.txt` template teaches AI agents and developers the RPG methodology through embedded instructions, inline good/bad examples, and XML-style tags for structure. This template enables creation of dependency-aware PRDs that automatically generate topologically-ordered task graphs when parsed with Task Master.

Key features:
- Method-as-template: teaches RPG principles (dual-semantics, explicit dependencies, topological order) while being used
- Inline instructions at decision points guide AI through each section
- Good/bad examples for immediate pattern matching
- Flexible plain-text format with XML-style tags for parseability
- Critical dependency-graph section ensures correct task ordering
- Automatic inclusion during `task-master init`
- Comprehensive documentation at [docs.task-master.dev/capabilities/rpg-method](https://docs.task-master.dev/capabilities/rpg-method)
- Tool recommendations for code-context-aware PRD creation (Claude Code, Cursor, Gemini CLI, Codex/Grok)

The RPG template complements the existing `example_prd.txt` and provides a more structured approach for complex projects requiring clear module boundaries and dependency chains.