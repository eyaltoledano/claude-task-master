---
"task-master-ai": minor
---

Migrate AI services to use generateObject for structured data generation

This update migrates all AI service calls from generateText to generateObject, ensuring more reliable and structured responses across all commands.

### Key Changes:

- **Unified AI Service**: Replaced separate generateText implementations with a single generateObjectService that handles structured data generation
- **JSON Mode Support**: Added proper JSON mode configuration for providers that support it (OpenAI, Anthropic, Google, Groq)
- **Schema Validation**: Integrated Zod schemas for all AI-generated content with automatic validation
- **Provider Compatibility**: Maintained compatibility with all existing providers while leveraging their native structured output capabilities
- **Improved Reliability**: Structured output generation reduces parsing errors and ensures consistent data formats

### Technical Improvements:

- Centralized provider configuration in `ai-providers-unified.js`
- Added `generateObject` support detection for each provider
- Implemented proper error handling for schema validation failures
- Maintained backward compatibility with existing prompt structures

### Bug Fixes:

- Fixed subtask ID numbering issue where AI was generating inconsistent IDs (101-105, 601-603) instead of sequential numbering (1, 2, 3...)
- Enhanced prompt instructions to enforce proper ID generation patterns
- Ensured subtasks display correctly as X.1, X.2, X.3 format

This migration improves the reliability and consistency of AI-generated content throughout the Task Master application.