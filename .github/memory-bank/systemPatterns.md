# System Patterns & Architecture

## Core Architecture Principles

### Modular AI Provider System
Task Master uses a **provider pattern** for AI integration, enabling support for multiple AI services through a unified interface:

- **BaseAIProvider**: Abstract base class defining common interface (`generateText`, `streamText`, `generateObject`)
- **Provider Implementations**: Specific classes for each AI service (Anthropic, OpenAI, Google, etc.)
- **Unified Service Layer**: `ai-services-unified.js` orchestrates provider selection and fallback chains
- **Configuration Management**: Role-based provider assignment (main, research, fallback)

### MCP Integration Architecture
The system supports both CLI and MCP (Model Context Protocol) access through a **dual-interface pattern**:

```
┌─────────────────┐         ┌─────────────────┐
│    CLI User     │         │    MCP User     │
└────────┬────────┘         └────────┬────────┘
         │                           │
         ▼                           ▼
┌────────────────┐         ┌────────────────────┐
│  commands.js   │         │   MCP Tool API     │
└────────┬───────┘         └──────────┬─────────┘
         │                            │
         ▼                            ▼
┌───────────────────────────────────────────────┐
│     Core Modules (task-manager.js, etc.)     │
└───────────────────────────────────────────────┘
```

### Source-Aware Functions
Core functions detect their execution context via a `source` parameter:
- **CLI Mode**: Full UI output, terminal interactions, banners
- **MCP Mode**: Structured JSON responses, minimal output

### Configuration Layering
Task Master uses a **layered configuration approach**:
1. **Project Config**: `.taskmasterconfig` for models, parameters, project settings
2. **Environment Variables**: API keys and sensitive data only
3. **Session Context**: MCP session provides runtime API key access
4. **Defaults**: Sensible fallbacks when configuration is missing

## Key Design Patterns

### Provider Registry Pattern
```javascript
const PROVIDERS = {
  anthropic: new AnthropicAIProvider(),
  openai: new OpenAIProvider(),
  google: new GoogleAIProvider(),
  // ... etc
};
```

All providers implement the same interface but handle provider-specific authentication, configuration, and API interactions.

### Role-Based AI Selection
Three distinct AI roles with independent provider/model configuration:
- **Main**: Primary AI for task generation and general operations
- **Research**: Specialized for external research and fresh information (Perplexity optimized)
- **Fallback**: Backup when main provider fails

### Intelligent Fallback Chain
When an AI call fails, the system automatically tries the next provider in the sequence:
1. Try configured provider for the role
2. Log the failure and try next role in sequence (main → fallback → research)
3. Return meaningful error if all providers fail

### Context Gathering System
The `ContextGatherer` class provides intelligent context collection:
- **Task Context**: Relevant tasks and their dependencies
- **File Context**: Source code and documentation
- **Project Tree**: High-level project structure
- **Semantic Search**: AI-powered relevant task discovery
- **Token Management**: Automatic context size optimization

### Tag-Based Organization
Tasks are organized using a **tag system** that supports:
- **Current Tag**: Active development context (usually matches git branch)
- **Tag Switching**: Move between different task contexts
- **Git Integration**: Automatic tag switching based on branch
- **Tag Isolation**: Tasks can be organized by feature, phase, or any logical grouping

## Component Relationships

### Core Task Management
- **Tasks JSON**: Single source of truth for all task data
- **Task Manager**: Core CRUD operations and business logic
- **Context Gatherer**: Intelligent context collection for AI operations
- **Dependency Manager**: Handles task relationships and dependency chains

### AI Orchestration Layer
- **AI Services Unified**: Central orchestration of all AI operations
- **Provider Registry**: Management of AI provider instances
- **Configuration Manager**: Role-based provider and model selection
- **Session Management**: Handles both CLI and MCP execution contexts

### Interface Layer
- **CLI Commands**: Direct command-line interface via Commander.js
- **MCP Server**: Model Context Protocol server for IDE integration
- **MCP Tools**: Individual tool implementations for MCP protocol
- **Direct Functions**: MCP-callable functions that bypass CLI UI

### Data Flow Patterns

#### Task Creation Flow
1. **Input**: PRD document or task prompt
2. **Context**: Gather relevant existing tasks and dependencies
3. **AI Generation**: Use configured AI provider to generate task details
4. **Validation**: Ensure task structure and dependencies are valid
5. **Storage**: Save to tasks.json and generate task files
6. **Notification**: Provide feedback via CLI or MCP response

#### Research Integration Flow
1. **Query**: User provides research query with optional context
2. **Context Assembly**: Gather relevant tasks, files, and project info
3. **AI Research**: Use research-optimized provider (typically Perplexity)
4. **Integration**: Optionally save research results to tasks
5. **Follow-up**: Support conversation continuity for deeper exploration

#### Provider Failover Flow
1. **Initial Call**: Try primary provider for the role
2. **Error Detection**: Detect retryable vs. fatal errors
3. **Retry Logic**: Exponential backoff for retryable errors
4. **Fallback**: Switch to next provider in sequence
5. **Error Aggregation**: Collect and report all failure reasons

## Critical Design Decisions

### ES Modules Adoption
- **Rationale**: Modern JavaScript patterns, better tree shaking, future-proof
- **Impact**: All imports use ESM syntax, affects testing and module loading
- **Trade-offs**: Some compatibility challenges with older Node.js tooling

### File-Based Configuration
- **Rationale**: Version controllable, environment-independent model configuration
- **Pattern**: `.taskmasterconfig` for settings, environment variables only for secrets
- **Benefits**: Teams can share model preferences, easier debugging

### MCP First-Class Support
- **Rationale**: AI development tools increasingly support MCP protocol
- **Architecture**: All functionality available via both CLI and MCP
- **Future-Proofing**: Positions Task Master for AI tool ecosystem growth

### Multi-Provider AI Strategy
- **Rationale**: Different AI models excel at different tasks, avoid vendor lock-in
- **Pattern**: Role-based provider assignment with intelligent fallback
- **Flexibility**: Users can optimize for cost, capability, or availability

### JSON + Markdown Dual Format
- **Rationale**: JSON for programmatic access, Markdown for AI consumption
- **Synchronization**: Generated markdown files stay in sync with JSON data
- **AI Optimization**: Markdown format optimized for AI context windows
