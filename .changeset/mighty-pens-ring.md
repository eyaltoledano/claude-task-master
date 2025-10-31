---
"task-master-ai": minor
---

Add native support for Z.ai (GLM models), giving you access to high-performance Chinese models including glm-4.6 with massive 200K+ token context windows at competitive pricing

**How to use:**

1. Get your Z.ai API key from <https://z.ai/manage-apikey/apikey-list>
2. Set your API key in .env, mcp.json or in env exports:

   ```bash
   ZAI_API_KEY="your-key-here"
   ```

3. Configure Task Master to use GLM models:

   ```bash
   task-master models --set-main glm-4.6
   # Or for an interactive view
   task-master models --setup
   ```

**Available models:**

- `glm-4.6` - Latest model with 200K+ context, excellent for complex projects
- `glm-4.5` - Previous generation, still highly capable
- Additional GLM variants for different use cases: `glm-4.5-air`, `glm-4.5v`

GLM models offer strong performance on software engineering tasks, with particularly good results on code generation and technical reasoning. The large context window makes them ideal for analyzing entire codebases or working with extensive documentation.
