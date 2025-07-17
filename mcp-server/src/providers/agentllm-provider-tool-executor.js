import { createErrorResponse } from '../tools/utils.js';
import { agentllmParsePrdSave } from '../core/utils/agentllm-parse-prd-tool-saver.js';
import { agentllmExpandTaskSave } from '../core/utils/agentllm-expand-task-tool-saver.js';
import { agentllmComplexityReportSave } from '../core/utils/agentllm-complexity-report-tool-saver.js';
import { agentllmUpdatedTaskSave } from '../core/utils/agentllm-update-task-tool-saver.js';
import { agentllmAddTaskSave } from '../core/utils/agentllm-add-task-tool-saver.js';
import { agentllmUpdateSave } from '../core/utils/agentllm-update-tool-saver.js';
import { agentllmUpdateSubtaskSave } from '../core/utils/agentllm-update-subtask-tool-saver.js';
import { agentllmResearchSave } from '../core/utils/agentllm-research-tool-saver.js';

async function _handlePostProcessing(
	pendingData,
	finalLLMOutput,
	log,
	interactionId
) {
	const {
		originalToolName,
		originalToolArgs,
		session,
		delegatedCallDetails
	} = pendingData;
	const projectRoot = originalToolArgs?.projectRoot || session?.roots?.[0]?.uri;

	let postProcessingResult = { success: true };
	let mainResultMessage = finalLLMOutput; // Default to returning the raw output

	if (originalToolName === 'parse_prd' && finalLLMOutput) {
		if (!projectRoot) throw new Error('Missing projectRoot for parse_prd');
		log.info(
			`TaskMasterMCPServer [Interaction: ${interactionId}]: Post-processing for 'parse_prd'.`
		);
		postProcessingResult = await agentllmParsePrdSave(
			finalLLMOutput,
			projectRoot,
			log
		);
		if (postProcessingResult.success) {
			mainResultMessage = `Successfully saved tasks.`;
		}
	} else if (originalToolName === 'expand_task' && finalLLMOutput) {
		const parentIdStr = originalToolArgs?.id;
		const parentIdNum = parentIdStr ? parseInt(parentIdStr, 10) : null;
		const { nextSubtaskId, numSubtasksForAgent } =
			delegatedCallDetails?.requestParameters || {};
		if (
			!projectRoot ||
			!parentIdNum ||
			typeof nextSubtaskId !== 'number' ||
			typeof numSubtasksForAgent !== 'number'
		) {
			throw new Error('Missing required parameters for expand_task.');
		}
		log.info(
			`TaskMasterMCPServer [Interaction: ${interactionId}]: Post-processing for 'expand_task'.`
		);
		const taskDetails = {
			numSubtasks: numSubtasksForAgent,
			nextSubtaskId: nextSubtaskId
		};
		postProcessingResult = await agentllmExpandTaskSave(
			finalLLMOutput,
			parentIdNum,
			projectRoot,
			log,
			taskDetails
		);
		if (postProcessingResult.success) {
			mainResultMessage = `Successfully saved subtasks.`;
		}
	} else if (
		originalToolName === 'analyze_project_complexity' &&
		finalLLMOutput
	) {
		if (!projectRoot)
			throw new Error('Missing projectRoot for analyze_project_complexity');
		log.info(
			`TaskMasterMCPServer [Interaction: ${interactionId}]: Post-processing for 'analyze_project_complexity'.`
		);
		postProcessingResult = await agentllmComplexityReportSave(
			finalLLMOutput,
			projectRoot,
			log,
			originalToolArgs
		);
		if (postProcessingResult.success) {
			mainResultMessage = `Successfully saved complexity report.`;
		}
	} else if (originalToolName === 'update_task' && finalLLMOutput) {
		const taskId = originalToolArgs?.id;
		if (!projectRoot || !taskId)
			throw new Error('Missing projectRoot or taskId for update_task');
		log.info(
			`TaskMasterMCPServer [Interaction: ${interactionId}]: Post-processing for 'update_task'.`
		);
		postProcessingResult = await agentllmUpdatedTaskSave(
			finalLLMOutput,
			taskId,
			projectRoot,
			log,
			originalToolArgs
		);
		if (postProcessingResult.success) {
			mainResultMessage = `Successfully updated task ${taskId}.`;
		}
	} else if (originalToolName === 'add_task' && finalLLMOutput) {
		const delegatedParams = delegatedCallDetails?.requestParameters;
		if (!projectRoot || !delegatedParams)
			throw new Error('Missing projectRoot or delegated params for add_task');
		log.info(
			`TaskMasterMCPServer [Interaction: ${interactionId}]: Post-processing for 'add_task'.`
		);
		postProcessingResult = await agentllmAddTaskSave(
			finalLLMOutput,
			projectRoot,
			log,
			originalToolArgs,
			delegatedParams
		);
		if (postProcessingResult.success) {
			mainResultMessage = `Successfully added new task ${postProcessingResult.newTask?.id}.`;
		}
	} else if (originalToolName === 'update_subtask' && finalLLMOutput) {
		const subtaskId = originalToolArgs?.id;
		if (!projectRoot || !subtaskId)
			throw new Error('Missing projectRoot or subtaskId for update_subtask');
		log.info(
			`TaskMasterMCPServer [Interaction: ${interactionId}]: Post-processing for 'update_subtask'.`
		);
		postProcessingResult = await agentllmUpdateSubtaskSave(
			finalLLMOutput,
			subtaskId,
			projectRoot,
			log,
			originalToolArgs
		);
		if (postProcessingResult.success) {
			mainResultMessage = `Successfully updated subtask ${subtaskId}.`;
		}
	} else if (
		(originalToolName === 'update' ||
			delegatedCallDetails?.originalCommand === 'update-tasks') &&
		finalLLMOutput
	) {
		if (!projectRoot) throw new Error('Missing projectRoot for update');
		log.info(
			`TaskMasterMCPServer [Interaction: ${interactionId}]: Post-processing for '${originalToolName}'.`
		);
		postProcessingResult = await agentllmUpdateSave(
			finalLLMOutput,
			projectRoot,
			log
		);
		if (postProcessingResult.success) {
			mainResultMessage = `Successfully updated ${postProcessingResult.updatesApplied} tasks.`;
		}
	} else if (originalToolName === 'research' && finalLLMOutput) {
		if (!projectRoot) throw new Error('Missing projectRoot for research');
		log.info(
			`TaskMasterMCPServer [Interaction: ${interactionId}]: Post-processing for 'research'.`
		);
		postProcessingResult = await agentllmResearchSave(
			finalLLMOutput,
			originalToolArgs,
			projectRoot,
			log,
			session
		);
		if (postProcessingResult.success) {
			mainResultMessage = `Successfully processed research result.`;
		}
	}

	if (!postProcessingResult.success) {
		throw new Error(
			postProcessingResult.error || 'Unknown error during post-processing.'
		);
	}

	return {
		mainResult: mainResultMessage,
		telemetryData: null,
		tagInfo: delegatedCallDetails?.requestParameters?.tagInfo || {
			currentTag: 'master',
			availableTags: ['master']
		}
	};
}

export function AgentLLMProviderToolExecutor(
	toolName,
	originalExecute,
	serverContext
) {
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
			toolResult.content[0]
		) {
			let textToParse = null;
			if (
				toolResult.content[0].type === 'resource' &&
				toolResult.content[0].resource &&
				toolResult.content[0].resource.uri ===
					'agent-llm://pending-interaction' &&
				typeof toolResult.content[0].resource.text === 'string'
			) {
				textToParse = toolResult.content[0].resource.text;
			} else if (toolResult.content[0].type === 'text') {
				textToParse = toolResult.content[0].text;
			}

			if (textToParse) {
				try {
					const parsedText = JSON.parse(textToParse);
					if (
						parsedText &&
						parsedText.isAgentLLMPendingInteraction === true &&
						parsedText.details
					) {
						detectedPendingInteractionObj = parsedText.details;
					} else {
						log.warn(
							`TaskMasterMCPServer: Found 'agent-llm://pending-interaction' resource, but its 'text' field content is not the expected structure for tool '${toolName}'. Text content: ${textToParse}`
						);
					}
				} catch (e) {
					log.error(
						`TaskMasterMCPServer: Error parsing JSON from resource.text for 'agent-llm://pending-interaction' for tool '${toolName}'. Error: ${e.message}. Text content: ${textToParse}`
					);
				}
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

			const agentLLMTool = serverContext.registeredTools.get('agent_llm');
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
				serverContext.pendingAgentLLMInteractions.set(interactionId, {
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
								serverContext.pendingAgentLLMInteractions.get(interactionId);
							if (pendingData) {
								log.warn(
									`TaskMasterMCPServer [Interaction: ${interactionId}]: Prematurely rejecting and deleting stored promise for '${pendingData.originalToolName}' due to unexpected agent_llm dispatch result. Status: '${agentDirectiveResult?.status}'. Deleting interaction.`
								);
								pendingData.reject(
									new Error(
										`agent_llm tool failed during dispatch setup: ${agentDirectiveResult.message || JSON.stringify(agentDirectiveResult.error)}`
									)
								);
								serverContext.pendingAgentLLMInteractions.delete(interactionId);
							}
						}
					})
					.catch((dispatchError) => {
						const pendingData =
							serverContext.pendingAgentLLMInteractions.get(interactionId);
						if (pendingData) {
							log.error(
								`TaskMasterMCPServer [Interaction: ${interactionId}]: Dispatch to agent_llm failed for original tool '${pendingData.originalToolName}'. Deleting stored promise. Error: ${dispatchError.message}`
							);
							pendingData.reject(
								new Error(
									`Failed to dispatch to agent_llm: ${dispatchError.message}`
								)
							);
							serverContext.pendingAgentLLMInteractions.delete(interactionId);
						} else {
							// This case might be rare, if the set() operation itself failed or was cleared before catch.
							log.error(
								`TaskMasterMCPServer [Interaction: ${interactionId}]: Dispatch to agent_llm failed, but no pending data found to reject. Error: ${dispatchError.message}`
							);
						}
					});
			}); // End of new Promise for internal tracking

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
				`TaskMasterMCPServer [Interaction: ${interactionId}]: 'agent_llm' tool called (agent callback). Attempting to retrieve promise context. Current map size: ${serverContext.pendingAgentLLMInteractions.size}.`
			);
			// For very verbose debugging, uncomment the next line in the actual code if needed:
			// log.debug(`TaskMasterMCPServer [Interaction: ${interactionId}]: Current interaction IDs in map: ${Array.from(this.pendingAgentLLMInteractions.keys())}`);

			const pendingData =
				serverContext.pendingAgentLLMInteractions.get(interactionId);

			if (pendingData) {
				log.debug(
					`TaskMasterMCPServer [Interaction: ${interactionId}]: Found pending context for original tool '${pendingData.originalToolName}'. Processing agent response. Deleting interaction from map.`
				);
				try {
					if (agentLLMStatus === 'llm_response_error' || error) {
						const agentError =
							error ||
							(typeof finalLLMOutput === 'string'
								? new Error(finalLLMOutput)
								: new Error('Agent LLM call failed'));
						throw agentError;
					}

					const { mainResult, telemetryData, tagInfo } =
						await _handlePostProcessing(
							pendingData,
							finalLLMOutput,
							log,
							interactionId
						);

					pendingData.resolve({ mainResult, telemetryData, tagInfo });

					// This is the success response returned to the agent.
					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify({
									status: 'agent_response_processed_by_taskmaster',
									interactionId: interactionId
								})
							}
						],
						isError: false
					};
				} catch (e) {
					log.error(
						`TaskMasterMCPServer [Interaction: ${interactionId}]: Error processing agent response for '${pendingData.originalToolName}'. Error: ${e.message}`
					);
					pendingData.reject(e);

					// Still need to return a response to the agent, even in case of error.
					return {
						content: [
							{
								type: 'text',
								text: JSON.stringify({
									status:
										'agent_response_processed_by_taskmaster_with_error',
									interactionId: interactionId,
									error: e.message
								})
							}
						],
						isError: true
					};
				} finally {
					serverContext.pendingAgentLLMInteractions.delete(interactionId);
				}
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
