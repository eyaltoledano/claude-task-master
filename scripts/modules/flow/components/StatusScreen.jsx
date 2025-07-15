import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';

import { style, gradient, getComponentTheme, getColor } from '../theme.js';
import { useAppContext } from '../index.jsx';
import { LoadingSpinner } from '../shared/components/ui/LoadingSpinner.jsx';


export const StatusScreen = () => {
	const { setCurrentScreen, backend, currentTag } = useAppContext();
	const { stdout } = useStdout();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [projectInfo, setProjectInfo] = useState(null);
	const [tasksInfo, setTasksInfo] = useState(null);
	const [modelsInfo, setModelsInfo] = useState(null);
	const [mcpInfo, setMcpInfo] = useState(null);
	const [complexityInfo, setComplexityInfo] = useState(null);



	// Get terminal width for dynamic borders
	const terminalWidth = stdout?.columns || 80;
	const borderLength = Math.max(60, terminalWidth - 4); // Minimum 60, max terminal width minus padding
	const borderChar = '═';
	const dynamicBorder = borderChar.repeat(borderLength);

	const taskTheme = getComponentTheme('taskList');
	const statusTheme = getComponentTheme('status');

	// Handle escape key to return to main menu
	useInput((input, key) => {
		if (key.escape) {
			setCurrentScreen('welcome');
			return;
		}
	});

	// Gather all project status data
	useEffect(() => {
		const gatherStatusData = async () => {
			try {
				setLoading(true);
				setError(null);

				// Gather enhanced project information using TaskContextGenerator
				let projectData = {
					name: 'Unknown',
					path: backend.projectRoot || 'N/A',
					currentTag: currentTag || 'master',
					gitBranch: 'N/A',
					gitStatus: 'inactive',
					astAvailable: false,
					astMode: 'none',
					isGitHub: false,
					hasRemote: false,
					needsSync: false,
					hasUncommittedChanges: false
				};

				// Try to use new TaskContextGenerator for enhanced project status
				try {
					const { TaskContextGenerator } = await import('../services/context-generation/index.js');
					
					const contextGenerator = new TaskContextGenerator({
						backend: backend,
						projectRoot: backend.projectRoot,
						astMode: 'optional'
					});

					const projectStatus = await contextGenerator.getProjectStatus();
					
					if (projectStatus && !projectStatus.error) {
						projectData = {
							name: projectStatus.projectName || 'Unknown',
							path: projectStatus.projectPath || 'N/A',
							currentTag: currentTag || 'master',
							gitBranch: projectStatus.branch || 'N/A',
							gitStatus: projectStatus.gitRepo ? 'active' : 'inactive',
							astAvailable: projectStatus.astAvailable || false,
							astMode: projectStatus.astMode || 'none',
							isGitHub: projectStatus.isGitHub || false,
							hasRemote: projectStatus.hasRemote || false,
							needsSync: projectStatus.needsSync || false,
							hasUncommittedChanges: projectStatus.hasUncommittedChanges || false
						};
					}
				} catch (err) {
					// Fallback to basic project detection
					console.debug('Enhanced project detection failed, using fallback:', err.message);
					
					// Try to get git branch information if available
					try {
						if (backend.getCurrentBranch) {
							const branch = await backend.getCurrentBranch();
							if (branch) {
								projectData.gitBranch = branch;
								projectData.gitStatus = 'active';
							}
						}
					} catch (err) {
						// Git info not available, keep defaults
					}

					// Try to get project name from config
					try {
						projectData.name = backend.projectRoot?.split('/').pop() || 'Unknown';
					} catch (err) {
						// Keep default name
					}
				}

				setProjectInfo(projectData);

				// Gather tasks information
				try {
					// First check if tasks file exists
					let hasTasksFile = false;
					try {
						if (backend.hasTasksFile) {
							hasTasksFile = await backend.hasTasksFile();
						}
					} catch (err) {
						// Method might not exist on all backends
					}

					const tasksResult = await backend.getTasks();

					// Handle different backend response formats
					let tasks = [];
					if (Array.isArray(tasksResult)) {
						tasks = tasksResult;
					} else if (tasksResult && Array.isArray(tasksResult.tasks)) {
						tasks = tasksResult.tasks;
					} else if (
						tasksResult &&
						tasksResult.data &&
						Array.isArray(tasksResult.data)
					) {
						tasks = tasksResult.data;
					}

					const taskCounts = tasks.reduce(
						(acc, task) => {
							const status = task.status || 'pending';
							acc[status] = (acc[status] || 0) + 1;
							acc.total++;
							return acc;
						},
						{ total: 0 }
					);

					// Count subtasks
					const subtaskInfo = tasks.reduce(
						(acc, task) => {
							if (task.subtasks && Array.isArray(task.subtasks)) {
								acc.tasksWithSubtasks++;
								acc.totalSubtasks += task.subtasks.length;

								task.subtasks.forEach((subtask) => {
									const status = subtask.status || 'pending';
									acc.subtaskCounts[status] =
										(acc.subtaskCounts[status] || 0) + 1;
								});
							}
							return acc;
						},
						{
							tasksWithSubtasks: 0,
							totalSubtasks: 0,
							subtaskCounts: {}
						}
					);

					// Try to get next task
					let nextTask = null;
					try {
						if (backend.nextTask) {
							const nextResult = await backend.nextTask();
							nextTask = nextResult.task;
						}
					} catch (err) {
						// Next task not available
					}

					setTasksInfo({
						total: taskCounts.total,
						done: taskCounts.done || 0,
						inProgress: taskCounts['in-progress'] || 0,
						pending: taskCounts.pending || 0,
						blocked: taskCounts.blocked || 0,
						nextTask: nextTask,
						subtasks: subtaskInfo
					});
				} catch (err) {
					setTasksInfo({
						total: 0,
						done: 0,
						inProgress: 0,
						pending: 0,
						blocked: 0,
						nextTask: null,
						subtasks: {
							tasksWithSubtasks: 0,
							totalSubtasks: 0,
							subtaskCounts: {}
						}
					});
				}

				// Gather models information
				try {
					const models = await backend.getModels();

					// Handle keyStatus - it might be an object or string
					let apiKeysStatus = 'Unknown';
					const keyStatusOptions = [
						models.main?.keyStatus,
						models.research?.keyStatus,
						models.fallback?.keyStatus
					];

					for (const status of keyStatusOptions) {
						if (status) {
							if (typeof status === 'string') {
								apiKeysStatus = status;
								break;
							} else if (typeof status === 'object') {
								// If it's an object, try to extract meaningful info
								apiKeysStatus = status.status || status.valid || 'Configured';
								break;
							}
						}
					}

					setModelsInfo({
						main: models.main?.model || null,
						research: models.research?.model || null,
						fallback: models.fallback?.model || null,
						apiKeysStatus: apiKeysStatus
					});
				} catch (err) {
					setModelsInfo({
						main: null,
						research: null,
						fallback: null,
						apiKeysStatus: 'Unknown'
					});
				}

				// Gather MCP information if available
				try {
					if (backend.getMcpServers) {
						const servers = await backend.getMcpServers();
						setMcpInfo({ servers: servers || [] });
					} else {
						setMcpInfo({ servers: [] });
					}
				} catch (err) {
					setMcpInfo({ servers: [] });
				}

				// Check for complexity report
				try {
					const reportDir = `${backend.projectRoot}/.taskmaster/reports`;
					const currentTagSuffix =
						currentTag && currentTag !== 'master' ? `_${currentTag}` : '';
					const reportPath = `${reportDir}/task-complexity-report${currentTagSuffix}.json`;

					// Try to check if file exists and get stats
					let reportExists = false;
					let reportDate = null;
					let reportTaskCount = 0;

					try {
						// Use fs to check if file exists and get stats
						const fs = await import('fs');
						const stats = fs.statSync(reportPath);
						if (stats.isFile()) {
							reportExists = true;
							reportDate = stats.mtime;

							// Try to read and parse the report to get task count
							try {
								const reportContent = fs.readFileSync(reportPath, 'utf8');
								const report = JSON.parse(reportContent);
								console.log(
									'Complexity report structure:',
									Object.keys(report)
								); // Debug log
								console.log(
									'Report sample:',
									JSON.stringify(report, null, 2).substring(0, 500)
								); // Debug log

								// Try different possible structures
								if (report.tasks && Array.isArray(report.tasks)) {
									reportTaskCount = report.tasks.length;
								} else if (report.analysis && Array.isArray(report.analysis)) {
									reportTaskCount = report.analysis.length;
								} else if (Array.isArray(report)) {
									reportTaskCount = report.length;
								} else if (
									report.taskAnalysis &&
									Array.isArray(report.taskAnalysis)
								) {
									reportTaskCount = report.taskAnalysis.length;
								} else {
									// Look for any array property that might contain tasks
									const arrayProps = Object.keys(report).filter((key) =>
										Array.isArray(report[key])
									);
									if (arrayProps.length > 0) {
										reportTaskCount = report[arrayProps[0]].length;
									}
								}
							} catch (parseErr) {
								console.error('Error parsing complexity report:', parseErr);
							}
						}
					} catch (fsErr) {
						// File doesn't exist or can't access
						reportExists = false;
					}

					setComplexityInfo({
						available: reportExists,
						lastGenerated: reportDate,
						taskCount: reportTaskCount,
						path: reportPath
					});
				} catch (err) {
					setComplexityInfo({
						available: false,
						lastGenerated: null,
						taskCount: 0,
						path: null
					});
				}
			} catch (err) {
				setError(err.message);
			} finally {
				setLoading(false);
			}
		};

		gatherStatusData();
	}, [backend, currentTag]);

	// Helper function to style status values
	const getStatusStyle = (status) => {
		const statusMap = {
			active: 'state.success.primary',
			connected: 'state.success.primary',
			ready: 'state.success.primary',
			configured: 'state.success.primary',
			inactive: 'state.error.primary',
			disconnected: 'state.error.primary',
			'not configured': 'state.warning.primary',
			partial: 'state.warning.primary'
		};

		// Ensure status is a string before calling toLowerCase
		const statusStr =
			status && typeof status === 'string' ? status.toLowerCase() : '';
		return statusMap[statusStr] || 'text.primary';
	};

	// Helper function to format task counts with semantic colors
	const formatTaskCount = (count, status) => {
		const color = taskTheme.status[status] || 'text.primary';
		return style(`${count}`, color);
	};

	// Show loading state
	if (loading) {
		return (
			<Box
				flexDirection="column"
				padding={1}
				alignItems="center"
				justifyContent="center"
			>
				<LoadingSpinner />
				<Text>Gathering project status...</Text>
			</Box>
		);
	}

	// Show error state
	if (error) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="red">Error loading project status: {error}</Text>
				<Text color="gray">Press ESC to return to main menu</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" padding={1}>
			{/* Gradient Header */}
			<Box marginBottom={1}>
				<Text>{gradient(dynamicBorder, ['primary', 'secondary'])}</Text>
			</Box>
			<Box justifyContent="center" marginBottom={1}>
				<Text>
					{gradient('Task Master Flow - Project Status', ['primary', 'accent'])}
				</Text>
			</Box>
			<Box marginBottom={2}>
				<Text>{gradient(dynamicBorder, ['secondary', 'primary'])}</Text>
			</Box>

			{/* Project Information */}
			<Box flexDirection="column" marginBottom={2}>
				<Text bold>{style('📁 Project Information', 'primary')}</Text>
				<Box marginLeft={2} flexDirection="column">
					<Box>
						<Text>{style('Name: ', 'text.secondary')}</Text>
						<Text>{style(projectInfo?.name || 'Unknown', 'text.primary')}</Text>
					</Box>
					<Box>
						<Text>{style('Path: ', 'text.secondary')}</Text>
						<Text>{style(projectInfo?.path || 'N/A', 'text.tertiary')}</Text>
					</Box>
					<Box>
						<Text>{style('Current Tag: ', 'text.secondary')}</Text>
						<Text>{style(projectInfo?.currentTag || 'master', 'accent')}</Text>
					</Box>
					<Box>
						<Text>{style('Git Branch: ', 'text.secondary')}</Text>
						<Text>
							{style(
								projectInfo?.gitBranch || 'N/A',
								getStatusStyle(projectInfo?.gitStatus || 'inactive')
							)}
						</Text>
						{projectInfo?.hasUncommittedChanges && (
							<Text color="yellow"> *</Text>
						)}
					</Box>
					{projectInfo?.isGitHub && (
						<Box>
							<Text>{style('GitHub: ', 'text.secondary')}</Text>
							<Text>{style('Connected', 'state.success.primary')}</Text>
							{projectInfo?.needsSync && (
								<Text color="yellow"> (sync needed)</Text>
							)}
						</Box>
					)}
					<Box>
						<Text>{style('AST Analysis: ', 'text.secondary')}</Text>
						<Text>
							{style(
								projectInfo?.astAvailable ? 
									`Available (${projectInfo.astMode})` : 
									'Not Available',
								projectInfo?.astAvailable ? 'state.success.primary' : 'text.tertiary'
							)}
						</Text>
					</Box>
				</Box>
			</Box>

			{/* Tasks Overview */}
			<Box flexDirection="column" marginBottom={2}>
				<Text bold>{style('📋 Tasks Overview', 'primary')}</Text>
				<Box marginLeft={2} flexDirection="column">
					<Box>
						<Text>{style('Total Tasks: ', 'text.secondary')}</Text>
						<Text>
							{style(tasksInfo?.total?.toString() || '0', 'text.primary')}
						</Text>
					</Box>
					<Box>
						<Text>{style('✓ Done: ', 'text.secondary')}</Text>
						<Text>{formatTaskCount(tasksInfo?.done || 0, 'done')}</Text>
					</Box>
					<Box>
						<Text>{style('⏳ In Progress: ', 'text.secondary')}</Text>
						<Text>
							{formatTaskCount(tasksInfo?.inProgress || 0, 'in-progress')}
						</Text>
					</Box>
					<Box>
						<Text>{style('⏸ Pending: ', 'text.secondary')}</Text>
						<Text>{formatTaskCount(tasksInfo?.pending || 0, 'pending')}</Text>
					</Box>
					<Box>
						<Text>{style('🚫 Blocked: ', 'text.secondary')}</Text>
						<Text>{formatTaskCount(tasksInfo?.blocked || 0, 'blocked')}</Text>
					</Box>
					{tasksInfo?.nextTask && (
						<Box marginTop={1}>
							<Text>{style('Next Task: ', 'text.secondary')}</Text>
							<Text>
								{style(
									`#${tasksInfo.nextTask.id} - ${tasksInfo.nextTask.title}`,
									'accent'
								)}
							</Text>
						</Box>
					)}
				</Box>
			</Box>

			{/* Subtasks Overview */}
			{tasksInfo?.subtasks && tasksInfo.subtasks.totalSubtasks > 0 && (
				<Box flexDirection="column" marginBottom={2}>
					<Text bold>{style('📋 Subtasks Overview', 'primary')}</Text>
					<Box marginLeft={2} flexDirection="column">
						<Box>
							<Text>{style('Tasks with Subtasks: ', 'text.secondary')}</Text>
							<Text>
								{style(
									tasksInfo.subtasks.tasksWithSubtasks.toString(),
									'text.primary'
								)}
							</Text>
						</Box>
						<Box>
							<Text>{style('Total Subtasks: ', 'text.secondary')}</Text>
							<Text>
								{style(
									tasksInfo.subtasks.totalSubtasks.toString(),
									'text.primary'
								)}
							</Text>
						</Box>
						<Box>
							<Text>{style('✓ Done: ', 'text.secondary')}</Text>
							<Text>
								{formatTaskCount(
									tasksInfo.subtasks.subtaskCounts.done || 0,
									'done'
								)}
							</Text>
						</Box>
						<Box>
							<Text>{style('⏳ In Progress: ', 'text.secondary')}</Text>
							<Text>
								{formatTaskCount(
									tasksInfo.subtasks.subtaskCounts['in-progress'] || 0,
									'in-progress'
								)}
							</Text>
						</Box>
						<Box>
							<Text>{style('⏸ Pending: ', 'text.secondary')}</Text>
							<Text>
								{formatTaskCount(
									tasksInfo.subtasks.subtaskCounts.pending || 0,
									'pending'
								)}
							</Text>
						</Box>
					</Box>
				</Box>
			)}



			{/* AI Models Configuration */}
			<Box flexDirection="column" marginBottom={2}>
				<Text bold>{style('🤖 AI Models', 'primary')}</Text>
				<Box marginLeft={2} flexDirection="column">
					<Box>
						<Text>{style('Main Model: ', 'text.secondary')}</Text>
						<Text>
							{style(
								modelsInfo?.main || 'Not configured',
								getStatusStyle(
									modelsInfo?.main ? 'configured' : 'not configured'
								)
							)}
						</Text>
					</Box>
					<Box>
						<Text>{style('Research Model: ', 'text.secondary')}</Text>
						<Text>
							{style(
								modelsInfo?.research || 'Not configured',
								getStatusStyle(
									modelsInfo?.research ? 'configured' : 'not configured'
								)
							)}
						</Text>
					</Box>
					<Box>
						<Text>{style('Fallback Model: ', 'text.secondary')}</Text>
						<Text>
							{style(
								modelsInfo?.fallback || 'Not configured',
								getStatusStyle(
									modelsInfo?.fallback ? 'configured' : 'not configured'
								)
							)}
						</Text>
					</Box>
					<Box marginTop={1}>
						<Text>{style('API Keys Status: ', 'text.secondary')}</Text>
						<Text>
							{style(
								modelsInfo?.apiKeysStatus || 'Unknown',
								getStatusStyle(modelsInfo?.apiKeysStatus || 'inactive')
							)}
						</Text>
					</Box>
				</Box>
			</Box>

			{/* Complexity Analysis */}
			<Box flexDirection="column" marginBottom={2}>
				<Text bold>{style('📊 Complexity Analysis', 'primary')}</Text>
				<Box marginLeft={2} flexDirection="column">
					<Box>
						<Text>{style('Report Available: ', 'text.secondary')}</Text>
						<Text>
							{style(
								complexityInfo?.available ? 'Yes' : 'No',
								getStatusStyle(
									complexityInfo?.available ? 'configured' : 'not configured'
								)
							)}
						</Text>
					</Box>
					{complexityInfo?.available && (
						<>
							<Box>
								<Text>{style('Tasks Analyzed: ', 'text.secondary')}</Text>
								<Text>
									{style(complexityInfo.taskCount.toString(), 'text.primary')}
								</Text>
							</Box>
							{complexityInfo.lastGenerated && (
								<Box>
									<Text>{style('Last Generated: ', 'text.secondary')}</Text>
									<Text>
										{style(
											new Date(
												complexityInfo.lastGenerated
											).toLocaleDateString(),
											'text.tertiary'
										)}
									</Text>
								</Box>
							)}
						</>
					)}
					{!complexityInfo?.available && (
						<Box marginTop={1}>
							<Text>{style('💡 Run ', 'text.tertiary')}</Text>
							<Text>{style('task-master analyze-complexity', 'accent')}</Text>
							<Text>{style(' to generate', 'text.tertiary')}</Text>
						</Box>
					)}
				</Box>
			</Box>

			{/* MCP Servers */}
			{mcpInfo && mcpInfo.servers && mcpInfo.servers.length > 0 && (
				<Box flexDirection="column" marginBottom={2}>
					<Text bold>{style('🔌 MCP Servers', 'primary')}</Text>
					<Box marginLeft={2} flexDirection="column">
						{mcpInfo.servers.map((server, idx) => (
							<Box key={`server-${server.name}-${idx}`}>
								<Text>{style(`${server.name}: `, 'text.secondary')}</Text>
								<Text>
									{style(
										server.status || 'Unknown',
										getStatusStyle(server.status || 'inactive')
									)}
								</Text>
							</Box>
						))}
						<Box marginTop={1}>
							<Text>{style('Total Servers: ', 'text.secondary')}</Text>
							<Text>
								{style(mcpInfo.servers.length.toString(), 'text.primary')}
							</Text>
						</Box>
					</Box>
				</Box>
			)}

			{/* Footer with gradient */}
			<Box marginTop={1}>
				<Text>{gradient(dynamicBorder, ['primary', 'secondary'])}</Text>
			</Box>

			{/* Help text */}
			<Box justifyContent="center" marginTop={1}>
				<Text color="gray">Press ESC to return to main menu</Text>
			</Box>
		</Box>
	);
};
