import React from 'react';
import { Box } from 'ink';
import { ProjectDashboardSection } from '../sections/ProjectDashboardSection.js';
import { DependencyStatusSection } from '../sections/DependencyStatusSection.js';
import { TaskListSection } from '../sections/TaskListSection.js';
import type { Task } from '@tm/core';

interface DashboardPanelProps {
	tasks: Task[];
	complexityMap: Map<string, number> | null;
	selectedTaskIndex: number;
	scrollOffset: number;
	contentHeight: number;
	maximizedSection: null | 'project' | 'dependency' | 'tasklist';
}

/**
 * Dashboard Panel
 * Shows 3 sections:
 * 1. Project Dashboard (left, top row)
 * 2. Dependency Status (right, top row)
 * 3. Task List (bottom row, full width)
 */
export const DashboardPanel: React.FC<DashboardPanelProps> = ({
	tasks,
	complexityMap,
	selectedTaskIndex,
	scrollOffset,
	contentHeight,
	maximizedSection
}) => {
	const bottomSectionHeight = Math.floor((contentHeight * 3) / 5);

	if (maximizedSection === 'project') {
		return (
			<Box flexDirection="column" height={contentHeight}>
				<ProjectDashboardSection tasks={tasks} />
			</Box>
		);
	}

	if (maximizedSection === 'dependency') {
		return (
			<Box flexDirection="column" height={contentHeight}>
				<DependencyStatusSection tasks={tasks} complexityMap={complexityMap} />
			</Box>
		);
	}

	if (maximizedSection === 'tasklist') {
		return (
			<Box flexDirection="column" height={contentHeight}>
				<TaskListSection
					tasks={tasks}
					complexityMap={complexityMap}
					selectedIndex={selectedTaskIndex}
					scrollOffset={scrollOffset}
					maxHeight={contentHeight}
				/>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" height={contentHeight}>
			<Box flexDirection="row" flexGrow={2} flexBasis={0}>
				<Box flexGrow={1} flexBasis={0} paddingRight={1}>
					<ProjectDashboardSection tasks={tasks} />
				</Box>

				<Box flexGrow={1} flexBasis={0}>
					<DependencyStatusSection
						tasks={tasks}
						complexityMap={complexityMap}
					/>
				</Box>
			</Box>

			<Box flexGrow={3} flexBasis={0}>
				<TaskListSection
					tasks={tasks}
					complexityMap={complexityMap}
					selectedIndex={selectedTaskIndex}
					scrollOffset={scrollOffset}
					maxHeight={bottomSectionHeight}
				/>
			</Box>
		</Box>
	);
};
