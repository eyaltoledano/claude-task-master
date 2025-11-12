/**
 * @fileoverview Display message utilities
 * Provides formatted message boxes for errors, success, warnings, info, and banners
 */

import boxen from 'boxen';
import chalk from 'chalk';
import { getBoxWidth } from '../layout/helpers.js';

/**
 * Display a fancy banner
 */
export function displayBanner(title: string = 'Task Master'): void {
	console.log(
		boxen(chalk.white.bold(title), {
			padding: 1,
			margin: { top: 1, bottom: 1 },
			borderStyle: 'round',
			borderColor: 'blue',
			textAlignment: 'center'
		})
	);
}

/**
 * Display an error message in a boxed format (matches scripts/modules/ui.js style)
 * Note: For general CLI error handling, use displayError from utils/error-handler.ts
 * This function is for displaying formatted error messages as part of UI output.
 */
export function displayErrorBox(message: string, details?: string): void {
	const boxWidth = getBoxWidth();

	console.error(
		boxen(
			chalk.red.bold('X Error: ') +
				chalk.white(message) +
				(details ? '\n\n' + chalk.gray(details) : ''),
			{
				padding: 1,
				borderStyle: 'round',
				borderColor: 'red',
				width: boxWidth
			}
		)
	);
}

/**
 * Alias for displayErrorBox
 */
export const displayError = displayErrorBox;

/**
 * Display a success message
 */
export function displaySuccess(message: string): void {
	const boxWidth = getBoxWidth();

	console.log(
		boxen(
			chalk.green.bold(String.fromCharCode(8730) + ' ') + chalk.white(message),
			{
				padding: 1,
				borderStyle: 'round',
				borderColor: 'green',
				width: boxWidth
			}
		)
	);
}

/**
 * Display a warning message
 */
export function displayWarning(message: string): void {
	const boxWidth = getBoxWidth();

	console.log(
		boxen(chalk.yellow.bold('⚠️ ') + chalk.white(message), {
			padding: 1,
			borderStyle: 'round',
			borderColor: 'yellow',
			width: boxWidth
		})
	);
}

/**
 * Display info message
 */
export function displayInfo(message: string): void {
	const boxWidth = getBoxWidth();

	console.log(
		boxen(chalk.blue.bold('i ') + chalk.white(message), {
			padding: 1,
			borderStyle: 'round',
			borderColor: 'blue',
			width: boxWidth
		})
	);
}
