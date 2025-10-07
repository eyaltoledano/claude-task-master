/**
 * Helper functions for project scanning
 */
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { ScanLoggingConfig } from './scan-config.js';

/**
 * Execute ast-grep command to analyze files
 * @param {string} projectRoot - Project root directory
 * @param {string} pattern - AST pattern to search for
 * @param {Array} files - Files to analyze
 * @returns {Promise<Object>} AST analysis results
 */
export async function executeAstGrep(projectRoot, pattern, files = []) {
	return new Promise((resolve, reject) => {
		const astGrepPath = path.join(process.cwd(), 'node_modules/.bin/ast-grep');
		const args = ['run', '--json'];
		
		if (pattern) {
			args.push('-p', pattern);
		}
		
		if (files.length > 0) {
			args.push(...files);
		}

		const child = spawn(astGrepPath, args, {
			cwd: projectRoot,
			stdio: ['pipe', 'pipe', 'pipe']
		});

		let stdout = '';
		let stderr = '';

		child.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		child.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		child.on('close', (code) => {
			if (code === 0) {
				try {
					const results = stdout ? JSON.parse(stdout) : [];
					resolve(results);
				} catch (error) {
					reject(new Error(`Failed to parse ast-grep output: ${error.message}`));
				}
			} else {
				reject(new Error(`ast-grep failed with code ${code}: ${stderr}`));
			}
		});

		child.on('error', (error) => {
			reject(new Error(`Failed to execute ast-grep: ${error.message}`));
		});
	});
}

/**
 * Detect project type based on files in root directory
 * @param {string} projectRoot - Project root directory
 * @returns {Object} Project type information
 */
export function detectProjectType(projectRoot) {
	const files = fs.readdirSync(projectRoot);
	const projectType = {
		type: 'unknown',
		frameworks: [],
		languages: [],
		buildTools: [],
		entryPoints: []
	};

	// Check for common project indicators
	const indicators = {
		'package.json': () => {
			projectType.type = 'nodejs';
			projectType.languages.push('javascript');
			
			try {
				const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
				
				// Detect frameworks and libraries
				const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
				if (deps.react) projectType.frameworks.push('react');
				if (deps.next) projectType.frameworks.push('next.js');
				if (deps.express) projectType.frameworks.push('express');
				if (deps.typescript) projectType.languages.push('typescript');
				
				// Find entry points
				if (packageJson.main) projectType.entryPoints.push(packageJson.main);
				if (packageJson.scripts?.start) {
					const startScript = packageJson.scripts.start;
					const match = startScript.match(/node\s+(\S+)/);
					if (match) projectType.entryPoints.push(match[1]);
				}
			} catch (error) {
				// Ignore package.json parsing errors
			}
		},
		'pom.xml': () => {
			projectType.type = 'java';
			projectType.languages.push('java');
			projectType.buildTools.push('maven');
		},
		'build.gradle': () => {
			projectType.type = 'java';
			projectType.languages.push('java');
			projectType.buildTools.push('gradle');
		},
		'requirements.txt': () => {
			projectType.type = 'python';
			projectType.languages.push('python');
		},
		'Pipfile': () => {
			projectType.type = 'python';
			projectType.languages.push('python');
			projectType.buildTools.push('pipenv');
		},
		'pyproject.toml': () => {
			projectType.type = 'python';
			projectType.languages.push('python');
		},
		'Cargo.toml': () => {
			projectType.type = 'rust';
			projectType.languages.push('rust');
			projectType.buildTools.push('cargo');
		},
		'go.mod': () => {
			projectType.type = 'go';
			projectType.languages.push('go');
		},
		'composer.json': () => {
			projectType.type = 'php';
			projectType.languages.push('php');
		},
		'Gemfile': () => {
			projectType.type = 'ruby';
			projectType.languages.push('ruby');
		}
	};

	// Check for indicators
	for (const file of files) {
		if (indicators[file]) {
			indicators[file]();
		}
	}

	return projectType;
}

/**
 * Get file list based on include/exclude patterns
 * @param {string} projectRoot - Project root directory
 * @param {Array} includePatterns - Patterns to include
 * @param {Array} excludePatterns - Patterns to exclude
 * @param {number} maxDepth - Maximum directory depth to scan
 * @returns {Array} List of files to analyze
 */
export function getFileList(projectRoot, includePatterns = [], excludePatterns = [], maxDepth = 5) {
	const files = [];
	
	function scanDirectory(dirPath, depth = 0) {
		if (depth > maxDepth) return;
		
		try {
			const items = fs.readdirSync(dirPath, { withFileTypes: true });
			
			for (const item of items) {
				const fullPath = path.join(dirPath, item.name);
				const relativePath = path.relative(projectRoot, fullPath);
				
				// Check exclude patterns
				if (shouldExclude(relativePath, excludePatterns)) {
					continue;
				}
				
				if (item.isDirectory()) {
					scanDirectory(fullPath, depth + 1);
				} else if (item.isFile()) {
					// Check include patterns (if specified)
					if (includePatterns.length === 0 || shouldInclude(relativePath, includePatterns)) {
						files.push(relativePath);
					}
				}
			}
		} catch (error) {
			// Ignore permission errors and continue
		}
	}
	
	scanDirectory(projectRoot);
	return files;
}

/**
 * Check if file should be excluded based on patterns
 * @param {string} filePath - File path to check
 * @param {Array} excludePatterns - Exclude patterns
 * @returns {boolean} True if should be excluded
 */
function shouldExclude(filePath, excludePatterns) {
	return excludePatterns.some(pattern => {
		if (pattern.includes('*')) {
			const regex = new RegExp(pattern.replace(/\*/g, '.*'));
			return regex.test(filePath);
		}
		return filePath.includes(pattern);
	});
}

/**
 * Check if file should be included based on patterns
 * @param {string} filePath - File path to check
 * @param {Array} includePatterns - Include patterns
 * @returns {boolean} True if should be included
 */
function shouldInclude(filePath, includePatterns) {
	return includePatterns.some(pattern => {
		if (pattern.includes('*')) {
			const regex = new RegExp(pattern.replace(/\*/g, '.*'));
			return regex.test(filePath);
		}
		return filePath.includes(pattern);
	});
}

/**
 * Analyze file content to extract key information
 * @param {string} filePath - Path to file
 * @param {string} projectRoot - Project root
 * @returns {Object} File analysis results
 */
export function analyzeFileContent(filePath, projectRoot) {
	try {
		const fullPath = path.join(projectRoot, filePath);
		const content = fs.readFileSync(fullPath, 'utf8');
		const ext = path.extname(filePath);
		
		const analysis = {
			path: filePath,
			size: content.length,
			lines: content.split('\n').length,
			language: getLanguageFromExtension(ext),
			functions: [],
			classes: [],
			imports: [],
			exports: []
		};
		
		// Basic pattern matching for common constructs
		switch (ext) {
			case '.js':
			case '.ts':
			case '.jsx':
			case '.tsx':
				analyzeJavaScriptFile(content, analysis);
				break;
			case '.py':
				analyzePythonFile(content, analysis);
				break;
			case '.java':
				analyzeJavaFile(content, analysis);
				break;
			case '.go':
				analyzeGoFile(content, analysis);
				break;
		}
		
		return analysis;
	} catch (error) {
		return {
			path: filePath,
			error: error.message
		};
	}
}

/**
 * Get programming language from file extension
 * @param {string} ext - File extension
 * @returns {string} Programming language
 */
function getLanguageFromExtension(ext) {
	const langMap = {
		'.js': 'javascript',
		'.jsx': 'javascript',
		'.ts': 'typescript',
		'.tsx': 'typescript',
		'.py': 'python',
		'.java': 'java',
		'.go': 'go',
		'.rs': 'rust',
		'.php': 'php',
		'.rb': 'ruby',
		'.cpp': 'cpp',
		'.c': 'c',
		'.cs': 'csharp'
	};
	return langMap[ext] || 'unknown';
}

/**
 * Analyze JavaScript/TypeScript file content
 * @param {string} content - File content
 * @param {Object} analysis - Analysis object to populate
 */
function analyzeJavaScriptFile(content, analysis) {
	// Extract function declarations
	const functionRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>)|(\w+)\s*:\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/g;
	let match;
	while ((match = functionRegex.exec(content)) !== null) {
		const functionName = match[1] || match[2] || match[3];
		if (functionName) {
			analysis.functions.push(functionName);
		}
	}
	
	// Extract class declarations
	const classRegex = /class\s+(\w+)/g;
	while ((match = classRegex.exec(content)) !== null) {
		analysis.classes.push(match[1]);
	}
	
	// Extract imports
	const importRegex = /import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/g;
	while ((match = importRegex.exec(content)) !== null) {
		analysis.imports.push(match[1]);
	}
	
	// Extract exports
	const exportRegex = /export\s+(?:default\s+)?(?:const\s+|function\s+|class\s+)?(\w+)/g;
	while ((match = exportRegex.exec(content)) !== null) {
		analysis.exports.push(match[1]);
	}
}

/**
 * Analyze Python file content
 * @param {string} content - File content
 * @param {Object} analysis - Analysis object to populate
 */
function analyzePythonFile(content, analysis) {
	// Extract function definitions
	const functionRegex = /def\s+(\w+)/g;
	let match;
	while ((match = functionRegex.exec(content)) !== null) {
		analysis.functions.push(match[1]);
	}
	
	// Extract class definitions
	const classRegex = /class\s+(\w+)/g;
	while ((match = classRegex.exec(content)) !== null) {
		analysis.classes.push(match[1]);
	}
	
	// Extract imports
	const importRegex = /(?:import\s+(\w+)|from\s+(\w+)\s+import)/g;
	while ((match = importRegex.exec(content)) !== null) {
		analysis.imports.push(match[1] || match[2]);
	}
}

/**
 * Analyze Java file content
 * @param {string} content - File content
 * @param {Object} analysis - Analysis object to populate
 */
function analyzeJavaFile(content, analysis) {
	// Extract method declarations
	const methodRegex = /(?:public|private|protected|static|\s)*\s+\w+\s+(\w+)\s*\(/g;
	let match;
	while ((match = methodRegex.exec(content)) !== null) {
		analysis.functions.push(match[1]);
	}
	
	// Extract class declarations
	const classRegex = /(?:public\s+)?class\s+(\w+)/g;
	while ((match = classRegex.exec(content)) !== null) {
		analysis.classes.push(match[1]);
	}
	
	// Extract imports
	const importRegex = /import\s+([^;]+);/g;
	while ((match = importRegex.exec(content)) !== null) {
		analysis.imports.push(match[1]);
	}
}

/**
 * Analyze Go file content
 * @param {string} content - File content
 * @param {Object} analysis - Analysis object to populate
 */
function analyzeGoFile(content, analysis) {
	// Extract function declarations
	const functionRegex = /func\s+(?:\([^)]*\)\s+)?(\w+)/g;
	let match;
	while ((match = functionRegex.exec(content)) !== null) {
		analysis.functions.push(match[1]);
	}
	
	// Extract type/struct declarations
	const typeRegex = /type\s+(\w+)\s+struct/g;
	while ((match = typeRegex.exec(content)) !== null) {
		analysis.classes.push(match[1]); // Treating structs as classes
	}
	
	// Extract imports
	const importRegex = /import\s+(?:\([^)]+\)|"([^"]+)")/g;
	while ((match = importRegex.exec(content)) !== null) {
		if (match[1]) {
			analysis.imports.push(match[1]);
		}
	}
}