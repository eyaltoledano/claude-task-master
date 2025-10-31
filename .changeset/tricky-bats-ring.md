---
"task-master-ai": minor
---

Add LM Studio integration, enabling you to run Task Master completely offline with local models at zero API cost.

**How to use:**

1. Download and install [LM Studio](https://lmstudio.ai/)
2. Launch LM Studio and download a model (e.g., Llama 3.2, Mistral, Qwen)
3. Optional: Add api key to mcp.json or .env (LMSTUDIO_API_KEY)
4. Go to the "Local Server" tab and click "Start Server"
5. Configure Task Master:

   ```bash
   task-master models --set-main <model-name> --lmstudio
   ```

   Example:

   ```bash
   task-master models --set-main llama-3.2-3b --lmstudio
   ```
