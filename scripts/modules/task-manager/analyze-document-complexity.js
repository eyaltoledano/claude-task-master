import { z } from 'zod';
import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import { 
  readFile, 
  log as consoleLog 
} from '../utils.js';
import { generateObjectService } from '../ai-services-unified.js';
import { startLoadingIndicator, stopLoadingIndicator } from '../ui.js';

// Define Zod schema for validating AI output
const DocComplexitySchema = z.object({
  complexity: z.enum(['low', 'medium', 'high', 'very-high']).describe('Overall document complexity assessment'),
  numTasks: z.number().int().min(1).max(30).describe('Recommended number of tasks'),
  reasonForEstimate: z.string().describe('Reasoning behind task count recommendation'),
  keyFeatures: z.array(z.string()).describe('Key functionality points identified in the document'),
  suggestedTaskCategories: z.array(z.string()).describe('Suggested task categories or groupings')
});

/**
 * Analyzes document complexity and recommends task count
 * @param {string} documentPath - Path to the document to analyze
 * @param {Object} options - Configuration options
 * @param {boolean} [options.useResearch=true] - Whether to use research model
 * @param {Object} [options.context={}] - Context object containing session and projectRoot
 * @param {string} [options.outputFormat='text'] - Output format (text or json)
 * @returns {Object} Document complexity analysis result
 */
async function analyzeDocumentComplexity(
  documentPath,
  options = {}
) {
  const { 
    useResearch = true, 
    context = {}, 
    outputFormat = 'text'
  } = options;
  
  const { session, mcpLog, projectRoot } = context;
  const isMCP = !!mcpLog;

  // Create unified logging function
  const logFn = isMCP
    ? mcpLog
    : {
        info: (...args) => consoleLog('info', ...args),
        warn: (...args) => consoleLog('warn', ...args),
        error: (...args) => consoleLog('error', ...args),
        debug: (...args) => consoleLog('debug', ...args),
        success: (...args) => consoleLog('success', ...args)
      };

  let loadingIndicator = null;

  try {
    // Read document content
    logFn.info(`Analyzing document: ${documentPath}`);
    const documentContent = await readFile(documentPath);
    
    if (!documentContent) {
      throw new Error(`Unable to read document: ${documentPath}`);
    }

    // Show loading indicator - only in text mode
    if (outputFormat === 'text') {
      loadingIndicator = startLoadingIndicator(
        `Analyzing document complexity using ${useResearch ? 'Research' : 'Main'} AI...`
      );
    }

    // System prompt
    const systemPrompt = 
      "You are a professional project management assistant skilled at analyzing document complexity and breaking requirements into manageable tasks. Based on the provided document content, estimate the number of development tasks needed.";

    // User prompt
    const userPrompt = `Please analyze the following document content, assess its complexity, and recommend an appropriate number of tasks:

${documentContent}

Consider the following factors:
1. Document length and complexity
2. Number of features and requirements
3. Technical complexity
4. Dependencies
5. Implementation difficulty

Based on your analysis, provide:
- Document complexity rating (low/medium/high/very-high)
- Recommended number of tasks (integer)
- Reasoning for your task count recommendation
- Key functionality points identified (max 10)
- Suggested task categories or groupings

Ensure your response follows the required JSON format.`;

    // Call AI service
    const serviceRole = useResearch ? 'research' : 'main';
    
    const analysisResult = await generateObjectService({
      role: serviceRole,
      session: session,
      projectRoot: projectRoot,
      schema: DocComplexitySchema,
      objectName: 'documentComplexity',
      systemPrompt: systemPrompt,
      prompt: userPrompt
    });

    logFn.success('Document analysis complete');

    // Format output results - only in text mode
    if (outputFormat === 'text') {
      const complexityColors = {
        'low': 'green',
        'medium': 'yellow',
        'high': 'magenta',
        'very-high': 'red'
      };
      
      const complexityColor = complexityColors[analysisResult.complexity] || 'white';
      
      console.log(
        boxen(
          chalk.white.bold(`Document Complexity Analysis Results`) +
          '\n\n' +
          chalk.white(`File: ${path.basename(documentPath)}`) +
          '\n' +
          chalk.white(`Complexity: ${chalk[complexityColor](analysisResult.complexity)}`) +
          '\n' +
          chalk.white(`Recommended Task Count: ${chalk.cyan(analysisResult.numTasks)}`) +
          '\n\n' +
          chalk.white.bold('Reasoning:') +
          '\n' +
          chalk.white(analysisResult.reasonForEstimate) +
          '\n\n' +
          chalk.white.bold('Key Features:') +
          '\n' +
          analysisResult.keyFeatures.map(f => `- ${chalk.cyan(f)}`).join('\n') +
          '\n\n' +
          chalk.white.bold('Suggested Task Categories:') +
          '\n' +
          analysisResult.suggestedTaskCategories.map(c => `- ${chalk.yellow(c)}`).join('\n'),
          { padding: 1, borderColor: 'blue', borderStyle: 'round' }
        )
      );
    }

    return analysisResult;
  } catch (error) {
    if (loadingIndicator) {
      stopLoadingIndicator(loadingIndicator);
    }
    
    logFn.error(`Error analyzing document: ${error.message}`);
    
    if (outputFormat === 'text') {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    
    throw error;
  } finally {
    if (loadingIndicator) {
      stopLoadingIndicator(loadingIndicator);
    }
  }
}

export default analyzeDocumentComplexity;