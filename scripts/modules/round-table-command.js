/**
 * Round Table Command Module
 * 
 * Enhanced implementation of the round-table command with interactive prompts
 * and summary extraction capabilities.
 */

import { 
  askQuestion, 
  askConfirmation,
  askSelection,
  askMultipleSelection,
  askQuestionSequence 
} from './prompt-manager.js';
import { generateExpertDiscussion, extractDiscussionSummary } from './ai-services.js';
import { generateSessionId, saveQuestionResponses, saveConceptResponse } from './json-storage.js';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { log } from './utils.js';

/**
 * Process a round table discussion to extract insights and summaries
 * @param {string} discussionContent - Content of the expert discussion
 * @returns {Promise<object>} Processed insights and summaries
 */
export async function processDiscussion(discussionContent) {
  try {
    log('info', 'Processing discussion to extract insights');
    
    // Extract discussion summary and insights using Claude
    const insights = await extractDiscussionSummary(discussionContent);
    
    // Create a formatted response object
    const processed = {
      summary: insights.summary || 'No summary available',
      keyInsights: insights.keyInsights || [],
      challenges: insights.challenges || [],
      actionItems: insights.actionItems || [],
      extractedAt: new Date().toISOString(),
      rawContent: discussionContent
    };
    
    return processed;
  } catch (error) {
    log('error', `Error processing discussion: ${error.message}`);
    
    // Return a default structure if processing fails
    return {
      summary: 'Error extracting summary. Please review the full discussion.',
      keyInsights: ['Unable to extract key insights due to an error'],
      challenges: ['Unable to extract challenges due to an error'],
      actionItems: ['Review the full discussion for action items'],
      extractedAt: new Date().toISOString(),
      rawContent: discussionContent,
      error: error.message
    };
  }
}

/**
 * Save extracted insights to a JSON file
 * @param {object} insights - Extracted insights from the discussion
 * @param {string} outputPath - Path to save the insights
 * @returns {Promise<string>} Path where insights were saved
 */
export async function saveDiscussionInsights(insights, outputPath) {
  try {
    // Create the directory if it doesn't exist
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      log('info', `Created directory: ${outputDir}`);
    }
    
    // Add metadata to the insights
    const withMetadata = {
      ...insights,
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0'
      }
    };
    
    // Write to file
    fs.writeFileSync(outputPath, JSON.stringify(withMetadata, null, 2), 'utf8');
    log('info', `Successfully saved insights to ${outputPath}`);
    
    return outputPath;
  } catch (error) {
    log('error', `Error saving discussion insights: ${error.message}`);
    throw error;
  }
}

/**
 * Interactive round table command implementation
 * @param {object} options - Command options
 * @param {object} display - Display manager (if available)
 * @returns {Promise<object>} - Result of the operation
 */
export async function interactiveRoundTable(options, display) {
  try {
    // Generate a unique session ID for this round table discussion
    const sessionId = generateSessionId();
    
    // Initialize result object
    const result = {
      sessionId,
      conceptFile: options.conceptFile || 'prd/concept.txt',
      outputFile: options.outputFile || options.output || 'prd/discussion.txt',
      insightsFile: options.insightsFile || '',
      participants: [],
      hasDiscussion: false,
      summaryExtracted: false,
      extractSummary: options.extractSummary || options.summary || false
    };
    
    // Display welcome message using the display manager if available
    if (display) {
      display.log('info', 'Starting interactive round table discussion...');
    } else {
      console.log(chalk.blue('Starting interactive round table discussion...'));
    }
    
    // Step 1: Get concept file path - use the one provided or ask
    if (!options.conceptFile) {
      const defaultPath = 'prd/concept.txt';
      const useDefault = await askConfirmation(
        `Use default concept file path (${defaultPath})? `, 
        true
      );
      
      if (useDefault) {
        result.conceptFile = defaultPath;
      } else {
        result.conceptFile = await askQuestion(
          'Enter path to concept file: ',
          defaultPath
        );
      }
    }
    
    // Verify concept file exists
    if (!fs.existsSync(result.conceptFile)) {
      throw new Error(`Concept file not found: ${result.conceptFile}`);
    }
    
    // Step 2: Get participants - use provided list or ask
    if (options.participants) {
      result.participants = options.participants
        .split(',')
        .map(p => p.trim());
    } else {
      // Provide some examples
      const examples = [
        'Product Manager',
        'Software Engineer',
        'UX Designer',
        'QA Engineer',
        'Security Expert',
        'DevOps Specialist',
        'Marketing Director'
      ];
      
      console.log(chalk.yellow('\nSuggested participant roles:'));
      console.log(examples.map(ex => chalk.white(`- ${ex}`)).join('\n'));
      
      const addParticipants = async () => {
        const participants = [];
        let addAnother = true;
        
        while (addAnother) {
          const participant = await askQuestion(
            `Enter participant ${participants.length + 1} name/role: `,
            ''
          );
          
          if (participant.trim()) {
            participants.push(participant.trim());
          }
          
          if (participants.length >= 2) {
            addAnother = await askConfirmation('Add another participant? ', false);
          }
        }
        
        return participants;
      };
      
      result.participants = await addParticipants();
      
      // Ensure we have at least 2 participants
      if (result.participants.length < 2) {
        throw new Error('At least 2 participants are required for a round table discussion');
      }
    }
    
    // Step 3: Get output file path
    if (!options.outputFile && !options.output) {
      const defaultOutput = 'prd/discussion.txt';
      const useDefaultOutput = await askConfirmation(
        `Use default output file path (${defaultOutput})? `,
        true
      );
      
      if (useDefaultOutput) {
        result.outputFile = defaultOutput;
      } else {
        result.outputFile = await askQuestion(
          'Enter output file path: ',
          defaultOutput
        );
      }
    }
    
    // Step 4: Confirm settings before proceeding
    console.log(chalk.yellow('\nRound table discussion settings:'));
    console.log(chalk.white(`Concept file: ${result.conceptFile}`));
    console.log(chalk.white(`Participants: ${result.participants.join(', ')}`));
    console.log(chalk.white(`Output file: ${result.outputFile}`));
    
    const proceed = await askConfirmation('Proceed with these settings? ', true);
    if (!proceed) {
      throw new Error('Round table discussion cancelled by user');
    }
    
    // Step 5: Run the discussion generation
    if (display) {
      display.log('info', 'Generating expert discussion...');
    } else {
      console.log(chalk.blue('\nGenerating expert discussion...'));
    }
    
    // Make sure output directory exists
    const outputDir = path.dirname(result.outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      log('info', `Created directory: ${outputDir}`);
    }
    
    // Read the concept file
    const conceptContent = fs.readFileSync(result.conceptFile, 'utf8');
    
    // Generate the expert discussion
    const discussionContent = await generateExpertDiscussion(conceptContent, result.participants);
    
    // Save the discussion to file
    fs.writeFileSync(result.outputFile, discussionContent, 'utf8');
    result.hasDiscussion = true;
    
    // Step 6: Extract insights and summaries if option is set or user confirms
    let shouldExtractSummary = result.extractSummary;
    
    // If it wasn't set through options, ask the user
    if (!shouldExtractSummary && options.interactive !== false) {
      shouldExtractSummary = await askConfirmation(
        'Extract key insights and summary from the discussion? ',
        true
      );
    }
    
    if (shouldExtractSummary) {
      if (display) {
        display.log('info', 'Extracting key insights from discussion...');
      } else {
        console.log(chalk.blue('\nExtracting key insights from discussion...'));
      }
      
      // Process the discussion to extract insights
      const insights = await processDiscussion(discussionContent);
      
      // Generate insights file path if not provided
      const insightsFilePath = result.insightsFile || options.insightsFile || 
        result.outputFile.replace(/\.txt$/, '-insights.json');
      
      // Save insights to file
      await saveDiscussionInsights(insights, insightsFilePath);
      result.insightsFile = insightsFilePath;
      result.summaryExtracted = true;
      result.insights = insights;
      
      // Display insights only if not using the command-display system
      // since we'll display them through its templates later
      if (!display && options.quiet !== true) {
        // Display a simplified version of insights in the console
        console.log(chalk.green('\nKey Insights Extracted:'));
        console.log(chalk.white('\nSummary:'));
        console.log(chalk.white(insights.summary));
        
        console.log(chalk.white('\nKey Insights:'));
        insights.keyInsights.forEach((insight, i) => {
          console.log(chalk.white(`${i+1}. ${insight}`));
        });
        
        console.log(chalk.white('\nChallenges:'));
        insights.challenges.forEach((challenge, i) => {
          console.log(chalk.white(`${i+1}. ${challenge}`));
        });
        
        if (insights.actionItems && insights.actionItems.length > 0) {
          console.log(chalk.white('\nAction Items:'));
          insights.actionItems.forEach((item, i) => {
            console.log(chalk.white(`${i+1}. ${item}`));
          });
        }
        
        console.log(chalk.green(`\nFull insights saved to: ${insightsFilePath}`));
      }
    }
    
    // Step 7: Ask if user wants to refine the concept with insights
    const shouldRefine = await askConfirmation(
      'Apply discussion recommendations to the concept file? ',
      false
    );
    
    if (shouldRefine) {
      // Import the refine function dynamically to avoid circular dependencies
      const { refineProductConcept } = await import('./task-manager.js');
      await refineProductConcept(result.conceptFile, '', result.outputFile, result.conceptFile);
      result.conceptRefined = true;
    }
    
    // Save responses for future reference
    await saveQuestionResponses('round-table', sessionId, {
      conceptFile: result.conceptFile,
      outputFile: result.outputFile,
      participants: result.participants,
      refineConcept: shouldRefine,
      summaryExtracted: shouldExtractSummary,
      insightsFile: result.insightsFile
    });
    
    // Return the result
    return result;
  } catch (error) {
    log('error', `Error in interactiveRoundTable: ${error.message}`);
    throw error;
  }
}

/**
 * Legacy round table command implementation for compatibility
 * @param {string} conceptFile - Path to concept file
 * @param {Array<string>} participants - List of participants
 * @param {string} outputFile - Path to output file
 * @param {boolean} refineConcept - Whether to refine the concept
 * @returns {Promise<object>} - Result of the operation
 */
export async function simulateRoundTable(conceptFile, participants, outputFile, refineConcept = false) {
  try {
    log('info', `Simulating round table discussion for concept in ${conceptFile}`);
    
    // Check if concept file exists
    if (!fs.existsSync(conceptFile)) {
      throw new Error(`Concept file not found: ${conceptFile}`);
    }
    
    // Create the output directory if it doesn't exist
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      log('info', `Created directory: ${outputDir}`);
    }
    
    // Generate a session ID for this discussion
    const sessionId = generateSessionId();
    
    // Read the concept
    const conceptContent = fs.readFileSync(conceptFile, 'utf8');
    
    // Generate the discussion
    const discussionContent = await generateExpertDiscussion(conceptContent, participants);
    
    // Write to file
    fs.writeFileSync(outputFile, discussionContent, 'utf8');
    log('info', `Successfully saved discussion to ${outputFile}`);
    
    // Optionally apply recommendations to concept
    let conceptRefined = false;
    if (refineConcept) {
      log('info', 'Applying discussion recommendations to concept');
      const { refineProductConcept } = await import('./task-manager.js');
      await refineProductConcept(conceptFile, '', discussionContent, conceptFile);
      log('info', 'Successfully refined concept with discussion recommendations');
      conceptRefined = true;
    }
    
    // Save responses for future reference
    await saveQuestionResponses('round-table', sessionId, {
      conceptFile,
      outputFile,
      participants,
      refineConcept
    });
    
    // Display success message
    console.log(chalk.green(`\nExpert discussion generated and saved to ${outputFile}`));
    console.log(chalk.blue('\nNext steps:'));
    console.log(chalk.white(`1. Review the discussion in ${outputFile}`));
    if (refineConcept) {
      console.log(chalk.white(`2. The concept file (${conceptFile}) has been updated with recommendations`));
      console.log(chalk.white(`3. Run 'task-master generate-prd-file --concept-file=${conceptFile}' to create a PRD`));
    } else {
      console.log(chalk.white(`2. Run 'task-master refine-concept --concept-file=${conceptFile} --discussion-file=${outputFile}' to apply recommendations`));
      console.log(chalk.white(`3. Or proceed directly to 'task-master generate-prd-file --concept-file=${conceptFile}'`));
    }
    
    // Return result object
    return {
      sessionId,
      conceptFile,
      outputFile,
      participants,
      hasDiscussion: true,
      conceptRefined
    };
  } catch (error) {
    log('error', `Error in simulateRoundTable: ${error.message}`);
    throw error;
  }
}

export default {
  interactiveRoundTable,
  simulateRoundTable,
  processDiscussion,
  saveDiscussionInsights
}; 