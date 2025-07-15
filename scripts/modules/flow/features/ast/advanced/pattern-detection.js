/**
 * Pattern Detection Component
 * Identifies design patterns, anti-patterns, and architectural patterns using AST analysis
 */

import { EventEmitter } from 'events';

export class PatternDetectionEngine extends EventEmitter {
	constructor(analyzers, options = {}) {
		super();
		this.analyzers = analyzers;
		this.options = {
			confidenceThreshold: 0.7,
			maxPatternsPerFile: 15,
			detectAntiPatterns: true,
			...options
		};
	}

	async analyzePatterns(filePath, ast, language) {
		this.emit('analysis:start', { filePath, language });

		try {
			const detectedPatterns = [];

			// Detect design patterns
			detectedPatterns.push(...this.detectDesignPatterns(ast, language));

			// Detect anti-patterns
			if (this.options.detectAntiPatterns) {
				detectedPatterns.push(...this.detectAntiPatterns(ast, language));
			}

			// Detect framework patterns
			detectedPatterns.push(...this.detectFrameworkPatterns(ast, language));

			const filteredPatterns = this.filterPatterns(detectedPatterns);

			return {
				filePath,
				language,
				patterns: filteredPatterns,
				summary: {
					totalPatterns: filteredPatterns.length,
					designPatterns: filteredPatterns.filter(
						(p) => p.category === 'design-pattern'
					).length,
					antiPatterns: filteredPatterns.filter(
						(p) => p.category === 'anti-pattern'
					).length,
					averageConfidence: this.calculateAverageConfidence(filteredPatterns)
				}
			};
		} catch (error) {
			this.emit('analysis:error', error);
			throw error;
		}
	}

	detectDesignPatterns(ast, language) {
		const patterns = [];

		// Singleton pattern detection
		if (ast.classes) {
			for (const cls of ast.classes) {
				if (this.isSingletonPattern(cls)) {
					patterns.push({
						type: 'singleton',
						category: 'design-pattern',
						name: 'Singleton Pattern',
						description: `Singleton pattern detected in class ${cls.name}`,
						location: { class: cls.name, line: cls.location?.line },
						confidence: 0.8,
						implications: [
							'Ensures single instance',
							'May create testing difficulties'
						]
					});
				}
			}
		}

		// Observer pattern detection
		if (ast.classes) {
			for (const cls of ast.classes) {
				if (this.isObserverPattern(cls)) {
					patterns.push({
						type: 'observer',
						category: 'design-pattern',
						name: 'Observer Pattern',
						description: `Observer pattern detected in ${cls.name}`,
						location: { class: cls.name, line: cls.location?.line },
						confidence: 0.75,
						implications: ['Loose coupling', 'Event-driven architecture']
					});
				}
			}
		}

		return patterns;
	}

	detectAntiPatterns(ast, language) {
		const antiPatterns = [];

		// God Object anti-pattern
		if (ast.classes) {
			for (const cls of ast.classes) {
				const methodCount = cls.methods ? cls.methods.length : 0;
				if (methodCount > 20) {
					antiPatterns.push({
						type: 'god-object',
						category: 'anti-pattern',
						name: 'God Object Anti-Pattern',
						description: `Class ${cls.name} has too many responsibilities (${methodCount} methods)`,
						location: { class: cls.name, line: cls.location?.line },
						confidence: 0.9,
						severity: methodCount > 30 ? 'high' : 'medium',
						refactoringSuggestions: [
							'Split class using Single Responsibility Principle'
						]
					});
				}
			}
		}

		// Long method anti-pattern
		if (ast.functions) {
			for (const func of ast.functions) {
				const lineCount = func.location?.endLine - func.location?.startLine;
				if (lineCount > 50) {
					antiPatterns.push({
						type: 'long-method',
						category: 'anti-pattern',
						name: 'Long Method Anti-Pattern',
						description: `Method ${func.name} is too long (${lineCount} lines)`,
						location: { function: func.name, line: func.location?.line },
						confidence: 0.9,
						severity: lineCount > 100 ? 'high' : 'medium',
						refactoringSuggestions: ['Extract smaller methods']
					});
				}
			}
		}

		return antiPatterns;
	}

	detectFrameworkPatterns(ast, language) {
		const patterns = [];

		if (language === 'javascript' || language === 'typescript') {
			patterns.push(...this.detectReactPatterns(ast));
		}

		return patterns;
	}

	detectReactPatterns(ast) {
		const patterns = [];

		// React Hooks pattern
		if (ast.functions) {
			for (const func of ast.functions) {
				const hooksUsed = this.getHooksUsed(func);
				if (hooksUsed.length > 0) {
					patterns.push({
						type: 'react-hooks',
						category: 'modern-pattern',
						name: 'React Hooks Pattern',
						description: `Functional component using ${hooksUsed.length} hooks`,
						location: { function: func.name, line: func.location?.line },
						confidence: 0.95,
						evidence: { hooksUsed, componentName: func.name },
						benefits: ['Simpler state management', 'Better reusability']
					});
				}
			}
		}

		return patterns;
	}

	// Helper methods
	isSingletonPattern(cls) {
		return (
			cls.methods &&
			cls.methods.some(
				(method) =>
					method.name.includes('instance') ||
					method.name.includes('getInstance')
			)
		);
	}

	isObserverPattern(cls) {
		return (
			cls.methods &&
			cls.methods.some((method) =>
				['emit', 'on', 'off', 'addListener', 'removeListener'].includes(
					method.name
				)
			)
		);
	}

	getHooksUsed(func) {
		const hooks = [];
		if (func.calls) {
			for (const call of func.calls) {
				if (
					call.function &&
					call.function.startsWith('use') &&
					['useState', 'useEffect', 'useContext', 'useReducer'].includes(
						call.function
					)
				) {
					hooks.push(call.function);
				}
			}
		}
		return [...new Set(hooks)];
	}

	filterPatterns(patterns) {
		return patterns
			.filter(
				(pattern) => pattern.confidence >= this.options.confidenceThreshold
			)
			.sort((a, b) => b.confidence - a.confidence)
			.slice(0, this.options.maxPatternsPerFile);
	}

	calculateAverageConfidence(patterns) {
		if (patterns.length === 0) return 0;
		const total = patterns.reduce(
			(sum, pattern) => sum + pattern.confidence,
			0
		);
		return Math.round((total / patterns.length) * 100) / 100;
	}
}

export default PatternDetectionEngine;

/**
 * Custom error class for pattern detection
 */
export class PatternDetectionError extends Error {
	constructor(message, cause) {
		super(message);
		this.name = 'PatternDetectionError';
		this.cause = cause;
	}
}
