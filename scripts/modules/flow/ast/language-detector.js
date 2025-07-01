/**
 * Language Detection System for AST Analysis
 * Detects programming languages from file extensions, shebangs, and content
 */

/**
 * Mapping of file extensions to programming languages
 */
const EXTENSION_LANGUAGE_MAP = {
	// JavaScript & TypeScript
	'.js': 'javascript',
	'.jsx': 'javascript',
	'.ts': 'typescript',
	'.tsx': 'typescript',
	'.mjs': 'javascript',
	'.cjs': 'javascript',

	// Python
	'.py': 'python',
	'.pyw': 'python',
	'.pyi': 'python',

	// Go
	'.go': 'go',

	// Rust
	'.rs': 'rust',

	// Java
	'.java': 'java',

	// C#
	'.cs': 'csharp',

	// PHP
	'.php': 'php',
	'.phtml': 'php',

	// Ruby
	'.rb': 'ruby',
	'.rbw': 'ruby',

	// C/C++
	'.c': 'c',
	'.cpp': 'cpp',
	'.cc': 'cpp',
	'.cxx': 'cpp',
	'.h': 'c',
	'.hpp': 'cpp',
	'.hxx': 'cpp'
};

/**
 * Shebang patterns for language detection
 */
const SHEBANG_PATTERNS = [
	{ pattern: /^#!.*\/python[0-9\.]*/, language: 'python' },
	{ pattern: /^#!.*\/node/, language: 'javascript' },
	{ pattern: /^#!.*\/ruby/, language: 'ruby' },
	{ pattern: /^#!.*\/php/, language: 'php' },
	{ pattern: /^#!.*\/bash/, language: 'shell' },
	{ pattern: /^#!.*\/sh/, language: 'shell' }
];

/**
 * Content-based language detection patterns
 */
const CONTENT_PATTERNS = [
	// Package declarations
	{ pattern: /^package\s+\w+/, language: 'go', confidence: 0.8 },
	{ pattern: /^namespace\s+\w+/, language: 'csharp', confidence: 0.7 },

	// Import/require patterns
	{
		pattern: /^import\s+.*from\s+['"]/,
		language: 'javascript',
		confidence: 0.6
	},
	{
		pattern: /^const\s+.*=\s+require\(/,
		language: 'javascript',
		confidence: 0.6
	},
	{ pattern: /^from\s+.*import/, language: 'python', confidence: 0.7 },
	{ pattern: /^import\s+\w+/, language: 'python', confidence: 0.5 },

	// Language-specific keywords
	{ pattern: /\bfunc\s+\w+\s*\(/, language: 'go', confidence: 0.6 },
	{ pattern: /\bdef\s+\w+\s*\(/, language: 'python', confidence: 0.7 },
	{ pattern: /\bclass\s+\w+\s*{/, language: 'javascript', confidence: 0.5 },
	{ pattern: /\bpublic\s+class\s+\w+/, language: 'java', confidence: 0.8 },
	{ pattern: /\bfn\s+\w+\s*\(/, language: 'rust', confidence: 0.8 }
];

/**
 * Detect programming language from file path
 * @param {string} filePath - Path to the file
 * @returns {string|null} Detected language or null if unknown
 */
export function detectLanguageFromPath(filePath) {
	if (!filePath) return null;

	// Extract file extension
	const extension = getFileExtension(filePath);
	return EXTENSION_LANGUAGE_MAP[extension] || null;
}

/**
 * Detect programming language from file content
 * @param {string} content - File content to analyze
 * @param {string} filePath - Optional file path for additional context
 * @returns {Object} Detection result with language, confidence, and method
 */
export function detectLanguageFromContent(content, filePath = null) {
	if (!content || typeof content !== 'string') {
		return { language: null, confidence: 0, method: 'none' };
	}

	const lines = content.split('\n');
	const firstLine = lines[0] || '';

	// 1. Check shebang (highest confidence)
	if (firstLine.startsWith('#!')) {
		for (const { pattern, language } of SHEBANG_PATTERNS) {
			if (pattern.test(firstLine)) {
				return { language, confidence: 0.9, method: 'shebang' };
			}
		}
	}

	// 2. Check content patterns
	const contentSample = lines.slice(0, 20).join('\n'); // First 20 lines
	let bestMatch = { language: null, confidence: 0, method: 'content' };

	for (const { pattern, language, confidence } of CONTENT_PATTERNS) {
		if (pattern.test(contentSample)) {
			if (confidence > bestMatch.confidence) {
				bestMatch = { language, confidence, method: 'content' };
			}
		}
	}

	// 3. Fall back to extension if available
	if (bestMatch.confidence < 0.5 && filePath) {
		const extLanguage = detectLanguageFromPath(filePath);
		if (extLanguage) {
			return { language: extLanguage, confidence: 0.4, method: 'extension' };
		}
	}

	return bestMatch;
}

/**
 * Comprehensive language detection combining multiple methods
 * @param {string} filePath - Path to the file
 * @param {string} content - File content (optional)
 * @returns {Object} Detection result with language, confidence, and method
 */
export function detectLanguage(filePath, content = null) {
	// Start with extension-based detection
	const extLanguage = detectLanguageFromPath(filePath);
	let result = {
		language: extLanguage,
		confidence: extLanguage ? 0.6 : 0,
		method: 'extension'
	};

	// Enhance with content analysis if available
	if (content) {
		const contentResult = detectLanguageFromContent(content, filePath);

		// Use content result if it has higher confidence
		if (contentResult.confidence > result.confidence) {
			result = contentResult;
		}
		// Or if content confirms extension detection
		else if (contentResult.language === result.language) {
			result.confidence = Math.min(0.95, result.confidence + 0.2);
			result.method = 'extension+content';
		}
	}

	return result;
}

/**
 * Check if a language is supported for AST analysis
 * @param {string} language - Language identifier
 * @param {Array<string>} supportedLanguages - Array of supported languages
 * @returns {boolean} True if language is supported
 */
export function isLanguageSupported(language, supportedLanguages = []) {
	return supportedLanguages.includes(language);
}

/**
 * Get file extension including the dot
 * @param {string} filePath - Path to the file
 * @returns {string} File extension or empty string
 */
export function getFileExtension(filePath) {
	if (!filePath) return '';

	const lastDot = filePath.lastIndexOf('.');
	const lastSlash = Math.max(
		filePath.lastIndexOf('/'),
		filePath.lastIndexOf('\\')
	);

	// Ensure the dot is after the last path separator
	if (lastDot > lastSlash && lastDot !== -1) {
		return filePath.substring(lastDot).toLowerCase();
	}

	return '';
}

/**
 * Get all supported file extensions for given languages
 * @param {Array<string>} languages - Array of language identifiers
 * @returns {Array<string>} Array of file extensions
 */
export function getExtensionsForLanguages(languages = []) {
	const extensions = [];

	for (const [ext, lang] of Object.entries(EXTENSION_LANGUAGE_MAP)) {
		if (languages.includes(lang)) {
			extensions.push(ext);
		}
	}

	return [...new Set(extensions)]; // Remove duplicates
}

/**
 * Get language display name
 * @param {string} language - Language identifier
 * @returns {string} Human-readable language name
 */
export function getLanguageDisplayName(language) {
	const displayNames = {
		javascript: 'JavaScript',
		typescript: 'TypeScript',
		python: 'Python',
		go: 'Go',
		rust: 'Rust',
		java: 'Java',
		csharp: 'C#',
		php: 'PHP',
		ruby: 'Ruby',
		c: 'C',
		cpp: 'C++',
		shell: 'Shell Script'
	};

	return displayNames[language] || language;
}

/**
 * Check if a file should be excluded from AST analysis
 * @param {string} filePath - Path to the file
 * @param {Array<string>} excludePatterns - Array of glob patterns to exclude
 * @returns {boolean} True if file should be excluded
 */
export function shouldExcludeFile(filePath, excludePatterns = []) {
	if (!filePath || !Array.isArray(excludePatterns)) {
		return false;
	}

	// Convert glob patterns to regex (simplified)
	for (const pattern of excludePatterns) {
		const regexPattern = pattern
			.replace(/\*\*/g, '.*') // ** matches any number of directories
			.replace(/\*/g, '[^/]*') // * matches anything except path separators
			.replace(/\?/g, '[^/]'); // ? matches single character except path separator

		const regex = new RegExp(regexPattern);
		if (regex.test(filePath)) {
			return true;
		}
	}

	return false;
}
