---
"task-master-ai": minor
---

Complete Groq provider integration and add MoonshotAI Kimi K2 model support

- Fixed missing Groq provider registration in ai-services-unified.js
- Added required getRequiredApiKeyName() method to GroqProvider class  
- Added Groq API key validation in config-manager.js
- Added GROQ_API_KEY to env.example
- Added moonshotai/kimi-k2-instruct model with $1/$3 per 1M token pricing and 16k max output