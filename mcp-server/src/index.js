import { FastMCP } from 'fastmcp';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import fs from 'fs';
import logger from './logger.js';
import { registerTaskMasterTools } from './tools/index.js';
import { createErrorResponse } from './tools/utils.js'; // Added for error responses
import { saveTasksFromAgentData } from './core/utils/agent-task-saver.js';
import { saveExpandedTaskData } from './core/utils/expand-task-saver.js';
import { saveComplexityReportFromAgent } from './core/utils/complexity-report-saver.js';
import { saveUpdatedTaskFromAgent } from './core/utils/update-task-saver.js';
import { saveNewTaskFromAgent } from './core/utils/add-task-saver.js';
import { saveMultipleTasksFromAgent } from './core/utils/agent-bulk-task-saver.js';
import { saveSubtaskDetailsFromAgent } from './core/utils/update-subtask-saver.js';
import { handleAgentResearchResult } from './core/utils/research-result-handler.js'; // Added for research post-processing
import ProviderRegistry from '../../src/provider-registry/index.js';
import { MCPProvider } from './providers/mcp-provider.js';

// Load environment variables
dotenv.config();

// Constants
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main MCP server class that integrates with Task Master
 */
class TaskMasterMCPServer {
	constructor() {
		// Get version from package.json using synchronous fs
		const packagePath = path.join(__dirname, '../../package.json');
		const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

		this.options = {
			name: 'Task Master MCP Server',
			version: packageJson.version
		};

		this.server = new FastMCP(this.options);
		this.initialized = false;
		this.pendingAgentLLMInteractions = new Map(); // For managing paused states
		this.registeredTools = new Map(); // Internal tool registry

		this.server.addResource({});

		this.server.addResourceTemplate({});

		// Bind methods
		this.init = this.init.bind(this);
		this.start = this.start.bind(this);
		this.stop = this.stop.bind(this);

		// Setup logging
		this.logger = logger;
	}

	/**
	 * Initialize the MCP server with necessary tools and routes
	 */
	async init() {
		if (this.initialized) return;

		// Create a custom tool registrar that wraps execute methods
		// AND populates our internal registry
		const customToolRegistrar = {
			addTool: ({ name, description, parameters, execute }) => {
				const wrappedExecute = this._getWrappedToolExecutor(name, execute);

				// Add to FastMCP's registry (as before)
				this.server.addTool({
					name,
					description,
					parameters,
					execute: wrappedExecute
				});

				// Add to our internal registry
				this.registeredTools.set(name, {
					name,
					description,
					parameters,
					execute: wrappedExecute
				});
				this.logger.info(
					`TaskMasterMCPServer: Tool '${name}' registered internally and with FastMCP.`
				);
			}
		};

		// Pass the custom registrar to the tool registration function
		registerTaskMasterTools(customToolRegistrar, this.asyncManager);

		this.initialized = true;

		return this;
	}

	/**
	 * Start the MCP server
	 */
	async start() {
		if (!this.initialized) {
			await this.init();
		}

		this.server.on('connect', (event) => {
			event.session.server.sendLoggingMessage({
				data: {
					context: event.session.context,
					message: `MCP Server connected: ${event.session.name}`
				},
				level: 'info'
			});
			this.registerRemoteProvider(event.session);
		});

		// Start the FastMCP server with increased timeout
		await this.server.start({
			transportType: 'stdio',
			timeout: 120000 // 2 minutes timeout (in milliseconds)
		});

		return this;
	}

	/**
	 * Register both MCP providers with the provider registry
	 */
	registerRemoteProvider(session) {
		// Check if the server has at least one session
		if (session) {
			// Make sure session has required capabilities
			if (!session.clientCapabilities || !session.clientCapabilities.sampling) {
				session.server.sendLoggingMessage({
					data: {
						context: session.context,
						message: `MCP session missing required sampling capabilities, providers not registered`
					},
					level: 'info'
				});
				return;
			}

			// Register MCP provider with the Provider Registry

			// Register the unified MCP provider
			const mcpProvider = new MCPProvider();
			mcpProvider.setSession(session);

			// Register provider with the registry
			const providerRegistry = ProviderRegistry.getInstance();
			providerRegistry.registerProvider('mcp', mcpProvider);

			session.server.sendLoggingMessage({
				data: {
					context: session.context,
					message: `MCP Server connected`
				},
				level: 'info'
			});
		} else {
			session.server.sendLoggingMessage({
				data: {
					context: session.context,
					message: `No MCP sessions available, providers not registered`
				},
				level: 'warn'
			});
		}
	}

	/**
	 * Stop the MCP server
	 */
	async stop() {
		if (this.server) {
			await this.server.stop();
		}
	}

	_getWrappedToolExecutor(toolName, originalExecute) {
		return async (toolArgs, context) => {
			const { log, session } = context; // context provided by FastMCP

			// Normal tool execution
			const toolResult = await originalExecute(toolArgs, context);

			let detectedPendingInteractionObj = null; // Variable to hold the actual pendingInteraction object

			if (
				toolResult &&
				toolResult.content &&
				Array.isArray(toolResult.content) &&
				toolResult.content.length > 0 &&
				toolResult.content[0] &&
				toolResult.content[0].type === 'resource' &&
				toolResult.content[0].resource &&
				toolResult.content[0].resource.uri ===
					'agent-llm://pending-interaction' &&
				typeof toolResult.content[0].resource.text === 'string'
			) {
				try {
					const parsedText = JSON.parse(toolResult.content[0].resource.text);
					// Validate the structure of the parsed text
					if (
						parsedText &&
						parsedText.isAgentLLMPendingInteraction === true &&
						parsedText.details
					) {
						detectedPendingInteractionObj = parsedText.details; // This is the actual pendingInteraction data
					} else {
						log.warn(
							`TaskMasterMCPServer: Found 'agent-llm://pending-interaction' resource, but its 'text' field content is not the expected structure for tool '${toolName}'. Text content: ${toolResult.content[0].resource.text}`
						);
					}
				} catch (e) {
					log.error(
						`TaskMasterMCPServer: Error parsing JSON from resource.text for 'agent-llm://pending-interaction' for tool '${toolName}'. Error: ${e.message}. Text content: ${toolResult.content[0].resource.text}`
					);
				}
			}

			// Main conditional logic using the extracted 'detectedPendingInteractionObj'
			if (
				detectedPendingInteractionObj &&
				detectedPendingInteractionObj.type === 'agent_llm'
			) {
				const { interactionId, delegatedCallDetails } =
					detectedPendingInteractionObj; // Destructure from the 'details' object

				if (!interactionId) {
					log.error(
						`TaskMasterMCPServer: pendingInteraction for '${toolName}' (extracted from resource) is missing interactionId.`
					);
					return createErrorResponse(
						`Internal error: pendingInteraction missing interactionId for ${toolName}`
					);
				}

				const agentLLMTool = this.registeredTools.get('agent_llm');
				// Check for agentLLMTool *before* creating and storing a promise
				if (!agentLLMTool) {
					log.error(
						"TaskMasterMCPServer: Critical error - 'agent_llm' tool not found in internal registry. Cannot delegate for tool '" +
							toolName +
							"'."
					);
					// Note: No pendingData to reject here yet, as the promise hasn't been created.
					return createErrorResponse(
						"Internal server error: 'agent_llm' tool not found, cannot delegate for " +
							toolName
					);
				}

				log.info(
					`TaskMasterMCPServer: Detected pendingInteraction for '${toolName}'. Interaction ID: ${interactionId}. Storing promise context and dispatching to agent_llm.`
				);

				// Create a new promise context for when the agent calls back
				// This promise isn't returned to FastMCP for the original tool call.
				// FastMCP gets 'toolResult' (the pendingInteraction signal) immediately.
				new Promise((resolve, reject) => {
					log.debug(
						`TaskMasterMCPServer [Interaction: ${interactionId}]: Storing promise context for original tool '${toolName}'.`
					);
					this.pendingAgentLLMInteractions.set(interactionId, {
						originalToolName: toolName,
						originalToolArgs: toolArgs,
						session,
						resolve,
						reject,
						timestamp: Date.now(),
						// Store the delegatedCallDetails which includes requestParameters
						delegatedCallDetails: delegatedCallDetails
					});

					// Asynchronously dispatch to agent_llm tool.
					// The outcome of this dispatch (success/failure to send to agent)
					// will affect the stored promise's state (reject if dispatch fails).
					const projectRoot =
						toolArgs.projectRoot || session?.roots?.[0]?.uri || '.';
					agentLLMTool
						.execute(
							{ interactionId, delegatedCallDetails, projectRoot },
							{ log, session }
						)
						.then((agentDirectiveResult) => {
							// This is the response from agent_llm (Taskmaster-to-Agent call)
							// It indicates if the directive was successfully formatted for the agent.
							log.debug(
								`TaskMasterMCPServer: Directive to agent for ID ${interactionId} processed by agent_llm tool. Result: ${JSON.stringify(agentDirectiveResult)}`
							);
							// If agentDirectiveResult itself indicates an error (e.g. agent_llm had bad inputs),
							// we should reject the stored promise.
							if (
								agentDirectiveResult &&
								agentDirectiveResult.status &&
								agentDirectiveResult.status !== 'pending_agent_llm_action'
							) {
								// Or check for an error structure
								const pendingData =
									this.pendingAgentLLMInteractions.get(interactionId);
								if (pendingData) {
									log.warn(
										`TaskMasterMCPServer [Interaction: ${interactionId}]: Prematurely rejecting and deleting stored promise for '${pendingData.originalToolName}' due to unexpected agent_llm dispatch result. Status: '${agentDirectiveResult?.status}'. Deleting interaction.`
									);
									pendingData.reject(
										new Error(
											`agent_llm tool failed during dispatch setup: ${agentDirectiveResult.message || JSON.stringify(agentDirectiveResult.error)}`
										)
									);
									this.pendingAgentLLMInteractions.delete(interactionId);
								}
							}
						})
						.catch((dispatchError) => {
							const pendingData =
								this.pendingAgentLLMInteractions.get(interactionId);
							if (pendingData) {
								log.error(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Dispatch to agent_llm failed for original tool '${pendingData.originalToolName}'. Deleting stored promise. Error: ${dispatchError.message}`
								);
								pendingData.reject(
									new Error(
										`Failed to dispatch to agent_llm: ${dispatchError.message}`
									)
								);
								this.pendingAgentLLMInteractions.delete(interactionId);
							} else {
								// This case might be rare, if the set() operation itself failed or was cleared before catch.
								log.error(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Dispatch to agent_llm failed, but no pending data found to reject. Error: ${dispatchError.message}`
								);
							}
						});
				}); // End of new Promise for internal tracking

                // --- BEGIN WORKAROUND MODIFICATION FOR CURSOR (JSON-in-text) ---
                if (
                    toolResult &&
                    toolResult.content &&
                    Array.isArray(toolResult.content) &&
                    toolResult.content.length > 0 &&
                    toolResult.content[0] &&
                    toolResult.content[0].type === 'resource' &&
                    toolResult.content[0].resource &&
                    toolResult.content[0].resource.uri === 'agent-llm://pending-interaction' &&
                    typeof toolResult.content[0].resource.text === 'string'
                ) {
                    const originalInteractionJSONText = toolResult.content[0].resource.text;

                    toolResult.content[0] = {
                        type: 'text',
                        text: originalInteractionJSONText
                    };
                }
                // --- END WORKAROUND MODIFICATION FOR CURSOR (JSON-in-text) ---

				// Return the original tool's result immediately.
				// This result contains the pendingInteraction signal for the client.
				return toolResult;
			} else if (
				toolName === 'agent_llm' &&
				toolResult &&
				toolResult.interactionId &&
				toolResult.hasOwnProperty('finalLLMOutput')
			) {
				const {
					interactionId,
					finalLLMOutput,
					error,
					status: agentLLMStatus
				} = toolResult;

				log.debug(
					`TaskMasterMCPServer [Interaction: ${interactionId}]: 'agent_llm' tool called (agent callback). Attempting to retrieve promise context. Current map size: ${this.pendingAgentLLMInteractions.size}.`
				);
				// For very verbose debugging, uncomment the next line in the actual code if needed:
				// log.debug(`TaskMasterMCPServer [Interaction: ${interactionId}]: Current interaction IDs in map: ${Array.from(this.pendingAgentLLMInteractions.keys())}`);

				const pendingData = this.pendingAgentLLMInteractions.get(interactionId);

				if (pendingData) {
					log.debug(
						`TaskMasterMCPServer [Interaction: ${interactionId}]: Found pending context for original tool '${pendingData.originalToolName}'. Processing agent response. Deleting interaction from map.`
					);
					if (agentLLMStatus === 'llm_response_error' || error) {
						const agentError =
							error ||
							(typeof finalLLMOutput === 'string'
								? new Error(finalLLMOutput)
								: new Error('Agent LLM call failed'));
						pendingData.reject(agentError);
					} else {
						// Construct the object that generateTextService and similar would return
						const projectRootForCallback =
							pendingData.originalToolArgs?.projectRoot ||
							pendingData.session?.roots?.[0]?.uri ||
							'.';
						const resolvedData = {
							mainResult: finalLLMOutput, // This is agentLLMResponse.data (the text string)
							telemetryData: null, // No direct Taskmaster LLM call telemetry
							tagInfo: pendingData.delegatedCallDetails?.requestParameters
								?.tagInfo || { currentTag: 'master', availableTags: ['master'] } // Retrieve stored tagInfo, or default
						};
						pendingData.resolve(resolvedData);

						// vvv EXISTING POST-PROCESSING LOGIC vvv
						// This logic should ideally use the 'resolvedData' or parts of it if needed,
						// or operate based on pendingData.originalToolArgs and finalLLMOutput.
						// For now, the primary goal is that pendingData.resolve gets the correct structure.

						if (
							pendingData.originalToolName === 'parse_prd' &&
							agentLLMStatus !== 'llm_response_error' &&
							finalLLMOutput
						) {
							const projectRootForSaving =
								pendingData.originalToolArgs?.projectRoot ||
								pendingData.session?.roots?.[0]?.uri;

							if (projectRootForSaving) {
								log.info(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Post-processing for 'parse_prd'. Attempting to save tasks from agent.`
								);

								// Fire-and-forget the save operation, but log its outcome.
								// The agent's acknowledgment should not wait for this.
								saveTasksFromAgentData(
									finalLLMOutput,
									projectRootForSaving,
									log
								)
									.then((saveResult) => {
										if (saveResult.success) {
											log.info(
												`TaskMasterMCPServer [Interaction: ${interactionId}]: Successfully saved tasks for 'parse_prd' to ${saveResult.outputPath}.`
											);
										} else {
											log.error(
												`TaskMasterMCPServer [Interaction: ${interactionId}]: Failed to save tasks for 'parse_prd'. Error: ${saveResult.error}`
											);
										}
									})
									.catch((saveError) => {
										log.error(
											`TaskMasterMCPServer [Interaction: ${interactionId}]: Exception during saving tasks for 'parse_prd'. Error: ${saveError.message}`
										);
										log.error(
											`TaskMasterMCPServer [Interaction: ${interactionId}]: Save error stack: ${saveError.stack}`
										);
									});
							} else {
								log.warn(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Cannot save tasks for 'parse_prd' due to missing projectRoot.`
								);
							}
						}
						// vvv NEW ELSE IF BLOCK FOR expand-task vvv
						else if (
							pendingData.originalToolName === 'expand_task' &&
							agentLLMStatus !== 'llm_response_error' &&
							finalLLMOutput
						) {
							const projectRootForSaving =
								pendingData.originalToolArgs?.projectRoot ||
								pendingData.session?.roots?.[0]?.uri;
							// Retrieve parentTaskId from originalToolArgs for 'expand-task'
							const parentTaskIdString = pendingData.originalToolArgs?.id;
							const parentTaskIdNum = parentTaskIdString
								? parseInt(parentTaskIdString, 10)
								: null;

							// Retrieve nextSubtaskId and numSubtasksForAgent from the stored delegatedCallDetails
							const nextSubtaskId =
								pendingData.delegatedCallDetails?.requestParameters
									?.nextSubtaskId;
							const numSubtasksForAgent =
								pendingData.delegatedCallDetails?.requestParameters
									?.numSubtasksForAgent;

							if (
								projectRootForSaving &&
								parentTaskIdNum &&
								finalLLMOutput &&
								typeof nextSubtaskId === 'number' &&
								typeof numSubtasksForAgent === 'number'
							) {
								log.info(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Post-processing for 'expand_task'. Saving subtasks from agent for parent task ${parentTaskIdNum}.`
								);

								const originalTaskDetailsForSaver = {
									numSubtasks: numSubtasksForAgent,
									nextSubtaskId: nextSubtaskId
								};

								saveExpandedTaskData(
									finalLLMOutput,
									parentTaskIdNum,
									projectRootForSaving,
									log,
									originalTaskDetailsForSaver
								)
									.then((saveResult) => {
										if (saveResult.success) {
											log.info(
												`TaskMasterMCPServer [Interaction: ${interactionId}]: Successfully saved subtasks for 'expand_task' (parent ID: ${parentTaskIdNum}).`
											);
										} else {
											log.error(
												`TaskMasterMCPServer [Interaction: ${interactionId}]: Failed to save subtasks for 'expand_task'. Error: ${saveResult.error}`
											);
										}
									})
									.catch((saveError) => {
										log.error(
											`TaskMasterMCPServer [Interaction: ${interactionId}]: Exception during saving subtasks for 'expand_task'. Error: ${saveError.message}`
										);
										log.error(
											`TaskMasterMCPServer [Interaction: ${interactionId}]: Save error stack: ${saveError.stack}`
										);
									});
							} else {
								log.warn(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Cannot save subtasks for 'expand_task' due to missing projectRoot, parentTaskId, numSubtasksForAgent, nextSubtaskId, or subtask data.`
								);
								log.warn(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Details - projectRoot: ${projectRootForSaving}, parentId: ${parentTaskIdNum}, nextId: ${nextSubtaskId}, numSubtasks: ${numSubtasksForAgent}, finalLLMOutput: ${!!finalLLMOutput}`
								);
							}
						}
						// vvv NEW ELSE IF BLOCK FOR analyze_project_complexity vvv
						else if (
							pendingData.originalToolName === 'analyze_project_complexity' &&
							agentLLMStatus !== 'llm_response_error' &&
							finalLLMOutput
						) {
							const projectRootForSaving =
								pendingData.originalToolArgs?.projectRoot ||
								pendingData.session?.roots?.[0]?.uri;
							// 'originalToolArgs' contains threshold, research, ids, from, to which saveComplexityReportFromAgent needs
							const originalToolArguments = pendingData.originalToolArgs;

							if (
								projectRootForSaving &&
								finalLLMOutput &&
								originalToolArguments
							) {
								log.info(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Post-processing for 'analyze_project_complexity'. Saving complexity report from agent.`
								);

								saveComplexityReportFromAgent(
									finalLLMOutput,
									projectRootForSaving,
									log,
									originalToolArguments
								)
									.then((saveResult) => {
										if (saveResult.success) {
											log.info(
												`TaskMasterMCPServer [Interaction: ${interactionId}]: Successfully saved complexity report for 'analyze_project_complexity' to ${saveResult.outputPath}.`
											);
										} else {
											log.error(
												`TaskMasterMCPServer [Interaction: ${interactionId}]: Failed to save complexity report for 'analyze_project_complexity'. Error: ${saveResult.error}`
											);
										}
									})
									.catch((saveError) => {
										log.error(
											`TaskMasterMCPServer [Interaction: ${interactionId}]: Exception during saving complexity report for 'analyze_project_complexity'. Error: ${saveError.message}`
										);
										log.error(
											`TaskMasterMCPServer [Interaction: ${interactionId}]: Save error stack: ${saveError.stack}`
										);
									});
							} else {
								log.warn(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Cannot save complexity report for 'analyze_project_complexity' due to missing projectRoot, agentOutput, or originalToolArguments.`
								);
								log.warn(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Details - projectRoot: ${projectRootForSaving}, finalLLMOutput: ${!!finalLLMOutput}, originalArgs: ${!!originalToolArguments}`
								);
							}
						}
						// vvv NEW ELSE IF BLOCK FOR update_task vvv
						else if (
							pendingData.originalToolName === 'update_task' &&
							agentLLMStatus !== 'llm_response_error' &&
							finalLLMOutput
						) {
							const projectRootForSaving =
								pendingData.originalToolArgs?.projectRoot ||
								pendingData.session?.roots?.[0]?.uri;
							// 'id' is the parameter name for taskId in the update_task tool
							const taskIdToUpdate = pendingData.originalToolArgs?.id;
							const originalToolArguments = pendingData.originalToolArgs; // Contains prompt, research flag etc.

							if (
								projectRootForSaving &&
								taskIdToUpdate &&
								finalLLMOutput &&
								originalToolArguments
							) {
								log.info(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Post-processing for 'update_task'. Saving updated task data from agent for ID ${taskIdToUpdate}.`
								);

								saveUpdatedTaskFromAgent(
									finalLLMOutput,
									taskIdToUpdate,
									projectRootForSaving,
									log,
									originalToolArguments
								)
									.then((saveResult) => {
										if (saveResult.success) {
											log.info(
												`TaskMasterMCPServer [Interaction: ${interactionId}]: Successfully saved updated task for 'update_task' (ID: ${taskIdToUpdate}). Actual update occurred: ${saveResult.wasActuallyUpdated}`
											);
										} else {
											log.error(
												`TaskMasterMCPServer [Interaction: ${interactionId}]: Failed to save updated task for 'update_task' (ID: ${taskIdToUpdate}). Error: ${saveResult.error}`
											);
										}
									})
									.catch((saveError) => {
										log.error(
											`TaskMasterMCPServer [Interaction: ${interactionId}]: Exception during saving updated task for 'update_task' (ID: ${taskIdToUpdate}). Error: ${saveError.message}`
										);
										log.error(
											`TaskMasterMCPServer [Interaction: ${interactionId}]: Save error stack: ${saveError.stack}`
										);
									});
							} else {
								log.warn(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Cannot save updated task for 'update_task' due to missing projectRoot, taskId, agentOutput, or originalToolArguments.`
								);
								log.warn(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Details - projectRoot: ${projectRootForSaving}, taskId: ${taskIdToUpdate}, finalLLMOutput: ${!!finalLLMOutput}, originalArgs: ${!!originalToolArguments}`
								);
							}
						}
						// vvv NEW ELSE IF BLOCK FOR add_task vvv
						else if (
							pendingData.originalToolName === 'add_task' &&
							agentLLMStatus !== 'llm_response_error' &&
							finalLLMOutput
						) {
							const projectRootForSaving =
								pendingData.originalToolArgs?.projectRoot ||
								pendingData.session?.roots?.[0]?.uri;
							const originalToolArguments = pendingData.originalToolArgs;
							// Get delegatedRequestParams stored during delegation initiation
							const delegatedRequestParams =
								pendingData.delegatedCallDetails?.requestParameters;

							if (
								projectRootForSaving &&
								finalLLMOutput &&
								originalToolArguments &&
								delegatedRequestParams
							) {
								log.info(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Post-processing for 'add_task'. Saving new task from agent.`
								);

								saveNewTaskFromAgent(
									finalLLMOutput,
									projectRootForSaving,
									log,
									originalToolArguments,
									delegatedRequestParams
								)
									.then((saveResult) => {
										if (saveResult.success) {
											log.info(
												`TaskMasterMCPServer [Interaction: ${interactionId}]: Successfully saved new task from agent for 'add_task'. New Task ID: ${saveResult.newTask?.id}`
											);
										} else {
											log.error(
												`TaskMasterMCPServer [Interaction: ${interactionId}]: Failed to save new task from agent for 'add_task'. Error: ${saveResult.error}`
											);
										}
									})
									.catch((saveError) => {
										log.error(
											`TaskMasterMCPServer [Interaction: ${interactionId}]: Exception during saving new task for 'add_task'. Error: ${saveError.message}`
										);
										log.error(
											`TaskMasterMCPServer [Interaction: ${interactionId}]: Save error stack: ${saveError.stack}`
										);
									});
							} else {
								log.warn(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Cannot save new task for 'add_task' due to missing projectRoot, agentOutput, originalToolArguments, or delegatedRequestParams.`
								);
								log.warn(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Details - projectRoot: ${projectRootForSaving}, finalLLMOutput: ${!!finalLLMOutput}, originalArgs: ${!!originalToolArguments}, delegatedParams: ${!!delegatedRequestParams}`
								);
							}
						}
						// vvv ADD/VERIFY THIS ELSE IF BLOCK for 'update_subtask' vvv
						else if (
							pendingData.originalToolName === 'update_subtask' &&
							agentLLMStatus !== 'llm_response_error' &&
							finalLLMOutput
						) {
							const projectRootForSaving =
								pendingData.originalToolArgs?.projectRoot ||
								pendingData.session?.roots?.[0]?.uri;
							// 'id' is the parameter name for the subtaskId string (e.g., "1.2") in the update_subtask tool
							const subtaskIdToUpdate = pendingData.originalToolArgs?.id;
							const originalToolArguments = pendingData.originalToolArgs; // Contains prompt, research flag, etc.

							if (
								projectRootForSaving &&
								subtaskIdToUpdate &&
								finalLLMOutput &&
								originalToolArguments
							) {
								log.info(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Post-processing for 'update_subtask'. Saving updated subtask data from agent for ID ${subtaskIdToUpdate}.`
								);

								// saveUpdatedTaskFromAgent already handles subtask IDs like "parentId.subtaskId"
								saveSubtaskDetailsFromAgent(
									finalLLMOutput,
									subtaskIdToUpdate,
									projectRootForSaving,
									log,
									originalToolArguments
								)
									.then((saveResult) => {
										if (saveResult.success) {
											log.info(
												`TaskMasterMCPServer [Interaction: ${interactionId}]: Successfully saved updated subtask for 'update_subtask' (ID: ${subtaskIdToUpdate}). Actual update occurred: ${saveResult.wasActuallyUpdated}`
											);
										} else {
											log.error(
												`TaskMasterMCPServer [Interaction: ${interactionId}]: Failed to save updated subtask for 'update_subtask' (ID: ${subtaskIdToUpdate}). Error: ${saveResult.error}`
											);
										}
									})
									.catch((saveError) => {
										log.error(
											`TaskMasterMCPServer [Interaction: ${interactionId}]: Exception during saving updated subtask for 'update_subtask' (ID: ${subtaskIdToUpdate}). Error: ${saveError.message}`
										);
										log.error(
											`TaskMasterMCPServer [Interaction: ${interactionId}]: Save error stack: ${saveError.stack}`
										);
									});
							} else {
								log.warn(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Cannot save updated subtask for 'update_subtask' due to missing projectRoot, subtaskId, agentOutput, or originalToolArguments.`
								);
								log.warn(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Details - projectRoot: ${projectRootForSaving}, subtaskId: ${subtaskIdToUpdate}, finalLLMOutput: ${!!finalLLMOutput}, originalArgs: ${!!originalToolArguments}`
								);
							}
						}
						// ^^^ END 'update_subtask' BLOCK ^^^
						// vvv NEW ELSE IF BLOCK FOR 'update' tool (multiple tasks) vvv
						else if (
							(pendingData.originalToolName === 'update' ||
								pendingData.delegatedCallDetails?.originalCommand ===
									'update-tasks') &&
							agentLLMStatus !== 'llm_response_error' &&
							finalLLMOutput
						) {
							const projectRootForSaving =
								pendingData.originalToolArgs?.projectRoot ||
								pendingData.session?.roots?.[0]?.uri;
							const originalToolArguments = pendingData.originalToolArgs; // Contains 'from', 'prompt', etc.

							if (
								projectRootForSaving &&
								finalLLMOutput &&
								originalToolArguments
							) {
								log.info(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Post-processing for '${pendingData.originalToolName}'. Saving multiple updated tasks from agent.`
								);

								saveMultipleTasksFromAgent(
									finalLLMOutput,
									projectRootForSaving,
									log
								)
									.then((saveResult) => {
										if (saveResult.success) {
											log.info(
												`TaskMasterMCPServer [Interaction: ${interactionId}]: Successfully saved ${saveResult.updatesApplied} tasks from agent for '${pendingData.originalToolName}'. IDs: ${saveResult.updatedTaskIds?.join(', ')}.`
											);
										} else {
											log.error(
												`TaskMasterMCPServer [Interaction: ${interactionId}]: Failed to save multiple tasks from agent for '${pendingData.originalToolName}'. Error: ${saveResult.error}`
											);
										}
									})
									.catch((saveError) => {
										log.error(
											`TaskMasterMCPServer [Interaction: ${interactionId}]: Exception during saving multiple tasks for '${pendingData.originalToolName}'. Error: ${saveError.message}`
										);
										log.error(
											`TaskMasterMCPServer [Interaction: ${interactionId}]: Save error stack: ${saveError.stack}`
										);
									});
							} else {
								log.warn(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Cannot save multiple tasks for '${pendingData.originalToolName}' due to missing projectRoot, agentOutput, or originalToolArguments.`
								);
								log.warn(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Details - projectRoot: ${projectRootForSaving}, finalLLMOutput: ${!!finalLLMOutput}, originalArgs: ${!!originalToolArguments}`
								);
							}
						}
						// ^^^ NEW ELSE IF BLOCK END ^^^
						// vvv NEW ELSE IF BLOCK FOR 'research' post-processing vvv
						else if (
							pendingData.originalToolName === 'research' &&
							agentLLMStatus !== 'llm_response_error' &&
							finalLLMOutput
						) {
							const projectRootForHandling =
								pendingData.originalToolArgs?.projectRoot ||
								pendingData.session?.roots?.[0]?.uri;
							const originalToolArguments = pendingData.originalToolArgs; // Contains query, saveTo, saveToFile, etc.
							const agentResearchText = finalLLMOutput; // The plain text from agent

							if (
								projectRootForHandling &&
								originalToolArguments &&
								agentResearchText
							) {
								log.info(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Post-processing for 'research'. Calling handleAgentResearchResult.`
								);

								handleAgentResearchResult(
									agentResearchText,
									originalToolArguments,
									projectRootForHandling,
									log,
									pendingData.session
								)
									.then((handlerResult) => {
										if (handlerResult.success) {
											log.info(
												`TaskMasterMCPServer [Interaction: ${interactionId}]: Successfully processed research result via handler. Task updated: ${handlerResult.taskUpdated}, File saved: ${handlerResult.filePath}`
											);
										} else {
											log.error(
												`TaskMasterMCPServer [Interaction: ${interactionId}]: Error in handleAgentResearchResult for 'research'. Error: ${handlerResult.error}`
											);
										}
									})
									.catch((handlerError) => {
										log.error(
											`TaskMasterMCPServer [Interaction: ${interactionId}]: Exception during handleAgentResearchResult for 'research'. Error: ${handlerError.message}`
										);
										log.error(
											`TaskMasterMCPServer [Interaction: ${interactionId}]: Handler error stack: ${handlerError.stack}`
										);
									});
							} else {
								log.warn(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Cannot post-process 'research' result due to missing projectRoot, originalToolArguments, or agentResearchText.`
								);
								log.warn(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Details - projectRoot: ${projectRootForHandling}, finalLLMOutput: ${!!agentResearchText}, originalArgs: ${!!originalToolArguments}`
								);
							}
						}
						// ^^^ END 'research' POST-PROCESSING BLOCK ^^^
					}
					this.pendingAgentLLMInteractions.delete(interactionId);
                    
                    // Construct the payload for the JSON-in-text workaround
                    const agentAckPayloadForText = {
                           status: 'agent_response_processed_by_taskmaster',
                           interactionId: interactionId 
                    };
                    
                    return { 
                        content: [
                            {
                                type: 'text', // Changed from 'resource' to 'text'
                                text: JSON.stringify(agentAckPayloadForText, null, 2) // Stringify the new payload, pretty-printed
                            }
                        ],
                        isError: false
                    };
				} else {
					// Ensure interactionId is part of this log, it was already included.
					log.warn(
						`TaskMasterMCPServer [Interaction: ${interactionId}]: Received agent_llm response for unknown or expired interaction ID: ${interactionId}`
					);
					return createErrorResponse(
						`Agent response for unknown/expired interaction ID: ${interactionId}`
					);
				}
			}

			// Default case: return the original tool result if no special handling applies
			return toolResult;
		};
	}
}

export default TaskMasterMCPServer;
