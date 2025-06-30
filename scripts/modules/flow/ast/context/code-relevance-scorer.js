/**
 * Code Relevance Scorer - Determines how relevant code files are to current tasks
 */

/**
 * Score the relevance of a parsed file to a set of tasks
 * @param {Object} parseResult - AST parse result
 * @param {Array} tasks - Array of task objects
 * @param {Object} options - Scoring options
 * @returns {Promise<number>} Relevance score (0-1, higher is more relevant)
 */
export async function scoreCodeRelevance(parseResult, tasks, options = {}) {
	try {
		const { file, ast, language } = parseResult;
		const { config } = options;
		
		let totalScore = 0;
		let scoreFactors = 0;
		
		// Factor 1: File name relevance to task titles/descriptions
		const fileNameScore = scoreFileNameRelevance(file.path, tasks);
		totalScore += fileNameScore * 0.3;
		scoreFactors += 0.3;
		
		// Factor 2: Function/class name relevance
		const symbolScore = scoreSymbolRelevance(ast, tasks);
		totalScore += symbolScore * 0.4;
		scoreFactors += 0.4;
		
		// Factor 3: Import/dependency relevance
		const importScore = scoreImportRelevance(ast, tasks, language);
		totalScore += importScore * 0.2;
		scoreFactors += 0.2;
		
		// Factor 4: Recent modification (if file was recently changed)
		const recencyScore = scoreFileRecency(file);
		totalScore += recencyScore * 0.1;
		scoreFactors += 0.1;
		
		// Normalize score
		const finalScore = scoreFactors > 0 ? totalScore / scoreFactors : 0;
		
		console.debug('[AST Scorer] File relevance:', {
			file: file.path,
			finalScore: finalScore.toFixed(3),
			factors: {
				fileName: fileNameScore.toFixed(3),
				symbols: symbolScore.toFixed(3),
				imports: importScore.toFixed(3),
				recency: recencyScore.toFixed(3)
			}
		});
		
		return Math.min(1, Math.max(0, finalScore));
		
	} catch (error) {
		console.warn('[AST Scorer] Error scoring relevance:', error.message);
		return 0.5; // Default moderate relevance if scoring fails
	}
}

/**
 * Score file name relevance to tasks
 * @param {string} filePath - File path
 * @param {Array} tasks - Task objects
 * @returns {number} Score 0-1
 */
function scoreFileNameRelevance(filePath, tasks) {
	const fileName = filePath.toLowerCase();
	let maxScore = 0;
	
	for (const task of tasks) {
		const taskText = `${task.title || ''} ${task.description || ''}`.toLowerCase();
		const keywords = extractKeywords(taskText);
		
		let fileScore = 0;
		for (const keyword of keywords) {
			if (keyword.length > 2 && fileName.includes(keyword)) {
				// Boost score based on keyword prominence
				const prominence = keyword.length / 10; // Longer keywords are more significant
				fileScore += Math.min(1, prominence);
			}
		}
		
		// Special boost for common patterns
		if (taskText.includes('auth') && fileName.includes('auth')) fileScore += 0.3;
		if (taskText.includes('api') && fileName.includes('api')) fileScore += 0.3;
		if (taskText.includes('database') && fileName.includes('db')) fileScore += 0.3;
		if (taskText.includes('user') && fileName.includes('user')) fileScore += 0.3;
		if (taskText.includes('config') && fileName.includes('config')) fileScore += 0.3;
		if (taskText.includes('test') && fileName.includes('test')) fileScore += 0.2;
		
		maxScore = Math.max(maxScore, fileScore);
	}
	
	return Math.min(1, maxScore);
}

/**
 * Score function/class name relevance to tasks
 * @param {Object} ast - AST analysis result
 * @param {Array} tasks - Task objects
 * @returns {number} Score 0-1
 */
function scoreSymbolRelevance(ast, tasks) {
	if (!ast.functions || !ast.classes) return 0;
	
	const allSymbols = [
		...ast.functions.map(f => f.name),
		...ast.classes.map(c => c.name),
		...(ast.exports || [])
	].filter(Boolean);
	
	if (allSymbols.length === 0) return 0;
	
	let totalScore = 0;
	let symbolCount = 0;
	
	for (const task of tasks) {
		const taskText = `${task.title || ''} ${task.description || ''} ${task.details || ''}`.toLowerCase();
		const keywords = extractKeywords(taskText);
		
		for (const symbol of allSymbols) {
			const symbolLower = symbol.toLowerCase();
			let symbolScore = 0;
			
			// Direct keyword matches
			for (const keyword of keywords) {
				if (keyword.length > 2) {
					if (symbolLower.includes(keyword) || keyword.includes(symbolLower)) {
						symbolScore += 0.5;
					}
				}
			}
			
			// Common function patterns
			if (taskText.includes('create') && symbolLower.includes('create')) symbolScore += 0.3;
			if (taskText.includes('update') && symbolLower.includes('update')) symbolScore += 0.3;
			if (taskText.includes('delete') && symbolLower.includes('delete')) symbolScore += 0.3;
			if (taskText.includes('get') && symbolLower.includes('get')) symbolScore += 0.2;
			if (taskText.includes('validate') && symbolLower.includes('validate')) symbolScore += 0.3;
			if (taskText.includes('auth') && symbolLower.includes('auth')) symbolScore += 0.3;
			if (taskText.includes('hash') && symbolLower.includes('hash')) symbolScore += 0.3;
			if (taskText.includes('encrypt') && symbolLower.includes('encrypt')) symbolScore += 0.3;
			
			totalScore += Math.min(1, symbolScore);
			symbolCount++;
		}
	}
	
	return symbolCount > 0 ? totalScore / symbolCount : 0;
}

/**
 * Score import/dependency relevance to tasks
 * @param {Object} ast - AST analysis result
 * @param {Array} tasks - Task objects
 * @param {string} language - Programming language
 * @returns {number} Score 0-1
 */
function scoreImportRelevance(ast, tasks, language) {
	if (!ast.imports || ast.imports.length === 0) return 0;
	
	let totalScore = 0;
	let importCount = 0;
	
	for (const task of tasks) {
		const taskText = `${task.title || ''} ${task.description || ''} ${task.details || ''}`.toLowerCase();
		
		for (const importItem of ast.imports) {
			const importName = (importItem.source || importItem.module || '').toLowerCase();
			let importScore = 0;
			
			// Technology-specific relevance
			if (language === 'javascript' || language === 'typescript') {
				if (taskText.includes('react') && importName.includes('react')) importScore += 0.4;
				if (taskText.includes('express') && importName.includes('express')) importScore += 0.4;
				if (taskText.includes('database') && (importName.includes('mongoose') || importName.includes('sequelize') || importName.includes('prisma'))) importScore += 0.4;
				if (taskText.includes('test') && (importName.includes('jest') || importName.includes('mocha') || importName.includes('chai'))) importScore += 0.3;
				if (taskText.includes('auth') && (importName.includes('passport') || importName.includes('jwt') || importName.includes('bcrypt'))) importScore += 0.4;
			} else if (language === 'python') {
				if (taskText.includes('web') && (importName.includes('flask') || importName.includes('django') || importName.includes('fastapi'))) importScore += 0.4;
				if (taskText.includes('database') && (importName.includes('sqlalchemy') || importName.includes('django.db'))) importScore += 0.4;
				if (taskText.includes('test') && (importName.includes('pytest') || importName.includes('unittest'))) importScore += 0.3;
				if (taskText.includes('request') && importName.includes('requests')) importScore += 0.3;
			} else if (language === 'go') {
				if (taskText.includes('web') && (importName.includes('gin') || importName.includes('echo') || importName.includes('fiber'))) importScore += 0.4;
				if (taskText.includes('database') && (importName.includes('gorm') || importName.includes('sql'))) importScore += 0.4;
				if (taskText.includes('test') && importName.includes('testing')) importScore += 0.3;
			}
			
			// Generic patterns
			if (taskText.includes('http') && importName.includes('http')) importScore += 0.3;
			if (taskText.includes('json') && importName.includes('json')) importScore += 0.2;
			if (taskText.includes('crypto') && importName.includes('crypto')) importScore += 0.3;
			if (taskText.includes('time') && importName.includes('time')) importScore += 0.2;
			
			totalScore += Math.min(1, importScore);
			importCount++;
		}
	}
	
	return importCount > 0 ? totalScore / importCount : 0;
}

/**
 * Score file recency (boost for recently modified files)
 * @param {Object} file - File object with modification time
 * @returns {number} Score 0-1
 */
function scoreFileRecency(file) {
	if (!file.modified) return 0;
	
	const now = new Date();
	const modifiedTime = new Date(file.modified);
	const hoursSinceModified = (now - modifiedTime) / (1000 * 60 * 60);
	
	// High score for files modified in last 24 hours, declining over time
	if (hoursSinceModified < 1) return 1.0;
	if (hoursSinceModified < 6) return 0.8;
	if (hoursSinceModified < 24) return 0.6;
	if (hoursSinceModified < 72) return 0.4;
	if (hoursSinceModified < 168) return 0.2; // 1 week
	
	return 0;
}

/**
 * Extract keywords from task text
 * @param {string} text - Task text
 * @returns {Array} Array of keywords
 */
function extractKeywords(text) {
	if (!text) return [];
	
	// Remove common words and extract meaningful terms
	const commonWords = new Set([
		'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
		'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
		'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must', 'shall',
		'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
	]);
	
	return text
		.toLowerCase()
		.replace(/[^\w\s]/g, ' ') // Remove punctuation
		.split(/\s+/)
		.filter(word => word.length > 2 && !commonWords.has(word))
		.filter(word => !word.match(/^\d+$/)); // Remove pure numbers
}

/**
 * Score relevance of multiple files and return top candidates
 * @param {Object} parseResults - Results grouped by language
 * @param {Array} tasks - Task objects
 * @param {Object} options - Scoring options
 * @returns {Promise<Array>} Sorted array of files by relevance
 */
export async function getTopRelevantFiles(parseResults, tasks, options = {}) {
	const { maxFiles = 10 } = options;
	const scoredFiles = [];
	
	for (const [language, results] of Object.entries(parseResults)) {
		for (const result of results) {
			const score = await scoreCodeRelevance(result, tasks, { ...options, language });
			scoredFiles.push({
				...result,
				relevanceScore: score
			});
		}
	}
	
	// Sort by relevance score (descending) and return top files
	return scoredFiles
		.sort((a, b) => b.relevanceScore - a.relevanceScore)
		.slice(0, maxFiles);
}

/**
 * Get relevance insights for debugging
 * @param {Object} parseResults - Results grouped by language
 * @param {Array} tasks - Task objects
 * @returns {Promise<Object>} Relevance insights
 */
export async function getRelevanceInsights(parseResults, tasks) {
	const insights = {
		totalFiles: 0,
		averageScore: 0,
		highRelevanceFiles: [],
		lowRelevanceFiles: [],
		keywordMatches: {}
	};
	
	const allScores = [];
	
	for (const [language, results] of Object.entries(parseResults)) {
		for (const result of results) {
			const score = await scoreCodeRelevance(result, tasks, { language });
			allScores.push(score);
			insights.totalFiles++;
			
			if (score > 0.7) {
				insights.highRelevanceFiles.push({
					file: result.file.path,
					score: score.toFixed(3)
				});
			} else if (score < 0.3) {
				insights.lowRelevanceFiles.push({
					file: result.file.path,
					score: score.toFixed(3)
				});
			}
		}
	}
	
	insights.averageScore = allScores.length > 0 
		? (allScores.reduce((sum, score) => sum + score, 0) / allScores.length).toFixed(3)
		: 0;
	
	return insights;
} 