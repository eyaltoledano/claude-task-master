# Claude Task Master - Project Brief

## Core Mission
Claude Task Master is an AI-driven task management system that bridges the gap between high-level project requirements and granular implementation tasks. It provides a structured way to parse Product Requirements Documents (PRDs) into actionable, dependency-aware tasks with AI assistance for task generation, expansion, and management.

## Problems It Solves

### 1. Implementation Drift
- **Problem**: During development, teams often diverge from original requirements without updating future tasks
- **Solution**: Task Master provides mechanisms to update all downstream tasks when architectural decisions change

### 2. Task Granularity Gap
- **Problem**: High-level requirements are too broad for implementation; manual task breakdown is time-consuming
- **Solution**: AI-powered task expansion and subtask generation with research-backed context

### 3. Dependency Management Complexity
- **Problem**: Complex task dependencies are hard to track and manage manually
- **Solution**: Automated dependency inference and visualization with intelligent dependency chain analysis

### 4. Context Loss in AI-Driven Development
- **Problem**: AI assistants lack project context and lose track of completed work
- **Solution**: Centralized task state with rich context that can be fed to AI tools via CLI and MCP integration

## Core Requirements

### Primary Objectives
1. **PRD-to-Tasks Conversion**: Parse requirements documents and generate structured task hierarchies
2. **AI-Enhanced Task Management**: Leverage multiple AI providers for task generation, expansion, and research
3. **Dependency Intelligence**: Automatically infer and manage task dependencies
4. **Multi-Channel Access**: Provide both CLI and MCP server interfaces for maximum flexibility
5. **Research Integration**: Incorporate fresh external research into task planning and execution

### Essential Features
- **Multi-Provider AI Support**: Anthropic Claude, OpenAI, Google, Perplexity, xAI, OpenRouter, Ollama, Azure, Bedrock, Vertex AI
- **Task File Generation**: Generate individual task files for AI agent consumption
- **Tag-Based Organization**: Organize tasks by feature branches or development phases
- **Progress Tracking**: Monitor completion status and next actionable items
- **MCP Server Integration**: Full integration with Model Context Protocol for IDE usage

### Technical Constraints
- **Node.js**: ES Modules, version 14.0.0+
- **Configuration Management**: File-based config (`.taskmasterconfig`) + environment variables for API keys
- **Data Format**: JSON-based task storage with markdown file generation
- **AI Provider Abstraction**: Unified interface supporting multiple AI providers with fallback chains

## Success Metrics
1. **Faster Development Cycles**: Reduce time from PRD to implementation-ready tasks
2. **Better Task Granularity**: Generate appropriately-sized tasks with clear acceptance criteria
3. **Reduced Context Switching**: Provide rich context to AI development tools
4. **Improved Dependency Management**: Minimize blocking issues through better dependency tracking
5. **Enhanced AI Integration**: Seamless workflow with AI coding assistants like Claude Desktop/Cursor

## Project Scope
- **Core Task Management**: Full CRUD operations on tasks and subtasks
- **AI Integration**: Multi-provider support with intelligent fallback
- **CLI Interface**: Complete command-line tool for direct usage
- **MCP Server**: Full MCP protocol implementation for IDE integration
- **Research Tools**: Integration with research-capable AI models for enhanced context
- **Git Integration**: Tag management tied to branch workflows

## Non-Goals
- **UI/Web Interface**: Command-line and MCP integration only
- **Team Collaboration**: Single-user focused (though files can be shared via git)
- **Time Tracking**: Focus on task state, not time measurement
- **Advanced Project Management**: Not a replacement for Jira/Linear, but a development-focused tool
