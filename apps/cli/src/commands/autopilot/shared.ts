/**
 * @fileoverview Shared utilities for autopilot commands
 */

import chalk from 'chalk';

/**
 * Base options interface for all autopilot commands
 */
export interface AutopilotBaseOptions {
	projectRoot?: string;
	json?: boolean;
	verbose?: boolean;
}

/**
 * Output formatter for JSON and text modes
 */
export class OutputFormatter {
	constructor(private useJson: boolean) {}

	/**
	 * Output data in appropriate format
	 */
	output(data: Record<string, unknown>): void {
		if (this.useJson) {
			console.log(JSON.stringify(data, null, 2));
		} else {
			this.outputText(data);
		}
	}

	/**
	 * Output data in human-readable text format
	 */
	private outputText(data: Record<string, unknown>): void {
		for (const [key, value] of Object.entries(data)) {
			if (typeof value === 'object' && value !== null) {
				console.log(chalk.cyan(`${key}:`));
				this.outputObject(value as Record<string, unknown>, '  ');
			} else {
				console.log(chalk.white(`${key}: ${value}`));
			}
		}
	}

	/**
	 * Output nested object with indentation
	 */
	private outputObject(obj: Record<string, unknown>, indent: string): void {
		for (const [key, value] of Object.entries(obj)) {
			if (typeof value === 'object' && value !== null) {
				console.log(chalk.cyan(`${indent}${key}:`));
				this.outputObject(value as Record<string, unknown>, indent + '  ');
			} else {
				console.log(chalk.gray(`${indent}${key}: ${value}`));
			}
		}
	}

	/**
	 * Output error message
	 */
	error(message: string, details?: Record<string, unknown>): void {
		if (this.useJson) {
			console.error(
				JSON.stringify(
					{
						error: message,
						...details
					},
					null,
					2
				)
			);
		} else {
			console.error(chalk.red(`Error: ${message}`));
			if (details) {
				for (const [key, value] of Object.entries(details)) {
					console.error(chalk.gray(`  ${key}: ${value}`));
				}
			}
		}
	}

	/**
	 * Output success message
	 */
	success(message: string, data?: Record<string, unknown>): void {
		if (this.useJson) {
			console.log(
				JSON.stringify(
					{
						success: true,
						message,
						...data
					},
					null,
					2
				)
			);
		} else {
			console.log(chalk.green(`✓ ${message}`));
			if (data) {
				this.output(data);
			}
		}
	}

	/**
	 * Output warning message
	 */
	warning(message: string): void {
		if (this.useJson) {
			console.warn(
				JSON.stringify(
					{
						warning: message
					},
					null,
					2
				)
			);
		} else {
			console.warn(chalk.yellow(`⚠️ ${message}`));
		}
	}

	/**
	 * Output info message
	 */
	info(message: string): void {
		if (this.useJson) {
			// Don't output info messages in JSON mode
			return;
		}
		console.log(chalk.blue(`ℹ ${message}`));
	}
}
