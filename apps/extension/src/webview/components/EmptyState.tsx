import React from 'react';
import { ExternalLink, Terminal, MessageSquare, Plus } from 'lucide-react';
import { TaskMasterLogo } from '../../components/TaskMasterLogo';

interface EmptyStateProps {
	currentTag: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ currentTag }) => {
	return (
		<div className="flex items-center justify-center h-full overflow-auto">
			<div className="max-w-2xl mx-auto text-center p-8">
				{/* Empty state illustration */}
				<div className="mb-8 max-w-96 mx-auto">
					<TaskMasterLogo className="w-32 h-32 mx-auto text-vscode-foreground/20" />
				</div>

				<h2 className="text-2xl font-semibold mb-2 text-vscode-foreground">
					No tasks in "{currentTag}" tag
				</h2>
				<p className="text-vscode-foreground/70 mb-8">
					Get started by adding tasks to this tag using the commands below
				</p>

				{/* Command suggestions */}
				<div className="space-y-4 text-left">
					<div className="bg-vscode-editor-background/50 border border-vscode-panel-border rounded-lg p-4">
						<div className="flex items-center gap-2 mb-2">
							<Terminal className="w-4 h-4 text-vscode-terminal-ansiGreen" />
							<h3 className="font-medium">CLI Commands</h3>
						</div>
						<div className="space-y-2">
							<div className="bg-vscode-editor-background rounded p-2 font-mono text-sm">
								<span className="text-vscode-terminal-ansiYellow">
									task-master
								</span>{' '}
								<span className="text-vscode-terminal-ansiCyan">parse-prd</span>{' '}
								<span className="text-vscode-foreground/70">
									&lt;path-to-prd&gt;
								</span>{' '}
								<span className="text-vscode-terminal-ansiMagenta">
									--append
								</span>
								<div className="text-xs text-vscode-foreground/50 mt-1">
									Parse a PRD and append tasks to current tag
								</div>
							</div>
							<div className="bg-vscode-editor-background rounded p-2 font-mono text-sm">
								<span className="text-vscode-terminal-ansiYellow">
									task-master
								</span>{' '}
								<span className="text-vscode-terminal-ansiCyan">add-task</span>{' '}
								<span className="text-vscode-terminal-ansiMagenta">
									--prompt
								</span>{' '}
								<span className="text-vscode-foreground/70">
									"Your task description"
								</span>
								<div className="text-xs text-vscode-foreground/50 mt-1">
									Add a single task with AI assistance
								</div>
							</div>
							<div className="bg-vscode-editor-background rounded p-2 font-mono text-sm">
								<span className="text-vscode-terminal-ansiYellow">
									task-master
								</span>{' '}
								<span className="text-vscode-terminal-ansiCyan">add-task</span>{' '}
								<span className="text-vscode-terminal-ansiMagenta">--help</span>
								<div className="text-xs text-vscode-foreground/50 mt-1">
									View all options for adding tasks
								</div>
							</div>
						</div>
					</div>

					<div className="bg-vscode-editor-background/50 border border-vscode-panel-border rounded-lg p-4">
						<div className="flex items-center gap-2 mb-2">
							<MessageSquare className="w-4 h-4 text-vscode-textLink-foreground" />
							<h3 className="font-medium">MCP Examples</h3>
						</div>
						<div className="space-y-2 text-sm">
							<div className="flex items-start gap-2">
								<Plus className="w-4 h-4 mt-0.5 text-vscode-foreground/50" />
								<div>
									<div className="text-vscode-foreground">
										"Add a task to tag {currentTag}: Implement user
										authentication"
									</div>
								</div>
							</div>
							<div className="flex items-start gap-2">
								<Plus className="w-4 h-4 mt-0.5 text-vscode-foreground/50" />
								<div>
									<div className="text-vscode-foreground">
										"Parse this PRD and add tasks to {currentTag}: [paste PRD
										content]"
									</div>
								</div>
							</div>
							<div className="flex items-start gap-2">
								<Plus className="w-4 h-4 mt-0.5 text-vscode-foreground/50" />
								<div>
									<div className="text-vscode-foreground">
										"Create 5 tasks for building a REST API in tag {currentTag}"
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Documentation link */}
					<div className="flex justify-center pt-4">
						<a
							href="https://docs.task-master.dev"
							className="inline-flex items-center gap-2 text-vscode-textLink-foreground hover:text-vscode-textLink-activeForeground transition-colors"
							onClick={(e) => {
								e.preventDefault();
								// Use VS Code API to open external link
								if (window.acquireVsCodeApi) {
									const vscode = window.acquireVsCodeApi();
									vscode.postMessage({
										type: 'openExternal',
										url: 'https://docs.task-master.dev'
									});
								}
							}}
						>
							<ExternalLink className="w-4 h-4" />
							<span className="text-sm font-medium">
								View TaskMaster Documentation
							</span>
						</a>
					</div>
				</div>
			</div>
		</div>
	);
};
