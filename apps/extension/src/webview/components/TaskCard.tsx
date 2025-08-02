/**
 * Task Card Component for Kanban Board
 */

import React from 'react';
import { KanbanCard } from '@/components/ui/shadcn-io/kanban';
import { PriorityBadge } from './PriorityBadge';
import type { TaskMasterTask } from '../types';

interface TaskCardProps {
	task: TaskMasterTask;
	dragging?: boolean;
	onViewDetails?: (taskId: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
	task,
	dragging,
	onViewDetails
}) => {
	const handleCardClick = (e: React.MouseEvent) => {
		e.preventDefault();
		onViewDetails?.(task.id);
	};

	return (
		<KanbanCard
			id={task.id}
			name={task.title}
			index={0} // Index is not used in our implementation
			parent={task.status}
			className="cursor-pointer p-3 transition-shadow hover:shadow-md bg-vscode-editor-background border-vscode-border group"
			onClick={handleCardClick}
		>
			<div className="space-y-3 h-full flex flex-col">
				<div className="flex items-start justify-between gap-2 flex-shrink-0">
					<h3 className="font-medium text-sm leading-tight flex-1 min-w-0 text-vscode-foreground">
						{task.title}
					</h3>
					<div className="flex items-center gap-1 flex-shrink-0">
						<PriorityBadge priority={task.priority} />
					</div>
				</div>

				{task.description && (
					<p className="text-xs text-vscode-foreground/70 line-clamp-3 leading-relaxed flex-1 min-h-0">
						{task.description}
					</p>
				)}

				<div className="flex items-center justify-between text-xs mt-auto pt-2 flex-shrink-0 border-t border-vscode-border/20">
					<span className="font-mono text-vscode-foreground/50 flex-shrink-0">
						#{task.id}
					</span>
					{task.dependencies && task.dependencies.length > 0 && (
						<div className="flex items-center gap-1 text-vscode-foreground/50 flex-shrink-0 ml-2">
							<span>Deps:</span>
							<div className="flex items-center gap-1">
								{task.dependencies.map((depId, index) => (
									<React.Fragment key={depId}>
										<button
											className="font-mono hover:text-vscode-link-activeForeground hover:underline transition-colors"
											onClick={(e) => {
												e.stopPropagation();
												onViewDetails?.(depId);
											}}
										>
											#{depId}
										</button>
										{index < task.dependencies!.length - 1 && <span>,</span>}
									</React.Fragment>
								))}
							</div>
						</div>
					)}
				</div>
			</div>
		</KanbanCard>
	);
};
