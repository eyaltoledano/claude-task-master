/**
 * AI-powered analysis for project scanning
 */
import { ScanLoggingConfig } from './scan-config.js';

// Dynamically import AI service with fallback
async function getAiService(options) {
	try {
		const { getAiService: aiService } = await import('../../ai-services-unified.js');
		return aiService(options);
	} catch (error) {
		throw new Error(`AI service not available: ${error.message}`);
	}
}

/**
 * Analyze project structure using AI
 * @param {Object} scanResults - Raw scan results
 * @param {Object} config - Scan configuration
 * @returns {Promise<Object>} AI-enhanced analysis
 */
export async function analyzeWithAI(scanResults, config) {
	const logger = new ScanLoggingConfig(config.mcpLog, config.reportProgress);
	logger.info('Starting AI-powered analysis...');

	try {
		// Step 1: Project Type Analysis
		const projectTypeAnalysis = await analyzeProjectType(scanResults, config, logger);
		
		// Step 2: Entry Points Analysis
		const entryPointsAnalysis = await analyzeEntryPoints(scanResults, projectTypeAnalysis, config, logger);
		
		// Step 3: Core Structure Analysis
		const coreStructureAnalysis = await analyzeCoreStructure(scanResults, entryPointsAnalysis, config, logger);
		
		// Step 4: Recursive Analysis (if needed)
		const detailedAnalysis = await performDetailedAnalysis(scanResults, coreStructureAnalysis, config, logger);
		
		// Combine all analyses
		const enhancedAnalysis = {
			projectType: projectTypeAnalysis,
			entryPoints: entryPointsAnalysis,
			coreStructure: coreStructureAnalysis,
			detailed: detailedAnalysis,
			summary: generateProjectSummary(scanResults, projectTypeAnalysis, coreStructureAnalysis)
		};

		logger.info('AI analysis completed successfully');
		return enhancedAnalysis;
	} catch (error) {
		logger.error(`AI analysis failed: ${error.message}`);
		throw error;
	}
}

/**
 * Step 1: Analyze project type using AI
 * @param {Object} scanResults - Raw scan results
 * @param {Object} config - Scan configuration
 * @param {ScanLoggingConfig} logger - Logger instance
 * @returns {Promise<Object>} Project type analysis
 */
async function analyzeProjectType(scanResults, config, logger) {
	logger.info('[Scan #1]: Analyzing project type and structure...');

	const prompt = `Given this root directory structure and files, identify the type of project and key characteristics:

Root files: ${JSON.stringify(scanResults.rootFiles, null, 2)}
Directory structure: ${JSON.stringify(scanResults.directories, null, 2)}

Please analyze:
1. Project type (e.g., Node.js, React, Laravel, Python, etc.)
2. Programming languages used
3. Frameworks and libraries
4. Build tools and configuration
5. Files or folders that should be excluded from further analysis (logs, binaries, etc.)

Respond with a JSON object containing your analysis.`;

	try {
		const aiService = getAiService({ projectRoot: config.projectRoot });
		const response = await aiService.generateStructuredOutput({
			prompt,
			schema: {
				type: 'object',
				properties: {
					projectType: { type: 'string' },
					languages: { type: 'array', items: { type: 'string' } },
					frameworks: { type: 'array', items: { type: 'string' } },
					buildTools: { type: 'array', items: { type: 'string' } },
					excludePatterns: { type: 'array', items: { type: 'string' } },
					confidence: { type: 'number' },
					reasoning: { type: 'string' }
				}
			}
		});

		logger.info(`[Scan #1]: Detected ${response.projectType} project`);
		return response;
	} catch (error) {
		logger.warn(`[Scan #1]: AI analysis failed, using fallback detection`);
		// Fallback to rule-based detection
		return scanResults.projectType;
	}
}

/**
 * Step 2: Analyze entry points using AI
 * @param {Object} scanResults - Raw scan results
 * @param {Object} projectTypeAnalysis - Project type analysis
 * @param {Object} config - Scan configuration
 * @param {ScanLoggingConfig} logger - Logger instance
 * @returns {Promise<Object>} Entry points analysis
 */
async function analyzeEntryPoints(scanResults, projectTypeAnalysis, config, logger) {
	logger.info('[Scan #2]: Identifying main entry points and core files...');

	const prompt = `Based on the project type "${projectTypeAnalysis.projectType}" and these files, identify the main entry points and core files:

Available files: ${JSON.stringify(scanResults.fileList.slice(0, 50), null, 2)}
Project type: ${projectTypeAnalysis.projectType}
Languages: ${JSON.stringify(projectTypeAnalysis.languages)}
Frameworks: ${JSON.stringify(projectTypeAnalysis.frameworks)}

Please identify:
1. Main entry points (files that start the application)
2. Configuration files
3. Core application files
4. Important directories to analyze further

Respond with a structured JSON object.`;

	try {
		const aiService = getAiService({ projectRoot: config.projectRoot });
		const response = await aiService.generateStructuredOutput({
			prompt,
			schema: {
				type: 'object',
				properties: {
					entryPoints: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								path: { type: 'string' },
								type: { type: 'string' },
								description: { type: 'string' }
							}
						}
					},
					configFiles: { type: 'array', items: { type: 'string' } },
					coreFiles: { type: 'array', items: { type: 'string' } },
					importantDirectories: { type: 'array', items: { type: 'string' } }
				}
			}
		});

		logger.info(`[Scan #2]: Found ${response.entryPoints.length} entry points`);
		return response;
	} catch (error) {
		logger.warn(`[Scan #2]: AI analysis failed, using basic detection`);
		return {
			entryPoints: scanResults.projectType.entryPoints.map(ep => ({ path: ep, type: 'main', description: 'Main entry point' })),
			configFiles: [],
			coreFiles: [],
			importantDirectories: []
		};
	}
}

/**
 * Step 3: Analyze core structure using AI
 * @param {Object} scanResults - Raw scan results
 * @param {Object} entryPointsAnalysis - Entry points analysis
 * @param {Object} config - Scan configuration
 * @param {ScanLoggingConfig} logger - Logger instance
 * @returns {Promise<Object>} Core structure analysis
 */
async function analyzeCoreStructure(scanResults, entryPointsAnalysis, config, logger) {
	logger.info('[Scan #3]: Analyzing core structure and key directories...');

	const prompt = `Based on the entry points and project structure, analyze the core architecture:

Entry points: ${JSON.stringify(entryPointsAnalysis.entryPoints, null, 2)}
Important directories: ${JSON.stringify(entryPointsAnalysis.importantDirectories)}
File analysis: ${JSON.stringify(scanResults.detailedFiles.slice(0, 20), null, 2)}

Please analyze:
1. Directory-level summaries and purposes
2. File relationships and dependencies
3. Key architectural patterns
4. Data flow and component relationships

Respond with a structured analysis.`;

	try {
		const aiService = getAiService({ projectRoot: config.projectRoot });
		const response = await aiService.generateStructuredOutput({
			prompt,
			schema: {
				type: 'object',
				properties: {
					directories: {
						type: 'object',
						additionalProperties: {
							type: 'object',
							properties: {
								purpose: { type: 'string' },
								importance: { type: 'string' },
								keyFiles: { type: 'array', items: { type: 'string' } },
								description: { type: 'string' }
							}
						}
					},
					architecture: {
						type: 'object',
						properties: {
							pattern: { type: 'string' },
							layers: { type: 'array', items: { type: 'string' } },
							dataFlow: { type: 'string' }
						}
					}
				}
			}
		});

		logger.info(`[Scan #3]: Analyzed ${Object.keys(response.directories || {}).length} directories`);
		return response;
	} catch (error) {
		logger.warn(`[Scan #3]: AI analysis failed, using basic structure`);
		return {
			directories: {},
			architecture: {
				pattern: 'unknown',
				layers: [],
				dataFlow: 'unknown'
			}
		};
	}
}

/**
 * Step 4: Perform detailed analysis on specific files/directories
 * @param {Object} scanResults - Raw scan results
 * @param {Object} coreStructureAnalysis - Core structure analysis
 * @param {Object} config - Scan configuration
 * @param {ScanLoggingConfig} logger - Logger instance
 * @returns {Promise<Object>} Detailed analysis
 */
async function performDetailedAnalysis(scanResults, coreStructureAnalysis, config, logger) {
	logger.info('[Scan #4+]: Performing detailed file-level analysis...');

	const importantFiles = scanResults.detailedFiles
		.filter(file => file.functions?.length > 0 || file.classes?.length > 0)
		.slice(0, 10); // Limit to most important files

	if (importantFiles.length === 0) {
		logger.info('No files requiring detailed analysis found');
		return { files: {} };
	}

	const prompt = `Analyze these key files in detail:

${importantFiles.map(file => `
File: ${file.path}
Functions: ${JSON.stringify(file.functions)}
Classes: ${JSON.stringify(file.classes)}
Imports: ${JSON.stringify(file.imports)}
Size: ${file.size} bytes, ${file.lines} lines
`).join('\n')}

For each file, provide:
1. Purpose and responsibility
2. Key functions and their roles
3. Dependencies and relationships
4. Importance to the overall architecture

Respond with detailed analysis for each file.`;

	try {
		const aiService = getAiService({ projectRoot: config.projectRoot });
		const response = await aiService.generateStructuredOutput({
			prompt,
			schema: {
				type: 'object',
				properties: {
					files: {
						type: 'object',
						additionalProperties: {
							type: 'object',
							properties: {
								purpose: { type: 'string' },
								keyFunctions: { type: 'array', items: { type: 'string' } },
								dependencies: { type: 'array', items: { type: 'string' } },
								importance: { type: 'string' },
								description: { type: 'string' }
							}
						}
					}
				}
			}
		});

		logger.info(`[Scan #4+]: Detailed analysis completed for ${Object.keys(response.files || {}).length} files`);
		return response;
	} catch (error) {
		logger.warn(`[Scan #4+]: Detailed analysis failed`);
		return { files: {} };
	}
}

/**
 * Generate a comprehensive project summary
 * @param {Object} scanResults - Raw scan results
 * @param {Object} projectTypeAnalysis - Project type analysis
 * @param {Object} coreStructureAnalysis - Core structure analysis
 * @returns {Object} Project summary
 */
function generateProjectSummary(scanResults, projectTypeAnalysis, coreStructureAnalysis) {
	return {
		overview: `${projectTypeAnalysis.projectType} project with ${scanResults.stats.totalFiles} files across ${scanResults.stats.totalDirectories} directories`,
		languages: projectTypeAnalysis.languages,
		frameworks: projectTypeAnalysis.frameworks,
		architecture: coreStructureAnalysis.architecture?.pattern || 'standard',
		complexity: scanResults.stats.totalFiles > 100 ? 'high' : scanResults.stats.totalFiles > 50 ? 'medium' : 'low',
		keyComponents: Object.keys(coreStructureAnalysis.directories || {}).slice(0, 5)
	};
}