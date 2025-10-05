import chalk from 'chalk';

/**
 * Factory for creating progress bar elements
 */
class ProgressBarFactory {
	constructor(multibar) {
		if (!multibar) {
			throw new Error('Multibar instance is required');
		}
		this.multibar = multibar;
	}

	/**
	 * Creates a progress bar with the given format
	 */
	createBar(format, payload = {}) {
		if (typeof format !== 'string') {
			throw new Error('Format must be a string');
		}

		const bar = this.multibar.create(
			1, // total
			1, // current
			{},
			{
				format,
				barsize: 1,
				hideCursor: true,
				clearOnComplete: false
			}
		);

		bar.update(1, payload);
		return bar;
	}

	/**
	 * Creates a header with borders
	 */
	createHeader(headerFormat, borderFormat) {
		this.createBar(borderFormat); // Top border
		this.createBar(headerFormat); // Header
		this.createBar(borderFormat); // Bottom border
	}

	/**
	 * Creates a data row
	 */
	createRow(rowFormat, payload) {
		if (!payload || typeof payload !== 'object') {
			throw new Error('Payload must be an object');
		}
		return this.createBar(rowFormat, payload);
	}

	/**
	 * Creates a border element
	 */
	createBorder(borderFormat) {
		return this.createBar(borderFormat);
	}
}

/**
 * Creates a bordered header for progress tables.
 * @param {Object} multibar - The multibar instance.
 * @param {string} headerFormat - Format string for the header row.
 * @param {string} borderFormat - Format string for the top and bottom borders.
 * @returns {void}
 */
export function createProgressHeader(multibar, headerFormat, borderFormat) {
	const factory = new ProgressBarFactory(multibar);
	factory.createHeader(headerFormat, borderFormat);
}

/**
 * Creates a formatted data row for progress tables.
 * @param {Object} multibar - The multibar instance.
 * @param {string} rowFormat - Format string for the row.
 * @param {Object} payload - Data payload for the row format.
 * @returns {void}
 */
export function createProgressRow(multibar, rowFormat, payload) {
	const factory = new ProgressBarFactory(multibar);
	factory.createRow(rowFormat, payload);
}

/**
 * Creates a border row for progress tables.
 * @param {Object} multibar - The multibar instance.
 * @param {string} borderFormat - Format string for the border.
 * @returns {void}
 */
export function createBorder(multibar, borderFormat) {
	const factory = new ProgressBarFactory(multibar);
	factory.createBorder(borderFormat);
}

/**
 * Builder for creating progress tables with consistent formatting
 */
export class ProgressTableBuilder {
	constructor(multibar) {
		this.factory = new ProgressBarFactory(multibar);
		this.borderStyle = '─';
		this.columnSeparator = '|';
	}

	/**
	 * Shows a formatted table header
	 */
	showHeader(columns = null) {
		// Default columns for task display
		const defaultColumns = [
			{ text: 'TASK', width: 6 },
			{ text: 'PRI', width: 5 },
			{ text: 'TITLE', width: 64 }
		];

		const cols = columns || defaultColumns;
		const headerText = ' ' + cols.map((c) => c.text).join(' | ') + ' ';
		const borderLine = this.createBorderLine(cols.map((c) => c.width));

		this.factory.createHeader(headerText, borderLine);
		return this;
	}

	/**
	 * Creates a border line based on column widths
	 */
	createBorderLine(columnWidths) {
		return columnWidths
			.map((width) => this.borderStyle.repeat(width))
			.join('─┼─');
	}

	/**
	 * Adds a task row to the table
	 */
	addTaskRow(taskId, priority, title) {
		const format = ` ${taskId} | ${priority} | {title}`;
		this.factory.createRow(format, { title });

		// Add separator after each row
		const borderLine = '------+-----+' + '─'.repeat(64);
		this.factory.createBorder(borderLine);
		return this;
	}

	/**
	 * Creates a summary row
	 */
	addSummaryRow(label, value) {
		const format = `  ${label}: {value}`;
		this.factory.createRow(format, { value });
		return this;
	}
}
