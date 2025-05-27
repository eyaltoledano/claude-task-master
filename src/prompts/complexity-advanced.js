/**
 * Advanced (comprehensive) complexity analysis prompt
 * Full detailed prompt for comprehensive analysis (5,711 chars)
 * Provides maximum detail and guidance for complex project analysis
 */

/**
 * Generates the advanced (full enhanced) prompt for complexity analysis.
 * @param {Object} tasksData - The tasks data object.
 * @returns {string} The generated prompt.
 */
export function generateAdvancedPrompt(tasksData) {
	const tasksString = JSON.stringify(tasksData.tasks, null, 2);

	return `You are an expert software architect tasked with analyzing the complexity of software development tasks. Use the following comprehensive 5-dimensional framework to evaluate each task:

## The 5-Dimensional Complexity Framework

### 1. Technical Complexity (Weight: 25%)
Evaluate the technical challenges involved:
- Algorithm complexity and optimization requirements
- System architecture and design patterns needed
- Performance and scalability considerations
- Technical debt and refactoring needs
- Integration with existing systems
- Use of advanced programming concepts

**Scoring Guide:**
- 1-2: Simple CRUD operations, basic UI components
- 3-4: Standard patterns, moderate algorithms
- 5-6: Complex state management, optimization needed
- 7-8: Distributed systems, complex algorithms
- 9-10: Cutting-edge tech, research required

### 2. Integration Complexity (Weight: 20%)
Assess external dependencies and integration challenges:
- Number of external APIs or services
- Cross-system communication requirements
- Data format transformations
- Authentication and authorization across systems
- Third-party library dependencies
- Platform-specific considerations

**Scoring Guide:**
- 1-2: Standalone components, no external deps
- 3-4: Single API integration, standard protocols
- 5-6: Multiple service integrations
- 7-8: Complex orchestration, custom protocols
- 9-10: Enterprise-wide integration, legacy systems

### 3. Domain Complexity (Weight: 20%)
Evaluate business logic and domain knowledge requirements:
- Business rule complexity
- Domain-specific knowledge needed
- Regulatory and compliance requirements
- User experience sophistication
- Industry-specific standards
- Stakeholder communication needs

**Scoring Guide:**
- 1-2: Common patterns, minimal domain knowledge
- 3-4: Standard business logic, clear requirements
- 5-6: Complex rules, some domain expertise needed
- 7-8: Deep domain knowledge, compliance critical
- 9-10: Expert-level domain understanding required

### 4. Risk & Uncertainty (Weight: 20%)
Assess project risks and unknowns:
- Requirement clarity and stability
- Technical feasibility uncertainties
- Dependency on external teams or services
- Potential for scope creep
- Impact of failure
- Need for prototyping or research

**Scoring Guide:**
- 1-2: Well-defined, low impact, proven approach
- 3-4: Mostly clear, some minor unknowns
- 5-6: Significant unknowns, moderate impact
- 7-8: High uncertainty, critical impact
- 9-10: Exploratory, high risk, business critical

### 5. Maintenance & Evolution (Weight: 15%)
Consider long-term maintenance needs:
- Documentation requirements
- Testing complexity and coverage needs
- Code maintainability and readability
- Likelihood of future changes
- Operational monitoring needs
- Knowledge transfer requirements

**Scoring Guide:**
- 1-2: Minimal maintenance, self-contained
- 3-4: Standard testing and docs needed
- 5-6: Comprehensive test suite, detailed docs
- 7-8: Complex testing scenarios, extensive docs
- 9-10: Mission-critical maintenance, 24/7 monitoring

## Calculation Method
For each task:
1. Score each dimension from 1-10
2. Apply weights: Technical×0.25 + Integration×0.20 + Domain×0.20 + Risk×0.20 + Maintenance×0.15
3. Round to 1 decimal place

## Subtask Recommendations
Based on the final complexity score:
- Score 1-3: Recommend 2-3 subtasks (keep it simple)
- Score 4-6: Recommend 3-5 subtasks (moderate breakdown)
- Score 7-8: Recommend 5-7 subtasks (detailed planning needed)
- Score 9-10: Recommend 7-10 subtasks (comprehensive breakdown required)

## Output Requirements
For each task, provide:
1. Individual dimension scores with brief justification
2. Calculated final complexity score
3. Recommended number of subtasks
4. Specific, actionable expansion prompt that breaks down the task

Think like a senior architect who needs to guide a development team. Consider dependencies, testing needs, and architectural decisions.

Tasks to analyze:
${tasksString}

Return a JSON array with the following structure for each task:
[
  {
    "taskId": number,
    "taskTitle": "string",
    "complexityScore": number,
    "recommendedSubtasks": number,
    "reasoning": "T:n (why), I:n (why), D:n (why), R:n (why), M:n (why) = final score",
    "expansionPrompt": "1) Specific subtask with clear deliverable\\n2) Another subtask with dependencies noted\\n3) Testing/documentation tasks\\n..."
  }
]`;
}