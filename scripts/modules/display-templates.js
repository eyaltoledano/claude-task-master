/**
 * Display Templates Module
 * 
 * Provides standardized templates for displaying various types of content
 * in a consistent format throughout the application.
 */

import displayUtils from './display-utils.js';

/**
 * Template for displaying a concept summary
 * @param {object} concept - Concept data
 * @returns {string} Formatted concept summary
 */
export function conceptSummary(concept) {
  const title = concept.title || 'Product Concept';
  
  // Create the header
  const header = displayUtils.header(title, { 
    borderColor: 'blue',
    padding: 1
  });
  
  // Format creation date if available
  const createdAt = concept.createdAt 
    ? `Created: ${new Date(concept.createdAt).toLocaleString()}`
    : '';
  
  // Create metadata section
  const metadata = displayUtils.formatKeyValue({
    'ID': concept.id || 'N/A',
    'Status': concept.status || 'Draft',
    ...createdAt && { 'Created': createdAt }
  }, { indent: 2 });
  
  // Format summary content
  const summaryContent = concept.summary || concept.content?.substring(0, 200) + '...' || '';
  
  // Assemble the full template
  return `
${header}

${displayUtils.sectionHeader('Metadata')}
${metadata}

${displayUtils.sectionHeader('Summary')}
  ${summaryContent}

${displayUtils.divider()}
`;
}

/**
 * Template for displaying an expert recommendation
 * @param {object} recommendation - Recommendation data
 * @returns {string} Formatted recommendation
 */
export function expertRecommendation(recommendation) {
  const title = `Expert Recommendation: ${recommendation.expert || 'Anonymous'}`;
  
  // Create the header
  const header = displayUtils.box(displayUtils.colors.highlight(title), {
    borderColor: 'yellow',
    padding: 1
  });
  
  // Format the recommendation content
  const content = recommendation.content || '';
  
  // Format key points if available
  const keyPoints = recommendation.keyPoints 
    ? `\n${displayUtils.sectionHeader('Key Points')}\n${displayUtils.formatList(recommendation.keyPoints)}`
    : '';
  
  // Assemble the full template
  return `
${header}

${content}
${keyPoints}

${displayUtils.divider()}
`;
}

/**
 * Template for displaying task details
 * @param {object} task - Task data
 * @returns {string} Formatted task details
 */
export function taskDetails(task) {
  const title = `Task #${task.id}: ${task.title}`;
  
  // Create the header
  const header = displayUtils.header(title, {
    borderColor: task.status === 'done' ? 'green' : 'blue',
    padding: 1
  });
  
  // Format the task metadata
  const metadata = displayUtils.formatKeyValue({
    'Status': task.status || 'pending',
    'Priority': task.priority || 'medium',
    'Dependencies': Array.isArray(task.dependencies) 
      ? task.dependencies.join(', ') || 'None'
      : 'None'
  }, { indent: 2 });
  
  // Format description and details
  const description = task.description || '';
  const details = task.details || '';
  
  // Format subtasks if available
  let subtasksSection = '';
  if (task.subtasks && task.subtasks.length > 0) {
    const headers = ['ID', 'Title', 'Status'];
    const rows = task.subtasks.map(st => [
      st.id,
      st.title,
      st.status
    ]);
    
    subtasksSection = `
${displayUtils.sectionHeader('Subtasks')}
${displayUtils.createTable(headers, rows)}
`;
  }
  
  // Format test strategy if available
  const testStrategy = task.testStrategy
    ? `\n${displayUtils.sectionHeader('Test Strategy')}\n  ${task.testStrategy}`
    : '';
  
  // Assemble the full template
  return `
${header}

${displayUtils.sectionHeader('Description')}
  ${description}

${displayUtils.sectionHeader('Details')}
  ${details}
${subtasksSection}${testStrategy}

${displayUtils.divider()}
`;
}

/**
 * Template for displaying command help
 * @param {object} command - Command data
 * @returns {string} Formatted command help
 */
export function commandHelp(command) {
  const title = `Command: ${command.name}`;
  
  // Create the header
  const header = displayUtils.header(title, {
    borderColor: 'cyan',
    padding: 1
  });
  
  // Format description
  const description = command.description || '';
  
  // Format usage
  const usage = command.usage || `task-master ${command.name} [options]`;
  
  // Format options if available
  let optionsSection = '';
  if (command.options && command.options.length > 0) {
    const optionsList = command.options.map(opt => 
      `${opt.flags}\n    ${opt.description}${opt.default ? ` (default: ${opt.default})` : ''}`
    );
    optionsSection = `
${displayUtils.sectionHeader('Options')}
${optionsList.join('\n\n')}`;
  }
  
  // Format examples if available
  let examplesSection = '';
  if (command.examples && command.examples.length > 0) {
    examplesSection = `
${displayUtils.sectionHeader('Examples')}
${displayUtils.formatList(command.examples, { indent: 2, color: 'info' })}`;
  }
  
  // Assemble the full template
  return `
${header}

${displayUtils.sectionHeader('Description')}
  ${description}

${displayUtils.sectionHeader('Usage')}
  ${displayUtils.colors.primary(usage)}
${optionsSection}${examplesSection}

${displayUtils.divider()}
`;
}

/**
 * Template for displaying error messages
 * @param {object} error - Error data
 * @returns {string} Formatted error message
 */
export function errorMessage(error) {
  const title = error.title || 'Error Occurred';
  
  // Create the header
  const header = displayUtils.box(displayUtils.colors.error(title), {
    borderColor: 'red',
    padding: 1
  });
  
  // Format error message
  const message = error.message || error.toString();
  
  // Format stack trace if available and debug mode is on
  const stack = (error.stack && process.env.DEBUG === 'true')
    ? `\n${displayUtils.sectionHeader('Stack Trace')}\n  ${error.stack}`
    : '';
  
  // Format troubleshooting tips if available
  const tips = error.tips
    ? `\n${displayUtils.sectionHeader('Troubleshooting')}\n${displayUtils.formatList(error.tips, { indent: 2 })}`
    : '';
  
  // Assemble the full template
  return `
${header}

${displayUtils.colors.error(message)}
${stack}${tips}

${displayUtils.divider()}
`;
}

/**
 * Template for displaying success messages
 * @param {object} data - Success data
 * @returns {string} Formatted success message
 */
export function successMessage(data) {
  const title = data.title || 'Operation Successful';
  
  // Create the header
  const header = displayUtils.box(displayUtils.colors.success(title), {
    borderColor: 'green',
    padding: 1
  });
  
  // Format success message
  const message = data.message || '';
  
  // Format details if available
  const details = data.details
    ? `\n${displayUtils.sectionHeader('Details')}\n  ${data.details}`
    : '';
  
  // Format next steps if available
  const nextSteps = data.nextSteps
    ? `\n${displayUtils.sectionHeader('Next Steps')}\n${displayUtils.formatList(data.nextSteps, { indent: 2 })}`
    : '';
  
  // Assemble the full template
  return `
${header}

${displayUtils.colors.success(message)}
${details}${nextSteps}

${displayUtils.divider()}
`;
}

/**
 * Template for displaying JSON data in a readable format
 * @param {object} data - JSON data to display
 * @param {string} title - Optional title
 * @returns {string} Formatted JSON display
 */
export function jsonDisplay(data, title = 'JSON Data') {
  // Create the header
  const header = displayUtils.sectionHeader(title);
  
  // Format the JSON data
  const jsonContent = displayUtils.formatJSON(data);
  
  // Assemble the full template
  return `
${header}
${jsonContent}

${displayUtils.divider()}
`;
}

/**
 * Template for displaying progress of long-running operations
 * @param {object} progress - Progress data
 * @returns {string} Formatted progress display
 */
export function progressDisplay(progress) {
  const title = progress.title || 'Operation in Progress';
  
  // Create the header
  const header = displayUtils.sectionHeader(title);
  
  // Format the current step
  const step = progress.step 
    ? `Step ${progress.step}/${progress.totalSteps}: ${progress.currentOperation || ''}`
    : progress.currentOperation || '';
  
  // Create progress bar
  const percent = progress.percent || 0;
  const progressBar = displayUtils.progressBar(percent);
  
  // Format estimated time remaining if available
  const eta = progress.eta
    ? `\nEstimated time remaining: ${progress.eta}`
    : '';
  
  // Assemble the full template
  return `
${header}
${step}
${progressBar}${eta}

${displayUtils.divider()}
`;
}

/**
 * Template for displaying discussion insights
 * @param {object} insights - Insights data
 * @returns {string} Formatted insights display
 */
export function discussionInsights(insights) {
  // Handle missing insights
  if (!insights) {
    return displayUtils.box(
      displayUtils.colors.error('No insights available'),
      { borderColor: 'red', padding: 1 }
    );
  }
  
  // Create the header
  const header = displayUtils.header('Discussion Insights', {
    borderColor: 'cyan',
    padding: 1
  });
  
  // Format summary
  const summary = insights.summary || 'No summary available';
  
  // Format key insights
  const keyInsightsContent = Array.isArray(insights.keyInsights) && insights.keyInsights.length > 0
    ? displayUtils.formatList(insights.keyInsights, { indent: 2, color: 'info' })
    : '  No key insights extracted';
  
  // Format challenges
  const challengesContent = Array.isArray(insights.challenges) && insights.challenges.length > 0
    ? displayUtils.formatList(insights.challenges, { indent: 2, color: 'warning' })
    : '  No challenges extracted';
  
  // Format action items if available
  let actionItemsSection = '';
  if (Array.isArray(insights.actionItems) && insights.actionItems.length > 0) {
    actionItemsSection = `
${displayUtils.sectionHeader('Action Items')}
${displayUtils.formatList(insights.actionItems, { indent: 2, color: 'success' })}`;
  }
  
  // Format metadata
  const metadata = insights.extractedAt
    ? `\nExtracted at: ${new Date(insights.extractedAt).toLocaleString()}`
    : '';
  
  // Assemble the full template
  return `
${header}

${displayUtils.sectionHeader('Executive Summary')}
  ${summary}

${displayUtils.sectionHeader('Key Insights')}
${keyInsightsContent}

${displayUtils.sectionHeader('Challenges')}
${challengesContent}
${actionItemsSection}

${displayUtils.divider()}
${metadata}
`;
}

/**
 * Template for displaying a refined concept
 * @param {object} concept - Refined concept data
 * @returns {string} Formatted refined concept display
 */
export function refinedConcept(concept) {
  // Handle missing concept
  if (!concept) {
    return displayUtils.box(
      displayUtils.colors.error('No concept data available'),
      { borderColor: 'red', padding: 1 }
    );
  }
  
  // Create the header
  const title = concept.title || 'Refined Product Concept';
  const header = displayUtils.header(title, {
    borderColor: 'green',
    padding: 1
  });
  
  // Format metadata
  const metadata = displayUtils.formatKeyValue({
    'Original Concept': concept.refinedFrom || 'N/A',
    'Output File': concept.sourceFile || 'N/A',
    'Refined At': concept.generatedAt ? new Date(concept.generatedAt).toLocaleString() : 'N/A'
  }, { indent: 2 });
  
  // Format refinement sources
  let sourcesContent = '';
  if (concept.discussionFile || concept.prompt) {
    const sources = [];
    if (concept.discussionFile) sources.push(`Discussion: ${concept.discussionFile}`);
    if (concept.prompt) sources.push(`Prompt: ${concept.prompt}`);
    
    sourcesContent = `
${displayUtils.sectionHeader('Refinement Sources')}
${displayUtils.formatList(sources, { indent: 2 })}`;
  }
  
  // Format content preview (first few lines)
  const contentPreview = concept.content 
    ? concept.content.split('\n').slice(0, 5).join('\n') + (concept.content.split('\n').length > 5 ? '\n...' : '')
    : 'No content available';
  
  // Assemble the full template
  return `
${header}

${displayUtils.sectionHeader('Metadata')}
${metadata}
${sourcesContent}

${displayUtils.sectionHeader('Content Preview')}
  ${contentPreview}

${displayUtils.divider()}
`;
}

/**
 * Export all display templates
 */
export default {
  conceptSummary,
  expertRecommendation,
  taskDetails,
  commandHelp,
  errorMessage,
  successMessage,
  jsonDisplay,
  progressDisplay,
  discussionInsights,
  refinedConcept
}; 