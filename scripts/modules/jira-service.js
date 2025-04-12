// scripts/modules/jira-service.js

// Assuming access to the mcp-atlassian tools via some mechanism
// (e.g., a global object or passed-in client)
// const jiraClient = ...;

/**
 * Maps a Jira issue object to the Task Master Task structure.
 * @param {object} issue - The Jira issue object from the API/MCP tool.
 * @returns {object} - The Task Master Task object.
 */
function mapJiraIssueToTask(issue) {
  if (!issue || !issue.key || !issue.fields) {
    console.error('Invalid Jira issue object received for mapping:', issue);
    return null;
  }

  // Basic mapping
  const task = {
    id: issue.key,
    title: issue.fields.summary || '',
    description: issue.fields.description || '', // Combine details/testStrategy later if needed
    status: issue.fields.status?.name || 'unknown', // Needs status mapping logic
    priority: issue.fields.priority?.name || 'medium', // Needs priority mapping logic
    dependencies: [], // Placeholder - requires link parsing
    subtasks: [], // Placeholder - requires subtask/parent link parsing
    details: '', // Extract from description or custom fields later
    testStrategy: '', // Extract from description or custom fields later
    // Add any other fields expected by Task Master, potentially extracting from custom fields
    // e.g., assignee: issue.fields.assignee?.displayName,
    // reporter: issue.fields.reporter?.displayName,
    created: issue.fields.created,
    updated: issue.fields.updated,
    jiraUrl: issue.self ? issue.self.replace(/rest\/api\/2\/issue\/\d+$/, `browse/${issue.key}`) : '', // Construct browse URL
  };

  // TODO: Implement mapping for dependencies from issue.fields.issuelinks
  // TODO: Implement mapping for subtasks from issue.fields.subtasks or parent link

  // TODO: Implement more robust status mapping (e.g., Jira 'Done' -> TM 'done')
  // TODO: Implement more robust priority mapping

  return task;
}

/**
 * Fetches tasks from the configured Jira project.
 * @param {object} options - Filtering options (e.g., { status: 'pending' }).
 * @returns {Promise<Array<object>>} - A promise resolving to an array of Task objects.
 */
async function getTasks(options = {}) {
  const projectKey = process.env.JIRA_PROJECT_KEY;
  if (!projectKey) {
    throw new Error('JIRA_PROJECT_KEY environment variable is not set.');
  }

  let jql = `project = "${projectKey}"`;

  // Add status filtering if provided (requires mapping TM status to Jira status)
  if (options.status) {
    // TODO: Map options.status (e.g., 'pending') to the corresponding Jira status name
    const jiraStatus = mapStatusToJira(options.status); // Placeholder for mapping function
    if (jiraStatus) {
      jql += ` AND status = "${jiraStatus}"`;
    } else {
      console.warn(`Could not map Task Master status "${options.status}" to a Jira status.`);
    }
  }

  // Add other filters based on options as needed (e.g., assignee)

  jql += ' ORDER BY created DESC'; // Example ordering

  try {
    // TODO: Replace with actual MCP tool call
    // const response = await jiraClient.mcp_mcp_atlassian_jira_search({
    //   jql: jql,
    //   fields: '*all', // Request needed fields, adjust as necessary
    //   limit: 50 // Or make configurable
    // });
    console.log(`Simulating: mcp_mcp_atlassian_jira_search({ jql: "${jql}", fields: "*all", limit: 50 })`);
    // Placeholder response for structure - replace with actual call result
    const response = { search_results: { issues: [/* array of Jira issue objects */] } }; // MOCK STRUCTURE

    if (!response || !response.search_results || !Array.isArray(response.search_results.issues)) {
        console.error('Invalid response structure from Jira search:', response);
        return [];
    }

    const tasks = response.search_results.issues
      .map(mapJiraIssueToTask)
      .filter(task => task !== null); // Filter out any nulls from mapping errors

    return tasks;
  } catch (error) {
    console.error(`Error fetching tasks from Jira: ${error.message}`, error);
    // Depending on Task Master's error handling, either throw or return empty array
    throw error;
  }
}

/**
 * Fetches a single task by its Jira issue key.
 * @param {string} id - The Jira issue key (e.g., 'DEVB-123').
 * @returns {Promise<object|null>} - A promise resolving to the Task object or null if not found.
 */
async function getTask(id) {
  if (!id) {
    throw new Error('Jira issue key (id) is required.');
  }

  try {
    // TODO: Replace with actual MCP tool call
    // const response = await jiraClient.mcp_mcp_atlassian_jira_get_issue({
    //   issue_key: id,
    //   fields: '*all' // Request needed fields
    // });
     console.log(`Simulating: mcp_mcp_atlassian_jira_get_issue({ issue_key: "${id}", fields: "*all" })`);
    // Placeholder response for structure - replace with actual call result
    const response = { issue: {/* single Jira issue object */} }; // MOCK STRUCTURE

    if (!response || !response.issue) {
      // Handle cases where the issue doesn't exist (tool might return error or specific response)
      console.warn(`Jira issue with key ${id} not found or error fetching.`);
      return null; // Or throw an error based on expected behavior
    }

    const task = mapJiraIssueToTask(response.issue);
    return task;
  } catch (error) {
    console.error(`Error fetching task ${id} from Jira: ${error.message}`, error);
     // Depending on Task Master's error handling, either throw or return null
    throw error;
  }
}

// Placeholder for status mapping logic
function mapStatusToJira(taskMasterStatus) {
  const mapping = {
    'pending': 'To Do', // Example mapping
    'in-progress': 'In Progress',
    'done': 'Done',
    'review': 'In Review',
    // Add other necessary mappings based on the DEVB project workflow
  };
  return mapping[taskMasterStatus.toLowerCase()];
}

/**
 * Maps Task Master task data to Jira fields for creation/updates.
 * @param {object} taskData - Object containing task fields (e.g., title, description, priority).
 * @param {boolean} isCreate - Flag indicating if mapping is for creation (vs. update).
 * @returns {object} - Object containing Jira fields payload.
 */
function mapTaskToJiraFields(taskData, isCreate = false) {
  const jiraFields = {};

  if (taskData.title) {
    jiraFields.summary = taskData.title;
  }

  // Combine description, details, and testStrategy into Jira description
  let descriptionParts = [];
  if (taskData.description) descriptionParts.push(taskData.description);
  if (taskData.details) descriptionParts.push(`\n\nh3. Details\n${taskData.details}`);
  if (taskData.testStrategy) descriptionParts.push(`\n\nh3. Test Strategy\n${taskData.testStrategy}`);
  if (descriptionParts.length > 0) {
    jiraFields.description = descriptionParts.join('');
  }

  if (taskData.priority) {
    // TODO: Implement robust priority mapping (Task Master name -> Jira name/id)
    const jiraPriorityName = mapPriorityToJira(taskData.priority); // Placeholder
    if (jiraPriorityName) {
      jiraFields.priority = { name: jiraPriorityName };
    }
  }

  // For creation, we might need to set initial status via workflow or specific fields,
  // but typically status is handled via transitions after creation.
  // We also need Project Key and Issue Type during creation.
  if (isCreate) {
     const projectKey = process.env.JIRA_PROJECT_KEY;
     const issueTypeName = process.env.JIRA_ISSUE_TYPE_TASK || 'Task'; // Default to 'Task'
     if (!projectKey) throw new Error('JIRA_PROJECT_KEY is required for creation.');
     jiraFields.project = { key: projectKey };
     jiraFields.issuetype = { name: issueTypeName };
  }


  // TODO: Map other fields if necessary (assignee, labels, custom fields)
  // if (taskData.assignee) jiraFields.assignee = { name: taskData.assignee }; // Or use accountId
  // if (taskData.labels) jiraFields.labels = taskData.labels;

  return jiraFields;
}

// Placeholder for priority mapping logic
function mapPriorityToJira(taskMasterPriority) {
    // Basic example, needs adjustment based on actual Jira project priorities
    const mapping = {
        'low': 'Low',
        'medium': 'Medium',
        'high': 'High',
    };
    return mapping[taskMasterPriority?.toLowerCase()] || 'Medium'; // Default to Medium
}

/**
 * Adds a new task to Jira.
 * @param {object} taskData - Object containing details for the new task (title, description, etc.).
 * @returns {Promise<object>} - A promise resolving to the newly created Task object (mapped from Jira response).
 */
async function addTask(taskData) {
  const projectKey = process.env.JIRA_PROJECT_KEY;
   if (!projectKey) {
    throw new Error('JIRA_PROJECT_KEY environment variable is not set.');
  }

  try {
    const jiraPayload = mapTaskToJiraFields(taskData, true);

    // Ensure essential fields for creation are present
    if (!jiraPayload.summary || !jiraPayload.project || !jiraPayload.issuetype) {
        throw new Error('Missing required fields for Jira issue creation (Summary, Project Key, Issue Type).');
    }

    // Convert payload to JSON string for the tool
    const fieldsJson = JSON.stringify(jiraPayload);

    // TODO: Replace with actual MCP tool call
    // const response = await jiraClient.mcp_mcp_atlassian_jira_create_issue({
    //   project_key: projectKey, // Required by tool schema, even if in fields
    //   issue_type: jiraPayload.issuetype.name, // Required by tool schema
    //   summary: jiraPayload.summary, // Required by tool schema
    //   description: jiraPayload.description, // Optional description
    //   additional_fields: fieldsJson // Pass the rest here
    //   // Assignee could also be a top-level param if needed
    // });
    console.log(`Simulating: mcp_mcp_atlassian_jira_create_issue({ project_key: "${projectKey}", issue_type: "${jiraPayload.issuetype.name}", summary: "...", additional_fields: '${fieldsJson}' })`);
     // Placeholder response - replace with actual call result mapping
    const response = { created_issue: { key: 'DEVB-NEW', fields: { /* ... new issue fields ... */ } } }; // MOCK STRUCTURE

    if (!response || !response.created_issue) {
        throw new Error('Failed to create Jira issue or invalid response received.');
    }

    // Map the created Jira issue back to Task Master format
    const newTask = mapJiraIssueToTask(response.created_issue);
    if (!newTask) {
         throw new Error('Failed to map created Jira issue back to Task Master format.');
    }
    return newTask;

  } catch (error) {
    console.error(`Error adding task to Jira: ${error.message}`, error);
    throw error;
  }
}

/**
 * Updates an existing task in Jira.
 * @param {string} id - The Jira issue key to update.
 * @param {object} taskUpdateData - Object containing fields to update.
 * @returns {Promise<boolean>} - A promise resolving to true if update was successful (Jira API often returns 204 No Content).
 */
async function updateTask(id, taskUpdateData) {
   if (!id) {
    throw new Error('Jira issue key (id) is required for update.');
  }
  if (!taskUpdateData || Object.keys(taskUpdateData).length === 0) {
      console.warn('No update data provided for updateTask.');
      return false; // Or true, depending on desired behavior for no-op
  }

  try {
    const jiraPayload = mapTaskToJiraFields(taskUpdateData, false);

    if (Object.keys(jiraPayload).length === 0) {
         console.warn('No mappable fields found in update data.');
         return false; // Or true?
    }

    // Convert payload to JSON string for the tool
    const fieldsJson = JSON.stringify({ fields: jiraPayload }); // API typically expects updates within a 'fields' object

     // TODO: Replace with actual MCP tool call
    // await jiraClient.mcp_mcp_atlassian_jira_update_issue({
    //   issue_key: id,
    //   fields: fieldsJson
    // });
     console.log(`Simulating: mcp_mcp_atlassian_jira_update_issue({ issue_key: "${id}", fields: '${fieldsJson}' })`);
     // Note: Update often returns no body on success (204 No Content)

    return true; // Assume success if no error thrown

  } catch (error) {
    console.error(`Error updating task ${id} in Jira: ${error.message}`, error);
    throw error;
  }
}

/**
 * Maps a Task Master status name to a potential Jira status name.
 * NOTE: This is used for *finding* the target transition, the actual Jira status name
 * might vary slightly. Adjust based on your Jira project's workflow.
 * @param {string} taskMasterStatus - e.g., 'done', 'pending'
 * @returns {string|null} - Corresponding Jira status name (e.g., 'Done', 'To Do') or null
 */
function mapTaskMasterStatusToJiraStatusName(taskMasterStatus) {
    const mapping = {
        'pending': 'To Do',
        'in-progress': 'In Progress',
        'done': 'Done',
        'review': 'In Review',
        'blocked': 'Blocked', // Example, adjust if needed
        'cancelled': 'Cancelled', // Example, adjust if needed
        'deferred': 'Deferred' // Example, adjust if needed
        // Add others as needed
    };
    return mapping[taskMasterStatus?.toLowerCase()] || null;
}

/**
 * Sets the status of a Jira issue by finding and executing the appropriate transition.
 * @param {string} id - The Jira issue key.
 * @param {string} status - The desired Task Master status (e.g., 'done', 'in-progress').
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
async function setTaskStatus(id, status) {
    if (!id || !status) {
        throw new Error('Jira issue key (id) and target status are required.');
    }

    const targetJiraStatusName = mapTaskMasterStatusToJiraStatusName(status);
    if (!targetJiraStatusName) {
        console.warn(`Cannot map Task Master status "${status}" to a known Jira status name.`);
        return false;
    }

    try {
        // 1. Get available transitions
        // TODO: Replace with actual MCP tool call
        // const transitionsResponse = await jiraClient.mcp_mcp_atlassian_jira_get_transitions({ issue_key: id });
        console.log(`Simulating: mcp_mcp_atlassian_jira_get_transitions({ issue_key: "${id}" })`);
        // MOCK STRUCTURE - replace with actual call result
        const transitionsResponse = {
            transitions: [
                { id: '11', name: 'Start Progress', to: { name: 'In Progress' } },
                { id: '21', name: 'Resolve Issue', to: { name: 'Done' } },
                { id: '31', name: 'Close Issue', to: { name: 'Done' } },
                { id: '41', name: 'Reopen Issue', to: { name: 'To Do' } },
            ]
        };


        if (!transitionsResponse || !Array.isArray(transitionsResponse.transitions)) {
            throw new Error(`Could not fetch or parse transitions for issue ${id}.`);
        }

        // 2. Find the correct transition ID
        // Find a transition whose *destination* status ('to.name') matches the target Jira status name
        const transition = transitionsResponse.transitions.find(
            (t) => t.to && t.to.name && t.to.name.toLowerCase() === targetJiraStatusName.toLowerCase()
        );

        if (!transition) {
            // It's also possible the issue is *already* in the target status. Check current status.
            // const currentIssue = await getTask(id); // Reuse getTask
            // if (currentIssue && currentIssue.status.toLowerCase() === targetJiraStatusName.toLowerCase()) {
            //     console.log(`Issue ${id} is already in status "${targetJiraStatusName}".`);
            //     return true; // Or false depending on desired idempotency behavior
            // }
            console.warn(`No transition found for issue ${id} to reach status "${targetJiraStatusName}". Available transitions lead to: ${transitionsResponse.transitions.map(t => t.to?.name).join(', ')}`);
            // Optional: Check current status here if needed
            return false;
        }

        const transitionId = transition.id;
        console.log(`Found transition ID ${transitionId} ("${transition.name}") to move ${id} to status "${targetJiraStatusName}".`);

        // 3. Execute the transition
        // TODO: Replace with actual MCP tool call
        // await jiraClient.mcp_mcp_atlassian_jira_transition_issue({
        //   issue_key: id,
        //   transition_id: transitionId
        //   // Optionally add comment or fields if the transition requires them
        // });
        console.log(`Simulating: mcp_mcp_atlassian_jira_transition_issue({ issue_key: "${id}", transition_id: "${transitionId}" })`);
        // Transition API usually returns 204 No Content on success

        return true; // Assume success if no error

    } catch (error) {
        console.error(`Error setting status for task ${id} in Jira: ${error.message}`, error);
        throw error;
    }
}

// TODO: Add functions for addSubtask, etc.

module.exports = {
  getTasks,
  getTask,
  addTask,
  updateTask,
  setTaskStatus,
  // Export other functions as they are implemented
}; 