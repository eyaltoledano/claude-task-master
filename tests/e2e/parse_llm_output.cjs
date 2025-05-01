#!/usr/bin/env node

// Note: We will use dynamic import() inside the async callback due to project being type: module

const readline = require('readline');
const path = require('path'); // Import path module

let inputData = '';

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	terminal: false
});

rl.on('line', (line) => {
	inputData += line;
});

// Make the callback async to allow await for dynamic imports
rl.on('close', async () => {
	let chalk, boxen, Table;
	try {
		// Dynamically import libraries
		chalk = (await import('chalk')).default;
		boxen = (await import('boxen')).default;
		Table = (await import('cli-table3')).default;

		// 1. Parse the initial API response body
		const apiResponse = JSON.parse(inputData);

		// 2. Extract the text content containing the nested JSON
		// Robust check for content structure
		const textContent = apiResponse?.content?.[0]?.text;
		if (!textContent) {
			console.error(
				chalk.red(
					"Error: Could not find '.content[0].text' in the API response JSON."
				)
			);
			process.exit(1);
		}

		// 3. Find the start of the actual JSON block
		const jsonStart = textContent.indexOf('{');
		const jsonEnd = textContent.lastIndexOf('}');

		if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
			console.error(
				chalk.red(
					'Error: Could not find JSON block starting with { and ending with } in the extracted text content.'
				)
			);
			process.exit(1);
		}
		const jsonString = textContent.substring(jsonStart, jsonEnd + 1);

		// 4. Parse the extracted JSON string
		let reportData;
		try {
			reportData = JSON.parse(jsonString);
		} catch (parseError) {
			console.error(
				chalk.red('Error: Failed to parse the extracted JSON block.')
			);
			console.error(chalk.red('Parse Error:'), parseError.message);
			process.exit(1);
		}

		// Ensure reportData is an object
		if (typeof reportData !== 'object' || reportData === null) {
			console.error(
				chalk.red('Error: Parsed report data is not a valid object.')
			);
			process.exit(1);
		}

		// --- Get Log File Path and Format Timestamp ---
		const logFilePath = process.argv[2]; // Get the log file path argument
		let formattedTime = 'Unknown';
		if (logFilePath) {
			const logBasename = path.basename(logFilePath);
			const timestampMatch = logBasename.match(/e2e_run_(\d{8}_\d{6})\.log$/);
			if (timestampMatch && timestampMatch[1]) {
				const ts = timestampMatch[1]; // YYYYMMDD_HHMMSS
				// Format into YYYY-MM-DD HH:MM:SS
				formattedTime = `${ts.substring(0, 4)}-${ts.substring(4, 6)}-${ts.substring(6, 8)} ${ts.substring(9, 11)}:${ts.substring(11, 13)}:${ts.substring(13, 15)}`;
			}
		}
		// --------------------------------------------

		// 5. Generate CLI Report (with defensive checks)
		console.log(
			'\n' +
				chalk.cyan.bold(
					boxen(
						`TASKMASTER E2E Log Analysis Report\nRun Time: ${chalk.yellow(formattedTime)}`, // Display formatted time
						{
							padding: 1,
							borderStyle: 'double',
							borderColor: 'cyan',
							textAlign: 'center' // Center align title
						}
					)
				) +
				'\n'
		);

		// Overall Status
		let statusColor = chalk.white;
		const overallStatus = reportData.overall_status || 'Unknown'; // Default if missing
		if (overallStatus === 'Success') statusColor = chalk.green.bold;
		if (overallStatus === 'Warning') statusColor = chalk.yellow.bold;
		if (overallStatus === 'Failure') statusColor = chalk.red.bold;
		console.log(
			boxen(`Overall Status: ${statusColor(overallStatus)}`, {
				padding: { left: 1, right: 1 },
				margin: { bottom: 1 },
				borderColor: 'blue'
			})
		);

		// LLM Summary Points
		console.log(chalk.blue.bold('📋 Summary Points:'));
		if (
			Array.isArray(reportData.llm_summary_points) &&
			reportData.llm_summary_points.length > 0
		) {
			reportData.llm_summary_points.forEach((point) => {
				console.log(chalk.white(`  - ${point || 'N/A'}`)); // Handle null/undefined points
			});
		} else {
			console.log(chalk.gray('  No summary points provided.'));
		}
		console.log();

		// Verified Steps
		console.log(chalk.green.bold('✅ Verified Steps:'));
		if (
			Array.isArray(reportData.verified_steps) &&
			reportData.verified_steps.length > 0
		) {
			reportData.verified_steps.forEach((step) => {
				console.log(chalk.green(`  - ${step || 'N/A'}`)); // Handle null/undefined steps
			});
		} else {
			console.log(chalk.gray('  No verified steps listed.'));
		}
		console.log();

		// Provider Add-Task Comparison
		console.log(chalk.magenta.bold('🔄 Provider Add-Task Comparison:'));
		const comp = reportData.provider_add_task_comparison;
		if (typeof comp === 'object' && comp !== null) {
			console.log(
				chalk.white(`  Prompt Used: ${comp.prompt_used || 'Not specified'}`)
			);
			console.log();

			if (
				typeof comp.provider_results === 'object' &&
				comp.provider_results !== null &&
				Object.keys(comp.provider_results).length > 0
			) {
				const providerTable = new Table({
					head: ['Provider', 'Status', 'Task ID', 'Score', 'Notes'].map((h) =>
						chalk.magenta.bold(h)
					),
					colWidths: [15, 18, 10, 12, 45],
					style: { head: [], border: [] },
					wordWrap: true
				});

				for (const provider in comp.provider_results) {
					const result = comp.provider_results[provider] || {}; // Default to empty object if provider result is null/undefined
					const status = result.status || 'Unknown';
					const isSuccess = status === 'Success';
					const statusIcon = isSuccess ? chalk.green('✅') : chalk.red('❌');
					const statusText = isSuccess
						? chalk.green(status)
						: chalk.red(status);
					providerTable.push([
						chalk.white(provider),
						`${statusIcon} ${statusText}`,
						chalk.white(result.task_id || 'N/A'),
						chalk.white(result.score || 'N/A'),
						chalk.dim(result.notes || 'N/A')
					]);
				}
				console.log(providerTable.toString());
				console.log();
			} else {
				console.log(chalk.gray('  No provider results available.'));
				console.log();
			}
			console.log(chalk.white.bold(`  Comparison Summary:`));
			console.log(chalk.white(`  ${comp.comparison_summary || 'N/A'}`));
		} else {
			console.log(chalk.gray('  Provider comparison data not found.'));
		}
		console.log();

		// Detected Issues
		console.log(chalk.red.bold('🚨 Detected Issues:'));
		if (
			Array.isArray(reportData.detected_issues) &&
			reportData.detected_issues.length > 0
		) {
			reportData.detected_issues.forEach((issue, index) => {
				if (typeof issue !== 'object' || issue === null) return; // Skip invalid issue entries

				const severity = issue.severity || 'Unknown';
				let boxColor = 'blue';
				let icon = 'ℹ️';
				if (severity === 'Error') {
					boxColor = 'red';
					icon = '❌';
				}
				if (severity === 'Warning') {
					boxColor = 'yellow';
					icon = '⚠️';
				}

				let issueContent = `${chalk.bold('Description:')} ${chalk.white(issue.description || 'N/A')}`;
				// Only add log context if it exists and is not empty
				if (issue.log_context && String(issue.log_context).trim()) {
					issueContent += `\n${chalk.bold('Log Context:')} \n${chalk.dim(String(issue.log_context).trim())}`;
				}

				console.log(
					boxen(issueContent, {
						title: `${icon} Issue ${index + 1}: [${severity}]`,
						padding: 1,
						margin: { top: 1, bottom: 0 },
						borderColor: boxColor,
						borderStyle: 'round'
					})
				);
			});
			console.log(); // Add final newline if issues exist
		} else {
			console.log(chalk.green('  No specific issues detected by the LLM.'));
		}
		console.log();

		console.log(chalk.cyan.bold('========================================'));
		console.log(chalk.cyan.bold('          End of LLM Report'));
		console.log(chalk.cyan.bold('========================================\n'));
	} catch (error) {
		// Ensure chalk is available for error reporting, provide fallback
		const errorChalk = chalk || { red: (t) => t, yellow: (t) => t };
		console.error(
			errorChalk.red('Error processing LLM response:'),
			error.message
		);
		// Avoid printing potentially huge inputData here unless necessary for debugging
		// console.error(errorChalk.yellow('Raw input data (first 500 chars):'), inputData.substring(0, 500));
		process.exit(1);
	}
});

// Handle potential errors during stdin reading
process.stdin.on('error', (err) => {
	console.error('Error reading standard input:', err);
	process.exit(1);
});
