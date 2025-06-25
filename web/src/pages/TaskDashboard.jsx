import React, { useState, useEffect } from 'react';
import { TaskItem } from '@components';
import './TaskDashboard.css';

const TaskDashboard = () => {
	const [tasks, setTasks] = useState([]);
	const [projectInfo, setProjectInfo] = useState({});
	const [dashboardStats, setDashboardStats] = useState({});
	const [nextTask, setNextTask] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		fetchDashboardData();
	}, []);

	const fetchDashboardData = async () => {
		try {
			setLoading(true);

			// Fetch tasks
			const tasksResponse = await fetch('/api/tasks');
			const tasksData = await tasksResponse.json();

			// Fetch next task
			const nextTaskResponse = await fetch('/api/tasks/next');
			const nextTaskData = await nextTaskResponse.json();

			setTasks(tasksData.tasks || []);
			setProjectInfo(tasksData.projectInfo || {});
			setDashboardStats(calculateDashboardStats(tasksData.tasks || []));
			setNextTask(nextTaskData.task || null);
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	const calculateDashboardStats = (taskList) => {
		const totalTasks = taskList.length;
		const tasksByStatus = taskList.reduce((acc, task) => {
			acc[task.status] = (acc[task.status] || 0) + 1;
			return acc;
		}, {});

		const tasksByPriority = taskList.reduce((acc, task) => {
			acc[task.priority] = (acc[task.priority] || 0) + 1;
			return acc;
		}, {});

		// Calculate subtask progress
		const subtaskStats = taskList.reduce(
			(acc, task) => {
				if (task.subtasks && task.subtasks.length > 0) {
					acc.total += task.subtasks.length;
					task.subtasks.forEach((subtask) => {
						acc[subtask.status] = (acc[subtask.status] || 0) + 1;
					});
				}
				return acc;
			},
			{ total: 0 }
		);

		// Calculate dependency stats
		const tasksWithNoDeps = taskList.filter(
			(task) => !task.dependencies || task.dependencies.length === 0
		).length;
		const tasksReadyToWork = taskList.filter(
			(task) =>
				task.status === 'pending' &&
				(!task.dependencies ||
					task.dependencies.every(
						(depId) => taskList.find((t) => t.id === depId)?.status === 'done'
					))
		).length;
		const tasksBlockedByDeps = taskList.filter(
			(task) =>
				task.status === 'pending' &&
				task.dependencies &&
				task.dependencies.some(
					(depId) => taskList.find((t) => t.id === depId)?.status !== 'done'
				)
		).length;

		const avgDependencies =
			taskList.length > 0
				? (
						taskList.reduce(
							(sum, task) => sum + (task.dependencies?.length || 0),
							0
						) / taskList.length
					).toFixed(1)
				: 0;

		return {
			totalTasks,
			tasksByStatus,
			tasksByPriority,
			subtaskStats,
			dependencyStats: {
				tasksWithNoDeps,
				tasksReadyToWork,
				tasksBlockedByDeps,
				avgDependencies
			}
		};
	};

	const getStatusIcon = (status) => {
		const icons = {
			pending: '○',
			'in-progress': '►',
			done: '✓',
			blocked: '!',
			deferred: '⏱',
			cancelled: '✗'
		};
		return icons[status] || '○';
	};

	const getStatusColor = (status) => {
		const colors = {
			pending: '#fbbf24',
			'in-progress': '#3b82f6',
			done: '#10b981',
			blocked: '#ef4444',
			deferred: '#6b7280',
			cancelled: '#9ca3af'
		};
		return colors[status] || '#6b7280';
	};

	const getPriorityColor = (priority) => {
		const colors = {
			high: '#ef4444',
			medium: '#f59e0b',
			low: '#10b981'
		};
		return colors[priority] || '#6b7280';
	};

	const formatDependencies = (task, allTasks) => {
		if (!task.dependencies || task.dependencies.length === 0) return 'None';

		return task.dependencies
			.map((depId) => {
				const depTask = allTasks.find((t) => t.id === depId);
				const status = depTask?.status || 'unknown';
				const icon = getStatusIcon(status);
				return `${icon} ${depId}`;
			})
			.join(', ');
	};

	if (loading) {
		return (
			<div className="dashboard-loading">
				<div className="loading-spinner"></div>
				<p>Loading dashboard...</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="dashboard-error">
				<h2>Error Loading Dashboard</h2>
				<p>{error}</p>
				<button onClick={fetchDashboardData}>Retry</button>
			</div>
		);
	}

	return (
		<div className="task-dashboard">
			{/* Header */}
			<header className="dashboard-header">
				<div className="header-brand">
					<h1 className="brand-title">TaskMaster</h1>
					<p className="brand-subtitle">by https://x.com/eyaltoledano</p>
				</div>
				<div className="header-info">
					<div className="version-info">
						<span className="version">
							Version: {projectInfo.version || '0.18.0'}
						</span>
						<span className="project">
							Project: {projectInfo.name || 'Taskmaster'}
						</span>
					</div>
				</div>
			</header>

			{/* Current Tag */}
			<div className="current-tag">
				<span className="tag-label">🏷️ tag:</span>
				<span className="tag-name">
					{projectInfo.currentTag || 'feature-web-interface'}
				</span>
			</div>

			{/* Dashboard Content */}
			<div className="dashboard-content">
				{/* Left Column - Stats */}
				<div className="dashboard-left">
					{/* Project Dashboard */}
					<section className="stats-section">
						<h2 className="section-title">Project Dashboard</h2>
						<div className="stats-grid">
							<div className="stat-item">
								<span className="stat-label">Task Progress:</span>
								<div className="progress-breakdown">
									<span className="progress-item done">
										Done: {dashboardStats.tasksByStatus?.done || 0}
									</span>
									<span className="progress-item in-progress">
										In Progress:{' '}
										{dashboardStats.tasksByStatus?.['in-progress'] || 0}
									</span>
									<span className="progress-item pending">
										Pending: {dashboardStats.tasksByStatus?.pending || 0}
									</span>
									<span className="progress-item blocked">
										Blocked: {dashboardStats.tasksByStatus?.blocked || 0}
									</span>
									<span className="progress-item deferred">
										Deferred: {dashboardStats.tasksByStatus?.deferred || 0}
									</span>
									<span className="progress-item cancelled">
										Cancelled: {dashboardStats.tasksByStatus?.cancelled || 0}
									</span>
								</div>
								<div className="completion-percentage">
									{Math.round(
										((dashboardStats.tasksByStatus?.done || 0) /
											dashboardStats.totalTasks) *
											100
									)}
									%
								</div>
							</div>
						</div>
					</section>

					{/* Subtasks Progress */}
					<section className="stats-section">
						<h2 className="section-title">Subtasks Progress</h2>
						<div className="subtask-stats">
							<div className="progress-bar">
								<div
									className="progress-fill"
									style={{
										width: `${Math.round(((dashboardStats.subtaskStats?.done || 0) / (dashboardStats.subtaskStats?.total || 1)) * 100)}%`
									}}
								></div>
							</div>
							<div className="subtask-breakdown">
								<span>
									Completed: {dashboardStats.subtaskStats?.done || 0}/
									{dashboardStats.subtaskStats?.total || 0}
								</span>
								<span>
									(
									{Math.round(
										((dashboardStats.subtaskStats?.done || 0) /
											(dashboardStats.subtaskStats?.total || 1)) *
											100
									)}
									%)
								</span>
							</div>
						</div>
					</section>

					{/* Priority Breakdown */}
					<section className="stats-section">
						<h2 className="section-title">Priority Breakdown</h2>
						<div className="priority-stats">
							<div className="priority-item high">
								<span className="priority-label">High priority:</span>
								<span className="priority-count">
									{dashboardStats.tasksByPriority?.high || 0}
								</span>
							</div>
							<div className="priority-item medium">
								<span className="priority-label">Medium priority:</span>
								<span className="priority-count">
									{dashboardStats.tasksByPriority?.medium || 0}
								</span>
							</div>
							<div className="priority-item low">
								<span className="priority-label">Low priority:</span>
								<span className="priority-count">
									{dashboardStats.tasksByPriority?.low || 0}
								</span>
							</div>
						</div>
					</section>
				</div>

				{/* Right Column - Dependencies & Next Task */}
				<div className="dashboard-right">
					<section className="stats-section">
						<h2 className="section-title">Dependency Status & Next Task</h2>
						<div className="dependency-stats">
							<div className="dep-item">
								<span className="dep-label">Dependency Metrics:</span>
							</div>
							<div className="dep-item">
								<span className="dep-text">
									• Tasks with no dependencies:{' '}
									{dashboardStats.dependencyStats?.tasksWithNoDeps || 0}
								</span>
							</div>
							<div className="dep-item">
								<span className="dep-text">
									• Tasks ready to work on:{' '}
									{dashboardStats.dependencyStats?.tasksReadyToWork || 0}
								</span>
							</div>
							<div className="dep-item">
								<span className="dep-text">
									• Tasks blocked by dependencies:{' '}
									{dashboardStats.dependencyStats?.tasksBlockedByDeps || 0}
								</span>
							</div>
							<div className="dep-item">
								<span className="dep-text">
									• Most depended-on task: #
									{tasks.find((t) => t.id === '1')?.id || 'N/A'} (
									{tasks.find((t) => t.id === '1')?.dependencies?.length || 0}{' '}
									dependencies)
								</span>
							</div>
							<div className="dep-item">
								<span className="dep-text">
									• Avg dependencies per task:{' '}
									{dashboardStats.dependencyStats?.avgDependencies || 0}
								</span>
							</div>
						</div>

						{nextTask && (
							<div className="next-task-info">
								<h3 className="next-task-title">Next Task to Work On:</h3>
								<div className="next-task-details">
									<div className="next-task-id">
										ID: {nextTask.id} - {nextTask.title}
									</div>
									<div className="next-task-meta">
										<span
											className="next-task-priority"
											style={{ color: getPriorityColor(nextTask.priority) }}
										>
											Priority: {nextTask.priority}
										</span>
										<span className="next-task-deps">
											Dependencies: {formatDependencies(nextTask, tasks)}
										</span>
									</div>
									<div className="next-task-complexity">
										Complexity: {nextTask.complexity || 'N/A'}
									</div>
								</div>
							</div>
						)}
					</section>
				</div>
			</div>

			{/* Task List Table */}
			<section className="task-list-section">
				<table className="task-table">
					<thead>
						<tr>
							<th>ID</th>
							<th>Title</th>
							<th>Status</th>
							<th>Priority</th>
							<th>Dependencies</th>
							<th>Complexity</th>
						</tr>
					</thead>
					<tbody>
						{tasks.map((task) => (
							<tr key={task.id} className={`task-row ${task.status}`}>
								<td className="task-id">{task.id}</td>
								<td className="task-title">{task.title}</td>
								<td className="task-status">
									<span
										className="status-indicator"
										style={{ color: getStatusColor(task.status) }}
									>
										{getStatusIcon(task.status)} {task.status}
									</span>
								</td>
								<td className="task-priority">
									<span
										className="priority-indicator"
										style={{ color: getPriorityColor(task.priority) }}
									>
										{task.priority}
									</span>
								</td>
								<td className="task-dependencies">
									{formatDependencies(task, tasks)}
								</td>
								<td className="task-complexity">{task.complexity || 'N/A'}</td>
							</tr>
						))}
					</tbody>
				</table>
			</section>

			{/* Recommended Next Task */}
			{nextTask && (
				<section className="recommended-task">
					<div className="recommended-header">
						<span className="recommended-icon">🔥</span>
						<span className="recommended-label">RECOMMENDED NEXT TASK</span>
						<span className="recommended-icon">🔥</span>
					</div>
					<div className="recommended-content">
						<div className="recommended-task-info">
							<h3 className="recommended-title">
								🔥 Next Task to Work On: #{nextTask.id} - {nextTask.title}
							</h3>
							<div className="recommended-details">
								<span className="recommended-priority">
									Priority: {nextTask.priority}
								</span>
								<span className="recommended-status">
									Status: {getStatusIcon(nextTask.status)} {nextTask.status}
								</span>
								<span className="recommended-deps">
									Dependencies: {formatDependencies(nextTask, tasks)}
								</span>
							</div>
							<div className="recommended-description">
								Description: {nextTask.description}
							</div>
							<div className="recommended-actions">
								<span className="action-label">Start working:</span>
								<code className="action-command">
									task-master set-status --id={nextTask.id} --status=in-progress
								</code>
							</div>
							<div className="recommended-actions">
								<span className="action-label">View details:</span>
								<code className="action-command">
									task-master show {nextTask.id}
								</code>
							</div>
						</div>
					</div>
				</section>
			)}

			{/* Suggested Next Steps */}
			<section className="suggested-steps">
				<h3 className="steps-title">Suggested Next Steps:</h3>
				<ol className="steps-list">
					<li>
						Run <code>task-master next</code> to see what to work on next
					</li>
					<li>
						Run <code>task-master expand --id=&lt;id&gt;</code> to break down a
						task into subtasks
					</li>
					<li>
						Run{' '}
						<code>task-master set-status --id=&lt;id&gt; --status=done</code> to
						mark a task as complete
					</li>
				</ol>
			</section>
		</div>
	);
};

export default TaskDashboard;
