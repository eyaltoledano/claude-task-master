// Sample JavaScript file for AST parsing tests
import { readFileSync } from 'fs';
import path from 'path';

/**
 * Calculate the sum of two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Sum of a and b
 */
export function calculateSum(a, b) {
	if (typeof a !== 'number' || typeof b !== 'number') {
		throw new Error('Both parameters must be numbers');
	}
	
	return a + b;
}

/**
 * Process array of numbers with various operations
 * @param {Array<number>} numbers - Array of numbers
 * @param {string} operation - Operation to perform
 * @returns {number} Result of operation
 */
export async function processNumbers(numbers, operation = 'sum') {
	if (!Array.isArray(numbers)) {
		throw new Error('First parameter must be an array');
	}
	
	let result = 0;
	
	switch (operation) {
		case 'sum':
			result = numbers.reduce((acc, num) => acc + num, 0);
			break;
		case 'multiply':
			result = numbers.reduce((acc, num) => acc * num, 1);
			break;
		case 'average':
			if (numbers.length === 0) return 0;
			result = numbers.reduce((acc, num) => acc + num, 0) / numbers.length;
			break;
		default:
			throw new Error(`Unknown operation: ${operation}`);
	}
	
	return result;
}

class DataProcessor {
	constructor(options = {}) {
		this.config = {
			debug: false,
			maxRetries: 3,
			...options
		};
	}
	
	/**
	 * Process data with retries
	 * @param {any} data - Data to process
	 * @returns {Promise<any>} Processed data
	 */
	async processData(data) {
		let attempts = 0;
		
		while (attempts < this.config.maxRetries) {
			try {
				if (this.config.debug) {
					console.log(`Processing attempt ${attempts + 1}`);
				}
				
				// Simulate processing
				if (Math.random() > 0.7) {
					throw new Error('Random processing error');
				}
				
				return {
					processed: true,
					data,
					attempts: attempts + 1
				};
			} catch (error) {
				attempts++;
				if (attempts >= this.config.maxRetries) {
					throw error;
				}
			}
		}
	}
	
	validateInput(input) {
		if (input === null || input === undefined) {
			return false;
		}
		
		if (typeof input === 'object' && Object.keys(input).length === 0) {
			return false;
		}
		
		return true;
	}
}

export { DataProcessor };

// Default export
export default {
	calculateSum,
	processNumbers,
	DataProcessor
}; 