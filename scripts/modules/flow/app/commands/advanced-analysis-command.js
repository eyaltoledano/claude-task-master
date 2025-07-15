/**
 * Advanced Analysis CLI Commands - Phase 5.1
 * CLI interface for advanced AST analysis features
 */

import { AdvancedAnalysisEngine } from '../../ast/advanced/index.js';

/**
 * Register advanced analysis commands
 */
export function registerAdvancedAnalysisCommands(program, context) {
	const { parserRegistry, dependencyMapper, analyzers } = context;

	// Advanced analysis command
	program
		.command('advanced:analyze')
		.description('Run comprehensive advanced analysis on project or file')
		.option('-f, --file <file>', 'Analyze specific file')
		.option('-p, --project-root <path>', 'Analyze entire project', '.')
		.option('--cross-language', 'Enable cross-language analysis', true)
		.option('--refactoring', 'Enable refactoring suggestions', true)
		.option('--patterns', 'Enable pattern detection', true)
		.option('--documentation', 'Enable documentation generation', true)
		.option(
			'--output <dir>',
			'Output directory for generated docs',
			'.taskmaster/docs/generated'
		)
		.action(async (options) => {
			try {
				const engine = new AdvancedAnalysisEngine(
					parserRegistry,
					dependencyMapper,
					analyzers,
					{
						enableCrossLanguage: options.crossLanguage,
						enableRefactoring: options.refactoring,
						enablePatterns: options.patterns,
						enableDocumentation: options.documentation,
						documentation: { outputDir: options.output }
					}
				);

				if (options.file) {
					console.log(`🔍 Analyzing file: ${options.file}`);
					// File analysis would require parsing the file first
					console.log('File analysis requires AST parsing integration');
				} else {
					console.log(`🔍 Analyzing project: ${options.projectRoot}`);
					const results = await engine.analyzeProject(options.projectRoot);

					console.log('\n📊 Analysis Results:');
					console.log(`- Project Path: ${results.projectPath}`);
					console.log(
						`- Enabled Features: ${results.summary.enabledFeatures.join(', ')}`
					);

					if (results.crossLanguage) {
						console.log(
							`- Languages: ${results.crossLanguage.summary.languages.join(', ')}`
						);
						console.log(
							`- Total Files: ${results.crossLanguage.summary.totalFiles}`
						);
						console.log(
							`- Cross-Language Dependencies: ${results.crossLanguage.summary.crossLanguageDependencies}`
						);
					}

					if (results.documentation) {
						console.log(
							`- Documentation Generated: ${results.documentation.summary.totalFiles} files`
						);
						console.log(
							`- Functions Documented: ${results.documentation.summary.totalFunctions}`
						);
						console.log(
							`- Classes Documented: ${results.documentation.summary.totalClasses}`
						);
					}
				}
			} catch (error) {
				console.error('❌ Advanced analysis failed:', error.message);
				process.exit(1);
			}
		});

	// Pattern detection command
	program
		.command('advanced:patterns')
		.description('Detect design patterns and anti-patterns in code')
		.option('-f, --file <file>', 'Analyze specific file')
		.option('--confidence <threshold>', 'Confidence threshold (0-1)', '0.7')
		.action(async (options) => {
			console.log('🎯 Pattern detection requires file parsing integration');
			console.log(
				'This command will be fully functional when integrated with the AST parsing system'
			);
		});

	// Documentation generation command
	program
		.command('advanced:docs')
		.description('Generate comprehensive documentation from code')
		.option(
			'-o, --output <dir>',
			'Output directory',
			'.taskmaster/docs/generated'
		)
		.option(
			'--format <format>',
			'Output format (markdown, html, json)',
			'markdown'
		)
		.action(async (options) => {
			console.log(
				'📚 Documentation generation requires project parsing integration'
			);
			console.log(
				'This command will be fully functional when integrated with the AST parsing system'
			);
		});
}

export default registerAdvancedAnalysisCommands;
