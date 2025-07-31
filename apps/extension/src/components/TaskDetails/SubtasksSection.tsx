import type React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { Plus, Loader2 } from 'lucide-react';
import type { TaskMasterTask } from '../../webview/types';
import { getStatusDotColor } from '../constants';

interface SubtasksSectionProps {
	currentTask: TaskMasterTask;
	isSubtask: boolean;
	sendMessage: (message: any) => Promise<any>;
	onNavigateToTask: (taskId: string) => void;
}

export const SubtasksSection: React.FC<SubtasksSectionProps> = ({
	currentTask,
	isSubtask,
	sendMessage,
	onNavigateToTask
}) => {
	const [isAddingSubtask, setIsAddingSubtask] = useState(false);
	const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
	const [newSubtaskDescription, setNewSubtaskDescription] = useState('');
	const [isSubmittingSubtask, setIsSubmittingSubtask] = useState(false);

	const handleAddSubtask = async () => {
		if (!currentTask || !newSubtaskTitle.trim() || isSubtask) {
			return;
		}

		setIsSubmittingSubtask(true);
		try {
			await sendMessage({
				type: 'addSubtask',
				data: {
					parentTaskId: currentTask.id,
					subtaskData: {
						title: newSubtaskTitle.trim(),
						description: newSubtaskDescription.trim() || undefined,
						status: 'pending'
					}
				}
			});

			// Reset form and close
			setNewSubtaskTitle('');
			setNewSubtaskDescription('');
			setIsAddingSubtask(false);
		} catch (error) {
			console.error('❌ TaskDetailsView: Failed to add subtask:', error);
		} finally {
			setIsSubmittingSubtask(false);
		}
	};

	const handleCancelAddSubtask = () => {
		setIsAddingSubtask(false);
		setNewSubtaskTitle('');
		setNewSubtaskDescription('');
	};

	if (
		!((currentTask.subtasks && currentTask.subtasks.length > 0) || !isSubtask)
	) {
		return null;
	}

	const rightElement = (
		<>
			{currentTask.subtasks && currentTask.subtasks.length > 0 && (
				<span className="text-sm text-vscode-foreground/50">
					{currentTask.subtasks?.filter((st) => st.status === 'done').length}/
					{currentTask.subtasks?.length}
				</span>
			)}
			{!isSubtask && (
				<Button
					variant="ghost"
					size="sm"
					className="ml-auto p-1 h-6 w-6 hover:bg-vscode-button-hoverBackground"
					onClick={() => setIsAddingSubtask(true)}
					title="Add subtask"
				>
					<Plus className="w-4 h-4" />
				</Button>
			)}
		</>
	);

	return (
		<CollapsibleSection
			title="Sub-issues"
			defaultExpanded={true}
			rightElement={rightElement}
		>
			<div className="space-y-3">
				{/* Add Subtask Form */}
				{isAddingSubtask && (
					<div className="bg-widget-background rounded-lg p-4 border border-widget-border">
						<h4 className="text-sm font-medium text-vscode-foreground mb-3">
							Add New Subtask
						</h4>
						<div className="space-y-3">
							<div>
								<Label
									htmlFor="subtask-title"
									className="block text-sm text-vscode-foreground/80 mb-1"
								>
									Title*
								</Label>
								<input
									id="subtask-title"
									type="text"
									placeholder="Enter subtask title..."
									value={newSubtaskTitle}
									onChange={(e) => setNewSubtaskTitle(e.target.value)}
									className="w-full px-3 py-2 text-sm bg-vscode-input-background border border-vscode-input-border text-vscode-input-foreground placeholder-vscode-input-foreground/50 rounded focus:border-vscode-focusBorder focus:ring-1 focus:ring-vscode-focusBorder"
									disabled={isSubmittingSubtask}
								/>
							</div>

							<div>
								<Label
									htmlFor="subtask-description"
									className="block text-sm text-vscode-foreground/80 mb-1"
								>
									Description (Optional)
								</Label>
								<Textarea
									id="subtask-description"
									placeholder="Enter subtask description..."
									value={newSubtaskDescription}
									onChange={(e) => setNewSubtaskDescription(e.target.value)}
									className="min-h-[80px] bg-vscode-input-background border-vscode-input-border text-vscode-input-foreground placeholder-vscode-input-foreground/50 focus:border-vscode-focusBorder focus:ring-vscode-focusBorder"
									disabled={isSubmittingSubtask}
								/>
							</div>

							<div className="flex gap-3 pt-2">
								<Button
									onClick={handleAddSubtask}
									disabled={!newSubtaskTitle.trim() || isSubmittingSubtask}
									className="bg-primary text-primary-foreground hover:bg-primary/90"
								>
									{isSubmittingSubtask ? (
										<>
											<Loader2 className="w-4 h-4 mr-2 animate-spin" />
											Adding...
										</>
									) : (
										<>
											<Plus className="w-4 h-4 mr-2" />
											Add Subtask
										</>
									)}
								</Button>
								<Button
									onClick={handleCancelAddSubtask}
									variant="outline"
									disabled={isSubmittingSubtask}
									className="border-widget-border"
								>
									Cancel
								</Button>
							</div>
						</div>
					</div>
				)}

				{/* Subtasks List */}
				{currentTask.subtasks && currentTask.subtasks.length > 0 && (
					<div className="space-y-2">
						{currentTask.subtasks.map((subtask, index) => {
							const subtaskId = `${currentTask.id}.${index + 1}`;

							return (
								<div
									key={subtask.id}
									className="flex items-center gap-3 p-3 rounded-md border border-textSeparator-foreground hover:border-vscode-border/70 transition-colors cursor-pointer"
									onClick={() => onNavigateToTask(subtaskId)}
								>
									<div
										className="w-4 h-4 rounded-full flex items-center justify-center"
										style={{
											backgroundColor: getStatusDotColor(subtask.status)
										}}
									/>
									<div className="flex-1 min-w-0">
										<p className="text-sm text-vscode-foreground truncate">
											{subtask.title}
										</p>
										{subtask.description && (
											<p className="text-xs text-vscode-foreground/60 truncate mt-0.5">
												{subtask.description}
											</p>
										)}
									</div>
									<div className="flex items-center gap-2 flex-shrink-0">
										<Badge
											variant="secondary"
											className="text-xs bg-secondary/20 border-secondary/30 text-secondary-foreground px-2 py-0.5"
										>
											{subtask.status === 'pending' ? 'todo' : subtask.status}
										</Badge>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</CollapsibleSection>
	);
};
