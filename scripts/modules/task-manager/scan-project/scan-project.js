/**
 * Main scan-project functionality
 * Implements intelligent project scanning with AI-driven analysis and ast-grep integration
 */
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { ScanConfig, ScanLoggingConfig } from './scan-config.js';
import { 
	detectProjectType,
	getFileList,
	analyzeFileContent,
	executeAstGrep 
} from './scan-helpers.js';
import { analyzeWithAI } from './ai-analysis.js';

/**
 * Main scan project function
 * @param {string} projectRoot - Project root directory
 * @param {Object} options - Scan options
 * @returns {Promise<Object>} Scan results
 */
export default async function scanProject(projectRoot, options = {}) {
	const config = new ScanConfig({
		projectRoot,
		outputPath: options.outputPath,
		includeFiles: options.includeFiles || [],
		excludeFiles: options.excludeFiles || ['node_modules', '.git', 'dist', 'build', '*.log'],
		scanDepth: options.scanDepth || 5,
		mcpLog: options.mcpLog || false,
		reportProgress: options.reportProgress !== false, // Default to true
		debug: options.debug || false
	});

	const logger = new ScanLoggingConfig(config.mcpLog, config.reportProgress);
	logger.info('Starting intelligent project scan...');

	try {
		// Phase 1: Initial project discovery
		logger.info('Phase 1: Discovering project structure...');
		const initialScan = await performInitialScan(config, logger);

		// Phase 2: File-level analysis
		logger.info('Phase 2: Analyzing individual files...');
		const fileAnalysis = await performFileAnalysis(config, initialScan, logger);

		// Phase 3: AST-grep enhanced analysis
		logger.info('Phase 3: Performing AST analysis...');
		const astAnalysis = await performASTAnalysis(config, fileAnalysis, logger);

		// Phase 4: AI-powered analysis (optional)
		let aiAnalysis = null;
		if (!options.skipAI) {
			logger.info('Phase 4: Enhancing with AI analysis...');
			try {
				aiAnalysis = await analyzeWithAI({
					...initialScan,
					...fileAnalysis,
					...astAnalysis
				}, config);
			} catch (error) {
				logger.warn(`AI analysis failed, continuing without it: ${error.message}`);
				aiAnalysis = {
					projectType: { confidence: 0 },
					coreStructure: { architecture: { pattern: 'unknown' } },
					summary: { complexity: 'unknown' }
				};
			}
		} else {
			logger.info('Phase 4: Skipping AI analysis...');
			aiAnalysis = {
				projectType: { confidence: 0 },
				coreStructure: { architecture: { pattern: 'unknown' } },
				summary: { complexity: 'unknown' }
			};
		}

		// Phase 5: Generate final output
		const finalResults = {
			timestamp: new Date().toISOString(),
			projectRoot: config.projectRoot,
			scanConfig: {
				excludeFiles: config.excludeFiles,
				scanDepth: config.scanDepth
			},
			...initialScan,
			...fileAnalysis,
			...astAnalysis,
			aiAnalysis,
			scanSummary: generateScanSummary(initialScan, fileAnalysis, aiAnalysis)
		};

		// Save results if output path is specified
		if (config.outputPath) {
			await saveResults(finalResults, config.outputPath, logger);
		}

		logger.info('Project scan completed successfully');
		return {
			success: true,
			data: finalResults
		};

	} catch (error) {
		logger.error(`Scan failed: ${error.message}`);
		return {
			success: false,
			error: {
				message: error.message,
				stack: config.debug ? error.stack : undefined
			}
		};
	}
}

/**
 * Phase 1: Perform initial project discovery
 * @param {ScanConfig} config - Scan configuration
 * @param {ScanLoggingConfig} logger - Logger instance
 * @returns {Promise<Object>} Initial scan results
 */
async function performInitialScan(config, logger) {
	logger.info('[Initial Scan]: Discovering project type and structure...');

	// Detect project type
	const projectType = detectProjectType(config.projectRoot);
	logger.info(`[Initial Scan]: Detected ${projectType.type} project`);

	// Get root-level files
	const rootFiles = fs.readdirSync(config.projectRoot)
		.filter(item => {
			const fullPath = path.join(config.projectRoot, item);
			return fs.statSync(fullPath).isFile();
		});

	// Get directory structure (first level)
	const directories = fs.readdirSync(config.projectRoot)
		.filter(item => {
			const fullPath = path.join(config.projectRoot, item);
			return fs.statSync(fullPath).isDirectory() && 
				   !config.excludeFiles.includes(item);
		})
		.map(dir => {
			const dirPath = path.join(config.projectRoot, dir);
			try {
				const files = fs.readdirSync(dirPath);
				return {
					name: dir,
					path: dirPath,
					fileCount: files.length,
					files: files.slice(0, 10) // Sample of files
				};
			} catch (error) {
				return {
					name: dir,
					path: dirPath,
					error: 'Access denied'
				};
			}
		});

	// Get complete file list for scanning
	const fileList = getFileList(
		config.projectRoot,
		config.includeFiles,
		config.excludeFiles,
		config.scanDepth
	);

	// Calculate basic statistics
	const stats = {
		totalFiles: fileList.length,
		totalDirectories: directories.length,
		rootFiles: rootFiles.length,
		languages: [...new Set(fileList.map(f => {
			const ext = path.extname(f);
			return ext ? ext.substring(1) : 'unknown';
		}))],
		largestFiles: fileList
			.map(f => {
				try {
					const fullPath = path.join(config.projectRoot, f);
					const stats = fs.statSync(fullPath);
					return { path: f, size: stats.size };
				} catch {
					return { path: f, size: 0 };
				}
			})
			.sort((a, b) => b.size - a.size)
			.slice(0, 10)
	};

	logger.info(`[Initial Scan]: Found ${stats.totalFiles} files in ${stats.totalDirectories} directories`);

	return {
		projectType,
		rootFiles,
		directories,
		fileList,
		stats
	};
}

/**
 * Phase 2: Perform detailed file analysis
 * @param {ScanConfig} config - Scan configuration
 * @param {Object} initialScan - Initial scan results
 * @param {ScanLoggingConfig} logger - Logger instance
 * @returns {Promise<Object>} File analysis results
 */
async function performFileAnalysis(config, initialScan, logger) {
	logger.info('[File Analysis]: Analyzing file contents...');

	const { fileList, projectType } = initialScan;
	
	// Filter files for detailed analysis (avoid binary files, focus on source code)
	const sourceExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', '.php', '.rb', '.cpp', '.c', '.cs'];
	const sourceFiles = fileList.filter(file => {
		const ext = path.extname(file);
		return sourceExtensions.includes(ext) || projectType.entryPoints.includes(file);
	}).slice(0, 100); // Limit to prevent excessive processing

	logger.info(`[File Analysis]: Analyzing ${sourceFiles.length} source files...`);

	// Analyze files
	const detailedFiles = sourceFiles.map(file => {
		try {
			return analyzeFileContent(file, config.projectRoot);
		} catch (error) {
			logger.warn(`[File Analysis]: Failed to analyze ${file}: ${error.message}`);
			return { path: file, error: error.message };
		}
	}).filter(result => !result.error);

	// Group by language
	const byLanguage = detailedFiles.reduce((acc, file) => {
		const lang = file.language || 'unknown';
		if (!acc[lang]) acc[lang] = [];
		acc[lang].push(file);
		return acc;
	}, {});

	// Extract key statistics
	const codeStats = {
		totalLines: detailedFiles.reduce((sum, f) => sum + (f.lines || 0), 0),
		totalFunctions: detailedFiles.reduce((sum, f) => sum + (f.functions?.length || 0), 0),
		totalClasses: detailedFiles.reduce((sum, f) => sum + (f.classes?.length || 0), 0),
		languageBreakdown: Object.keys(byLanguage).map(lang => ({
			language: lang,
			files: byLanguage[lang].length,
			lines: byLanguage[lang].reduce((sum, f) => sum + (f.lines || 0), 0)
		}))
	};

	logger.info(`[File Analysis]: Analyzed ${detailedFiles.length} files, ${codeStats.totalLines} lines, ${codeStats.totalFunctions} functions`);

	return {
		detailedFiles,
		byLanguage,
		codeStats
	};
}

/**
 * Phase 3: Perform AST-grep enhanced analysis
 * @param {ScanConfig} config - Scan configuration
 * @param {Object} fileAnalysis - File analysis results
 * @param {ScanLoggingConfig} logger - Logger instance
 * @returns {Promise<Object>} AST analysis results
 */
async function performASTAnalysis(config, fileAnalysis, logger) {
	logger.info('[AST Analysis]: Performing syntax tree analysis...');

	const { detailedFiles } = fileAnalysis;
	
	// Select files for AST analysis (focus on main source files)
	const astTargetFiles = detailedFiles
		.filter(file => file.functions?.length > 0 || file.classes?.length > 0)
		.slice(0, 20) // Limit for performance
		.map(file => file.path);

	if (astTargetFiles.length === 0) {
		logger.info('[AST Analysis]: No suitable files found for AST analysis');
		return { astResults: {} };
	}

	logger.info(`[AST Analysis]: Analyzing ${astTargetFiles.length} files with ast-grep...`);

	const astResults = {};

	// Define common patterns to search for
	const patterns = {
		functions: {
			javascript: 'function $_($$$) { $$$ }',
			typescript: 'function $_($$$): $_ { $$$ }',
			python: 'def $_($$$): $$$',
			java: '$_ $_($$$ args) { $$$ }'
		},
		classes: {
			javascript: 'class $_ { $$$ }',
			typescript: 'class $_ { $$$ }',
			python: 'class $_: $$$',
			java: 'class $_ { $$$ }'
		},
		imports: {
			javascript: 'import $_ from $_',
			typescript: 'import $_ from $_',
			python: 'import $_',
			java: 'import $_;'
		}
	};

	// Run AST analysis for different languages
	for (const [language, files] of Object.entries(fileAnalysis.byLanguage || {})) {
		if (patterns.functions[language] && files.length > 0) {
			try {
				logger.debug(`[AST Analysis]: Analyzing ${language} files...`);
				
				const langFiles = files.map(f => f.path).filter(path => astTargetFiles.includes(path));
				if (langFiles.length > 0) {
					// Run ast-grep for functions
					const functionResults = await executeAstGrep(
						config.projectRoot,
						patterns.functions[language],
						langFiles
					);

					// Run ast-grep for classes
					const classResults = await executeAstGrep(
						config.projectRoot,
						patterns.classes[language],
						langFiles
					);

					astResults[language] = {
						functions: functionResults || [],
						classes: classResults || [],
						files: langFiles
					};
				}
			} catch (error) {
				logger.warn(`[AST Analysis]: AST analysis failed for ${language}: ${error.message}`);
				// Continue with other languages
			}
		}
	}

	const totalMatches = Object.values(astResults).reduce((sum, lang) => 
		sum + (lang.functions?.length || 0) + (lang.classes?.length || 0), 0);

	logger.info(`[AST Analysis]: Found ${totalMatches} AST matches across ${Object.keys(astResults).length} languages`);

	return { astResults };
}

/**
 * Generate scan summary
 * @param {Object} initialScan - Initial scan results
 * @param {Object} fileAnalysis - File analysis results
 * @param {Object} aiAnalysis - AI analysis results
 * @returns {Object} Scan summary
 */
function generateScanSummary(initialScan, fileAnalysis, aiAnalysis) {
	return {
		overview: `Scanned ${initialScan.stats.totalFiles} files across ${initialScan.stats.totalDirectories} directories`,
		projectType: initialScan.projectType.type,
		languages: initialScan.stats.languages,
		codeMetrics: {
			totalLines: fileAnalysis.codeStats?.totalLines || 0,
			totalFunctions: fileAnalysis.codeStats?.totalFunctions || 0,
			totalClasses: fileAnalysis.codeStats?.totalClasses || 0
		},
		aiInsights: {
			confidence: aiAnalysis.projectType?.confidence || 0,
			architecture: aiAnalysis.coreStructure?.architecture?.pattern || 'unknown',
			complexity: aiAnalysis.summary?.complexity || 'unknown'
		},
		recommendations: generateRecommendations(initialScan, fileAnalysis, aiAnalysis)
	};
}

/**
 * Generate recommendations based on scan results
 * @param {Object} initialScan - Initial scan results
 * @param {Object} fileAnalysis - File analysis results
 * @param {Object} aiAnalysis - AI analysis results
 * @returns {Array} List of recommendations
 */
function generateRecommendations(initialScan, fileAnalysis, aiAnalysis) {
	const recommendations = [];

	// Size-based recommendations
	if (initialScan.stats.totalFiles > 500) {
		recommendations.push('Consider using a monorepo management tool for large codebase');
	}

	// Language-specific recommendations
	const jsFiles = fileAnalysis.byLanguage?.javascript?.length || 0;
	const tsFiles = fileAnalysis.byLanguage?.typescript?.length || 0;
	
	if (jsFiles > tsFiles && jsFiles > 10) {
		recommendations.push('Consider migrating JavaScript files to TypeScript for better type safety');
	}

	// Documentation recommendations
	const readmeExists = initialScan.rootFiles.some(f => f.toLowerCase().includes('readme'));
	if (!readmeExists) {
		recommendations.push('Add a README.md file to document the project');
	}

	// Testing recommendations
	const hasTests = initialScan.fileList.some(f => f.includes('test') || f.includes('spec'));
	if (!hasTests) {
		recommendations.push('Consider adding unit tests to improve code quality');
	}

	return recommendations;
}

/**
 * Save scan results to file
 * @param {Object} results - Scan results
 * @param {string} outputPath - Output file path
 * @param {ScanLoggingConfig} logger - Logger instance
 */
async function saveResults(results, outputPath, logger) {
	try {
		// Ensure output directory exists
		const outputDir = path.dirname(outputPath);
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		// Write results to file
		fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
		logger.info(`Scan results saved to: ${outputPath}`);
	} catch (error) {
		logger.error(`Failed to save results: ${error.message}`);
		throw error;
	}
}