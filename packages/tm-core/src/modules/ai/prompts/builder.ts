/**
 * @fileoverview Fluent builder for constructing AI system prompts
 * Provides a composable, type-safe way to build complex prompts
 */

export interface PromptSection {
	readonly heading?: string;
	readonly content: string;
}

export class PromptBuilder {
	private role?: string;
	private task?: string;
	private instructions: string[] = [];
	private rules: string[] = [];
	private constraints: string[] = [];
	private examples: string[] = [];
	private outputFormat?: string;

	/**
	 * Set the AI's role/persona
	 * @example setRole('software architecture analyst')
	 */
	setRole(role: string): this {
		this.role = role;
		return this;
	}

	/**
	 * Set the primary task
	 * @example setTask('analyze semantic content of project tags')
	 */
	setTask(task: string): this {
		this.task = task;
		return this;
	}

	/**
	 * Add a focus area or instruction
	 * @example addInstruction('Focus on domain and capabilities')
	 */
	addInstruction(instruction: string): this {
		this.instructions.push(instruction);
		return this;
	}

	/**
	 * Add multiple instructions at once
	 */
	addInstructions(instructions: string[]): this {
		this.instructions.push(...instructions);
		return this;
	}

	/**
	 * Add a rule or constraint that must be followed
	 * @example addRule('Avoid circular dependencies')
	 */
	addRule(rule: string): this {
		this.rules.push(rule);
		return this;
	}

	/**
	 * Add multiple rules at once
	 */
	addRules(rules: string[]): this {
		this.rules.push(...rules);
		return this;
	}

	/**
	 * Add a constraint on the output
	 * @example addConstraint('Output valid JSON matching the schema')
	 */
	addConstraint(constraint: string): this {
		this.constraints.push(constraint);
		return this;
	}

	/**
	 * Add an example to guide the AI
	 * @example addExample('Infrastructure tags have no dependencies')
	 */
	addExample(example: string): this {
		this.examples.push(example);
		return this;
	}

	/**
	 * Specify the expected output format
	 * @example setOutputFormat('Valid JSON matching the requested schema')
	 */
	setOutputFormat(format: string): this {
		this.outputFormat = format;
		return this;
	}

	/**
	 * Build the final system prompt string
	 */
	build(): string {
		const sections: string[] = [];

		if (this.role) {
			sections.push(`You are a ${this.role}.`);
		}

		if (this.task) {
			sections.push(this.task);
		}

		if (this.instructions.length > 0) {
			sections.push('Focus on:');
			sections.push(...this.instructions.map((i) => `- ${i}`));
		}

		if (this.rules.length > 0) {
			sections.push('\nRules:');
			sections.push(...this.rules.map((r) => `- ${r}`));
		}

		if (this.examples.length > 0) {
			sections.push('\nExamples:');
			sections.push(...this.examples.map((e) => `- ${e}`));
		}

		if (this.constraints.length > 0) {
			sections.push('\nConstraints:');
			sections.push(...this.constraints.map((c) => `- ${c}`));
		}

		if (this.outputFormat) {
			sections.push(`\n${this.outputFormat}`);
		}

		return sections.join('\n');
	}
}
