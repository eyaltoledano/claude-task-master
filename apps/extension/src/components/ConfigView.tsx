import { ArrowLeft, RefreshCw, Settings } from 'lucide-react';
import type React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';

interface ModelConfig {
	provider: string;
	modelId: string;
	maxTokens: number;
	temperature: number;
}

interface ConfigData {
	models?: {
		main?: ModelConfig;
		research?: ModelConfig;
		fallback?: ModelConfig;
	};
	global?: {
		defaultNumTasks?: number;
		defaultSubtasks?: number;
		defaultPriority?: string;
		projectName?: string;
		responseLanguage?: string;
	};
}

interface ConfigViewProps {
	sendMessage: (message: any) => Promise<any>;
	onNavigateBack: () => void;
}

export const ConfigView: React.FC<ConfigViewProps> = ({
	sendMessage,
	onNavigateBack
}) => {
	const [config, setConfig] = useState<ConfigData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadConfig = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await sendMessage({ type: 'getConfig' });
			setConfig(response);
		} catch (err) {
			setError('Failed to load configuration');
			console.error('Error loading config:', err);
		} finally {
			setLoading(false);
		}
	}, [sendMessage]);

	useEffect(() => {
		loadConfig();
	}, [loadConfig]);

	const modelLabels = {
		main: {
			label: 'Main Model',
			icon: '🤖',
			description: 'Primary model for task generation'
		},
		research: {
			label: 'Research Model',
			icon: '🔍',
			description: 'Model for research-backed operations'
		},
		fallback: {
			label: 'Fallback Model',
			icon: '🔄',
			description: 'Backup model if primary fails'
		}
	};

	return (
		<div className="flex flex-col h-full bg-vscode-editor-background">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b border-vscode-border">
				<div className="flex items-center gap-3">
					<Button
						variant="ghost"
						size="icon"
						onClick={onNavigateBack}
						className="h-8 w-8"
					>
						<ArrowLeft className="h-4 w-4" />
					</Button>
					<div className="flex items-center gap-2">
						<Settings className="w-5 h-5" />
						<h1 className="text-lg font-semibold">Task Master Configuration</h1>
					</div>
				</div>
				<Button
					variant="ghost"
					size="icon"
					onClick={loadConfig}
					className="h-8 w-8"
				>
					<RefreshCw className="h-4 w-4" />
				</Button>
			</div>

			{/* Content */}
			<ScrollArea className="flex-1 overflow-hidden">
				<div className="p-6 pb-12">
					{loading ? (
						<div className="flex items-center justify-center py-8">
							<RefreshCw className="w-6 h-6 animate-spin text-vscode-foreground/50" />
						</div>
					) : error ? (
						<div className="text-red-500 text-center py-8">{error}</div>
					) : config ? (
						<div className="space-y-6 max-w-4xl mx-auto">
							{/* Models Section */}
							<Card>
								<CardHeader>
									<CardTitle>AI Models</CardTitle>
									<CardDescription>
										Models configured for different Task Master operations
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									{config.models &&
										Object.entries(config.models).map(([key, modelConfig]) => {
											const label =
												modelLabels[key as keyof typeof modelLabels];
											if (!label || !modelConfig) return null;

											return (
												<div key={key} className="space-y-2">
													<div className="flex items-center gap-2">
														<span className="text-lg">{label.icon}</span>
														<div>
															<h4 className="font-medium">{label.label}</h4>
															<p className="text-xs text-vscode-foreground/60">
																{label.description}
															</p>
														</div>
													</div>
													<div className="bg-vscode-input/20 rounded-md p-3 space-y-1">
														<div className="flex justify-between">
															<span className="text-sm text-vscode-foreground/80">
																Provider:
															</span>
															<Badge variant="secondary">
																{modelConfig.provider}
															</Badge>
														</div>
														<div className="flex justify-between">
															<span className="text-sm text-vscode-foreground/80">
																Model:
															</span>
															<code className="text-xs font-mono bg-vscode-input/30 px-2 py-1 rounded">
																{modelConfig.modelId}
															</code>
														</div>
														<div className="flex justify-between">
															<span className="text-sm text-vscode-foreground/80">
																Max Tokens:
															</span>
															<span className="text-sm">
																{modelConfig.maxTokens.toLocaleString()}
															</span>
														</div>
														<div className="flex justify-between">
															<span className="text-sm text-vscode-foreground/80">
																Temperature:
															</span>
															<span className="text-sm">
																{modelConfig.temperature}
															</span>
														</div>
													</div>
												</div>
											);
										})}
								</CardContent>
							</Card>

							{/* Task Defaults Section */}
							{config.global && (
								<Card>
									<CardHeader>
										<CardTitle>Task Defaults</CardTitle>
										<CardDescription>
											Default values for new tasks and subtasks
										</CardDescription>
									</CardHeader>
									<CardContent>
										<div className="space-y-3">
											<div className="flex justify-between items-center">
												<span className="text-sm font-medium">
													Default Number of Tasks
												</span>
												<Badge variant="outline">
													{config.global.defaultNumTasks || 10}
												</Badge>
											</div>
											<Separator />
											<div className="flex justify-between items-center">
												<span className="text-sm font-medium">
													Default Number of Subtasks
												</span>
												<Badge variant="outline">
													{config.global.defaultSubtasks || 5}
												</Badge>
											</div>
											<Separator />
											<div className="flex justify-between items-center">
												<span className="text-sm font-medium">
													Default Priority
												</span>
												<Badge
													variant={
														config.global.defaultPriority === 'high'
															? 'destructive'
															: config.global.defaultPriority === 'low'
																? 'secondary'
																: 'default'
													}
												>
													{config.global.defaultPriority || 'medium'}
												</Badge>
											</div>
											{config.global.projectName && (
												<>
													<Separator />
													<div className="flex justify-between items-center">
														<span className="text-sm font-medium">
															Project Name
														</span>
														<span className="text-sm text-vscode-foreground/80">
															{config.global.projectName}
														</span>
													</div>
												</>
											)}
											{config.global.responseLanguage && (
												<>
													<Separator />
													<div className="flex justify-between items-center">
														<span className="text-sm font-medium">
															Response Language
														</span>
														<span className="text-sm text-vscode-foreground/80">
															{config.global.responseLanguage}
														</span>
													</div>
												</>
											)}
										</div>
									</CardContent>
								</Card>
							)}

							{/* Info Card */}
							<Card>
								<CardContent className="pt-6">
									<p className="text-sm text-vscode-foreground/60">
										To modify these settings, go to{' '}
										<code className="bg-vscode-input/30 px-1 py-0.5 rounded">
											.taskmaster/config.json
										</code>{' '}
										and modify them, or use the MCP.
									</p>
								</CardContent>
							</Card>
						</div>
					) : (
						<div className="text-center py-8 text-vscode-foreground/50">
							No configuration found. Please run `task-master init` in your
							project.
						</div>
					)}
				</div>
			</ScrollArea>
		</div>
	);
};
