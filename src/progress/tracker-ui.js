import chalk from 'chalk';

/**
 * Creates a bordered header for progress tables.
 * @param {Object} multibar - The multibar instance.
 * @param {string} headerFormat - Format string for the header row.
 * @param {string} borderFormat - Format string for the top and bottom borders.
 * @returns {void}
 */
export function createProgressHeader(multibar, headerFormat, borderFormat) {
  if (!multibar || typeof headerFormat !== 'string' || typeof borderFormat !== 'string') {
    throw new Error('Invalid parameters for createProgressHeader');
  }

  // Top border
  const topBorderBar = multibar.create(1, 1, {}, { format: borderFormat, barsize: 1 });
  topBorderBar.update(1);

  // Header row
  const headerBar = multibar.create(1, 1, {}, { format: headerFormat, barsize: 1 });
  headerBar.update(1);

  // Bottom border
  const bottomBorderBar = multibar.create(1, 1, {}, { format: borderFormat, barsize: 1 });
  bottomBorderBar.update(1);
}

/**
 * Creates a formatted data row for progress tables.
 * @param {Object} multibar - The multibar instance.
 * @param {string} rowFormat - Format string for the row.
 * @param {Object} payload - Data payload for the row format.
 * @returns {void}
 */
export function createProgressRow(multibar, rowFormat, payload) {
  if (!multibar || typeof rowFormat !== 'string' || typeof payload !== 'object') {
    throw new Error('Invalid parameters for createProgressRow');
  }

  const rowBar = multibar.create(1, 1, {}, { format: rowFormat, barsize: 1 });
  rowBar.update(1, payload);
}

/**
 * Creates a border row for progress tables.
 * @param {Object} multibar - The multibar instance.
 * @param {string} borderFormat - Format string for the border.
 * @returns {void}
 */
export function createBorder(multibar, borderFormat) {
  if (!multibar || typeof borderFormat !== 'string') {
    throw new Error('Invalid parameters for createBorder');
  }

  const borderBar = multibar.create(1, 1, {}, { format: borderFormat, barsize: 1 });
  borderBar.update(1);
} 