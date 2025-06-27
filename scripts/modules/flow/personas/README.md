# Task Master Persona System

The Persona System enhances Task Master's Claude Code integration by providing cognitive frameworks that guide Claude's approach to different types of tasks. Based on SuperClaude's persona architecture, this system automatically detects the most appropriate persona for each task and builds comprehensive prompts for autonomous execution.

## Overview

Personas are cognitive modifiers that change how Claude approaches tasks. Each persona represents a specialized role with its own:
- Identity and beliefs
- Decision-making framework
- Problem-solving approach
- Success metrics
- Communication style

## Available Personas

### 🏛️ Architect
**Focus**: System design, scalability, long-term maintainability
**Best for**: Architecture decisions, system design, refactoring planning

### 🎨 Frontend
**Focus**: User experience, accessibility, performance
**Best for**: UI components, responsive design, user interactions

### ⚙️ Backend
**Focus**: Reliability, performance, scalability
**Best for**: API development, database design, server optimization

### 🔍 Analyzer
**Focus**: Root cause analysis, evidence-based investigation
**Best for**: Bug fixing, debugging, performance issues

### 🔒 Security
**Focus**: Threat modeling, vulnerability assessment, secure coding
**Best for**: Authentication, authorization, security audits

### 📚 Mentor
**Focus**: Knowledge transfer, documentation, teaching
**Best for**: Documentation, tutorials, code explanations

### ♻️ Refactorer
**Focus**: Code quality, technical debt reduction, maintainability
**Best for**: Code cleanup, refactoring, optimization

### ⚡ Performance
**Focus**: Optimization, bottleneck identification, benchmarking
**Best for**: Performance tuning, optimization, profiling

### ✅ QA
**Focus**: Quality assurance, testing, edge cases
**Best for**: Test writing, quality gates, validation

## How It Works

### 1. Automatic Detection

When launching Claude for a task, the system analyzes:
- Task title and description
- Keywords and patterns
- File types mentioned
- Task complexity
- Dependencies

Example detection:
```javascript
// Task: "Implement user authentication API endpoint"
// Detected personas:
// 1. Backend (90%) - Contains "API", "endpoint"
// 2. Security (85%) - Contains "authentication"
// 3. Architect (60%) - Has dependencies
```

### 2. Prompt Building

Once a persona is selected, the system builds a comprehensive prompt that includes:

```markdown
# Acting as: Backend engineer | Performance specialist | Scalability architect

## Core Belief
Reliability and performance enable everything else | Systems must handle scale

## Primary Question
"Will this handle 10x traffic with 99.9% uptime?"

## Implementation Plan
1. Analyze Requirements
2. Design for Reliability
3. Implementation
4. Performance Optimization

[Full task context and autonomous execution instructions...]
```

### 3. Launch Modes

#### Interactive Mode
- Opens Claude in a new terminal
- Creates CLAUDE.md with persona context
- User can interact directly with Claude

#### Headless Mode
- Runs Claude with comprehensive autonomous prompt
- No user interaction required
- Complete implementation based on persona

#### Batch Mode
- Processes multiple tasks
- Can use multi-persona workflows for complex projects
- Fully autonomous execution

## Usage in Flow TUI

1. **Navigate to Git Worktrees** (press `g`)
2. **Select a worktree** with linked tasks
3. **Press `c`** to launch Claude
4. **Choose launch mode**:
   - [1] Interactive
   - [2] Headless
   - [3] Batch (if multiple tasks)
5. **Review detected personas** and select one
6. **Add instructions** (for headless mode)
7. **Launch** - Claude executes with the selected persona

## Multi-Persona Workflows

For complex projects, the system can detect when multiple personas are needed:

```javascript
// Full-stack implementation detected
// Workflow: architect → backend → frontend → qa
```

Each persona phase builds on the previous one, ensuring comprehensive implementation.

## Customization

### Manual Persona Selection
- Press `p` in the persona selection screen
- Choose from all 9 available personas
- Override automatic detection when needed

### No Persona Mode
- Press `n` to launch without a persona
- Useful for general tasks or custom approaches

## Implementation Details

### File Structure
```
personas/
├── index.js                    # Main exports
├── persona-definitions.js      # Persona configurations
├── persona-detector.js         # Detection algorithms
├── persona-prompt-builder.js   # Prompt generation
└── README.md                  # This file
```

### Key Functions

```javascript
// Detect persona for a task
const personas = await detectPersona(task, worktree);

// Build autonomous prompt
const builder = new PersonaPromptBuilder('backend');
const prompt = builder.buildTaskPrompt(task);

// Launch Claude with persona
await backend.launchClaudeHeadless(worktree, tasks, prompt, {
  persona: 'backend',
  maxTurns: 10
});
```

## Best Practices

1. **Trust the Detection**: The system analyzes multiple signals to suggest personas
2. **Override When Needed**: Manual selection is available for edge cases
3. **Use Batch Mode**: For related tasks, batch mode maintains context
4. **Review Output**: Even in autonomous mode, review Claude's implementation

## Future Enhancements

- Custom persona definitions
- Persona performance metrics
- Learning from user corrections
- Integration with task templates 