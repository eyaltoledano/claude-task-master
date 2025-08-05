/**
 * Markdown Formatter - Formats context data into CLAUDE.md format
 *
 * This service takes various context data and formats it into a coherent
 * markdown document that can be sent to Claude Code or VibeKit agents.
 */

export class MarkdownFormatter {
	constructor() {
		this.timestamp = new Date().toISOString();
	}

	generateClaudeMarkdown(options = {}) {
		const {
			projectInfo = {},
			enhancedTasks = [],
			taskHierarchy = null,
			gitContext = null,
			projectAnalysis = null,
			executionOptions = {},
			customSections = []
		} = options;

		let markdown = this.generateHeader(projectInfo);

		// Add execution context
		if (executionOptions && Object.keys(executionOptions).length > 0) {
			markdown += this.formatExecutionContext(executionOptions);
		}

		// Add task context
		if (enhancedTasks.length > 0) {
			markdown += this.formatTaskContext(enhancedTasks, taskHierarchy);
		}

		// Add git context
		if (gitContext) {
			markdown += this.formatGitContext(gitContext);
		}

		// Add project structure
		if (projectAnalysis) {
			markdown += this.formatProjectStructure(projectAnalysis);
		}

		// Add custom sections
		customSections.forEach((section) => {
			markdown += section;
		});

		// Add footer
		markdown += this.generateFooter();

		return markdown;
	}

	generateHeader(projectInfo) {
		const title = projectInfo.name || 'Project Context';
		const description =
			projectInfo.description || 'Generated context for development assistance';

		return (
			`# ${title}\n\n` +
			`${description}\n\n` +
			`**Generated:** ${this.timestamp}\n` +
			`**Project Root:** ${projectInfo.path || 'Unknown'}\n\n` +
			`---\n\n`
		);
	}

	formatExecutionContext(executionOptions) {
		let markdown = '## Execution Context\n\n';

		if (executionOptions.mode) {
			markdown += `**Mode:** ${executionOptions.mode}\n`;
		}

		if (executionOptions.target) {
			markdown += `**Target:** ${executionOptions.target}\n`;
		}

		if (
			executionOptions.requirements &&
			executionOptions.requirements.length > 0
		) {
			markdown += `**Requirements:**\n`;
			executionOptions.requirements.forEach((req) => {
				markdown += `- ${req}\n`;
			});
		}

		if (
			executionOptions.constraints &&
			executionOptions.constraints.length > 0
		) {
			markdown += `**Constraints:**\n`;
			executionOptions.constraints.forEach((constraint) => {
				markdown += `- ${constraint}\n`;
			});
		}

		return markdown + '\n';
	}

	formatTaskContext(enhancedTasks, taskHierarchy = null) {
		let markdown = '## Task Context\n\n';

		if (taskHierarchy) {
			return markdown + this.formatTaskHierarchy(taskHierarchy);
		}

		// Fallback to simple task list
		enhancedTasks.forEach((task, index) => {
			markdown += this.formatSingleTask(task, index === 0);
		});

		return markdown + '\n';
	}

	formatTaskHierarchy(hierarchy) {
		let markdown = '';

		// Show parent tasks with their subtasks
		hierarchy.taskGroups.forEach((group, parentId) => {
			markdown += `### Task ${parentId}: ${group.parent.title}\n\n`;
			markdown += `**Status:** ${group.parent.status}\n`;
			markdown += `**Description:** ${group.parent.description}\n\n`;

			if (group.parent.details) {
				markdown += `**Details:**\n${group.parent.details}\n\n`;
			}

			if (group.subtasks.length > 0) {
				markdown += `**Subtasks:**\n`;
				group.subtasks.forEach((subtask) => {
					const statusIcon = this.getStatusIcon(subtask.status);
					markdown += `- ${statusIcon} **${subtask.id}:** ${subtask.title} (${subtask.status})\n`;
					if (subtask.description) {
						markdown += `  - ${subtask.description}\n`;
					}
				});
				markdown += '\n';
			}
		});

		// Show standalone parent tasks
		if (hierarchy.parentTasks.length > 0) {
			markdown += '### Other Tasks\n\n';
			hierarchy.parentTasks.forEach((task) => {
				markdown += this.formatSingleTask(task, false);
			});
		}

		// Show orphaned subtasks
		if (hierarchy.standaloneSubtasks.length > 0) {
			markdown += '### Standalone Subtasks\n\n';
			hierarchy.standaloneSubtasks.forEach((subtask) => {
				markdown += this.formatSingleTask(subtask, false);
			});
		}

		return markdown;
	}

	formatSingleTask(task, isFirst = false) {
		const prefix = isFirst ? '### ' : '#### ';
		const statusIcon = this.getStatusIcon(task.status);

		let markdown = `${prefix}${statusIcon} Task ${task.id}: ${task.title}\n\n`;
		markdown += `**Status:** ${task.status}\n`;
		markdown += `**Description:** ${task.description}\n\n`;

		if (task.details) {
			markdown += `**Implementation Details:**\n${task.details}\n\n`;
		}

		if (task.testStrategy || task.test_strategy) {
			markdown += `**Test Strategy:** ${task.testStrategy || task.test_strategy}\n\n`;
		}

		if (task.dependencies && task.dependencies.length > 0) {
			markdown += `**Dependencies:** ${task.dependencies.join(', ')}\n\n`;
		}

		// Show parent task context for subtasks
		if (task.isSubtask && task.parentTask) {
			markdown += `**Parent Task Context:**\n`;
			markdown += `- **${task.parentTask.id}:** ${task.parentTask.title}\n`;
			markdown += `- **Parent Description:** ${task.parentTask.description}\n`;
			if (task.parentTask.details) {
				markdown += `- **Parent Details:** ${task.parentTask.details}\n`;
			}
			markdown += '\n';
		}

		return markdown;
	}

	formatGitContext(gitContext) {
		if (gitContext.error) {
			return `## Git Context\n\nError: ${gitContext.error}\n\n`;
		}

		let markdown = '## Git Context\n\n';

		// Branch info
		if (gitContext.branchInfo && !gitContext.branchInfo.error) {
			markdown += `**Current Branch:** ${gitContext.branchInfo.current}\n\n`;

			if (gitContext.branchInfo.aheadBehind) {
				const { ahead, behind } = gitContext.branchInfo.aheadBehind;
				if (ahead > 0) markdown += `⬆️ ${ahead} commits ahead of remote\n`;
				if (behind > 0) markdown += `⬇️ ${behind} commits behind remote\n`;
				markdown += '\n';
			}
		}

		// Remote info
		if (gitContext.remoteInfo && gitContext.remoteInfo.originUrl) {
			markdown += `**Remote:** ${gitContext.remoteInfo.originUrl}\n\n`;
		}

		// Current status
		if (gitContext.currentStatus && !gitContext.currentStatus.error) {
			const status = gitContext.currentStatus;
			if (status.hasUncommittedChanges) {
				markdown += '**Uncommitted Changes:**\n';
				const summary = status.statusSummary;

				if (summary.modified.length > 0) {
					markdown += `- Modified: ${summary.modified.slice(0, 10).join(', ')}`;
					if (summary.modified.length > 10)
						markdown += ` (+${summary.modified.length - 10} more)`;
					markdown += '\n';
				}

				if (summary.added.length > 0) {
					markdown += `- Added: ${summary.added.slice(0, 10).join(', ')}`;
					if (summary.added.length > 10)
						markdown += ` (+${summary.added.length - 10} more)`;
					markdown += '\n';
				}

				if (summary.untracked.length > 0) {
					markdown += `- Untracked: ${summary.untracked.slice(0, 10).join(', ')}`;
					if (summary.untracked.length > 10)
						markdown += ` (+${summary.untracked.length - 10} more)`;
					markdown += '\n';
				}

				markdown += '\n';
			}
		}

		// Recent commits
		if (gitContext.recentCommits && gitContext.recentCommits.length > 0) {
			markdown += '**Recent Commits:**\n';
			gitContext.recentCommits.slice(0, 10).forEach((commit) => {
				markdown += `- \`${commit.hash}\` ${commit.message}\n`;
			});
			markdown += '\n';
		}

		return markdown;
	}

	formatProjectStructure(projectAnalysis) {
		let markdown = '## Project Structure\n\n';

		// Package info
		if (projectAnalysis.packageInfo && !projectAnalysis.packageInfo.error) {
			const pkg = projectAnalysis.packageInfo;
			markdown += `**Project:** ${pkg.name}`;
			if (pkg.version) markdown += ` v${pkg.version}`;
			markdown += '\n';

			if (pkg.description) {
				markdown += `**Description:** ${pkg.description}\n`;
			}
			markdown += '\n';
		}

		// Structure summary
		if (projectAnalysis.structure && !projectAnalysis.structure.error) {
			const summary = projectAnalysis.structure.summary;
			markdown += `**Structure:** ${summary.totalFiles} files, ${summary.totalDirectories} directories\n`;

			if (summary.keyDirectories.length > 0) {
				markdown += `**Key Directories:** ${summary.keyDirectories.join(', ')}\n`;
			}

			if (summary.configFiles.length > 0) {
				markdown += `**Config Files:** ${summary.configFiles.join(', ')}\n`;
			}

			// File types breakdown
			const fileTypes = Object.entries(summary.fileTypes)
				.sort(([, a], [, b]) => b - a)
				.slice(0, 8);

			if (fileTypes.length > 0) {
				markdown += `**File Types:** `;
				markdown += fileTypes
					.map(([ext, count]) => `${ext}(${count})`)
					.join(', ');
				markdown += '\n';
			}

			markdown += '\n';
		}

		// Dependencies
		if (projectAnalysis.dependencies && !projectAnalysis.dependencies.error) {
			const deps = projectAnalysis.dependencies;
			const hasAnyDeps = Object.values(deps).some((arr) => arr.length > 0);

			if (hasAnyDeps) {
				markdown += '**Key Dependencies:**\n';

				if (deps.frameworks.length > 0) {
					markdown += `- **Frameworks:** ${deps.frameworks.slice(0, 5).join(', ')}\n`;
				}
				if (deps.ui.length > 0) {
					markdown += `- **UI Libraries:** ${deps.ui.slice(0, 5).join(', ')}\n`;
				}
				if (deps.testing.length > 0) {
					markdown += `- **Testing:** ${deps.testing.slice(0, 5).join(', ')}\n`;
				}
				if (deps.build.length > 0) {
					markdown += `- **Build Tools:** ${deps.build.slice(0, 5).join(', ')}\n`;
				}
				if (deps.utilities.length > 0) {
					markdown += `- **Utilities:** ${deps.utilities.slice(0, 5).join(', ')}\n`;
				}

				markdown += '\n';
			}
		}

		// AST Context
		if (projectAnalysis.astContext) {
			const ast = projectAnalysis.astContext;
			if (ast.available) {
				markdown += '**Code Analysis (AST Available):**\n';
				if (ast.summary) {
					if (ast.summary.languages.length > 0) {
						markdown += `- **Languages:** ${ast.summary.languages.join(', ')}\n`;
					}
					markdown += `- **Files Analyzed:** ${ast.summary.totalFiles}\n`;

					const features = [];
					if (ast.summary.hasComponents) features.push('Components');
					if (ast.summary.hasFunctions) features.push('Functions');
					if (ast.summary.hasImports) features.push('Module Imports');

					if (features.length > 0) {
						markdown += `- **Code Features:** ${features.join(', ')}\n`;
					}
				}
				markdown += '\n';
			} else {
				markdown += `**Code Analysis:** ${ast.reason || 'Not available'}\n\n`;
			}
		}

		return markdown;
	}

	getStatusIcon(status) {
		const icons = {
			pending: '⏳',
			'in-progress': '🚧',
			done: '✅',
			blocked: '🚫',
			cancelled: '❌',
			review: '👀',
			deferred: '⏸️'
		};

		return icons[status] || '📝';
	}

	generateFooter() {
		return (
			`---\n\n` +
			`*This context was generated by TaskMaster Flow at ${this.timestamp}*\n` +
			`*For the most up-to-date information, regenerate this context.*\n\n`
		);
	}

	/**
	 * Generate a minimal context version for quick reference
	 */
	generateMinimalContext(options = {}) {
		const { enhancedTasks = [], projectInfo = {}, gitContext = null } = options;

		let markdown = `# ${projectInfo.name || 'Project'} - Quick Context\n\n`;

		// Current task focus
		if (enhancedTasks.length > 0) {
			const currentTask = enhancedTasks[0];
			markdown += `## Current Focus\n\n`;
			markdown += `**Task ${currentTask.id}:** ${currentTask.title}\n`;
			markdown += `**Status:** ${currentTask.status}\n`;
			markdown += `**Description:** ${currentTask.description}\n\n`;
		}

		// Git status summary
		if (gitContext && !gitContext.error) {
			markdown += `## Git Status\n\n`;
			if (gitContext.branchInfo) {
				markdown += `**Branch:** ${gitContext.branchInfo.current}\n`;
			}
			if (gitContext.currentStatus?.hasUncommittedChanges) {
				markdown += `**Status:** Uncommitted changes present\n`;
			}
			markdown += '\n';
		}

		return markdown;
	}
}
