---
'task-master-ai': minor
---
Tweaks Perplexity AI calls for research mode to max out input tokens and get day-fresh information
    - Forces temp at 0.1 for highly deterministic output, no variations
    - Adds a system prompt to further improve the output
    - Correctly uses the maximum input tokens (8,719, used 8,700) for perplexity
    - Specificies to use a high degree of research across the web
    - Specifies to use information that is as fresh as today; this support stuff like capturing brand new announcements like new GPT models and being able to query for those in research. 🔥
