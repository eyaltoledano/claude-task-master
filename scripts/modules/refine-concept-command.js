/**
 * Refine Concept Command Module
 * 
 * Enhanced implementation of the refine-concept command with interactive prompts
 * and immediate feedback capabilities.
 */

import { 
  askQuestion, 
  askConfirmation,
  askSelection,
  askMultipleSelection,
  askQuestionSequence 
} from './prompt-manager.js';
import { generateConceptRefinement } from './ai-services.js';
import { generateSessionId, saveQuestionResponses, saveConceptResponse } from './json-storage.js';
import refinementQuestions from './refinement-questions.js';
import refinementFeedback from './refinement-feedback.js';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { log } from './utils.js';

/**
 * Save a version of a concept for history tracking
 * @param {string} conceptFile - Path to the concept file
 * @param {string} content - Content to save
 * @param {string} reason - Reason for the change
 * @returns {string} Path to the saved version
 */
function saveConceptVersion(conceptFile, content, reason) {
  try {
    // Create versions directory next to the concept file
    const basePath = path.dirname(conceptFile);
    const versionsDir = path.join(basePath, 'versions');
    
    if (!fs.existsSync(versionsDir)) {
      fs.mkdirSync(versionsDir, { recursive: true });
    }
    
    // Generate a timestamp and clean filename
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const baseFilename = path.basename(conceptFile, path.extname(conceptFile));
    const versionFilename = `${baseFilename}_${timestamp}${path.extname(conceptFile)}`;
    const versionPath = path.join(versionsDir, versionFilename);
    
    // Add version metadata as a comment at the top
    const metadataComment = 
      `<!--\nVersion: ${timestamp}\nReason: ${reason}\nOriginal file: ${conceptFile}\n-->\n\n`;
    
    // Write the content with metadata
    fs.writeFileSync(versionPath, metadataComment + content);
    
    log('info', `Saved concept version to ${versionPath}`);
    return versionPath;
  } catch (error) {
    log('warn', `Failed to save concept version: ${error.message}`);
    return null;
  }
}

/**
 * Generate a diff between two text contents
 * @param {string} originalContent - Original content
 * @param {string} newContent - New content
 * @returns {string} Formatted diff output
 */
function generateTextDiff(originalContent, newContent) {
  const originalLines = originalContent.split('\n');
  const newLines = newContent.split('\n');
  
  const diff = [];
  let i = 0, j = 0;
  
  // Very simple diff algorithm that works for our purposes
  while (i < originalLines.length || j < newLines.length) {
    if (i < originalLines.length && j < newLines.length && originalLines[i] === newLines[j]) {
      // Same line
      diff.push({ type: 'same', content: originalLines[i] });
      i++;
      j++;
    } else {
      // Try to find the next matching line
      let foundMatch = false;
      
      // Look ahead in the new content to see if we can find a match for the current original line
      for (let lookAhead = 1; lookAhead <= 3 && j + lookAhead < newLines.length; lookAhead++) {
        if (i < originalLines.length && originalLines[i] === newLines[j + lookAhead]) {
          // Found a match ahead in the new content, there are additions
          for (let k = 0; k < lookAhead; k++) {
            diff.push({ type: 'added', content: newLines[j + k] });
          }
          
          diff.push({ type: 'same', content: originalLines[i] });
          i++;
          j += lookAhead + 1;
          foundMatch = true;
          break;
        }
      }
      
      if (!foundMatch) {
        // Look ahead in the original content to see if we can find a match for the current new line
        for (let lookAhead = 1; lookAhead <= 3 && i + lookAhead < originalLines.length; lookAhead++) {
          if (j < newLines.length && originalLines[i + lookAhead] === newLines[j]) {
            // Found a match ahead in the original content, there are removals
            for (let k = 0; k < lookAhead; k++) {
              diff.push({ type: 'removed', content: originalLines[i + k] });
            }
            
            diff.push({ type: 'same', content: newLines[j] });
            i += lookAhead + 1;
            j++;
            foundMatch = true;
            break;
          }
        }
      }
      
      if (!foundMatch) {
        // No match found within the lookahead, treat as a replacement
        if (i < originalLines.length) {
          diff.push({ type: 'removed', content: originalLines[i] });
          i++;
        }
        
        if (j < newLines.length) {
          diff.push({ type: 'added', content: newLines[j] });
          j++;
        }
      }
    }
  }
  
  // Format the diff output
  const formattedDiff = diff.map(line => {
    if (line.type === 'same') {
      return `  ${line.content}`;
    } else if (line.type === 'added') {
      return chalk.green(`+ ${line.content}`);
    } else if (line.type === 'removed') {
      return chalk.red(`- ${line.content}`);
    }
  }).join('\n');
  
  return formattedDiff;
}

/**
 * Show a preview of the changes to be applied
 * @param {string} originalContent - Original content
 * @param {string} newContent - New content
 * @returns {boolean} Whether the user accepted the changes
 */
async function showChangePreview(originalContent, newContent) {
  // Generate and display diff
  console.log(chalk.cyan('\n=== Change Preview ==='));
  console.log('Legend: ' + chalk.green('+ Added') + ' ' + chalk.red('- Removed') + '\n');
  
  const diffOutput = generateTextDiff(originalContent, newContent);
  console.log(diffOutput);
  
  // Metrics about the changes
  const originalLines = originalContent.split('\n').length;
  const newLines = newContent.split('\n').length;
  const lineChange = newLines - originalLines;
  
  console.log(chalk.cyan('\n=== Change Summary ==='));
  console.log(`Lines: ${originalLines} → ${newLines} (${lineChange > 0 ? '+' : ''}${lineChange})`);
  
  // Get sections
  const originalSections = extractSections(originalContent);
  const newSections = extractSections(newContent);
  
  // Find new, removed, and modified sections
  const addedSections = newSections.filter(s => !originalSections.includes(s));
  const removedSections = originalSections.filter(s => !newSections.includes(s));
  
  if (addedSections.length > 0) {
    console.log(chalk.green('\nNew sections:'));
    addedSections.forEach(s => console.log(chalk.green(` + ${s}`)));
  }
  
  if (removedSections.length > 0) {
    console.log(chalk.red('\nRemoved sections:'));
    removedSections.forEach(s => console.log(chalk.red(` - ${s}`)));
  }
  
  // Ask for confirmation to apply changes
  return await askConfirmation('\nApply these changes? ', true);
}

/**
 * Interactive refine concept command implementation
 * @param {object} options - Command options
 * @param {object} display - Display manager (if available)
 * @returns {Promise<object>} - Result of the operation
 */
export async function interactiveRefineConcept(options, display) {
  try {
    // Generate a unique session ID for this refinement session
    const sessionId = generateSessionId();
    
    // Initialize result object
    const result = {
      sessionId,
      conceptFile: options.conceptFile || 'prd/concept.txt',
      outputFile: options.outputFile || options.output || options.conceptFile || 'prd/concept.txt',
      discussionFile: options.discussionFile || '',
      prompt: options.prompt || '',
      hasRefinement: false,
      conceptId: `concept_${Date.now()}`
    };
    
    // Additional options with defaults
    const trackHistory = options.trackHistory !== false;  // True by default
    const showPreview = options.preview !== false;        // True by default
    const skipFeedback = options.skipFeedback === true;   // False by default
    
    // Display welcome message using the display manager if available
    if (display) {
      display.log('info', 'Starting interactive concept refinement...');
    } else {
      console.log(chalk.blue('Starting interactive concept refinement...'));
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
    
    // Read the concept file
    const conceptContent = fs.readFileSync(result.conceptFile, 'utf8');
    
    // If history tracking is enabled, save the original version
    let originalVersionPath = null;
    if (trackHistory) {
      originalVersionPath = saveConceptVersion(
        result.conceptFile, 
        conceptContent, 
        'Original version before refinement'
      );
      
      if (originalVersionPath) {
        console.log(chalk.blue(`Original version saved to: ${originalVersionPath}`));
      }
    }
    
    // Step 2: Get output file path if different from concept file
    if (!options.outputFile && !options.output) {
      const useConceptFile = await askConfirmation(
        `Save refined concept to the same file (${result.conceptFile})? `,
        true
      );
      
      if (!useConceptFile) {
        result.outputFile = await askQuestion(
          'Enter output file path: ',
          result.conceptFile.replace('.txt', '-refined.txt')
        );
      }
    }
    
    // Step 3: Get refinement input sources
    // First, check if we have a discussion file
    let discussionContent = '';
    if (options.discussionFile) {
      result.discussionFile = options.discussionFile;
      
      if (fs.existsSync(result.discussionFile)) {
        discussionContent = fs.readFileSync(result.discussionFile, 'utf8');
        if (display) {
          display.log('info', `Loaded discussion from ${result.discussionFile}`);
        } else {
          console.log(chalk.blue(`\nLoaded discussion from ${result.discussionFile}`));
        }
      } else {
        throw new Error(`Discussion file not found: ${result.discussionFile}`);
      }
    } else {
      // Ask about using a discussion file
      const useDiscussion = await askConfirmation(
        'Use a discussion file for refinement? ',
        false
      );
      
      if (useDiscussion) {
        // Ask for discussion file path
        result.discussionFile = await askQuestion(
          'Enter discussion file path: ',
          'prd/discussion.txt'
        );
        
        // Verify discussion file exists
        if (!fs.existsSync(result.discussionFile)) {
          console.log(chalk.yellow(`Warning: Discussion file not found: ${result.discussionFile}`));
          
          // Ask if they want to create a discussion first
          const createDiscussion = await askConfirmation(
            'Generate a round table discussion first? ',
            true
          );
          
          if (createDiscussion) {
            // Ask for participants
            console.log(chalk.yellow('\nLet\'s define the participants for the round table:'));
            
            const suggestedParticipants = [
              'Product Manager',
              'Software Engineer',
              'UX Designer',
              'QA Engineer',
              'Marketing Specialist',
              'Customer Support Lead'
            ];
            
            console.log(chalk.yellow('Suggested participants:'));
            console.log(suggestedParticipants.map(p => chalk.white(` - ${p}`)).join('\n'));
            
            const participantsInput = await askQuestion(
              'Enter comma-separated list of participants: ',
              'Product Manager, Software Engineer, UX Designer'
            );
            
            const participants = participantsInput.split(',').map(p => p.trim());
            
            // Import round table command dynamically
            const { simulateRoundTable } = await import('./round-table-command.js');
            
            // Run round table
            const rtResult = await simulateRoundTable(
              result.conceptFile, 
              participants, 
              result.discussionFile,
              false
            );
            
            // Set discussion content
            discussionContent = fs.readFileSync(result.discussionFile, 'utf8');
            
          } else {
            // Clear discussion file path if not found and not created
            result.discussionFile = '';
          }
        } else {
          // Load discussion content
          discussionContent = fs.readFileSync(result.discussionFile, 'utf8');
        }
      }
    }
    
    // Step 4: Get custom prompt using structured questions
    if (options.prompt) {
      result.prompt = options.prompt;
      
      // Show real-time feedback on the provided prompt
      if (!options.quiet && !skipFeedback) {
        refinementFeedback.provideRefinementFeedback(conceptContent, result.prompt);
      }
    } else {
      // If no prompt was provided, offer structured refinement questions
      const useStructuredPrompt = await askConfirmation(
        'Would you like guided refinement with structured questions? ',
        true
      );
      
      if (useStructuredPrompt) {
        // Analyze the concept to suggest a starting category
        const conceptType = detectConceptType(conceptContent);
        const weakAreas = detectWeakAreas(conceptContent);
        
        // Show categories for refinement
        console.log(chalk.yellow('\nRefinement Categories:'));
        refinementQuestions.refinementCategories.forEach((category, index) => {
          console.log(chalk.white(`${index + 1}. ${category.name} - ${category.description}`));
        });
        
        // Suggest a category based on content analysis
        let suggestedCategoryIndex = 0;
        if (weakAreas.length > 0) {
          // Map the weak area to a category
          const areaToCategory = {
            'technical': 'technical',
            'market': 'market',
            'user': 'user_experience',
            'features': 'features'
          };
          
          const suggestedCategoryId = areaToCategory[weakAreas[0]];
          suggestedCategoryIndex = refinementQuestions.refinementCategories.findIndex(c => c.id === suggestedCategoryId);
          
          if (suggestedCategoryIndex < 0) suggestedCategoryIndex = 0;
        }
        
        // Allow user to select a category
        const selectedCategoryIndex = await askQuestion(
          `Select a refinement category (1-${refinementQuestions.refinementCategories.length}): `,
          String(suggestedCategoryIndex + 1)
        );
        
        const categoryIndex = parseInt(selectedCategoryIndex, 10) - 1;
        if (categoryIndex >= 0 && categoryIndex < refinementQuestions.refinementCategories.length) {
          const selectedCategory = refinementQuestions.refinementCategories[categoryIndex];
          
          console.log(chalk.yellow(`\nSelected Category: ${selectedCategory.name}`));
          
          // If it's a custom prompt, ask directly
          if (selectedCategory.id === 'custom') {
            const customQuestion = selectedCategory.questions[0];
            console.log(chalk.white(`\n${customQuestion.text}`));
            
            // Generate a suggested prompt based on concept analysis
            const suggestedPrompt = refinementQuestions.generateSuggestedPrompt(conceptContent);
            
            result.prompt = await askQuestion(
              'Enter your custom refinement prompt: ',
              suggestedPrompt
            );
          } else {
            // Show questions for the selected category
            console.log(chalk.yellow('\nRefinement Questions:'));
            selectedCategory.questions.forEach((question, qIndex) => {
              console.log(chalk.white(`${qIndex + 1}. ${question.text}`));
            });
            
            // Allow user to select a question
            const selectedQuestionIndex = await askQuestion(
              `Select a question (1-${selectedCategory.questions.length}): `,
              '1'
            );
            
            const qIndex = parseInt(selectedQuestionIndex, 10) - 1;
            if (qIndex >= 0 && qIndex < selectedCategory.questions.length) {
              const selectedQuestion = selectedCategory.questions[qIndex];
              result.prompt = selectedQuestion.defaultPrompt;
              
              // Allow customization of the prompt
              const customizePrompt = await askConfirmation(
                `Use the default prompt: "${result.prompt}"? `,
                true
              );
              
              if (!customizePrompt) {
                result.prompt = await askQuestion(
                  'Enter your custom refinement prompt: ',
                  result.prompt
                );
              }
            }
          }
        }
      } else {
        // Basic prompt without structured guidance
        const promptExamples = [
          'Focus on the technical feasibility of the features',
          'Enhance the user experience aspects',
          'Improve the security considerations',
          'Add more details about scalability'
        ];
        
        console.log(chalk.yellow('\nPrompt examples:'));
        console.log(promptExamples.map(ex => chalk.white(` - ${ex}`)).join('\n'));
        
        // Generate a suggested prompt based on concept analysis
        const suggestedPrompt = refinementQuestions.generateSuggestedPrompt(conceptContent);
        
        // Get prompt from user
        result.prompt = await askQuestion(
          'Enter refinement prompt: ',
          suggestedPrompt
        );
        
        // Show real-time feedback on the entered prompt
        refinementFeedback.provideRefinementFeedback(conceptContent, result.prompt);
        
        // Allow user to refine the prompt based on feedback
        const refinePrompt = await askConfirmation(
          'Would you like to refine your prompt based on the feedback? ',
          false
        );
        
        if (refinePrompt) {
          // Get updated prompt
          result.prompt = await askQuestion(
            'Enter refined prompt: ',
            result.prompt
          );
          
          // Show updated feedback
          refinementFeedback.provideRefinementFeedback(conceptContent, result.prompt);
        }
      }
    }
    
    // Ensure we have at least one input source
    if (!result.prompt && !result.discussionFile) {
      // If neither prompt nor discussion file, ask for a basic prompt
      result.prompt = await askQuestion(
        'Enter a basic refinement prompt (required): ',
        'Improve and enhance the concept with more details'
      );
      
      // Show real-time feedback on the basic prompt
      refinementFeedback.provideRefinementFeedback(conceptContent, result.prompt);
    }
    
    // Step 5: Confirm settings before proceeding
    console.log(chalk.yellow('\nConcept refinement settings:'));
    console.log(chalk.white(`Concept file: ${result.conceptFile}`));
    console.log(chalk.white(`Output file: ${result.outputFile}`));
    if (result.discussionFile) {
      console.log(chalk.white(`Discussion file: ${result.discussionFile}`));
    }
    if (result.prompt) {
      console.log(chalk.white(`Refinement prompt: ${result.prompt}`));
    }
    
    const proceed = await askConfirmation('Proceed with these settings? ', true);
    if (!proceed) {
      throw new Error('Concept refinement cancelled by user');
    }
    
    // Step 6: Run the refinement
    if (display) {
      display.log('info', 'Generating concept refinement...');
    } else {
      console.log(chalk.blue('\nGenerating concept refinement...'));
    }
    
    // Make sure output directory exists
    const outputDir = path.dirname(result.outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      log('info', `Created directory: ${outputDir}`);
    }
    
    // Generate the refined concept
    const refinedContent = await generateConceptRefinement(
      conceptContent, 
      result.prompt, 
      discussionContent
    );
    
    // Show preview of changes if enabled
    let applyChanges = true;
    if (showPreview) {
      applyChanges = await showChangePreview(conceptContent, refinedContent);
    }
    
    if (applyChanges) {
      // Save the refined concept to file
      fs.writeFileSync(result.outputFile, refinedContent, 'utf8');
      result.hasRefinement = true;
      
      // Save a version of the refined content
      if (trackHistory) {
        const refinedVersionPath = saveConceptVersion(
          result.outputFile, 
          refinedContent, 
          `Refinement with prompt: ${result.prompt}`
        );
        
        if (refinedVersionPath) {
          console.log(chalk.blue(`Refined version saved to: ${refinedVersionPath}`));
        }
      }
      
      // Show a quick comparison of the original and refined concept
      const showComparison = !skipFeedback && await askConfirmation(
        'Would you like to see a summary of changes? ',
        true
      );
      
      if (showComparison) {
        displayRefinementChanges(conceptContent, refinedContent);
      }
      
      // Save responses for future reference
      await saveQuestionResponses('refine-concept', sessionId, {
        conceptFile: result.conceptFile,
        outputFile: result.outputFile,
        discussionFile: result.discussionFile,
        prompt: result.prompt
      });
      
      // Save the concept for future reference
      await saveConceptResponse(result.conceptId, {
        title: extractConceptTitle(refinedContent),
        content: refinedContent,
        sourceFile: result.outputFile,
        refinedFrom: result.conceptFile,
        discussionFile: result.discussionFile,
        prompt: result.prompt
      });
    } else {
      console.log(chalk.yellow('\nRefinement cancelled. No changes were applied.'));
      result.hasRefinement = false;
    }
    
    // Return the result
    return {
      ...result,
      refinedContent: applyChanges ? refinedContent : null
    };
  } catch (error) {
    log('error', `Error in interactiveRefineConcept: ${error.message}`);
    throw error;
  }
}

/**
 * Display a summary of changes between original and refined concept
 * @param {string} originalContent - Original concept content
 * @param {string} refinedContent - Refined concept content
 */
function displayRefinementChanges(originalContent, refinedContent) {
  try {
    console.log(chalk.cyan('\n=== Refinement Changes Summary ==='));
    
    // Basic metrics
    const originalLines = originalContent.split('\n').length;
    const refinedLines = refinedContent.split('\n').length;
    const originalWords = originalContent.split(/\s+/).filter(Boolean).length;
    const refinedWords = refinedContent.split(/\s+/).filter(Boolean).length;
    
    // Calculate differences
    const linesDiff = refinedLines - originalLines;
    const wordsDiff = refinedWords - originalWords;
    
    // Display metrics
    console.log(chalk.white(`\nContent size:`));
    console.log(chalk.white(`  Original: ${originalLines} lines, ${originalWords} words`));
    console.log(chalk.white(`  Refined:  ${refinedLines} lines, ${refinedWords} words`));
    console.log(chalk.white(`  Changes:  ${linesDiff > 0 ? '+' : ''}${linesDiff} lines, ${wordsDiff > 0 ? '+' : ''}${wordsDiff} words`));
    
    // Detect section changes
    const originalSections = extractSections(originalContent);
    const refinedSections = extractSections(refinedContent);
    
    console.log(chalk.white(`\nSection changes:`));
    
    // Find new sections
    const newSections = refinedSections.filter(section => 
      !originalSections.includes(section)
    );
    
    if (newSections.length > 0) {
      console.log(chalk.green(`  Added sections (${newSections.length}):`));
      newSections.forEach(section => {
        console.log(chalk.green(`    + ${section}`));
      });
    }
    
    // Find removed sections
    const removedSections = originalSections.filter(section => 
      !refinedSections.includes(section)
    );
    
    if (removedSections.length > 0) {
      console.log(chalk.red(`  Removed sections (${removedSections.length}):`));
      removedSections.forEach(section => {
        console.log(chalk.red(`    - ${section}`));
      });
    }
    
    // Find common sections
    const commonSections = originalSections.filter(section => 
      refinedSections.includes(section)
    );
    
    console.log(chalk.blue(`  Existing sections (${commonSections.length}):`));
    commonSections.forEach(section => {
      console.log(chalk.blue(`    • ${section}`));
    });
    
    console.log(chalk.cyan('\n=== End of Summary ===\n'));
  } catch (error) {
    log('warn', `Error displaying refinement changes: ${error.message}`);
    // Don't throw - this is a non-critical feature
  }
}

/**
 * Extract section headings from content
 * @param {string} content - Content to extract sections from
 * @returns {string[]} Array of section headings
 */
function extractSections(content) {
  const sections = [];
  const sectionRegex = /^#+\s+(.+?)$/gm;
  let match;
  
  while ((match = sectionRegex.exec(content)) !== null) {
    sections.push(match[1].trim());
  }
  
  return sections;
}

/**
 * Detect the type of concept based on content
 * @param {string} content - Concept content
 * @returns {string} Detected concept type
 */
function detectConceptType(content) {
  // Delegate to refinement-questions module
  try {
    return refinementQuestions.detectConceptType ? 
      refinementQuestions.detectConceptType(content) : 
      'software';
  } catch (error) {
    log('warn', `Error detecting concept type: ${error.message}`);
    return 'software';
  }
}

/**
 * Detect weak areas in the concept
 * @param {string} content - Concept content
 * @returns {string[]} List of weak areas
 */
function detectWeakAreas(content) {
  // Delegate to refinement-questions module
  try {
    return refinementQuestions.detectWeakAreas ? 
      refinementQuestions.detectWeakAreas(content) : 
      [];
  } catch (error) {
    log('warn', `Error detecting weak areas: ${error.message}`);
    return [];
  }
}

/**
 * Legacy refine concept command implementation for compatibility
 * @param {string} conceptFile - Path to concept file
 * @param {string} prompt - Custom refinement prompt
 * @param {string} discussionFile - Path to discussion file
 * @param {string} outputFile - Path to save the refined concept
 * @returns {Promise<object>} - Result of the operation
 */
export async function refineProductConcept(conceptFile, prompt, discussionFile, outputFile) {
  try {
    log('info', `Refining product concept from ${conceptFile}`);
    
    // Generate a session ID
    const sessionId = generateSessionId();
    const conceptId = `concept_${Date.now()}`;
    
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
    
    // Read the concept
    const conceptContent = fs.readFileSync(conceptFile, 'utf8');
    
    // Read discussion if provided
    let discussionContent = '';
    if (discussionFile && discussionFile.trim().length > 0) {
      if (fs.existsSync(discussionFile)) {
        discussionContent = fs.readFileSync(discussionFile, 'utf8');
        log('info', `Loaded discussion from ${discussionFile}`);
      } else {
        log('warn', `Discussion file not found: ${discussionFile}`);
      }
    }
    
    // Generate the refined concept
    const refinedContent = await generateConceptRefinement(conceptContent, prompt, discussionContent);
    
    // Write to file
    fs.writeFileSync(outputFile, refinedContent, 'utf8');
    log('info', `Successfully saved refined concept to ${outputFile}`);
    
    // Save responses for future reference
    await saveQuestionResponses('refine-concept', sessionId, {
      conceptFile,
      outputFile,
      discussionFile,
      prompt
    });
    
    // Save the concept for future reference
    await saveConceptResponse(conceptId, {
      title: extractConceptTitle(refinedContent),
      content: refinedContent,
      sourceFile: outputFile,
      refinedFrom: conceptFile,
      discussionFile,
      prompt
    });
    
    // Display success message
    console.log(chalk.green(`\nRefined concept generated and saved to ${outputFile}`));
    console.log(chalk.blue('\nNext steps:'));
    console.log(chalk.white(`1. Review the refined concept in ${outputFile}`));
    console.log(chalk.white(`2. Run 'task-master generate-prd-file --concept-file=${outputFile}' to create a PRD`));
    
    // Return result
    return {
      sessionId,
      conceptId,
      conceptFile,
      outputFile,
      discussionFile,
      prompt,
      hasRefinement: true,
      refinedContent
    };
  } catch (error) {
    log('error', `Error in refineProductConcept: ${error.message}`);
    throw error;
  }
}

/**
 * Helper function to extract title from concept content
 * @param {string} content - Concept content
 * @returns {string} - Extracted title or default title
 */
function extractConceptTitle(content) {
  try {
    // Look for a heading at the beginning of the content
    const titleMatch = content.match(/^#\s+(.+?)(\r?\n|$)/);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim();
    }
    
    // Try to find any heading if not at the beginning
    const anyTitleMatch = content.match(/^#+\s+(.+?)(\r?\n|$)/m);
    if (anyTitleMatch && anyTitleMatch[1]) {
      return anyTitleMatch[1].trim();
    }
    
    // Default title if no matching pattern found
    return 'Refined Product Concept';
  } catch (error) {
    log('warn', `Error extracting concept title: ${error.message}`);
    return 'Refined Product Concept';
  }
}

export default {
  interactiveRefineConcept,
  refineProductConcept
}; 