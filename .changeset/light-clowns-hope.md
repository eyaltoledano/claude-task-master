---
"task-master-ai": patch
---

Add support for ZAI (GLM) Coding Plan subscription endpoint as a separate provider. Users can now select between two ZAI providers:

- **zai**: Standard ZAI endpoint (`https://api.z.ai/api/paas/v4/`)
- **zai-coding**: Coding Plan endpoint (`https://api.z.ai/api/coding/paas/v4/`)

Both providers use the same model IDs (glm-4.6, glm-4.5) but route to different API endpoints based on your subscription. When running `tm models --setup`, you'll see both providers listed separately:

- `zai / glm-4.6` - Standard endpoint
- `zai-coding / glm-4.6` - Coding Plan endpoint
