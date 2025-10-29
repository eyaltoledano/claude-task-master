---
"task-master-ai": patch
---

fix: improve parse-prd schema by using .nullable() instead of .optional()

Changed metadata field from .optional() to .nullable() for better AI model compatibility. This allows the model to explicitly return null for fields without values, which aligns better with API expectations and is supported by most structured output integrations.