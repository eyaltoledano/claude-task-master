/**
 * Persona Prompt Builder for Task Master
 * Builds comprehensive prompts for autonomous Claude execution
 */

import { personaDefinitions, getPersona } from './persona-definitions.js';

export class PersonaPromptBuilder {
	constructor(persona) {
		this.persona = typeof persona === 'string' ? getPersona(persona) : persona;
	}

	/**
	 * Build a complete autonomous prompt for a task
	 */
	buildTaskPrompt(task, options = {}) {
		const sections = [
			this.getPersonaContext(),
			this.getTaskContext(task),
			this.getImplementationPlan(task),
			this.getQualityStandards(),
			this.getEvidenceRequirements(),
			this.getAutonomousInstructions()
		];

		if (options.additionalContext) {
			sections.splice(1, 0, options.additionalContext);
		}

		return sections.filter(Boolean).join('\n\n');
	}

	/**
	 * Build prompt for multiple tasks
	 */
	buildBatchPrompt(tasks, options = {}) {
		const sections = [
			this.getPersonaContext(),
			this.getBatchTasksContext(tasks),
			this.getBatchImplementationPlan(tasks),
			this.getQualityStandards(),
			this.getEvidenceRequirements(),
			this.getBatchAutonomousInstructions(tasks)
		];

		return sections.filter(Boolean).join('\n\n');
	}

	/**
	 * Get persona context section
	 */
	getPersonaContext() {
		return `# Acting as: ${this.persona.identity}

## Core Belief
${this.persona.coreBelief}

## Primary Question
"${this.persona.primaryQuestion}"

## Decision Framework
${this.persona.decisionFramework}

## Problem-Solving Approach
${this.persona.problemSolving.map((ps) => `- ${ps}`).join('\n')}

## Risk Profile
${this.persona.riskProfile}`;
	}

	/**
	 * Get task context section
	 */
	getTaskContext(task) {
		let context = `## Task Context

**Task ID**: ${task.id}
**Title**: ${task.title}
**Description**: ${task.description || 'No description provided'}`;

		if (task.details) {
			context += `\n\n**Implementation Details**:\n${task.details}`;
		}

		if (task.testStrategy) {
			context += `\n\n**Test Strategy**:\n${task.testStrategy}`;
		}

		if (task.dependencies?.length > 0) {
			context += `\n\n**Dependencies**: Tasks ${task.dependencies.join(', ')} must be completed first`;
		}

		if (task.subtasks?.length > 0) {
			context += `\n\n**Subtasks**:\n${task.subtasks
				.map((st, i) => `${i + 1}. ${st.title} (${st.status})`)
				.join('\n')}`;
		}

		return context;
	}

	/**
	 * Get batch tasks context
	 */
	getBatchTasksContext(tasks) {
		return `## Tasks to Complete

${tasks
	.map(
		(task, index) => `
### Task ${index + 1}: ${task.title} (ID: ${task.id})
**Description**: ${task.description || 'No description'}
**Status**: ${task.status || 'pending'}
${task.details ? `**Details**: ${task.details}` : ''}
${task.testStrategy ? `**Test Strategy**: ${task.testStrategy}` : ''}
${task.dependencies?.length ? `**Dependencies**: ${task.dependencies.join(', ')}` : ''}
`
	)
	.join('\n')}`;
	}

	/**
	 * Get implementation plan based on persona
	 */
	getImplementationPlan(task) {
		const plans = {
			architect: `## Implementation Plan

1. **Analyze System Context**
   - Review existing architecture and patterns
   - Identify system boundaries and interfaces
   - Consider long-term maintainability (5+ years)

2. **Design Solution**
   - Apply proven architectural patterns
   - Minimize coupling between components
   - Design clear module boundaries
   - Plan for future extensibility

3. **Document Decisions**
   - Create architectural decision records (ADRs)
   - Document trade-offs and rationale
   - Include system diagrams where helpful

4. **Implementation**
   - Follow the designed architecture strictly
   - Ensure consistency with existing patterns
   - Prevent technical debt accumulation`,

			backend: `## Implementation Plan

1. **Analyze Requirements**
   - Review API contracts and data models
   - Identify performance requirements
   - Plan for 10x traffic scalability

2. **Design for Reliability**
   - Design failure handling strategies
   - Plan database transactions carefully
   - Implement comprehensive error handling

3. **Implementation**
   - Follow RESTful principles
   - Ensure data integrity at all times
   - Optimize database queries
   - Add monitoring and logging

4. **Performance Optimization**
   - Profile critical paths
   - Optimize response times (<100ms target)
   - Implement caching where appropriate`,

			frontend: `## Implementation Plan

1. **User Experience Design**
   - Consider mobile-first approach
   - Plan for accessibility (WCAG AAA)
   - Design for all device types

2. **Component Architecture**
   - Create reusable components
   - Implement proper state management
   - Ensure responsive design

3. **Performance Optimization**
   - Optimize bundle size
   - Implement lazy loading
   - Target <2s page load time

4. **Implementation**
   - Follow design system guidelines
   - Implement progressive enhancement
   - Add comprehensive error states`,

			security: `## Implementation Plan

1. **Threat Modeling**
   - Identify potential attack vectors
   - Analyze trust boundaries
   - Plan defense strategies

2. **Security Implementation**
   - Apply defense-in-depth principles
   - Implement zero-trust architecture
   - Validate all inputs strictly

3. **Authentication & Authorization**
   - Implement secure authentication
   - Apply principle of least privilege
   - Secure session management

4. **Security Testing**
   - Test for common vulnerabilities
   - Verify security controls
   - Plan incident response`,

			qa: `## Implementation Plan

1. **Test Strategy Design**
   - Plan comprehensive test coverage
   - Design edge case scenarios
   - Plan performance tests

2. **Test Implementation**
   - Write unit tests (>95% coverage)
   - Implement integration tests
   - Add end-to-end tests

3. **Quality Gates**
   - Set up automated testing
   - Define quality metrics
   - Implement continuous testing

4. **Validation**
   - Verify all requirements met
   - Test edge cases thoroughly
   - Ensure regression prevention`,

			analyzer: `## Investigation Plan

1. **Evidence Gathering**
   - Collect all relevant data
   - Document current behavior
   - Identify symptoms vs causes

2. **Hypothesis Formation**
   - Generate multiple hypotheses
   - Design tests for each
   - Avoid premature conclusions

3. **Systematic Testing**
   - Test hypotheses methodically
   - Document all findings
   - Follow evidence trails

4. **Root Cause Analysis**
   - Identify actual root cause
   - Verify with evidence
   - Document reasoning chain`,

			performance: `## Optimization Plan

1. **Performance Profiling**
   - Measure current performance
   - Identify bottlenecks
   - Establish baselines

2. **Analysis**
   - Analyze critical paths
   - Find optimization opportunities
   - Calculate potential improvements

3. **Optimization**
   - Fix identified bottlenecks
   - Optimize algorithms
   - Implement caching

4. **Validation**
   - Measure improvements
   - Verify no regressions
   - Document optimizations`,

			refactorer: `## Refactoring Plan

1. **Code Analysis**
   - Identify code smells
   - Find duplication
   - Assess complexity

2. **Refactoring Strategy**
   - Plan incremental changes
   - Maintain behavior
   - Improve readability

3. **Implementation**
   - Eliminate duplication
   - Simplify complex logic
   - Improve naming

4. **Validation**
   - Ensure tests still pass
   - Verify no behavior changes
   - Measure improvements`,

			mentor: `## Documentation Plan

1. **Audience Analysis**
   - Identify target audience
   - Assess knowledge level
   - Plan content depth

2. **Content Structure**
   - Create logical flow
   - Use progressive disclosure
   - Include examples

3. **Documentation**
   - Write clear explanations
   - Add helpful analogies
   - Include code examples

4. **Validation**
   - Test with target audience
   - Ensure completeness
   - Verify accuracy`
		};

		return (
			plans[
				Object.keys(personaDefinitions).find(
					(k) => personaDefinitions[k].flag === this.persona.flag
				)
			] || plans.architect
		);
	}

	/**
	 * Get batch implementation plan
	 */
	getBatchImplementationPlan(tasks) {
		return `## Batch Implementation Plan

1. **Analyze All Tasks**
   - Review task dependencies
   - Identify common patterns
   - Plan execution order

2. **Apply ${this.persona.identity.split('|')[0]} Approach**
   ${this.persona.problemSolving.map((ps) => `- ${ps}`).join('\n   ')}

3. **Execute Tasks Systematically**
   - Complete each task fully before moving on
   - Apply consistent patterns across tasks
   - Maintain quality standards throughout

4. **Continuous Validation**
   - Verify each task meets requirements
   - Ensure no regressions
   - Document all changes`;
	}

	/**
	 * Get quality standards
	 */
	getQualityStandards() {
		return `## Quality Standards

### Success Metrics
${this.persona.successMetrics.map((sm) => `- ${sm}`).join('\n')}

### Focus Areas
${this.persona.focus.map((f) => `- ${f}`).join('\n')}

### Communication Style
Document your work using:
${this.persona.communicationStyle.map((cs) => `- ${cs}`).join('\n')}`;
	}

	/**
	 * Get evidence requirements
	 */
	getEvidenceRequirements() {
		const evidenceMap = {
			architect: 'Document all architectural decisions in ADR format',
			security: 'Log all security considerations and mitigations',
			performance: 'Include performance benchmarks and metrics',
			qa: 'Provide test coverage reports and quality metrics',
			backend: 'Document API contracts and performance metrics',
			frontend: 'Include accessibility audit and performance scores',
			analyzer: 'Document complete reasoning chain with evidence',
			refactorer: 'Show before/after metrics and improvements',
			mentor: 'Include examples and learning validation'
		};

		const personaKey = Object.keys(personaDefinitions).find(
			(k) => personaDefinitions[k].flag === this.persona.flag
		);

		return `## Evidence Requirements

${evidenceMap[personaKey] || 'Document all decisions and implementations thoroughly'}

Provide clear evidence of meeting the success metrics defined above.`;
	}

	/**
	 * Get autonomous execution instructions
	 */
	getAutonomousInstructions() {
		return `## Autonomous Execution Instructions

1. **Work Independently**: Complete all implementation without requiring user interaction
2. **Make Decisions**: Use the ${this.persona.flag} decision framework for all choices
3. **Handle Edge Cases**: Apply the risk profile: ${this.persona.riskProfile}
4. **Complete Fully**: Ensure all aspects of the task are implemented
5. **Document Progress**: Leave clear documentation of what was done

Begin implementation now. Execute autonomously with no user interaction required.`;
	}

	/**
	 * Get batch autonomous instructions
	 */
	getBatchAutonomousInstructions(tasks) {
		return `## Autonomous Batch Execution Instructions

1. **Process All Tasks**: Complete all ${tasks.length} tasks in sequence
2. **Maintain Context**: Apply learnings from each task to subsequent ones
3. **Consistent Approach**: Use ${this.persona.flag} methodology throughout
4. **No Interaction**: Complete all work without user input
5. **Comprehensive Documentation**: Document each task's implementation

Execute all tasks autonomously. Begin with Task 1 and proceed systematically.`;
	}
}

/**
 * Build multi-persona workflow prompt
 */
export function buildMultiPersonaPrompt(tasks, personas, options = {}) {
	const sections = [
		`# Multi-Persona Task Implementation

This implementation requires multiple specialized approaches applied in sequence.`
	];

	// Add workflow reason if provided
	if (options.reason) {
		sections.push(`**Workflow Type**: ${options.reason}`);
	}

	// Add tasks context
	sections.push(`## Tasks to Complete

${tasks
	.map(
		(task, i) => `${i + 1}. **${task.title}** (ID: ${task.id})
   ${task.description || ''}`
	)
	.join('\n')}`);

	// Add persona phases
	personas.forEach((personaId, index) => {
		const persona = getPersona(personaId);
		sections.push(`## Phase ${index + 1}: ${persona.identity.split('|')[0]}

**Primary Question**: "${persona.primaryQuestion}"

**Approach**:
${persona.problemSolving.map((ps) => `- ${ps}`).join('\n')}

**Focus**: ${persona.focus.join(', ')}`);
	});

	// Add execution instructions
	sections.push(`## Execution Instructions

1. Complete each phase in sequence
2. Apply the specific persona mindset for each phase
3. Carry learnings forward to subsequent phases
4. Ensure all tasks are fully completed
5. Document the work from each persona's perspective

Execute all phases autonomously without user interaction.`);

	return sections.join('\n\n');
}

/**
 * Create a lightweight persona context for interactive mode
 */
export function createInteractivePersonaContext(persona, task) {
	const p = typeof persona === 'string' ? getPersona(persona) : persona;

	return `You are operating as: ${p.identity}

Key principle: ${p.primaryQuestion}

For this task, prioritize: ${p.focus.slice(0, 3).join(', ')}

Task: ${task.title}`;
}
