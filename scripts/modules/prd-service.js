/**
 * PRD Service
 * 
 * Service for generating Product Requirements Documents from concepts
 */

import { ServiceInterface } from './interfaces/service-interface.js';
import { createLogger } from './logger.js';
import errorHandler, { ERROR_CATEGORIES } from './error-handler.js';
import { PRD } from './models/prd.js';
// Attempt to import the Anthropic client
import { Anthropic } from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import ora from 'ora';

dotenv.config(); // Ensure env variables are loaded

// Create logger for this module
const logger = createLogger('PRDService');

/**
 * PRD Service for generating Product Requirements Documents
 */
export class PRDService extends ServiceInterface {
  /**
   * Create a new PRD service instance
   * @param {object} deps - Service dependencies (aiProvider, storageProvider, exportProvider - optional)
   * @param {object} config - Service configuration
   */
  constructor(deps = {}, config = {}) {
    // Modify super call if ServiceInterface constructor expects different args now
    super(deps, config); 

    // Initialize AI provider internally if not provided in deps
    this.aiProvider = deps.aiProvider || this._initializeAIProvider();
    // Keep storage and export providers if passed, otherwise null
    this.storageProvider = deps.storageProvider || null;
    this.exportProvider = deps.exportProvider || null;
    // Assign deps for potential use in methods (original code used this.deps)
    this.deps = { 
        aiProvider: this.aiProvider,
        storageProvider: this.storageProvider,
        exportProvider: this.exportProvider
    };
    
    if (!this.aiProvider) {
      throw new Error('AI Provider could not be initialized. Check ANTHROPIC_API_KEY environment variable.');
    }
    
    this.defaultSections = [
      'executive_summary',
      'problem_statement',
      'goals',
      'personas',
      'features',
      'technical',
      'ux',
      'metrics',
      'timeline'
    ];
    
    this.defaultOptions = {
      format: 'markdown',
      style: 'standard',
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 8000,
      model: config.model || process.env.MODEL || 'claude-3-7-sonnet-20250219'
    };
    this.initialized = false; // Will be set by initialize method
  }
  
  /**
   * Initializes the default AI provider (Anthropic)
   * @private
   */
   _initializeAIProvider() {
    if (!process.env.ANTHROPIC_API_KEY) {
        console.warn('ANTHROPIC_API_KEY not found in environment variables.');
        return null;
    }
    return new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
        defaultHeaders: {
            'anthropic-beta': 'output-128k-2025-02-19' // Example header, adjust if needed
        }
    });
    // Placeholder for the actual methods needed 
  }

  /**
   * Initialize the service and validate dependencies
   * (Modified: No longer validates deps explicitly, relies on constructor injection or internal init)
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    logger.debug('Initializing PRD service');
    // Dependencies are now handled in constructor
    // Consider adding checks here if aiProvider is valid
    if (!this.aiProvider) {
         throw errorHandler.create('AI Provider failed to initialize', {
            message: 'Failed to initialize PRD service',
            category: ERROR_CATEGORIES.SERVICE,
            suggestion: 'Check ANTHROPIC_API_KEY env variable.'
          });
    }
    // TODO: Add initialization logic for storage/export providers if they require it
    this.initialized = true;
    logger.info('PRD service initialized successfully');
  }

  /**
   * Ensure the service is initialized
   * @private
   */
  _ensureInitialized() {
    if (!this.initialized) {
      throw errorHandler.create('PRD Service not initialized', {
        name: 'ServiceNotInitializedError',
        code: 'ERR_SERVICE_NOT_INITIALIZED',
        category: ERROR_CATEGORIES.SERVICE,
        suggestion: 'Call initialize() before using the service'
      });
    }
  }

  /**
   * Generate a PRD from a concept
   * @param {string|object} concept - Concept to generate PRD from
   * @param {object} options - Generation options
   * @returns {Promise<PRD>} - Generated PRD
   */
  async generatePRD(concept, options = {}) {
    // Ensure initialized might not be needed if constructor guarantees init
    // or call initialize() here if not done elsewhere
    await this.initialize(); // Ensure initialization before use
    this._ensureInitialized();
    
    try {
      logger.debug('Generating PRD from concept');
      
      const conceptContent = typeof concept === 'string' ? concept : concept.content;
      const conceptId = typeof concept === 'object' ? concept.id : null;
      
      if (!conceptContent || !conceptContent.trim()) {
        throw errorHandler.createValidationError('Concept content is required', {
          suggestion: 'Provide a non-empty concept description'
        });
      }
      
      const mergedOptions = {
        ...this.defaultOptions,
        ...options,
        sections: options.sections || this.defaultSections
      };
      
      const prdContent = await this._generatePRDContent(conceptContent, mergedOptions);
      
      const prd = new PRD(
        this._extractTitle(prdContent, conceptContent),
        prdContent,
        {
            format: mergedOptions.format,
            sections: mergedOptions.sections,
            conceptId: conceptId, 
            metadata: {
              generatedAt: new Date().toISOString(),
              model: mergedOptions.model,
              options: mergedOptions
            }
        }
      );
      
      // Store PRD if storage provider is available
      if (this.storageProvider && options.save !== false) {
        // TODO: Ensure storageProvider interface matches
        await this.storageProvider.savePRD(prd.toObject()); // Save plain object
      }
      
      return prd;
    } catch (error) {
      const enhancedError = errorHandler.handle(error, {
        message: 'Error generating PRD',
        category: ERROR_CATEGORIES.SERVICE,
        code: 'ERR_PRD_GENERATION_FAILED'
      });
      throw enhancedError;
    }
  }

  /**
   * Generate PRD content using AI provider
   * @param {string} conceptContent - Concept content
   * @param {object} options - Generation options
   * @returns {Promise<string>} - Generated PRD content
   * @private
   */
  async _generatePRDContent(conceptContent, options) {
    // Build formatting instructions based on format
    let formatInstructions = '';
    if (options.format === 'markdown') {
      formatInstructions = 'Format the PRD using Markdown. Use headers, lists, tables, and emphasis appropriately.';
    } else if (options.format === 'html') {
      formatInstructions = 'Format the PRD using HTML. Use proper tags for structure, lists, tables, and emphasis.';
    } else {
      formatInstructions = 'Format the PRD as plain text with clear headings and structure.';
    }
    
    // Build style instructions
    let styleInstructions = '';
    if (options.style === 'detailed') {
      styleInstructions = 'Make the PRD comprehensive with detailed explanations and examples for each section.';
    } else if (options.style === 'minimal') {
      styleInstructions = 'Make the PRD concise and to the point, focusing only on critical information.';
    } else {
      styleInstructions = 'Balance detail and conciseness, focusing on clarity and actionability.';
    }
    
    // Format section names for prompt
    const sectionsList = options.sections.map(s => {
      switch (s) {
        case 'executive_summary': return 'Executive Summary';
        case 'problem_statement': return 'Problem Statement';
        case 'goals': return 'Product Goals';
        case 'personas': return 'User Personas';
        case 'features': return 'Feature Specifications';
        case 'technical': return 'Technical Requirements';
        case 'ux': return 'UI/UX Considerations';
        case 'metrics': return 'Success Metrics';
        case 'timeline': return 'Timeline & Milestones';
        case 'risks': return 'Risks & Mitigations';
        default: return s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
    }).join(', ');
    
    // Create system prompt
    const systemPrompt = `You are an AI assistant specialized in creating comprehensive Product Requirements Documents (PRDs).
Based on the provided product concept, create a detailed PRD that would guide a product team.
Include the following sections: ${sectionsList}.
${formatInstructions}
${styleInstructions}
The PRD should be structured, comprehensive, and actionable.`;
    
    // Create user prompt
    const prompt = options.templateContent ? 
      `Product Concept:\n\n${conceptContent}\n\nTemplate to follow:\n\n${options.templateContent}\n\nPlease generate a PRD based on this concept and template.` :
      `Product Concept:\n\n${conceptContent}\n\nPlease generate a comprehensive PRD based on this concept.`;
    
    logger.debug('Calling AI provider to generate PRD content');

    // --- ADAPTATION NEEDED --- 
    // Original code used `this.deps.aiProvider.generateCompletion` or `streamCompletion`
    // We need to use `this.aiProvider.messages.create`
    
    // For simplicity, using non-streaming for now
    try {
        const response = await this.aiProvider.messages.create({
            model: options.model,
            max_tokens: options.maxTokens,
            temperature: options.temperature,
            system: systemPrompt,
            messages: [{ role: 'user', content: prompt }]
        });
        return response.content[0].text;
    } catch (aiError) {
        console.error("Error calling AI for PRD generation:", aiError);
        // Use the imported errorHandler
        throw errorHandler.handle(aiError, {
            message: 'AI interaction failed during PRD generation',
            category: ERROR_CATEGORIES.API, 
            code: 'ERR_AI_PRD_GENERATION'
        });
    }
    // --- END ADAPTATION --- 
  }

  /**
   * Extract title from PRD content or concept
   * @param {string} prdContent - Generated PRD content
   * @param {string} conceptContent - Source concept content
   * @returns {string} - Extracted title
   * @private
   */
  _extractTitle(prdContent, conceptContent) {
    // Attempt to extract from PRD using common patterns
    const prdTitleMatch = prdContent.match(/^#\s+(.*)$/m) || 
                          prdContent.match(/^Title:\s*(.*)$/im);
    if (prdTitleMatch && prdTitleMatch[1]) {
      return prdTitleMatch[1].trim();
    }
    
    // Attempt to extract from concept title
    const conceptTitleMatch = conceptContent.match(/^#\s+(.*)$/m);
    if (conceptTitleMatch && conceptTitleMatch[1]) {
      return `PRD: ${conceptTitleMatch[1].trim()}`;
    }
    
    // Fallback title
    return 'Generated PRD';
  }

  /**
   * Export PRD to a specific format
   * @param {PRD} prd - The PRD to export
   * @param {string} format - The desired format (markdown, html, pdf, docx)
   * @param {object} options - Export options
   * @returns {Promise<string|Buffer>} - Exported content or file path
   */
  async exportPRD(prd, format, options = {}) {
    await this.initialize();
    this._ensureInitialized();
    
    if (!this.exportProvider) {
      throw errorHandler.create('Export provider not configured', {
        name: 'DependencyMissingError',
        code: 'ERR_EXPORT_PROVIDER_MISSING',
        category: ERROR_CATEGORIES.SERVICE,
        suggestion: 'Export functionality is not available without an export provider.'
      });
    }
    
    logger.debug(`Exporting PRD ${prd.id} to ${format}`);
    // TODO: Ensure exportProvider interface matches
    return await this.exportProvider.exportDocument(prd, format, options);
  }

  /**
   * Get the list of supported export formats
   * @returns {Promise<Array<string>>}
   */
  getSupportedExportFormats() {
    if (this.exportProvider) {
       // TODO: Ensure exportProvider interface matches
      return this.exportProvider.getSupportedFormats();
    }
    return [];
  }

  /**
   * Cleanup service resources
   */
  async cleanup() {
    logger.debug('Cleaning up PRD service');
    this.initialized = false;
    // TODO: Add cleanup for storage/export providers if needed
  }

  /**
   * Refine a product concept using AI based on additional inputs.
   * @param {string} conceptContent - Original product concept content.
   * @param {string} [prompt] - Custom refinement prompt.
   * @param {string} [discussionContent] - Expert discussion content.
   * @param {object} [options] - Additional options (e.g., model, temperature).
   * @returns {Promise<string>} Refined product concept content.
   */
  async refineConceptWithAI(conceptContent, prompt = null, discussionContent = null, options = {}) {
    await this.initialize(); // Ensure AI provider is ready
    this._ensureInitialized();
    logger.debug('Refining product concept with AI input...');

    const spinner = ora('Refining concept...').start();
    let responseText = '';

    try {
        // Determine what inputs we're using
        const usingPrompt = prompt && prompt.trim().length > 0;
        const usingDiscussion = discussionContent && discussionContent.trim().length > 0;

        // Tailor the system prompt based on available inputs
        let systemPromptText = `You are a product strategy expert helping to refine a product concept.
Your task is to improve and enhance an existing product concept`;
        if (usingPrompt && usingDiscussion) {
          systemPromptText += ` based on both a custom refinement prompt and insights from an expert discussion.`;
        } else if (usingPrompt) {
          systemPromptText += ` based on a custom refinement prompt.`;
        } else if (usingDiscussion) {
          systemPromptText += ` based on insights from an expert discussion.`;
        } else {
          // Default refinement if no specific input provided (can be enhanced)
          systemPromptText += ` by identifying potential weaknesses, clarifying ambiguities, and suggesting enhancements based on best practices.`;
        }
        systemPromptText += `\n\nYour refined concept should:
1. Maintain the overall structure and purpose of the original concept.
2. Address identified weaknesses or gaps.
3. Incorporate suggested improvements logically.
4. Add detail or clarity where beneficial.
5. Ensure coherence and consistency throughout.
The output should be the complete, revised version of the concept, preserving the original formatting structure (like Markdown headings/bullets) where appropriate.`;

        // Build user message based on available inputs
        let userContent = `Here's the original product concept to refine:\n\n---
${conceptContent}\n---\n`;
        if (usingPrompt) {
          userContent += `\nPlease apply the following refinement prompt:\n${prompt}\n`;
        }
        if (usingDiscussion) {
          userContent += `\nPlease consider these insights from an expert discussion:\n${discussionContent}\n`;
        }
        userContent += `\nProvide the complete refined version of the concept incorporating the required improvements.`;

        // Determine AI model and temperature
        const model = options.model || this.defaultOptions.model;
        const temperature = options.temperature || 0.6; // Balanced temp for refinement
        const maxTokens = options.maxTokens || this.defaultOptions.maxTokens;

        // Call the AI provider
        const response = await this.aiProvider.messages.create({
            model: model,
            max_tokens: maxTokens,
            temperature: temperature,
            system: systemPromptText,
            messages: [
              {
                role: 'user',
                content: userContent
              }
            ],
            // Streaming could be added here if needed
        });

        responseText = response.content[0].text;
        spinner.succeed('Concept refined successfully!');
        return responseText;

    } catch (aiError) {
        spinner.fail('Concept refinement failed.');
        throw errorHandler.handle(aiError, {
            message: 'AI interaction failed during concept refinement',
            category: ERROR_CATEGORIES.API,
            code: 'ERR_AI_REFINE_CONCEPT'
        });
    }
  }
} 