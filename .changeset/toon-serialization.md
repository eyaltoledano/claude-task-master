---
"task-master-ai": minor
---

feat: Add TOON (Token-Oriented Object Notation) for LLM data serialization

Implements TOON format for 30-60% token reduction in LLM calls:

- **TOON Serializer**: Core JSON ↔ TOON conversion with round-trip validation  
- **LLM Integration**: Automatic provider enhancement with smart suitability analysis
- **CLI Tool**: Enable/disable TOON, test with sample data, convert files  
- **Zero-config**: Works transparently with existing Task Master workflows
- **Intelligent fallback**: Only uses TOON when beneficial (configurable thresholds)

Benefits:
- Reduces LLM token costs by 30-60% for structured data
- Optimized for task lists, uniform objects, API responses  
- Maintains 100% backward compatibility
- Automatic fallback for unsuitable data structures

Usage: `node scripts/toon-cli.js enable --min-savings 10`