/**
 * Dashboard.tsx - Main dashboard view (equivalent to tm list)
 *
 * Shows project overview, task list, and recommended next task
 */
import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../theme/colors.js';
import { borders } from '../../theme/borders.js';
import { icons } from '../../theme/icons.js';

// Types
interface Task {
	id: string;
	title: string;
	status: 'pending' | 'in-progress' | 'done' | 'blocked' | 'cancelled' | 'deferred' | 'review';
	priority: 'high' | 'medium' | 'low';
	dependencies?: string[];
	complexity?: number | null;
	description?: string;
}

interface DashboardProps {
	tasks: Task[];
	briefName?: string;
	briefId?: string;
	briefUrl?: string;
	projectName?: string;
	version?: string;
	tag?: string;
	storageType?: 'local' | 'api';
}

// Helper: Progress bar
function ProgressBar({
	progress,
	width = 30,
	label,
	showPercent = true,
}: {
	progress: number;
	width?: number;
	label?: string;
	showPercent?: boolean;
}) {
	const filled = Math.round((progress / 100) * width);
	const empty = width - filled;

	return (
		<Text>
			{label && <Text>{label}: </Text>}
			<Text color={colors.accent.cyan}>{'█'.repeat(filled)}</Text>
			<Text dimColor>{'░'.repeat(empty)}</Text>
			{showPercent && <Text dimColor> {progress}%</Text>}
		</Text>
	);
}

// Helper: Status icon
function StatusIcon({ status }: { status: Task['status'] }) {
	const iconMap: Record<Task['status'], { icon: string; color: string }> = {
		done: { icon: icons.status.done, color: colors.semantic.success },
		'in-progress': { icon: icons.status.inProgress, color: colors.accent.yellow },
		pending: { icon: icons.status.pending, color: colors.semantic.muted },
		blocked: { icon: icons.status.blocked, color: colors.semantic.error },
		cancelled: { icon: icons.status.cancelled, color: colors.semantic.muted },
		deferred: { icon: icons.status.deferred, color: colors.semantic.warning },
		review: { icon: '◎', color: colors.accent.purple },
	};

	const { icon, color } = iconMap[status] || iconMap.pending;
	return <Text color={color}>{icon}</Text>;
}

// Helper: Priority badge
function PriorityBadge({ priority }: { priority: Task['priority'] }) {
	const colorMap: Record<Task['priority'], string> = {
		high: colors.semantic.error,
		medium: colors.semantic.warning,
		low: colors.semantic.muted,
	};

	return <Text color={colorMap[priority]}>{priority}</Text>;
}

// Panel component with border
function Panel({
	title,
	children,
	width,
	borderColor = colors.accent.cyan,
}: {
	title?: string;
	children: React.ReactNode;
	width?: number | string;
	borderColor?: string;
}) {
	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor={borderColor}
			paddingX={2}
			paddingY={1}
			width={width}
		>
			{title && (
				<Box marginBottom={1}>
					<Text bold color={colors.semantic.primary}>
						{title}
					</Text>
				</Box>
			)}
			{children}
		</Box>
	);
}

// Project Dashboard Panel
function ProjectDashboardPanel({ tasks }: { tasks: Task[] }) {
	const total = tasks.length;
	const done = tasks.filter((t) => t.status === 'done').length;
	const inProgress = tasks.filter((t) => t.status === 'in-progress').length;
	const pending = tasks.filter((t) => t.status === 'pending').length;
	const blocked = tasks.filter((t) => t.status === 'blocked').length;
	const cancelled = tasks.filter((t) => t.status === 'cancelled').length;
	const deferred = tasks.filter((t) => t.status === 'deferred').length;
	const review = tasks.filter((t) => t.status === 'review').length;

	const progress = total > 0 ? Math.round((done / total) * 100) : 0;

	const highPriority = tasks.filter((t) => t.priority === 'high').length;
	const mediumPriority = tasks.filter((t) => t.priority === 'medium').length;
	const lowPriority = tasks.filter((t) => t.priority === 'low').length;

	return (
		<Panel title="Project Dashboard">
			<Box flexDirection="column">
				<ProgressBar
					progress={progress}
					label={`Tasks Progress`}
				/>
				<Text dimColor>
					{' '}{done}/{total}
				</Text>
				<Text dimColor>
					Done: {done}  Cancelled: {cancelled}  Deferred: {deferred}
				</Text>
				<Text dimColor>
					In Progress: {inProgress}  Review: {review}  Pending: {pending}  Blocked: {blocked}
				</Text>

				<Box marginTop={1}>
					<Text bold>Priority Breakdown:</Text>
				</Box>
				<Text dimColor>• High priority: {highPriority}</Text>
				<Text dimColor>• Medium priority: {mediumPriority}</Text>
				<Text dimColor>• Low priority: {lowPriority}</Text>
			</Box>
		</Panel>
	);
}

// Dependency Status Panel
function DependencyPanel({ tasks, nextTask }: { tasks: Task[]; nextTask?: Task }) {
	const noDeps = tasks.filter((t) => !t.dependencies || t.dependencies.length === 0).length;
	const doneIds = new Set(tasks.filter((t) => t.status === 'done').map((t) => t.id));
	const ready = tasks.filter((t) => {
		if (t.status === 'done') return false;
		if (!t.dependencies || t.dependencies.length === 0) return true;
		return t.dependencies.every((d) => doneIds.has(d));
	}).length;
	const blocked = tasks.filter((t) => {
		if (t.status === 'done') return false;
		if (!t.dependencies || t.dependencies.length === 0) return false;
		return !t.dependencies.every((d) => doneIds.has(d));
	}).length;

	const totalDeps = tasks.reduce((sum, t) => sum + (t.dependencies?.length || 0), 0);
	const avgDeps = tasks.length > 0 ? (totalDeps / tasks.length).toFixed(1) : '0';

	return (
		<Panel title="Dependency Status & Next Task">
			<Box flexDirection="column">
				<Text bold>Dependency Metrics:</Text>
				<Text dimColor>• Tasks with no dependencies: {noDeps}</Text>
				<Text dimColor>• Tasks ready to work on: {ready}</Text>
				<Text dimColor>• Tasks blocked by dependencies: {blocked}</Text>
				<Text dimColor>• Avg dependencies per task: {avgDeps}</Text>

				{nextTask && (
					<Box marginTop={1} flexDirection="column">
						<Text bold>Next Task to Work On:</Text>
						<Text color={colors.accent.cyan}>
							ID: {nextTask.id} - {nextTask.title.slice(0, 50)}
							{nextTask.title.length > 50 ? '...' : ''}
						</Text>
						<Text dimColor>
							Priority: {nextTask.priority}  Dependencies:{' '}
							{nextTask.dependencies?.join(', ') || 'None'}
						</Text>
					</Box>
				)}
			</Box>
		</Panel>
	);
}

// Task Table
function TaskTable({ tasks }: { tasks: Task[] }) {
	const colWidths = {
		id: 14,
		title: 50,
		status: 15,
		priority: 10,
		deps: 20,
	};

	return (
		<Box flexDirection="column" marginY={1}>
			{/* Header */}
			<Box>
				<Box width={colWidths.id}>
					<Text bold>ID</Text>
				</Box>
				<Box width={colWidths.title}>
					<Text bold>Title</Text>
				</Box>
				<Box width={colWidths.status}>
					<Text bold>Status</Text>
				</Box>
				<Box width={colWidths.priority}>
					<Text bold>Priority</Text>
				</Box>
				<Box width={colWidths.deps}>
					<Text bold>Dependencies</Text>
				</Box>
			</Box>

			{/* Separator */}
			<Text dimColor>{'─'.repeat(colWidths.id + colWidths.title + colWidths.status + colWidths.priority + colWidths.deps)}</Text>

			{/* Rows */}
			{tasks.map((task) => (
				<Box key={task.id}>
					<Box width={colWidths.id}>
						<Text color={colors.accent.cyan}>{task.id}</Text>
					</Box>
					<Box width={colWidths.title}>
						<Text>
							{task.title.slice(0, colWidths.title - 3)}
							{task.title.length > colWidths.title - 3 ? '...' : ''}
						</Text>
					</Box>
					<Box width={colWidths.status}>
						<StatusIcon status={task.status} />
						<Text> {task.status}</Text>
					</Box>
					<Box width={colWidths.priority}>
						<PriorityBadge priority={task.priority} />
					</Box>
					<Box width={colWidths.deps}>
						<Text dimColor>
							{task.dependencies?.join(', ') || 'None'}
						</Text>
					</Box>
				</Box>
			))}
		</Box>
	);
}

// Recommended Next Task Panel
function NextTaskPanel({ task }: { task: Task }) {
	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor={colors.semantic.warning}
			paddingX={2}
			paddingY={1}
			marginY={1}
		>
			<Box justifyContent="center" marginBottom={1}>
				<Text bold color={colors.semantic.warning}>
					⚡ RECOMMENDED NEXT TASK ⚡
				</Text>
			</Box>

			<Text bold color={colors.accent.cyan}>
				🔥 Next Task to Work On: #{task.id} - {task.title}
			</Text>

			<Box marginTop={1}>
				<Text>
					Priority: <PriorityBadge priority={task.priority} />
					{'  '}Status: <StatusIcon status={task.status} /> {task.status}
				</Text>
			</Box>

			<Text dimColor>
				Dependencies: {task.dependencies?.join(', ') || 'None'}
			</Text>

			{task.description && (
				<Box marginTop={1}>
					<Text dimColor>{task.description}</Text>
				</Box>
			)}

			<Box marginTop={1} flexDirection="column">
				<Text color={colors.semantic.muted}>
					Start working: <Text color={colors.accent.green}>set-status --id={task.id} --status=in-progress</Text>
				</Text>
				<Text color={colors.semantic.muted}>
					View details: <Text color={colors.accent.green}>show {task.id}</Text>
				</Text>
			</Box>
		</Box>
	);
}

// Suggestions Panel
function SuggestionsPanel() {
	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor={colors.semantic.muted}
			paddingX={2}
			paddingY={1}
		>
			<Text bold>Suggested Next Steps:</Text>
			<Text dimColor>
				1. Run <Text color={colors.accent.cyan}>next</Text> to see what to work on next
			</Text>
			<Text dimColor>
				2. Run <Text color={colors.accent.cyan}>expand --id=&lt;id&gt;</Text> to break down a task
			</Text>
			<Text dimColor>
				3. Run <Text color={colors.accent.cyan}>set-status --id=&lt;id&gt; --status=done</Text> to complete a task
			</Text>
		</Box>
	);
}

// Main Dashboard Component
export function Dashboard({
	tasks,
	briefName,
	briefId,
	briefUrl,
	projectName = 'Taskmaster',
	version = '0.35.0',
	tag = 'master',
	storageType = 'local',
}: DashboardProps) {
	// Find next available task
	const doneIds = new Set(tasks.filter((t) => t.status === 'done').map((t) => t.id));
	const nextTask = tasks.find((t) => {
		if (t.status === 'done') return false;
		if (!t.dependencies || t.dependencies.length === 0) return true;
		return t.dependencies.every((d) => doneIds.has(d));
	});

	return (
		<Box flexDirection="column" paddingX={1}>
			{/* Context Header */}
			<Box marginBottom={1}>
				{briefName ? (
					<Text>
						<Text color={colors.accent.yellow}>🏷</Text>
						{'  '}
						<Text bold>Brief:</Text>{' '}
						<Text color={colors.accent.cyan}>{briefName}</Text>
						{briefId && (
							<Text dimColor> ({briefId})</Text>
						)}
					</Text>
				) : (
					<Text>
						<Text color={colors.accent.yellow}>🏷</Text>
						{'  '}
						<Text bold>Tag:</Text>{' '}
						<Text color={colors.accent.cyan}>{tag}</Text>
						{'  '}
						<Text dimColor>({storageType === 'api' ? 'Multiplayer' : 'Solo'})</Text>
					</Text>
				)}
			</Box>

			{briefUrl && (
				<Box marginBottom={1}>
					<Text dimColor>
						Listing tasks from:{' '}
						<Text color={colors.accent.cyan} underline>
							{briefUrl}
						</Text>
					</Text>
				</Box>
			)}

			{/* Top panels: Project Dashboard + Dependency Status */}
			<Box>
				<Box width="50%">
					<ProjectDashboardPanel tasks={tasks} />
				</Box>
				<Box width="50%">
					<DependencyPanel tasks={tasks} nextTask={nextTask} />
				</Box>
			</Box>

			{/* Task Table */}
			<TaskTable tasks={tasks} />

			{/* Recommended Next Task */}
			{nextTask && <NextTaskPanel task={nextTask} />}

			{/* Suggestions */}
			<SuggestionsPanel />
		</Box>
	);
}

export default Dashboard;

