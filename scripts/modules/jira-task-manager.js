/**
 * Task Provider implementation using the Jira MCP tools.
 * Assumes necessary Jira configuration (project key, etc.) is available,
 * likely via environment variables or a config mechanism.
 * Also assumes JIRA_SUBTASK_TYPE_NAME environment variable can be set, defaulting to 'Subtask'.
 */
class JiraTaskManager {
    constructor(config = {}, jiraMcpTools = {}) {
        // Store necessary config, e.g., projectKey, potentially fetched from env vars
        this.projectKey = config.projectKey || process.env.JIRA_PROJECT_KEY;
        this.subtaskTypeName = process.env.JIRA_SUBTASK_TYPE_NAME || 'Sub-task'; // Read subtask type name
        // Read custom field IDs from environment variables
        this.epicLinkFieldId = process.env.JIRA_EPIC_LINK_FIELD_ID; // e.g., customfield_10014
        this.epicNameFieldId = process.env.JIRA_EPIC_NAME_FIELD_ID; // e.g., customfield_10011

        this.jiraMcpTools = jiraMcpTools; // Store the injected tool functions

        // Basic check for required tools
        const requiredTools = ['search', 'get_issue', 'create_issue', 'update_issue', 'get_transitions', 'transition_issue'];
        for (const toolName of requiredTools) {
            if (typeof this.jiraMcpTools[toolName] !== 'function') {
                // Throw or warn strongly - without the tools, this provider is useless
                throw new Error(`JiraTaskManager requires the '${toolName}' MCP tool function.`);
            }
        }

        if (!this.projectKey) {
            // Consider throwing an error or logging a warning if project key is missing
            console.warn("JiraTaskManager initialized without a project key. Operations may fail.");
        }
        // TODO: Add mapping for Task Master status -> Jira status
        // TODO: Add mapping for Task Master priority -> Jira priority
        // TODO: Define how Task Master fields (details, testStrategy) map to Jira fields (custom fields?)
    }

    /**
     * Maps Task Master task structure to Jira issue structure.
     * Handles custom fields, priorities, statuses etc.
     * @param {object} jiraIssue - The raw issue object from the Jira tool.
     * @returns {object} - A Task Master task object.
     */
    _mapJiraIssueToTask(jiraIssue) {
        // Basic mapping
        const task = {
            id: jiraIssue.key,
            title: jiraIssue.fields.summary,
            description: jiraIssue.fields.description || '',
            status: jiraIssue.fields.status.name, // TODO: Map Jira status back to TM status
            priority: jiraIssue.fields.priority?.name || 'medium', // TODO: Map Jira priority back to TM priority
            // Add links and parent info
            parentKey: jiraIssue.fields.parent?.key, // Get parent key if it exists (for subtasks)
            issueLinks: jiraIssue.fields.issuelinks || [],
            // Placeholder for TM-specific dependencies
            dependencies: [],
            subtasks: [], // Placeholder, requires separate fetching or processing
            // Extract Epic Link and Name using configured custom field IDs
            epicKey: this.epicLinkFieldId ? jiraIssue.fields[this.epicLinkFieldId] : null,
            epicName: this.epicNameFieldId ? jiraIssue.fields[this.epicNameFieldId] : null,
            // Map other relevant fields
            created: jiraIssue.fields.created,
            updated: jiraIssue.fields.updated,
            assignee: jiraIssue.fields.assignee?.displayName,
            reporter: jiraIssue.fields.reporter?.displayName,
            url: jiraIssue.url, // Add the Jira issue URL
            // TODO: Map custom fields for details, testStrategy if configured
            details: '', 
            testStrategy: '',
            _raw: jiraIssue // Optionally keep the raw data for debugging
        };

        // Clean up null/undefined fields potentially?

        return task;
    }

     /**
     * Maps Task Master task data to a payload suitable for Jira issue creation/update.
     * @param {object} taskData - The Task Master task object.
     * @param {boolean} isUpdate - Flag indicating if this is for an update (true) or creation (false).
     * @returns {object} - An object containing 'fields' and potentially 'additional_fields' for Jira tools.
     */
    _mapTaskToJiraPayload(taskData, isUpdate = false) {
        const jiraPayload = {
            fields: {},
             // additional_fields JSON string might be needed for complex updates or custom fields
            additional_fields: {}
        };

        if (!isUpdate) {
            // Required for creation
             if (!this.projectKey) throw new Error("Missing projectKey for Jira issue creation.");
            jiraPayload.fields.project = { key: this.projectKey };
            // TODO: Determine correct issue type ('Task', 'Story', etc.) - maybe configurable?
             jiraPayload.fields.issuetype = { name: 'Task' };
        }

        if (taskData.title) jiraPayload.fields.summary = taskData.title;
        if (taskData.description) jiraPayload.fields.description = taskData.description;
        // TODO: Map TM priority -> Jira priority object/name
        // if (taskData.priority) jiraPayload.fields.priority = { name: mapPriority(taskData.priority) };
        // TODO: Map TM details/testStrategy -> Jira custom fields
        // if (taskData.details) jiraPayload.additional_fields.customfield_xxxxx = taskData.details;
        // if (taskData.testStrategy) jiraPayload.additional_fields.customfield_yyyyy = taskData.testStrategy;
        // TODO: Handle dependencies (linking issues) - Complex, might need separate calls/logic
        // TODO: Handle subtasks (parent field) - Needed for addSubtask

        // Convert additional_fields object to JSON string if not empty
        if (Object.keys(jiraPayload.additional_fields).length > 0) {
            jiraPayload.additional_fields = JSON.stringify(jiraPayload.additional_fields);
        } else {
            delete jiraPayload.additional_fields; // Remove if empty
        }
         // Convert fields object to JSON string for update tool
         if (isUpdate) {
            jiraPayload.fields = JSON.stringify(jiraPayload.fields);
         }


        return jiraPayload;
    }


    /**
     * Fetches tasks (Jira issues) based on criteria.
     * Can filter by standard project/status, fetch all issues for a specific Epic,
     * or use a custom JQL query if provided.
     * @param {object} options - Filter options { status, withSubtasks, epicKey, jql }
     * @returns {Promise<object>} - { tasks: [...] }
     */
    async getTasks(options = {}) {
        console.log(`JiraTaskManager: getTasks called with options:`, options);

        let jql = '';

        if (options.jql) {
            // Use provided JQL directly
            console.log(`JiraTaskManager: Using provided JQL: ${options.jql}`);
            jql = options.jql;
        } else if (options.epicKey) {
            // Comprehensive Epic Discovery Mode
            console.log(`JiraTaskManager: Fetching all issues for Epic ${options.epicKey}`);
            // Escape single quotes in epicKey if necessary, though unlikely for keys
            const safeEpicKey = options.epicKey.replace(/'/g, "\\'");
            jql = `'Epic Link' = '${safeEpicKey}' OR parent = '${safeEpicKey}' ORDER BY issuetype ASC, key ASC`;
        } else {
            // Standard Project/Status Filter Mode
            if (!this.projectKey) {
                throw new Error("JiraTaskManager requires a projectKey for standard task fetching when no JQL or epicKey is provided.");
            }
            // Escape double quotes in projectKey
            const safeProjectKey = this.projectKey.replace(/"/g, '\\"');
            jql = `project = \"${safeProjectKey}\"`;
            if (options.status) {
                // TODO: Map TM status to Jira status for JQL more robustly
                // Escape double quotes in status
                const safeStatus = options.status.replace(/"/g, '\\"');
                jql += ` AND status = \"${safeStatus}\"`;
            }
            jql += ` ORDER BY created DESC`; // Example ordering
            console.log(`JiraTaskManager: Using default project/status JQL: ${jql}`);
        }


        try {
            // Use injected tool function
            // Requesting *all fields to ensure issueLinks, parent, etc. are present
            const searchResult = await this.jiraMcpTools.search({ jql: jql, fields: '*all', limit: 50 });
            // Ensure searchResult.issues is an array before mapping
            const issues = Array.isArray(searchResult.issues) ? searchResult.issues : [];
            const tasks = issues.map(this._mapJiraIssueToTask.bind(this));

            // TODO: Handle subtasks hierarchy reconstruction if options.withSubtasks is true
            // This would involve processing the fetched tasks list, identifying parents/children,
            // and structuring them hierarchically before returning.

            return { tasks: tasks };
        } catch (error) {
            console.error(`Error fetching Jira issues with JQL "${jql}":`, error);
            // Re-throw or return error structure
            throw new Error(`Failed to fetch tasks from Jira: ${error.message}`);
        }
    }

    /**
     * Fetches a single task (Jira issue) by ID (Jira Key).
     * @param {string} id - Jira Issue Key
     * @returns {Promise<object>} - Task Master task object
     */
    async getTask(id) {
        // TODO: Implement using mcp_mcp_atlassian_jira_get_issue
        // 1. Call mcp_mcp_atlassian_jira_get_issue with id (issue_key)
        // 2. Map result using _mapJiraIssueToTask
        console.log(`JiraTaskManager: getTask called with id:`, id);
         try {
            // Use injected tool function
            const issue = await this.jiraMcpTools.get_issue({ issue_key: id, fields: '*all' });
            return this._mapJiraIssueToTask(issue);
        } catch (error) {
            console.error(`Error fetching Jira issue ${id}:`, error);
            throw new Error(`Failed to get task ${id} from Jira: ${error.message}`);
        }
    }

    /**
     * Adds a new task (creates a Jira issue).
     * @param {object} taskData - Task Master task data
     * @returns {Promise<object>} - Newly created Task Master task object
     */
    async addTask(taskData) {
        // TODO: Implement using mcp_mcp_atlassian_jira_create_issue
        // 1. Map taskData to Jira payload using _mapTaskToJiraPayload
        // 2. Call mcp_mcp_atlassian_jira_create_issue
        // 3. Fetch the newly created issue (tool might return it, or use getTask)
        // 4. Map result using _mapJiraIssueToTask
         console.log(`JiraTaskManager: addTask called with data:`, taskData);
        try {
            const payload = this._mapTaskToJiraPayload(taskData, false);
            // Use injected tool function
            const createResult = await this.jiraMcpTools.create_issue({
                project_key: this.projectKey,
                issue_type: payload.fields.issuetype.name,
                summary: payload.fields.summary,
                description: payload.fields.description,
                additional_fields: payload.additional_fields
                // TODO: Pass assignee, priority etc. if mapped
            });

             if (createResult && createResult.key) {
                 return await this.getTask(createResult.key);
             } else {
                 throw new Error("Jira issue creation did not return a key.");
             }
        } catch (error) {
            console.error("Error creating Jira issue:", error);
            throw new Error(`Failed to add task to Jira: ${error.message}`);
        }
    }

    /**
     * Updates an existing task (Jira issue).
     * @param {string} id - Jira Issue Key
     * @param {object} taskData - Task Master data fields to update
     * @returns {Promise<object>} - Updated Task Master task object
     */
    async updateTask(id, taskData) {
        // TODO: Implement using mcp_mcp_atlassian_jira_update_issue
        // 1. Map taskData to Jira update payload using _mapTaskToJiraPayload (isUpdate = true)
        // 2. Call mcp_mcp_atlassian_jira_update_issue
        // 3. Fetch the updated issue using getTask
        // 4. Map result using _mapJiraIssueToTask
         console.log(`JiraTaskManager: updateTask called for id ${id} with data:`, taskData);
         try {
            const payload = this._mapTaskToJiraPayload(taskData, true);
            // Use injected tool function
             await this.jiraMcpTools.update_issue({
                issue_key: id,
                fields: payload.fields,
                additional_fields: payload.additional_fields
            });
             return await this.getTask(id);
         } catch (error) {
            console.error(`Error updating Jira issue ${id}:`, error);
            throw new Error(`Failed to update task ${id} in Jira: ${error.message}`);
         }
    }

    /**
     * Adds a subtask (creates a Jira sub-task issue).
     * @param {string} parentId - Jira Issue Key of the parent
     * @param {string | null} taskId - Existing TM Task ID to convert (Not directly applicable to Jira)
     * @param {object} subtaskData - Task Master subtask data
     * @returns {Promise<object>} - Newly created Task Master subtask object
     */
    async addSubtask(parentId, taskId, subtaskData) {
        // TODO: Implement using mcp_mcp_atlassian_jira_create_issue with 'Subtask' type and parent link
        // 1. Map subtaskData to Jira payload (_mapTaskToJiraPayload might need adjustments for subtasks)
        // 2. Ensure payload includes parent link: { "parent": { "key": parentId } } in additional_fields
        // 3. Set issue_type to 'Subtask' (or configured subtask type)
        // 4. Call mcp_mcp_atlassian_jira_create_issue
        // 5. Fetch the new subtask using getTask
        // 6. Map result using _mapJiraIssueToTask
        console.log(`JiraTaskManager: addSubtask called for parent ${parentId} with data:`, subtaskData);
         if (taskId) {
             console.warn("JiraTaskManager: Converting an existing task to a subtask (taskId parameter) is not directly supported. Creating a new subtask instead.");
         }
         try {
            const payload = this._mapTaskToJiraPayload(subtaskData, false);
            const additionalFields = payload.additional_fields ? JSON.parse(payload.additional_fields) : {};
            additionalFields.parent = { key: parentId };

            // Use injected tool function
            const createResult = await this.jiraMcpTools.create_issue({
                project_key: this.projectKey,
                issue_type: this.subtaskTypeName, // Use configured subtask type name
                summary: payload.fields.summary,
                description: payload.fields.description,
                additional_fields: JSON.stringify(additionalFields)
            });

            if (createResult && createResult.key) {
                return await this.getTask(createResult.key);
            } else {
                throw new Error("Jira subtask creation did not return a key.");
            }
        } catch (error) {
            console.error(`Error creating Jira subtask for parent ${parentId}:`, error);
            throw new Error(`Failed to add subtask to Jira: ${error.message}`);
        }
    }

    /**
     * Sets the status of a task (transitions a Jira issue).
     * @param {string} id - Jira Issue Key or comma-separated keys
     * @param {string} status - Target Task Master status
     * @returns {Promise<boolean>} - Success status
     */
    async setTaskStatus(id, status) {
        // TODO: Implement using mcp_mcp_atlassian_jira_get_transitions and mcp_mcp_atlassian_jira_transition_issue
        // 1. Map TM status to target Jira status name.
        // 2. For each id in potentially comma-separated list:
        //    a. Call mcp_mcp_atlassian_jira_get_transitions for the issue key.
        //    b. Find the transition ID that matches the target Jira status name.
        //    c. If found, call mcp_mcp_atlassian_jira_transition_issue with the issue key and transition ID.
        //    d. Handle cases where the transition is not available.
        console.log(`JiraTaskManager: setTaskStatus called for id(s) ${id} to status ${status}`);
         const issueKeys = id.split(',').map(k => k.trim());
         let allSucceeded = true;

         // TODO: Get target Jira status name from TM status
         const targetJiraStatusName = status; // Simple mapping for now

         for (const issueKey of issueKeys) {
            try {
                // Use injected tool function
                const transitionsResult = await this.jiraMcpTools.get_transitions({ issue_key: issueKey });
                const availableTransitions = transitionsResult.transitions || [];
                const targetTransition = availableTransitions.find(t => t.to.name.toLowerCase() === targetJiraStatusName.toLowerCase());

                if (!targetTransition) {
                    console.warn(`Transition to status '${targetJiraStatusName}' not available for issue ${issueKey}. Available: ${availableTransitions.map(t => t.to.name).join(', ')}`);
                    allSucceeded = false;
                    continue; // Skip this issue
                }

                // Use injected tool function
                await this.jiraMcpTools.transition_issue({
                    issue_key: issueKey,
                    transition_id: targetTransition.id
                });
                 console.log(`Successfully transitioned issue ${issueKey} to status ${targetJiraStatusName}`);

             } catch (error) {
                console.error(`Error transitioning Jira issue ${issueKey} to status ${status}:`, error);
                 allSucceeded = false;
                 // Continue trying other issues if multiple were provided
             }
         }
         return allSucceeded; // Return overall success
    }

    /**
     * Adds a comment to a specific Jira issue.
     * @param {string} issueKey - The key of the issue to add the comment to.
     * @param {string} comment - The comment text (Markdown format).
     * @returns {Promise<object>} - The result from the add_comment tool.
     */
    async addComment(issueKey, comment) {
        if (typeof this.jiraMcpTools.add_comment !== 'function') {
            throw new Error("JiraTaskManager requires the 'add_comment' MCP tool function to add comments.");
        }
        console.log(`JiraTaskManager: Adding comment to issue ${issueKey}`);
        try {
            const result = await this.jiraMcpTools.add_comment({
                issue_key: issueKey,
                comment: comment
            });
            console.log(`JiraTaskManager: Comment added successfully to ${issueKey}`);
            return result; // Return the result from the tool
        } catch (error) {
            console.error(`Error adding comment to Jira issue ${issueKey}:`, error);
            throw new Error(`Failed to add comment to Jira issue ${issueKey}: ${error.message}`);
        }
    }

    // TODO: Implement other methods if needed (removeTask, dependency management)
    // Dependency management in Jira involves issue linking, which might require
    // mcp_mcp_atlassian_jira_link_issues or similar (if available) or updates via update_issue.
    // Removing tasks would use mcp_mcp_atlassian_jira_delete_issue.
}

// Export the class
export default JiraTaskManager;

// Helper function example (needs proper implementation)
function mapPriority(tmPriority) {
    // Map 'high', 'medium', 'low' to Jira priority names/objects
    return tmPriority.charAt(0).toUpperCase() + tmPriority.slice(1); // Basic example
} 