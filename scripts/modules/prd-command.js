/**
 * PRD Generator - PRD command module
 * 
 * Copyright (c) 2025 Zyra-V23
 * All rights reserved.
 * 
 * This file is part of the PRD Generator functionality and is subject to the
 * terms of the modified MIT License with Commercial Use Restrictions.
 * Commercial use, redistribution, or creation of derivative works for commercial
 * purposes requires explicit written permission from the copyright holder.
 * 
 * For licensing inquiries, contact Zyra.
 */

/**
 * PRD command module for Task Master CLI
 * Provides interactive PRD generation functionality
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { log } from './logger.js';
import { fileExists } from './utils.js';
import { generatePRDPreview } from './ai-services.js';

/**
 * Available PRD output formats
 */
const PRD_FORMATS = {
  MARKDOWN: 'markdown',
  PLAIN: 'plaintext',
  HTML: 'html'
};

/**
 * PRD style options
 */
const PRD_STYLES = {
  STANDARD: 'standard',
  DETAILED: 'detailed',
  MINIMAL: 'minimal'
};

/**
 * Default PRD sections
 */
const DEFAULT_PRD_SECTIONS = [
  { name: 'Executive Summary', value: 'executive_summary', checked: true },
  { name: 'Problem Statement', value: 'problem_statement', checked: true },
  { name: 'Product Goals', value: 'goals', checked: true },
  { name: 'User Personas', value: 'personas', checked: true },
  { name: 'Ideal Customer Profile', value: 'icp', checked: true },
  { name: 'Feature Specifications', value: 'features', checked: true },
  { name: 'Technical Requirements', value: 'technical', checked: true },
  { name: 'UI/UX Considerations', value: 'ux', checked: true },
  { name: 'Success Metrics & KPIs', value: 'metrics', checked: true },
  { name: 'Timeline & Milestones', value: 'timeline', checked: true },
  { name: 'Risks & Mitigations', value: 'risks', checked: true }
];

/**
 * Interactive PRD generation command implementation
 * @param {object} options - Command options
 * @returns {Promise<object>} - Result of the operation
 */
export async function interactivePRDGeneration(options) {
  try {
    // Set default values
    const defaults = {
      conceptFile: options.conceptFile || 'prd/concept.txt',
      outputFile: options.output || 'prd/prd.txt',
      templateFile: options.template || '',
      useResearch: options.research || false,
      format: PRD_FORMATS.MARKDOWN,
      style: PRD_STYLES.STANDARD,
      sections: DEFAULT_PRD_SECTIONS.filter(section => section.checked).map(section => section.value)
    };

    // Initial questions to fill in missing information
    const initialQuestions = [];

    // Check if concept file exists
    const conceptFileExists = await fileExists(defaults.conceptFile);
    if (!conceptFileExists) {
      initialQuestions.push({
        type: 'input',
        name: 'conceptFile',
        message: 'Enter the path to your concept file:',
        default: defaults.conceptFile,
        validate: async (input) => {
          if (!input) return 'Please enter a valid file path';
          const exists = await fileExists(input);
          return exists ? true : 'File does not exist. Please enter a valid file path.';
        }
      });
    }

    // Ask where to save the PRD
    initialQuestions.push({
      type: 'input',
      name: 'outputFile',
      message: 'Where should the PRD be saved?',
      default: defaults.outputFile
    });

    // Ask about template usage
    initialQuestions.push({
      type: 'confirm',
      name: 'useTemplate',
      message: 'Would you like to use a PRD template?',
      default: !!defaults.templateFile
    });

    // Set up research question
    initialQuestions.push({
      type: 'confirm',
      name: 'useResearch',
      message: 'Use Perplexity AI for research-backed PRD generation?',
      default: defaults.useResearch
    });

    // Get answers for initial questions
    const answers = await inquirer.prompt(initialQuestions);

    // If user wants to use a template, ask for the template file
    if (answers.useTemplate) {
      const templateQuestion = {
        type: 'input',
        name: 'templateFile',
        message: 'Enter the path to your template file:',
        default: defaults.templateFile || 'assets/example_prd.txt',
        validate: async (input) => {
          if (!input) return true; // Empty is ok, will use default structure
          const exists = await fileExists(input);
          return exists ? true : 'File does not exist. Please use a valid template path or leave empty.';
        }
      };
      
      const templateAnswer = await inquirer.prompt([templateQuestion]);
      answers.templateFile = templateAnswer.templateFile;
    } else {
      answers.templateFile = '';
    }

    // Ask for PRD format option
    const formatQuestion = await inquirer.prompt([
      {
        type: 'list',
        name: 'format',
        message: 'Select the output format for the PRD:',
        choices: [
          { name: 'Markdown (.md)', value: PRD_FORMATS.MARKDOWN },
          { name: 'Plain Text (.txt)', value: PRD_FORMATS.PLAIN },
          { name: 'HTML (.html)', value: PRD_FORMATS.HTML }
        ],
        default: defaults.format
      }
    ]);
    
    answers.format = formatQuestion.format;
    
    // Adjust file extension based on format if needed
    if (answers.format !== PRD_FORMATS.PLAIN) {
      const outputExt = path.extname(answers.outputFile);
      if (outputExt === '.txt' || outputExt === '') {
        const basePath = outputExt === '' ? answers.outputFile : answers.outputFile.slice(0, -4);
        const newExt = answers.format === PRD_FORMATS.MARKDOWN ? '.md' : '.html';
        answers.outputFile = basePath + newExt;
      }
    }
    
    // Ask for PRD style option
    const styleQuestion = await inquirer.prompt([
      {
        type: 'list',
        name: 'style',
        message: 'Select the detail level for the PRD:',
        choices: [
          { name: 'Standard - Balanced detail for most projects', value: PRD_STYLES.STANDARD },
          { name: 'Detailed - Comprehensive coverage with in-depth analysis', value: PRD_STYLES.DETAILED },
          { name: 'Minimal - Concise overview focusing on key points only', value: PRD_STYLES.MINIMAL }
        ],
        default: defaults.style
      }
    ]);
    
    answers.style = styleQuestion.style;
    
    // Ask which sections to include
    const sectionsQuestion = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'sections',
        message: 'Select which sections to include in the PRD:',
        choices: DEFAULT_PRD_SECTIONS,
        default: defaults.sections,
        validate: (input) => {
          if (input.length === 0) return 'Please select at least one section';
          return true;
        }
      }
    ]);
    
    answers.sections = sectionsQuestion.sections;

    // Ask if they want to provide detailed parameters
    const detailedParamsQuestion = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'collectDetailedParams',
        message: 'Would you like to provide detailed parameters for the PRD?',
        default: true
      }
    ]);

    // Collect detailed parameters if requested
    let detailedParams = {
      format: answers.format,
      style: answers.style,
      sections: answers.sections
    };
    
    if (detailedParamsQuestion.collectDetailedParams) {
      const { collectPRDParameters } = await import('./prd-params.js');
      const contentParams = await collectPRDParameters(answers);
      // Merge the format/style/sections with the content parameters
      detailedParams = { ...detailedParams, ...contentParams };
    }

    // Prepare directory for output file if needed
    const outputDir = path.dirname(answers.outputFile);
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (error) {
      log('warn', `Error creating directory: ${error.message}`);
    }

    // Show summary of options before generating
    console.log(chalk.blue('\nGenerating PRD with the following options:'));
    console.log(chalk.white(`- Concept file: ${answers.conceptFile || defaults.conceptFile}`));
    console.log(chalk.white(`- Output file: ${answers.outputFile}`));
    
    if (answers.templateFile) {
      console.log(chalk.white(`- Template file: ${answers.templateFile}`));
    } else {
      console.log(chalk.white('- Using default PRD structure (no template)'));
    }
    
    console.log(chalk.white(`- Format: ${answers.format}`));
    console.log(chalk.white(`- Style: ${answers.style}`));
    console.log(chalk.white(`- Sections: ${answers.sections.length} selected`));
    console.log(chalk.white(`- Research-backed: ${answers.useResearch ? 'Yes' : 'No'}`));
    console.log(chalk.white(`- Detailed parameters: ${detailedParamsQuestion.collectDetailedParams ? 'Yes' : 'No'}`));

    // Generate PRD preview if the concept file exists
    const conceptFile = answers.conceptFile || defaults.conceptFile;
    try {
      // Ask if they want to see a preview
      const previewQuestion = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'showPreview',
          message: 'Would you like to see a preview of the PRD before generating the full document?',
          default: true
        }
      ]);

      if (previewQuestion.showPreview) {
        console.log(chalk.blue('\nGenerating PRD preview...'));
        
        // Read the concept file
        const fsSync = await import('fs');
        const conceptContent = fsSync.readFileSync(conceptFile, 'utf8');
        
        // Generate preview using the new function
        const previewContent = await generatePRDPreview(
          conceptContent, 
          answers.templateFile, 
          answers.useResearch,
          detailedParams
        );
        
        // Display the preview with a nice box
        const boxen = (await import('boxen')).default;
        
        console.log(chalk.green('\nPRD Preview:'));
        console.log(boxen(previewContent, {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'blue',
          width: 80,
          wrap: {
            wrapWidth: 76,
            trim: true,
            hard: true
          }
        }));
      }
    } catch (error) {
      console.log(chalk.yellow(`\nCouldn't generate preview: ${error.message}`));
      log('warn', `Error generating preview: ${error.message}`);
    }

    // Final confirmation
    const confirmation = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Proceed with generating the full PRD?',
        default: true
      }
    ]);

    if (!confirmation.proceed) {
      console.log(chalk.yellow('PRD generation cancelled.'));
      return { success: false, message: 'Operation cancelled by user' };
    }

    // Return options for PRD generation
    return {
      success: true,
      conceptFile: answers.conceptFile || defaults.conceptFile,
      templateFile: answers.templateFile,
      outputFile: answers.outputFile,
      useResearch: answers.useResearch,
      detailedParams: detailedParams
    };
  } catch (error) {
    log('error', `Error in interactivePRDGeneration: ${error.message}`);
    throw error;
  }
} 