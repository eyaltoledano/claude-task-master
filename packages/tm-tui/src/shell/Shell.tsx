import { Box, Text, useApp, useInput, useStdout } from 'ink';
/**
 * Shell.tsx - Task Master TUI
 *
 * Fixed-height, single-page application feel
 */
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Splash from '../components/layout/Splash.js';

// ─────────────────────────────────────────────────────────────────────────────
// THEME - Cool gradient (matching splash)
// ─────────────────────────────────────────────────────────────────────────────
const theme = {
	// Cool gradient (cyan -> blue -> purple) - matches splash
	cool: ['#00d4ff', '#00a8cc', '#0077b6', '#005a8c', '#003d5c'],
	accent: {
		cyan: '#00d4ff',
		blue: '#0077b6',
		green: '#22c55e',
		yellow: '#f59e0b',
		orange: '#f97316',
		red: '#ef4444',
		purple: '#a855f7',
		magenta: '#d946ef'
	},
	success: '#22c55e',
	warning: '#f59e0b',
	error: '#ef4444',
	muted: '#6b7280',
	dim: '#4b5563',
	border: '#374151', // Dark gray border for main sections
	text: '#e5e7eb',
	bright: '#ffffff',
	hamster: '#f97316'
};

// ─────────────────────────────────────────────────────────────────────────────
// BEAUTIFUL ASCII LOGO (always use large - the only one)
// ─────────────────────────────────────────────────────────────────────────────
const LOGO = `
████████╗ █████╗ ███████╗██╗  ██╗    ███╗   ███╗ █████╗ ███████╗████████╗███████╗██████╗ 
╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝    ████╗ ████║██╔══██╗██╔════╝╚══██╔══╝██╔════╝██╔══██╗
   ██║   ███████║███████╗█████╔╝     ██╔████╔██║███████║███████╗   ██║   █████╗  ██████╔╝
   ██║   ██╔══██║╚════██║██╔═██╗     ██║╚██╔╝██║██╔══██║╚════██║   ██║   ██╔══╝  ██╔══██╗
   ██║   ██║  ██║███████║██║  ██╗    ██║ ╚═╝ ██║██║  ██║███████║   ██║   ███████╗██║  ██║
   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝    ╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Subtask {
	id: string | number;
	title: string;
	status: string;
	description?: string;
	details?: string;
}

interface Task {
	id: string | number;
	title: string;
	status: string;
	priority?: string;
	dependencies?: (string | number)[];
	description?: string;
	details?: string;
	testStrategy?: string;
	subtasks?: Subtask[];
	complexity?: number;
}

interface Brief {
	id: string;
	name: string;
}

interface AuthState {
	isAuthenticated: boolean;
	email?: string;
	org?: string;
}

interface ShellProps {
	showSplash?: boolean;
	initialTag?: string;
	storageType?: 'local' | 'api';
	brief?: Brief;
	version?: string;
	onExit?: () => void;
	initialTasks?: Task[];
	isInteractive?: boolean;
	authState?: AuthState;
	projectRoot?: string;
}

type ViewMode =
	| 'splash'
	| 'dashboard'
	| 'tasks'
	| 'task-detail'
	| 'subtask-detail'
	| 'account'
	| 'init'
	| 'help';

// ─────────────────────────────────────────────────────────────────────────────
// MARKDOWN RENDERER (simple terminal-friendly)
// ─────────────────────────────────────────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode[] {
	if (!text)
		return [
			<Text key="empty" color={theme.muted}>
				No content.
			</Text>
		];

	const lines = text.split('\n');
	const elements: React.ReactNode[] = [];

	lines.forEach((line, idx) => {
		// Headers
		if (line.startsWith('### ')) {
			elements.push(
				<Text key={idx} color={theme.accent.green} bold>
					{line.slice(4)}
				</Text>
			);
		} else if (line.startsWith('## ')) {
			elements.push(
				<Text key={idx} color={theme.accent.yellow} bold>
					{line.slice(3)}
				</Text>
			);
		} else if (line.startsWith('# ')) {
			elements.push(
				<Text key={idx} color={theme.accent.cyan} bold>
					{line.slice(2)}
				</Text>
			);
		}
		// Bullet points
		else if (line.match(/^[\s]*[-*]\s/)) {
			const indent = line.match(/^[\s]*/)?.[0].length || 0;
			const content = line.replace(/^[\s]*[-*]\s/, '');
			elements.push(
				<Box key={idx} paddingLeft={Math.floor(indent / 2)}>
					<Text color={theme.accent.cyan}>• </Text>
					<Text color={theme.text}>{renderInlineMarkdown(content)}</Text>
				</Box>
			);
		}
		// Numbered lists
		else if (line.match(/^[\s]*\d+\.\s/)) {
			const match = line.match(/^([\s]*)(\d+)\.\s(.*)$/);
			if (match) {
				const [, spaces, num, content] = match;
				elements.push(
					<Box key={idx} paddingLeft={Math.floor((spaces?.length || 0) / 2)}>
						<Text color={theme.accent.yellow}>{num}. </Text>
						<Text color={theme.text}>{renderInlineMarkdown(content)}</Text>
					</Box>
				);
			}
		}
		// Code blocks (simplified)
		else if (line.startsWith('```')) {
			elements.push(
				<Text key={idx} color={theme.dim}>
					{'─'.repeat(40)}
				</Text>
			);
		}
		// Bold lines (like **Title**)
		else if (line.match(/^\*\*.*\*\*:?$/)) {
			const content = line.replace(/\*\*/g, '').replace(/:$/, '');
			elements.push(
				<Text key={idx} color={theme.accent.orange} bold>
					{content}
				</Text>
			);
		}
		// Empty lines
		else if (line.trim() === '') {
			elements.push(<Text key={idx}> </Text>);
		}
		// Regular text with inline formatting
		else {
			elements.push(
				<Text key={idx} color={theme.text}>
					{renderInlineMarkdown(line)}
				</Text>
			);
		}
	});

	return elements;
}

function renderInlineMarkdown(text: string): string {
	// For now, just strip markdown syntax - Ink doesn't support mixed styles easily
	return text
		.replace(/\*\*(.*?)\*\*/g, '$1') // bold
		.replace(/\*(.*?)\*/g, '$1') // italic
		.replace(/`(.*?)`/g, '$1') // inline code
		.replace(/\[(.*?)\]\(.*?\)/g, '$1'); // links
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS HELPERS (matching Taskmaster conventions)
// ─────────────────────────────────────────────────────────────────────────────
function getStatusDisplay(status: string): { icon: string; color: string } {
	switch (status) {
		case 'done':
		case 'completed':
			return { icon: '✓', color: theme.success };
		case 'in-progress':
			return { icon: '►', color: theme.accent.orange };
		case 'pending':
			return { icon: '○', color: theme.warning };
		case 'blocked':
			return { icon: '!', color: theme.error };
		case 'deferred':
			return { icon: 'x', color: theme.muted };
		case 'review':
			return { icon: '?', color: theme.accent.magenta };
		case 'cancelled':
			return { icon: 'x', color: theme.dim };
		default:
			return { icon: '○', color: theme.muted };
	}
}

function getPriorityColor(priority?: string): string {
	switch (priority) {
		case 'high':
			return theme.error;
		case 'medium':
			return theme.warning;
		case 'low':
			return theme.success;
		default:
			return theme.muted;
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// HEADER (no border, fast shimmer at random intervals 1-15s)
// ─────────────────────────────────────────────────────────────────────────────
function Header({
	version,
	isHamster,
	authState,
	briefName,
	tag,
	isInteractive
}: {
	version: string;
	isHamster: boolean;
	authState?: AuthState;
	briefName?: string;
	tag: string;
	isInteractive: boolean;
}) {
	const [gradientOffset, setGradientOffset] = useState(0);
	const shimmerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	const lines = LOGO.split('\n');

	// Fast shimmer (75ms per step) triggered at random intervals (1-15s)
	useEffect(() => {
		if (!isInteractive) return;

		const scheduleNextShimmer = () => {
			// Random delay between 1-15 seconds
			const delay = 1000 + Math.random() * 14000;
			shimmerTimeoutRef.current = setTimeout(() => {
				// Fast shimmer animation
				let step = 0;
				const shimmerInterval = setInterval(() => {
					setGradientOffset((prev) => (prev + 1) % theme.cool.length);
					step++;
					if (step >= theme.cool.length * 2) {
						clearInterval(shimmerInterval);
						scheduleNextShimmer();
					}
				}, 75);
			}, delay);
		};

		scheduleNextShimmer();

		return () => {
			if (shimmerTimeoutRef.current) {
				clearTimeout(shimmerTimeoutRef.current);
			}
		};
	}, [isInteractive]);

	// Connection status - colored dot only
	const statusDot = isHamster
		? authState?.isAuthenticated
			? {
					color: theme.success,
					label: `Connected (${authState.email || 'user'})`
				}
			: { color: theme.error, label: 'Not connected' }
		: { color: theme.warning, label: 'Local mode' };

	return (
		<Box flexDirection="column" paddingX={2} paddingY={1}>
			{/* Animated gradient logo */}
			<Box flexDirection="column" alignItems="center" marginBottom={1}>
				{lines.map((line, i) => {
					const colorIndex = (i + gradientOffset) % theme.cool.length;
					return (
						<Text key={i} color={theme.cool[colorIndex]}>
							{line}
						</Text>
					);
				})}
			</Box>

			{/* Context bar */}
			<Box justifyContent="space-between" paddingX={2}>
				<Box gap={3}>
					<Text color={theme.accent.yellow} bold>
						{tag}
					</Text>
					{briefName && <Text color={theme.accent.green}>{briefName}</Text>}
				</Box>
				<Box gap={3}>
					<Text color={statusDot.color}>●</Text>
					<Text color={theme.text}>{statusDot.label}</Text>
					<Text color={theme.dim}>v{version}</Text>
				</Box>
			</Box>
		</Box>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATED PROGRESS BAR (the awesome one)
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedProgressBar({
	percent,
	width = 40
}: { percent: number; width?: number }) {
	const [shimmerPos, setShimmerPos] = useState(0);
	const filled = Math.round((percent / 100) * width);

	useEffect(() => {
		const interval = setInterval(() => {
			setShimmerPos((prev) => (prev + 1) % (width + 10));
		}, 50);
		return () => clearInterval(interval);
	}, [width]);

	const color =
		percent === 100
			? theme.success
			: percent >= 50
				? theme.accent.cyan
				: theme.warning;

	return (
		<Box>
			{Array.from({ length: width }).map((_, i) => {
				const isFilled = i < filled;
				const isShimmer = Math.abs(i - shimmerPos) < 3 && isFilled;
				return (
					<Text
						key={i}
						color={isShimmer ? theme.bright : isFilled ? color : theme.dim}
					>
						{isFilled ? '█' : '░'}
					</Text>
				);
			})}
			<Text color={color} bold>
				{' '}
				{percent}%
			</Text>
		</Box>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT BOX
// ─────────────────────────────────────────────────────────────────────────────
function StatBox({
	icon,
	label,
	value,
	color
}: { icon: string; label: string; value: number; color: string }) {
	return (
		<Box
			flexDirection="column"
			borderStyle="single"
			borderColor={theme.border}
			paddingX={3}
			paddingY={1}
			minWidth={16}
		>
			<Text color={theme.muted}>
				{icon} {label}
			</Text>
			<Text color={color} bold>
				{value}
			</Text>
		</Box>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD VIEW
// ─────────────────────────────────────────────────────────────────────────────
function DashboardView({
	tasks,
	selectedMenu,
	loading,
	nextTask
}: {
	tasks: Task[];
	selectedMenu: number;
	loading: boolean;
	nextTask: Task | null;
}) {
	const done = tasks.filter((t) => t.status === 'done').length;
	const inProgress = tasks.filter((t) => t.status === 'in-progress').length;
	const pending = tasks.filter((t) => t.status === 'pending').length;
	const total = tasks.length;
	const percent = total > 0 ? Math.round((done / total) * 100) : 0;

	const menuItems = [
		{ label: 'Tasks', key: 'T', color: theme.accent.cyan },
		{ label: 'Next', key: 'N', color: theme.accent.orange },
		{ label: 'Setup', key: 'S', color: theme.accent.green },
		{ label: 'Account', key: 'A', color: theme.accent.purple },
		{ label: 'Help', key: '?', color: theme.accent.yellow }
	];

	if (loading) {
		return (
			<Box flexDirection="column" alignItems="center" paddingY={3}>
				<Text color={theme.accent.cyan}>Loading tasks...</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" paddingX={2} paddingY={2}>
			{/* Stats row */}
			<Box justifyContent="center" gap={1}>
				<StatBox icon="✓" label="Done" value={done} color={theme.success} />
				<StatBox
					icon="►"
					label="Active"
					value={inProgress}
					color={theme.accent.orange}
				/>
				<StatBox
					icon="○"
					label="Pending"
					value={pending}
					color={theme.warning}
				/>
				<StatBox
					icon="Σ"
					label="Total"
					value={total}
					color={theme.accent.cyan}
				/>
			</Box>

			{/* Progress bar */}
			<Box justifyContent="center" marginTop={2}>
				<AnimatedProgressBar percent={percent} width={50} />
			</Box>

			{/* Next task preview */}
			{nextTask && (
				<Box
					flexDirection="column"
					borderStyle="round"
					borderColor={theme.accent.orange}
					paddingX={2}
					paddingY={1}
					marginTop={2}
				>
					<Text color={theme.accent.orange} bold>
						▸ UP NEXT
					</Text>
					<Box marginTop={1}>
						<Text color={theme.accent.cyan} bold>
							{String(nextTask.id).padEnd(12)}
						</Text>
						<Text color={theme.text}>{nextTask.title}</Text>
					</Box>
					{nextTask.description && (
						<Box paddingLeft={12} marginTop={1}>
							<Text color={theme.muted} wrap="wrap">
								{nextTask.description.slice(0, 120)}...
							</Text>
						</Box>
					)}
				</Box>
			)}

			{/* Menu */}
			<Box justifyContent="center" marginTop={2} gap={1}>
				{menuItems.map((item, idx) => {
					const isSelected = idx === selectedMenu;
					return (
						<Box
							key={item.label}
							borderStyle={isSelected ? 'round' : 'single'}
							borderColor={isSelected ? item.color : theme.border}
							paddingX={2}
							paddingY={0}
						>
							<Text color={isSelected ? item.color : theme.muted}>
								{isSelected ? '▸ ' : '  '}
								{item.key} {item.label}
							</Text>
						</Box>
					);
				})}
			</Box>

			{/* Help */}
			<Box justifyContent="center" marginTop={2}>
				<Text color={theme.dim}>◀▶ Navigate Enter Select q Quit</Text>
			</Box>
		</Box>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK LIST VIEW (with D/S/P status change support)
// ─────────────────────────────────────────────────────────────────────────────
function TaskListView({
	tasks,
	selectedIndex,
	expandedTasks,
	showAllSubtasks,
	loading
}: {
	tasks: Task[];
	selectedIndex: number;
	expandedTasks: Set<string>;
	showAllSubtasks: boolean;
	loading: boolean;
}) {
	const { stdout } = useStdout();
	const termWidth = stdout?.columns || 120;

	if (loading) {
		return (
			<Box flexDirection="column" alignItems="center" paddingY={3}>
				<Text color={theme.accent.cyan}>Loading tasks...</Text>
			</Box>
		);
	}

	if (tasks.length === 0) {
		return (
			<Box flexDirection="column" paddingX={2} paddingY={2}>
				<Box
					borderStyle="round"
					borderColor={theme.border}
					paddingX={2}
					paddingY={1}
				>
					<Text color={theme.muted}>
						No tasks found. Run Setup to initialize.
					</Text>
				</Box>
			</Box>
		);
	}

	// Build flat list
	const flatList: {
		task: Task;
		subtask?: Subtask;
		isSubtask: boolean;
		parentId: string;
	}[] = [];
	tasks.forEach((task) => {
		const taskId = String(task.id);
		flatList.push({ task, isSubtask: false, parentId: taskId });
		const isExpanded = showAllSubtasks || expandedTasks.has(taskId);
		if (isExpanded && task.subtasks && task.subtasks.length > 0) {
			task.subtasks.forEach((sub) => {
				flatList.push({
					task,
					subtask: sub,
					isSubtask: true,
					parentId: taskId
				});
			});
		}
	});

	// Column widths: ID, Title, Status, Priority, Dependencies, Complexity
	const idWidth = 14;
	const statusWidth = 14;
	const priWidth = 8;
	const depsWidth = 14;
	const compWidth = 8;
	const titleWidth = Math.max(
		30,
		termWidth - idWidth - statusWidth - priWidth - depsWidth - compWidth - 14
	);

	return (
		<Box flexDirection="column" paddingX={2} paddingY={1}>
			{/* Header */}
			<Box
				borderStyle="single"
				borderColor={theme.border}
				paddingX={1}
				paddingY={0}
			>
				<Box width={4}>
					<Text> </Text>
				</Box>
				<Box width={idWidth}>
					<Text color={theme.cool[0]} bold>
						ID
					</Text>
				</Box>
				<Box width={titleWidth}>
					<Text color={theme.cool[0]} bold>
						TITLE
					</Text>
				</Box>
				<Box width={statusWidth}>
					<Text color={theme.cool[0]} bold>
						STATUS
					</Text>
				</Box>
				<Box width={priWidth}>
					<Text color={theme.cool[0]} bold>
						PRI
					</Text>
				</Box>
				<Box width={depsWidth}>
					<Text color={theme.cool[0]} bold>
						DEPS
					</Text>
				</Box>
				<Box width={compWidth}>
					<Text color={theme.cool[0]} bold>
						CMPLX
					</Text>
				</Box>
			</Box>

			{/* Rows */}
			<Box
				flexDirection="column"
				borderStyle="single"
				borderColor={theme.border}
				borderTop={false}
			>
				{flatList.map((item, idx) => {
					const isSelected = idx === selectedIndex;

					if (item.isSubtask && item.subtask) {
						const sub = item.subtask;
						const status = getStatusDisplay(sub.status);
						return (
							<Box
								key={`${item.parentId}.${sub.id}`}
								paddingX={1}
								marginY={0}
								backgroundColor={isSelected ? '#1a1a2e' : undefined}
							>
								<Box width={4}>
									<Text color={theme.accent.purple}>
										{isSelected ? '▸' : ' '}
									</Text>
								</Box>
								<Box width={idWidth}>
									<Text color={theme.dim}>└─ </Text>
									<Text color={isSelected ? theme.accent.purple : theme.muted}>
										{String(sub.id)}
									</Text>
								</Box>
								<Box width={titleWidth}>
									<Text
										color={isSelected ? theme.bright : theme.text}
										wrap="truncate-end"
									>
										{sub.title}
									</Text>
								</Box>
								<Box width={statusWidth}>
									<Text color={status.color}>
										{status.icon} {sub.status}
									</Text>
								</Box>
								<Box width={priWidth}>
									<Text color={theme.dim}>-</Text>
								</Box>
								<Box width={depsWidth}>
									<Text color={theme.dim}>-</Text>
								</Box>
								<Box width={compWidth}>
									<Text color={theme.dim}>-</Text>
								</Box>
							</Box>
						);
					}

					const task = item.task;
					const status = getStatusDisplay(task.status);
					const priColor = getPriorityColor(task.priority);
					const subCount = task.subtasks?.length || 0;
					const isExpanded =
						showAllSubtasks || expandedTasks.has(String(task.id));
					const deps = task.dependencies?.map(String).join(',') || '-';

					return (
						<Box
							key={String(task.id)}
							paddingX={1}
							marginY={0}
							backgroundColor={isSelected ? '#1a1a2e' : undefined}
						>
							<Box width={4}>
								<Text color={theme.accent.cyan}>{isSelected ? '▸' : ' '}</Text>
							</Box>
							<Box width={idWidth}>
								<Text
									color={isSelected ? theme.accent.cyan : theme.text}
									bold={isSelected}
								>
									{String(task.id)}
								</Text>
								{subCount > 0 && (
									<Text color={theme.dim}> {isExpanded ? '▾' : '▸'}</Text>
								)}
							</Box>
							<Box width={titleWidth}>
								<Text
									color={isSelected ? theme.bright : theme.text}
									wrap="truncate-end"
								>
									{task.title}
								</Text>
							</Box>
							<Box width={statusWidth}>
								<Text color={status.color}>
									{status.icon} {task.status}
								</Text>
							</Box>
							<Box width={priWidth}>
								<Text color={priColor}>
									{(task.priority || 'med').slice(0, 4)}
								</Text>
							</Box>
							<Box width={depsWidth}>
								<Text color={theme.accent.yellow} wrap="truncate-end">
									{deps.slice(0, 12)}
								</Text>
							</Box>
							<Box width={compWidth}>
								<Text
									color={
										task.complexity && task.complexity >= 7
											? theme.error
											: theme.muted
									}
								>
									{task.complexity || '-'}
								</Text>
							</Box>
						</Box>
					);
				})}
			</Box>

			{/* Help - includes D/S/P */}
			<Box paddingX={1} marginTop={2}>
				<Text color={theme.dim}>
					▲▼ Navigate ◀▶ Expand A All D/S/P Status Enter View Esc Back
				</Text>
			</Box>
		</Box>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK DETAIL CONTENT - Renders the active tab content only (fixed height)
// ─────────────────────────────────────────────────────────────────────────────
function TaskDetailContent({
	task,
	selectedTab,
	selectedSubtask,
	focusArea
}: {
	task: Task;
	selectedTab: number;
	selectedSubtask: number;
	focusArea: 'tabs' | 'content';
}) {
	const hasSubtasks = task.subtasks && task.subtasks.length > 0;
	const hasDetails = !!task.details;

	// Determine which content to show based on tab index
	// Tab 0 = Overview
	// Tab 1 = Subtasks (if hasSubtasks)
	// Tab 1 or 2 = Details (depending on whether subtasks exist)

	const showOverview = selectedTab === 0;
	const showSubtasks = hasSubtasks && selectedTab === 1;
	const showDetails = hasDetails && selectedTab === (hasSubtasks ? 2 : 1);

	return (
		<Box flexDirection="column" minHeight={12}>
			{showOverview && (
				<Box flexDirection="column">
					<Text color={theme.accent.yellow} bold>
						Description
					</Text>
					<Box paddingLeft={2} marginTop={1} flexDirection="column">
						{renderMarkdown(task.description || 'No description.')}
					</Box>
					{task.testStrategy && (
						<Box flexDirection="column" marginTop={2}>
							<Text color={theme.accent.green} bold>
								Test Strategy
							</Text>
							<Box paddingLeft={2} marginTop={1} flexDirection="column">
								{renderMarkdown(task.testStrategy)}
							</Box>
						</Box>
					)}
				</Box>
			)}

			{showSubtasks && (
				<Box flexDirection="column">
					<Text color={theme.accent.purple} bold>
						Subtasks
					</Text>
					<Box flexDirection="column" marginTop={1}>
						{task.subtasks!.map((sub, idx) => {
							const subStatus = getStatusDisplay(sub.status);
							const isSubSelected =
								focusArea === 'content' && idx === selectedSubtask;
							return (
								<Box
									key={String(sub.id)}
									paddingLeft={1}
									paddingY={0}
									backgroundColor={isSubSelected ? '#1a1a2e' : undefined}
								>
									<Text color={theme.accent.cyan}>
										{isSubSelected ? '▸ ' : '  '}
									</Text>
									<Text color={subStatus.color}>{subStatus.icon} </Text>
									<Text color={theme.accent.cyan}>
										{String(task.id)}.{String(sub.id)}
									</Text>
									<Text color={theme.dim}> — </Text>
									<Text color={sub.status === 'done' ? theme.dim : theme.text}>
										{sub.title}
									</Text>
								</Box>
							);
						})}
					</Box>
					{focusArea === 'content' && (
						<Box marginTop={2}>
							<Text color={theme.muted}>
								D/S/P change status Enter view details
							</Text>
						</Box>
					)}
				</Box>
			)}

			{showDetails && (
				<Box flexDirection="column">
					<Text color={theme.accent.orange} bold>
						Implementation Details
					</Text>
					<Box paddingLeft={2} flexDirection="column" marginTop={1}>
						{renderMarkdown(task.details!)}
					</Box>
				</Box>
			)}
		</Box>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK DETAIL VIEW (fixed layout - no appending)
// ─────────────────────────────────────────────────────────────────────────────
function TaskDetailView({
	task,
	selectedTab,
	selectedSubtask,
	focusArea
}: {
	task: Task;
	selectedTab: number;
	selectedSubtask: number;
	focusArea: 'tabs' | 'content';
}) {
	const status = getStatusDisplay(task.status);
	const hasSubtasks = task.subtasks && task.subtasks.length > 0;
	const hasDetails = !!task.details;

	const tabs = ['Overview'];
	if (hasSubtasks) tabs.push(`Subtasks (${task.subtasks!.length})`);
	if (hasDetails) tabs.push('Details');

	return (
		<Box flexDirection="column" paddingX={2} paddingY={2}>
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor={theme.border}
				paddingX={2}
				paddingY={1}
			>
				{/* Header */}
				<Box justifyContent="space-between">
					<Box>
						<Text color={theme.accent.cyan} bold>
							{String(task.id)}
						</Text>
						<Text color={theme.dim}> — </Text>
						<Text color={theme.bright} bold>
							{task.title}
						</Text>
					</Box>
					<Text color={status.color} bold>
						{status.icon} {task.status.toUpperCase()}
					</Text>
				</Box>

				{/* Meta */}
				<Box marginTop={1} gap={3}>
					<Text>
						<Text color={theme.muted}>Priority: </Text>
						<Text color={getPriorityColor(task.priority)} bold>
							{task.priority || 'medium'}
						</Text>
					</Text>
					<Text>
						<Text color={theme.muted}>Deps: </Text>
						<Text color={theme.accent.yellow}>
							{task.dependencies?.map(String).join(', ') || 'None'}
						</Text>
					</Text>
					{hasSubtasks && (
						<Text>
							<Text color={theme.muted}>Subtasks: </Text>
							<Text color={theme.accent.purple}>
								{task.subtasks!.filter((s) => s.status === 'done').length}/
								{task.subtasks!.length}
							</Text>
						</Text>
					)}
					{task.complexity && (
						<Text>
							<Text color={theme.muted}>Complexity: </Text>
							<Text color={task.complexity >= 7 ? theme.error : theme.warning}>
								{task.complexity}/10
							</Text>
						</Text>
					)}
				</Box>

				{/* Tabs */}
				<Box marginTop={2} gap={1}>
					{tabs.map((tab, idx) => (
						<Box
							key={tab}
							borderStyle={
								focusArea === 'tabs' && selectedTab === idx ? 'round' : 'single'
							}
							borderColor={selectedTab === idx ? theme.cool[0] : theme.border}
							paddingX={2}
						>
							<Text
								color={selectedTab === idx ? theme.cool[0] : theme.muted}
								bold={selectedTab === idx}
							>
								{tab}
							</Text>
						</Box>
					))}
				</Box>

				{/* Separator */}
				<Box marginY={1}>
					<Text color={theme.dim}>{'─'.repeat(70)}</Text>
				</Box>

				{/* Content - using dedicated component */}
				<TaskDetailContent
					task={task}
					selectedTab={selectedTab}
					selectedSubtask={selectedSubtask}
					focusArea={focusArea}
				/>

				{/* Actions */}
				<Box marginTop={2} gap={2}>
					<Text color={theme.muted}>Actions:</Text>
					{task.status !== 'done' && <Text color={theme.success}>D Done</Text>}
					{task.status !== 'in-progress' && (
						<Text color={theme.accent.orange}>S Start</Text>
					)}
					{task.status !== 'pending' && (
						<Text color={theme.warning}>P Pending</Text>
					)}
				</Box>
			</Box>

			<Box paddingX={1} marginTop={2}>
				<Text color={theme.dim}>◀▶ Tabs ▼ Subtasks D/S/P Status Esc Back</Text>
			</Box>
		</Box>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBTASK DETAIL VIEW (with proper markdown rendering)
// ─────────────────────────────────────────────────────────────────────────────
function SubtaskDetailView({
	parentTask,
	subtask
}: {
	parentTask: Task;
	subtask: Subtask;
}) {
	const status = getStatusDisplay(subtask.status);

	return (
		<Box flexDirection="column" paddingX={2} paddingY={2}>
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor={theme.accent.purple}
				paddingX={2}
				paddingY={1}
			>
				{/* Header */}
				<Box justifyContent="space-between">
					<Box>
						<Text color={theme.accent.cyan} bold>
							{String(parentTask.id)}.{String(subtask.id)}
						</Text>
						<Text color={theme.dim}> — </Text>
						<Text color={theme.bright} bold>
							{subtask.title}
						</Text>
					</Box>
					<Text color={status.color} bold>
						{status.icon} {subtask.status.toUpperCase()}
					</Text>
				</Box>

				{/* Parent */}
				<Box marginTop={1}>
					<Text color={theme.muted}>Parent: </Text>
					<Text color={theme.accent.cyan}>{String(parentTask.id)}</Text>
					<Text color={theme.dim}> — </Text>
					<Text color={theme.text}>{parentTask.title}</Text>
				</Box>

				{/* Separator */}
				<Box marginY={1}>
					<Text color={theme.dim}>{'─'.repeat(70)}</Text>
				</Box>

				{/* Content with proper markdown rendering */}
				<Box flexDirection="column" minHeight={8}>
					<Text color={theme.accent.yellow} bold>
						Description
					</Text>
					<Box paddingLeft={2} marginTop={1} flexDirection="column">
						{subtask.description ? (
							renderMarkdown(subtask.description)
						) : (
							<Text color={theme.muted}>No description for this subtask.</Text>
						)}
					</Box>

					{subtask.details && (
						<Box flexDirection="column" marginTop={2}>
							<Text color={theme.accent.orange} bold>
								Details
							</Text>
							<Box paddingLeft={2} marginTop={1} flexDirection="column">
								{renderMarkdown(subtask.details)}
							</Box>
						</Box>
					)}
				</Box>

				{/* Actions */}
				<Box marginTop={2} gap={2}>
					<Text color={theme.muted}>Actions:</Text>
					{subtask.status !== 'done' && (
						<Text color={theme.success}>D Done</Text>
					)}
					{subtask.status !== 'in-progress' && (
						<Text color={theme.accent.orange}>S Start</Text>
					)}
					{subtask.status !== 'pending' && (
						<Text color={theme.warning}>P Pending</Text>
					)}
				</Box>
			</Box>

			<Box paddingX={1} marginTop={2}>
				<Text color={theme.dim}>D/S/P Change Status Esc Back to Task</Text>
			</Box>
		</Box>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT VIEW (with actual CLI command execution)
// ─────────────────────────────────────────────────────────────────────────────
function AccountView({
	isHamster,
	authState,
	brief,
	tag,
	selectedAction
}: {
	isHamster: boolean;
	authState?: AuthState;
	brief?: Brief;
	tag: string;
	selectedAction: number;
}) {
	const actions = authState?.isAuthenticated
		? [
				{
					label: 'Refresh Token',
					key: 'R',
					color: theme.accent.cyan,
					action: 'refresh'
				},
				{ label: 'Logout', key: 'L', color: theme.error, action: 'logout' }
			]
		: [
				{
					label: 'Login to Hamster',
					key: 'L',
					color: theme.accent.green,
					action: 'login'
				}
			];

	return (
		<Box flexDirection="column" paddingX={2} paddingY={2}>
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor={theme.border}
				paddingX={2}
				paddingY={1}
			>
				<Text color={theme.accent.purple} bold>
					Account & Context
				</Text>

				<Box marginTop={2} flexDirection="column">
					<Box marginY={0}>
						<Box width={20}>
							<Text color={theme.muted}>Storage Mode:</Text>
						</Box>
						<Text color={isHamster ? theme.hamster : theme.accent.cyan}>
							{isHamster ? 'Hamster (Cloud)' : 'Local (Taskmaster)'}
						</Text>
					</Box>

					<Box marginY={0}>
						<Box width={20}>
							<Text color={theme.muted}>Status:</Text>
						</Box>
						{isHamster ? (
							authState?.isAuthenticated ? (
								<>
									<Text color={theme.success}>●</Text>
									<Text color={theme.text}> Connected</Text>
								</>
							) : (
								<>
									<Text color={theme.error}>●</Text>
									<Text color={theme.text}> Not connected</Text>
								</>
							)
						) : (
							<>
								<Text color={theme.warning}>●</Text>
								<Text color={theme.text}> Local mode</Text>
							</>
						)}
					</Box>

					{authState?.email && (
						<Box marginY={0}>
							<Box width={20}>
								<Text color={theme.muted}>User:</Text>
							</Box>
							<Text color={theme.text}>{authState.email}</Text>
						</Box>
					)}

					{authState?.org && (
						<Box marginY={0}>
							<Box width={20}>
								<Text color={theme.muted}>Organization:</Text>
							</Box>
							<Text color={theme.text}>{authState.org}</Text>
						</Box>
					)}

					{brief && (
						<Box marginY={0}>
							<Box width={20}>
								<Text color={theme.muted}>Brief:</Text>
							</Box>
							<Text color={theme.accent.green}>{brief.name}</Text>
							<Text color={theme.dim}> ({brief.id})</Text>
						</Box>
					)}

					<Box marginY={0}>
						<Box width={20}>
							<Text color={theme.muted}>Active Tag:</Text>
						</Box>
						<Text color={theme.accent.yellow}>{tag}</Text>
					</Box>
				</Box>

				{/* Auth action buttons */}
				<Box marginTop={2} gap={1}>
					{actions.map((action, idx) => {
						const isSelected = idx === selectedAction;
						return (
							<Box
								key={action.label}
								borderStyle={isSelected ? 'round' : 'single'}
								borderColor={isSelected ? action.color : theme.border}
								paddingX={2}
							>
								<Text color={isSelected ? action.color : theme.muted}>
									{isSelected ? '▸ ' : '  '}
									{action.key} {action.label}
								</Text>
							</Box>
						);
					})}
				</Box>

				<Box marginTop={2}>
					<Text color={theme.dim}>
						Press Enter to execute the selected action
					</Text>
				</Box>
			</Box>

			<Box paddingX={1} marginTop={2}>
				<Text color={theme.dim}>◀▶ Select Action Enter Execute Esc Back</Text>
			</Box>
		</Box>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT VIEW (exact copy from CLI init.js)
// ─────────────────────────────────────────────────────────────────────────────
function InitView({ selectedOption }: { selectedOption: number }) {
	const options = [
		{
			title: 'Solo (Taskmaster)',
			bullets: [
				'Parse your own PRDs into structured task lists and build with any IDE or background agents',
				'Agents execute tasks with precision, no scope creep, no going off-track',
				'Tasks live in a local JSON file, everything stays in your repo',
				'Upgrade to Hamster to bring the Taskmaster experience to your team'
			],
			key: 'S',
			color: theme.accent.cyan,
			value: 'local' as const
		},
		{
			title: 'Together (Hamster)',
			bullets: [
				'Write a brief with your team. Hamster refines it into a plan.',
				'Your team drafts, refines, and aligns on the same page before executing',
				'One brief, one plan, one source of truth for execution',
				'Access tasks on Taskmaster and execute with any AI agent'
			],
			key: 'H',
			color: theme.hamster,
			value: 'cloud' as const
		}
	];

	return (
		<Box flexDirection="column" paddingX={2} paddingY={2}>
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor={theme.border}
				paddingX={2}
				paddingY={1}
			>
				<Text color={theme.accent.cyan} bold>
					You need a plan before you execute.
				</Text>
				<Text color={theme.text}> How do you want to build it?</Text>

				<Box marginTop={2} flexDirection="column" gap={1}>
					{options.map((opt, idx) => (
						<Box
							key={opt.title}
							flexDirection="column"
							borderStyle={selectedOption === idx ? 'round' : 'single'}
							borderColor={selectedOption === idx ? opt.color : theme.border}
							paddingX={2}
							paddingY={1}
						>
							<Box>
								<Text
									color={selectedOption === idx ? opt.color : theme.muted}
									bold
								>
									{selectedOption === idx ? '▸ ' : '  '}
									{opt.title}
								</Text>
							</Box>
							<Box flexDirection="column" paddingLeft={4} marginTop={1}>
								{opt.bullets.map((bullet, bidx) => (
									<Box key={bidx}>
										<Text color={theme.text}>• {bullet}</Text>
									</Box>
								))}
							</Box>
						</Box>
					))}
				</Box>
			</Box>

			<Box paddingX={1} marginTop={2}>
				<Text color={theme.dim}>▲▼ Select Enter Confirm Esc Cancel</Text>
			</Box>
		</Box>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELP VIEW
// ─────────────────────────────────────────────────────────────────────────────
function HelpView() {
	return (
		<Box flexDirection="column" paddingX={2} paddingY={2}>
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor={theme.border}
				paddingX={2}
				paddingY={1}
			>
				<Text color={theme.accent.yellow} bold>
					Help
				</Text>

				<Box marginTop={2} flexDirection="column">
					<Text bold color={theme.cool[0]}>
						Navigation
					</Text>
					<Text color={theme.text}> ▲▼ Move up/down</Text>
					<Text color={theme.text}> ◀▶ Switch tabs / Expand subtasks</Text>
					<Text color={theme.text}> Enter Select / Confirm</Text>
					<Text color={theme.text}> Esc Go back</Text>
					<Text color={theme.text}> q Quit</Text>
				</Box>

				<Box marginTop={2} flexDirection="column">
					<Text bold color={theme.cool[0]}>
						Task Actions
					</Text>
					<Text color={theme.text}> D Mark as Done</Text>
					<Text color={theme.text}> S Start (in-progress)</Text>
					<Text color={theme.text}> P Set Pending</Text>
				</Box>

				<Box marginTop={2} flexDirection="column">
					<Text bold color={theme.cool[0]}>
						Task List
					</Text>
					<Text color={theme.text}> ▶ Expand task subtasks</Text>
					<Text color={theme.text}> ◀ Collapse subtasks</Text>
					<Text color={theme.text}> A Toggle all subtasks</Text>
				</Box>
			</Box>

			<Box paddingX={1} marginTop={2}>
				<Text color={theme.dim}>Esc Close</Text>
			</Box>
		</Box>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BAR
// ─────────────────────────────────────────────────────────────────────────────
function StatusBar({ view, message }: { view: ViewMode; message?: string }) {
	const labels: Record<ViewMode, string> = {
		splash: 'Loading',
		dashboard: 'Dashboard',
		tasks: 'Tasks',
		'task-detail': 'Task',
		'subtask-detail': 'Subtask',
		account: 'Account',
		init: 'Setup',
		help: 'Help'
	};

	return (
		<Box paddingX={2} paddingY={1} justifyContent="space-between">
			{message ? (
				<Text color={theme.success}>✓ {message}</Text>
			) : (
				<Text color={theme.muted}>{labels[view]}</Text>
			)}
			<Text color={theme.dim}>q Quit</Text>
		</Box>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SHELL
// ─────────────────────────────────────────────────────────────────────────────
export function Shell({
	showSplash = true,
	initialTag = 'master',
	storageType = 'local',
	brief,
	version = '0.35.0',
	onExit,
	initialTasks,
	isInteractive = true,
	authState,
	projectRoot
}: ShellProps) {
	const { exit } = useApp();
	const [view, setView] = useState<ViewMode>(
		showSplash && isInteractive ? 'splash' : 'dashboard'
	);
	const [tasks, setTasks] = useState<Task[]>(initialTasks || []);
	const [nextTask, setNextTask] = useState<Task | null>(null);
	const [statusMessage, setStatusMessage] = useState('');
	const [loading, setLoading] = useState(!initialTasks);
	const [error, setError] = useState<string | null>(null);
	const [tmCore, setTmCore] = useState<any>(null);

	// Navigation
	const [dashboardMenu, setDashboardMenu] = useState(0);
	const [taskListIndex, setTaskListIndex] = useState(0);
	const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
	const [showAllSubtasks, setShowAllSubtasks] = useState(false);
	const [selectedTask, setSelectedTask] = useState<Task | null>(null);
	const [selectedSubtaskObj, setSelectedSubtaskObj] = useState<Subtask | null>(
		null
	);
	const [detailTab, setDetailTab] = useState(0);
	const [detailFocus, setDetailFocus] = useState<'tabs' | 'content'>('tabs');
	const [selectedSubtask, setSelectedSubtask] = useState(0);
	const [initOption, setInitOption] = useState(0);
	const [accountAction, setAccountAction] = useState(0);
	const [actionLoading, setActionLoading] = useState(false);

	const isHamster = storageType === 'api';
	const currentTag = initialTag;

	// Load tasks using @tm/core
	useEffect(() => {
		if (initialTasks) {
			setLoading(false);
			const next = initialTasks.find((t) => t.status === 'pending');
			setNextTask(next || null);
			return;
		}

		async function loadTasks() {
			try {
				setLoading(true);
				setError(null);
				const { createTmCore } = await import('@tm/core');
				const root = projectRoot || process.cwd();
				const core = await createTmCore({ projectPath: root });
				setTmCore(core);
				const result = await core.tasks.list({ tag: currentTag });
				setTasks(result.tasks || []);
				const next = await core.tasks.getNext(currentTag);
				setNextTask(next);
				setLoading(false);
			} catch (err: any) {
				setError(err.message || 'Failed to load tasks');
				setLoading(false);
			}
		}
		loadTasks();
	}, [initialTasks, projectRoot, currentTag]);

	// Execute auth command
	const executeAuthCommand = useCallback(async (action: string) => {
		try {
			setStatusMessage(`Running tm auth ${action}...`);
			const { spawn } = await import('child_process');
			const child = spawn('tm', ['auth', action], {
				stdio: 'inherit',
				shell: true
			});
			child.on('close', (code) => {
				if (code === 0) {
					setStatusMessage(`Auth ${action} completed`);
				} else {
					setStatusMessage(`Auth ${action} failed`);
				}
			});
		} catch (err: any) {
			setStatusMessage(`Error: ${err.message}`);
		}
	}, []);

	// Execute init/setup
	const executeSetup = useCallback(async (type: 'local' | 'cloud') => {
		try {
			if (type === 'cloud') {
				setStatusMessage('Opening Hamster login...');
				const { spawn } = await import('child_process');
				const child = spawn('tm', ['auth', 'login'], {
					stdio: 'inherit',
					shell: true
				});
				child.on('close', (code) => {
					if (code === 0) {
						setStatusMessage('Hamster login completed');
					} else {
						setStatusMessage('Hamster login cancelled');
					}
					setView('dashboard');
				});
			} else {
				setStatusMessage('Solo mode selected - tasks stored locally');
				setView('dashboard');
			}
		} catch (err: any) {
			setStatusMessage(`Error: ${err.message}`);
			setView('dashboard');
		}
	}, []);

	// Status update (for both tasks and subtasks) - uses @tm/core
	const updateTaskStatus = useCallback(
		async (taskId: string, newStatus: string) => {
			if (!tmCore && !initialTasks) return;
			try {
				setActionLoading(true);
				if (tmCore) {
					await tmCore.tasks.updateStatus(taskId, newStatus, currentTag);
					const result = await tmCore.tasks.list({ tag: currentTag });
					setTasks(result.tasks || []);
					const next = await tmCore.tasks.getNext(currentTag);
					setNextTask(next);

					// Update selectedTask if we're viewing it
					if (selectedTask) {
						const updatedTask = result.tasks?.find(
							(t: Task) => String(t.id) === String(selectedTask.id)
						);
						if (updatedTask) {
							setSelectedTask(updatedTask);
						}
					}
				} else {
					// Handle subtask status locally (for initialTasks/demo mode)
					if (taskId.includes('.')) {
						const [parentId, subId] = taskId.split('.');
						setTasks((prev) =>
							prev.map((t) => {
								if (String(t.id) === parentId && t.subtasks) {
									return {
										...t,
										subtasks: t.subtasks.map((s) =>
											String(s.id) === subId ? { ...s, status: newStatus } : s
										)
									};
								}
								return t;
							})
						);
						// Update selectedTask's subtasks too
						if (selectedTask && String(selectedTask.id) === parentId) {
							setSelectedTask((prev) => {
								if (!prev || !prev.subtasks) return prev;
								return {
									...prev,
									subtasks: prev.subtasks.map((s) =>
										String(s.id) === subId ? { ...s, status: newStatus } : s
									)
								};
							});
						}
						// Update selectedSubtaskObj if we're viewing it
						if (selectedSubtaskObj && String(selectedSubtaskObj.id) === subId) {
							setSelectedSubtaskObj((prev) =>
								prev ? { ...prev, status: newStatus } : prev
							);
						}
					} else {
						setTasks((prev) =>
							prev.map((t) =>
								String(t.id) === taskId ? { ...t, status: newStatus } : t
							)
						);
					}
				}
				setStatusMessage(`${taskId} → ${newStatus}`);
				setActionLoading(false);
			} catch (err: any) {
				setStatusMessage(`Error: ${err.message}`);
				setActionLoading(false);
			}
		},
		[tmCore, currentTag, initialTasks, selectedTask, selectedSubtaskObj]
	);

	// Status message timeout
	useEffect(() => {
		if (statusMessage) {
			const timer = setTimeout(() => setStatusMessage(''), 3000);
			return () => clearTimeout(timer);
		}
	}, [statusMessage]);

	const handleSplashComplete = useCallback(() => setView('dashboard'), []);

	// Build flat list for navigation
	const getFlatList = useCallback(() => {
		const flat: { task: Task; subtask?: Subtask; isSubtask: boolean }[] = [];
		tasks.forEach((task) => {
			flat.push({ task, isSubtask: false });
			const isExpanded = showAllSubtasks || expandedTasks.has(String(task.id));
			if (isExpanded && task.subtasks) {
				task.subtasks.forEach((sub) => {
					flat.push({ task, subtask: sub, isSubtask: true });
				});
			}
		});
		return flat;
	}, [tasks, expandedTasks, showAllSubtasks]);

	// Keyboard
	useInput(
		(input, key) => {
			if (!isInteractive || view === 'splash') return;

			if (input === 'q' || (key.ctrl && input === 'c')) {
				onExit?.();
				exit();
				return;
			}

			if (key.escape) {
				if (view === 'subtask-detail') {
					setSelectedSubtaskObj(null);
					setView('task-detail');
				} else if (view === 'task-detail') {
					setSelectedTask(null);
					setDetailTab(0);
					setDetailFocus('tabs');
					setView('tasks');
				} else if (view !== 'dashboard') setView('dashboard');
				return;
			}

			// Dashboard
			if (view === 'dashboard') {
				if (key.leftArrow) setDashboardMenu((p) => Math.max(0, p - 1));
				else if (key.rightArrow) setDashboardMenu((p) => Math.min(4, p + 1));
				else if (input === 't' || input === 'T') setView('tasks');
				else if (input === 'n' || input === 'N') {
					if (nextTask) {
						setSelectedTask(nextTask);
						setDetailTab(0);
						setDetailFocus('tabs');
						setView('task-detail');
					}
				} else if (input === 's' || input === 'S') setView('init');
				else if (input === 'a' || input === 'A') setView('account');
				else if (input === '?') setView('help');
				else if (key.return) {
					if (dashboardMenu === 0) setView('tasks');
					else if (dashboardMenu === 1 && nextTask) {
						setSelectedTask(nextTask);
						setView('task-detail');
					} else if (dashboardMenu === 2) setView('init');
					else if (dashboardMenu === 3) setView('account');
					else if (dashboardMenu === 4) setView('help');
				}
				return;
			}

			// Task list - with D/S/P support
			if (view === 'tasks') {
				const flatList = getFlatList();
				const currentItem = flatList[taskListIndex];

				// D/S/P status changes from task list
				if (currentItem && !actionLoading) {
					const itemId =
						currentItem.isSubtask && currentItem.subtask
							? `${currentItem.task.id}.${currentItem.subtask.id}`
							: String(currentItem.task.id);

					if (input === 'd' || input === 'D') {
						updateTaskStatus(itemId, 'done');
						return;
					}
					if (input === 's' || input === 'S') {
						updateTaskStatus(itemId, 'in-progress');
						return;
					}
					if (input === 'p' || input === 'P') {
						updateTaskStatus(itemId, 'pending');
						return;
					}
				}

				if (key.upArrow) setTaskListIndex((p) => Math.max(0, p - 1));
				else if (key.downArrow)
					setTaskListIndex((p) => Math.min(flatList.length - 1, p + 1));
				else if (key.rightArrow) {
					const item = flatList[taskListIndex];
					if (item && !item.isSubtask && item.task.subtasks?.length) {
						setExpandedTasks(
							(prev) => new Set([...prev, String(item.task.id)])
						);
					}
				} else if (key.leftArrow) {
					const item = flatList[taskListIndex];
					if (item) {
						if (item.isSubtask) {
							const parentIdx = flatList.findIndex(
								(f) =>
									!f.isSubtask && String(f.task.id) === String(item.task.id)
							);
							if (parentIdx >= 0) setTaskListIndex(parentIdx);
						} else {
							setExpandedTasks((prev) => {
								const next = new Set(prev);
								next.delete(String(item.task.id));
								return next;
							});
						}
					}
				} else if (input === 'a' || input === 'A') {
					setShowAllSubtasks((p) => !p);
				} else if (key.return) {
					const item = flatList[taskListIndex];
					if (item) {
						// If it's a subtask, go directly to subtask detail view
						if (item.isSubtask && item.subtask) {
							setSelectedTask(item.task);
							setSelectedSubtaskObj(item.subtask);
							setView('subtask-detail');
						} else {
							// It's a parent task
							setSelectedTask(item.task);
							setDetailTab(0);
							setDetailFocus('tabs');
							setView('task-detail');
						}
					}
				}
				return;
			}

			// Task detail
			if (view === 'task-detail' && selectedTask && !actionLoading) {
				const hasSubtasks =
					selectedTask.subtasks && selectedTask.subtasks.length > 0;
				const hasDetails = !!selectedTask.details;
				const tabCount = 1 + (hasSubtasks ? 1 : 0) + (hasDetails ? 1 : 0);

				// Status changes for task (when not in subtask focus)
				if (detailFocus === 'tabs' || detailTab !== 1) {
					if (input === 'd' || input === 'D') {
						updateTaskStatus(String(selectedTask.id), 'done');
						return;
					}
					if (input === 's' || input === 'S') {
						updateTaskStatus(String(selectedTask.id), 'in-progress');
						return;
					}
					if (input === 'p' || input === 'P') {
						updateTaskStatus(String(selectedTask.id), 'pending');
						return;
					}
				}

				// Status changes for subtask (when in subtask focus)
				if (detailFocus === 'content' && detailTab === 1 && hasSubtasks) {
					const currentSubtask = selectedTask.subtasks![selectedSubtask];
					if (currentSubtask) {
						if (input === 'd' || input === 'D') {
							updateTaskStatus(
								`${selectedTask.id}.${currentSubtask.id}`,
								'done'
							);
							return;
						}
						if (input === 's' || input === 'S') {
							updateTaskStatus(
								`${selectedTask.id}.${currentSubtask.id}`,
								'in-progress'
							);
							return;
						}
						if (input === 'p' || input === 'P') {
							updateTaskStatus(
								`${selectedTask.id}.${currentSubtask.id}`,
								'pending'
							);
							return;
						}
					}
				}

				if (key.leftArrow && detailFocus === 'tabs') {
					setDetailTab((p) => Math.max(0, p - 1));
				} else if (key.rightArrow && detailFocus === 'tabs') {
					setDetailTab((p) => Math.min(tabCount - 1, p + 1));
				} else if (key.downArrow) {
					if (detailFocus === 'tabs' && detailTab === 1 && hasSubtasks) {
						setDetailFocus('content');
						setSelectedSubtask(0);
					} else if (detailFocus === 'content' && hasSubtasks) {
						setSelectedSubtask((p) =>
							Math.min(selectedTask.subtasks!.length - 1, p + 1)
						);
					}
				} else if (key.upArrow) {
					if (detailFocus === 'content') {
						if (selectedSubtask === 0) setDetailFocus('tabs');
						else setSelectedSubtask((p) => Math.max(0, p - 1));
					}
				} else if (key.return && detailFocus === 'content' && hasSubtasks) {
					const sub = selectedTask.subtasks![selectedSubtask];
					if (sub) {
						setSelectedSubtaskObj(sub);
						setView('subtask-detail');
					}
				}
				return;
			}

			// Subtask detail
			if (
				view === 'subtask-detail' &&
				selectedTask &&
				selectedSubtaskObj &&
				!actionLoading
			) {
				const subtaskId = `${selectedTask.id}.${selectedSubtaskObj.id}`;
				if (input === 'd' || input === 'D') {
					updateTaskStatus(subtaskId, 'done');
				} else if (input === 's' || input === 'S') {
					updateTaskStatus(subtaskId, 'in-progress');
				} else if (input === 'p' || input === 'P') {
					updateTaskStatus(subtaskId, 'pending');
				}
				return;
			}

			// Account
			if (view === 'account') {
				const actions = authState?.isAuthenticated
					? ['refresh', 'logout']
					: ['login'];
				const maxAction = actions.length - 1;
				if (key.leftArrow) setAccountAction((p) => Math.max(0, p - 1));
				else if (key.rightArrow)
					setAccountAction((p) => Math.min(maxAction, p + 1));
				else if (key.return) {
					executeAuthCommand(actions[accountAction]);
				}
				return;
			}

			// Init
			if (view === 'init') {
				if (key.upArrow) setInitOption((p) => Math.max(0, p - 1));
				else if (key.downArrow) setInitOption((p) => Math.min(1, p + 1));
				else if (key.return) {
					executeSetup(initOption === 0 ? 'local' : 'cloud');
				}
				return;
			}
		},
		{ isActive: isInteractive }
	);

	// Splash
	if (view === 'splash') {
		return (
			<Splash
				version={version}
				onComplete={handleSplashComplete}
				duration={1500}
			/>
		);
	}

	// Non-interactive
	if (!isInteractive) {
		return (
			<Box flexDirection="column" paddingY={1}>
				<Header
					version={version}
					isHamster={isHamster}
					authState={authState}
					briefName={brief?.name}
					tag={currentTag}
					isInteractive={false}
				/>
				<DashboardView
					tasks={tasks}
					selectedMenu={0}
					loading={loading}
					nextTask={nextTask}
				/>
				<Box paddingX={2}>
					<Text color={theme.dim}>
						Run in interactive terminal for full TUI.
					</Text>
				</Box>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			<Header
				version={version}
				isHamster={isHamster}
				authState={authState}
				briefName={brief?.name}
				tag={currentTag}
				isInteractive={true}
			/>

			{error && (
				<Box paddingX={2} paddingY={1}>
					<Text color={theme.error}>Error: {error}</Text>
				</Box>
			)}

			{view === 'dashboard' && (
				<DashboardView
					tasks={tasks}
					selectedMenu={dashboardMenu}
					loading={loading}
					nextTask={nextTask}
				/>
			)}
			{view === 'tasks' && (
				<TaskListView
					tasks={tasks}
					selectedIndex={taskListIndex}
					expandedTasks={expandedTasks}
					showAllSubtasks={showAllSubtasks}
					loading={loading}
				/>
			)}
			{view === 'task-detail' && selectedTask && (
				<TaskDetailView
					task={selectedTask}
					selectedTab={detailTab}
					selectedSubtask={selectedSubtask}
					focusArea={detailFocus}
				/>
			)}
			{view === 'subtask-detail' && selectedTask && selectedSubtaskObj && (
				<SubtaskDetailView
					parentTask={selectedTask}
					subtask={selectedSubtaskObj}
				/>
			)}
			{view === 'account' && (
				<AccountView
					isHamster={isHamster}
					authState={authState}
					brief={brief}
					tag={currentTag}
					selectedAction={accountAction}
				/>
			)}
			{view === 'init' && <InitView selectedOption={initOption} />}
			{view === 'help' && <HelpView />}

			<StatusBar view={view} message={statusMessage} />
		</Box>
	);
}

export default Shell;
